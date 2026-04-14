"""
OptiPlan 360 - Self-Supervised Learning Service
AI-032: Etiketsiz veriden öğrenme ve temsil çıkarımı

Bu modül:
- Contrastive Learning (SimCLR, MoCo)
- Masked Autoencoders (MAE)
- Pretext task learning
- Feature extraction ve transfer learning
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from typing import List, Tuple, Dict, Optional, Callable
from dataclasses import dataclass
import numpy as np
import random
from PIL import Image, ImageOps, ImageFilter
import logging

logger = logging.getLogger(__name__)


@dataclass
class SSLConfig:
    """Self-supervised learning konfigürasyonu"""
    # Model
    backbone: str = "resnet50"  # resnet18, resnet50, efficientnet_b0
    projection_dim: int = 128
    hidden_dim: int = 512
    
    # Training
    batch_size: int = 256
    temperature: float = 0.5  # Contrastive loss temperature
    epochs: int = 100
    lr: float = 0.001
    weight_decay: float = 1e-6
    
    # Augmentation
    image_size: int = 224
    color_jitter_strength: float = 0.5
    
    # Pretext tasks
    pretext_task: str = "contrastive"  # contrastive, mae, rotation


class ContrastiveLearningView:
    """SimCLR tarzı görüntü augmentasyonu"""
    
    def __init__(self, image_size: int = 224, color_jitter: float = 0.5):
        self.image_size = image_size
        self.color_jitter = color_jitter
        
    def __call__(self, image: Image.Image) -> Image.Image:
        """
        SimCLR augmentasyon pipeline:
        1. Rastgele crop
        2. Rastgele flip
        3. Color jitter
        4. Gaussian blur
        5. Grayscale
        """
        # RandomResizedCrop
        image = self._random_resized_crop(image)
        
        # RandomHorizontalFlip
        if random.random() > 0.5:
            image = ImageOps.mirror(image)
        
        # ColorJitter
        if random.random() > 0.5:
            image = self._color_jitter(image)
        
        # GaussianBlur
        if random.random() > 0.5:
            image = image.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.1, 2.0)))
        
        # RandomGrayscale
        if random.random() > 0.2:
            image = ImageOps.grayscale(image).convert('RGB')
        
        return image
    
    def _random_resized_crop(self, image: Image.Image) -> Image.Image:
        """RandomResizedCrop implementasyonu"""
        w, h = image.size
        # Random scale
        scale = random.uniform(0.08, 1.0)
        # Random aspect ratio
        ratio = random.uniform(3./4., 4./3.)
        
        new_h = int(np.sqrt(h * w / ratio * scale))
        new_w = int(np.sqrt(h * w * ratio * scale))
        
        # Random position
        top = random.randint(0, max(0, h - new_h))
        left = random.randint(0, max(0, w - new_w))
        
        # Crop
        image = image.crop((left, top, left + new_w, top + new_h))
        
        # Resize
        image = image.resize((self.image_size, self.image_size), Image.BILINEAR)
        
        return image
    
    def _color_jitter(self, image: Image.Image) -> Image.Image:
        """Color jitter implementasyonu"""
        # Brightness
        factor = random.uniform(0.8, 1.2)
        image = ImageEnhance.Brightness(image).enhance(factor)
        
        # Contrast
        factor = random.uniform(0.8, 1.2)
        image = ImageEnhance.Contrast(image).enhance(factor)
        
        # Saturation
        factor = random.uniform(0.8, 1.2)
        image = ImageEnhance.Color(image).enhance(factor)
        
        return image


from PIL import ImageEnhance


class SimCLRModel(nn.Module):
    """
    SimCLR (Simple Contrastive Learning) modeli.
    
    Architecture:
    - Encoder (ResNet/EfficientNet)
    - Projection Head (MLP)
    """
    
    def __init__(
        self,
        backbone: str = "resnet50",
        projection_dim: int = 128,
        hidden_dim: int = 512
    ):
        super().__init__()
        
        # Backbone
        self.encoder = self._create_encoder(backbone)
        self.feature_dim = self.encoder.output_dim
        
        # Projection head (2-layer MLP)
        self.projection_head = nn.Sequential(
            nn.Linear(self.feature_dim, hidden_dim),
            nn.ReLU(inplace=True),
            nn.Linear(hidden_dim, projection_dim)
        )
    
    def _create_encoder(self, backbone: str) -> nn.Module:
        """Encoder backbone oluştur"""
        if backbone == "resnet18":
            import torchvision.models as models
            base = models.resnet18(pretrained=False)
            output_dim = 512
        elif backbone == "resnet50":
            import torchvision.models as models
            base = models.resnet50(pretrained=False)
            output_dim = 2048
        elif backbone == "efficientnet_b0":
            # EfficientNet implementasyonu
            output_dim = 1280
        else:
            raise ValueError(f"Unknown backbone: {backbone}")
        
        # Son FC layer'ı kaldır
        class EncoderWrapper(nn.Module):
            def __init__(self, base_model, output_dim):
                super().__init__()
                self.features = nn.Sequential(*list(base_model.children())[:-1])
                self.output_dim = output_dim
            
            def forward(self, x):
                x = self.features(x)
                return torch.flatten(x, 1)
        
        return EncoderWrapper(base, output_dim)
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass.
        
        Returns:
            (features, projections)
        """
        features = self.encoder(x)
        projections = self.projection_head(features)
        
        # L2 normalize projections
        projections = F.normalize(projections, dim=1)
        
        return features, projections


class MaskedAutoencoder(nn.Module):
    """
    Masked Autoencoder (MAE) Vision Transformer.
    
    Patch embedding → Mask random patches → Encoder → Decoder → Reconstruct
    """
    
    def __init__(
        self,
        img_size: int = 224,
        patch_size: int = 16,
        in_chans: int = 3,
        embed_dim: int = 768,
        depth: int = 12,
        num_heads: int = 12,
        decoder_embed_dim: int = 512,
        decoder_depth: int = 8,
        mask_ratio: float = 0.75
    ):
        super().__init__()
        
        self.patch_size = patch_size
        self.num_patches = (img_size // patch_size) ** 2
        self.mask_ratio = mask_ratio
        
        # Patch embedding
        self.patch_embed = nn.Conv2d(
            in_chans, embed_dim,
            kernel_size=patch_size, stride=patch_size
        )
        
        # Positional embedding
        self.pos_embed = nn.Parameter(torch.zeros(1, self.num_patches, embed_dim))
        
        # Encoder (Transformer blocks)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=num_heads,
            dim_feedforward=embed_dim * 4, dropout=0.1
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=depth)
        
        # Decoder
        self.decoder_embed = nn.Linear(embed_dim, decoder_embed_dim)
        self.mask_token = nn.Parameter(torch.zeros(1, 1, decoder_embed_dim))
        
        decoder_layer = nn.TransformerEncoderLayer(
            d_model=decoder_embed_dim, nhead=num_heads,
            dim_feedforward=decoder_embed_dim * 4, dropout=0.1
        )
        self.decoder = nn.TransformerEncoder(decoder_layer, num_layers=decoder_depth)
        
        # Reconstruction head
        self.decoder_pred = nn.Linear(decoder_embed_dim, patch_size ** 2 * in_chans)
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass.
        
        Returns:
            (loss, pred, mask)
        """
        # Patch embedding
        x = self.patch_embed(x)  # (B, embed_dim, H/P, W/P)
        x = x.flatten(2).transpose(1, 2)  # (B, num_patches, embed_dim)
        x = x + self.pos_embed
        
        # Random masking
        B, N, D = x.shape
        len_keep = int(N * (1 - self.mask_ratio))
        
        noise = torch.rand(B, N, device=x.device)
        ids_shuffle = torch.argsort(noise, dim=1)
        ids_restore = torch.argsort(ids_shuffle, dim=1)
        
        ids_keep = ids_shuffle[:, :len_keep]
        x_masked = torch.gather(x, dim=1, index=ids_keep.unsqueeze(-1).repeat(1, 1, D))
        
        # Encoder (masked patches only)
        x_masked = x_masked.transpose(0, 1)  # (N, B, D) for transformer
        latent = self.encoder(x_masked)
        latent = latent.transpose(0, 1)  # (B, N_keep, D)
        
        # Decoder
        x_dec = self.decoder_embed(latent)
        
        # Add mask tokens
        mask_tokens = self.mask_token.repeat(B, N - len_keep, 1)
        x_full = torch.cat([x_dec, mask_tokens], dim=1)
        
        # Unshuffle
        x_dec = torch.gather(
            x_full, dim=1,
            index=ids_restore.unsqueeze(-1).repeat(1, 1, x_dec.shape[-1])
        )
        
        # Decode
        x_dec = x_dec.transpose(0, 1)
        decoded = self.decoder(x_dec)
        decoded = decoded.transpose(0, 1)
        
        # Predict
        pred = self.decoder_pred(decoded)
        
        # Loss (MSE on masked patches)
        target = self.patchify(x)
        loss = self.forward_loss(pred, target, mask)
        
        return loss, pred, mask
    
    def patchify(self, imgs: torch.Tensor) -> torch.Tensor:
        """Görüntüyü patch'lere böl"""
        p = self.patch_size
        h = w = imgs.shape[2] // p
        x = imgs.reshape(shape=(imgs.shape[0], 3, h, p, w, p))
        x = torch.einsum('nchpwq->nhwpqc', x)
        x = x.reshape(shape=(imgs.shape[0], h * w, p ** 2 * 3))
        return x
    
    def forward_loss(
        self,
        pred: torch.Tensor,
        target: torch.Tensor,
        mask: torch.Tensor
    ) -> torch.Tensor:
        """MSE loss on masked patches"""
        loss = (pred - target) ** 2
        loss = loss.mean(dim=-1)  # [N, L], mean loss per patch
        loss = (loss * mask).sum() / mask.sum()  # mean loss on removed patches
        return loss


class SelfSupervisedLearningService:
    """
    Self-supervised learning servisi.
    
    Use cases:
    1. OCR modeli için pretraining (büyük etiketsiz veri)
    2. Feature extraction ve similarity search
    3. Transfer learning için backbone training
    """
    
    def __init__(self, config: SSLConfig):
        self.config = config
        self.model = None
        self.optimizer = None
        self.epoch = 0
        
        self.augmentation = ContrastiveLearningView(
            image_size=config.image_size,
            color_jitter=config.color_jitter_strength
        )
    
    def initialize_model(self, device: str = "cuda") -> None:
        """Modeli initialize et"""
        if self.config.pretext_task == "contrastive":
            self.model = SimCLRModel(
                backbone=self.config.backbone,
                projection_dim=self.config.projection_dim,
                hidden_dim=self.config.hidden_dim
            )
        elif self.config.pretext_task == "mae":
            self.model = MaskedAutoencoder(
                img_size=self.config.image_size
            )
        else:
            raise ValueError(f"Unknown pretext task: {self.config.pretext_task}")
        
        self.model = self.model.to(device)
        
        self.optimizer = torch.optim.Adam(
            self.model.parameters(),
            lr=self.config.lr,
            weight_decay=self.config.weight_decay
        )
        
        logger.info(f"Model initialized: {self.config.pretext_task}")
    
    def contrastive_train_step(
        self,
        images: torch.Tensor,
        device: str = "cuda"
    ) -> float:
        """
        Contrastive learning (SimCLR) training step.
        
        Args:
            images: (B, C, H, W) batch görüntü
            
        Returns:
            Loss değeri
        """
        B = images.shape[0]
        
        # Create two views
        view1 = torch.stack([
            self._pil_to_tensor(self.augmentation(self._tensor_to_pil(img)))
            for img in images
        ]).to(device)
        
        view2 = torch.stack([
            self._pil_to_tensor(self.augmentation(self._tensor_to_pil(img)))
            for img in images
        ]).to(device)
        
        # Forward
        _, z1 = self.model(view1)
        _, z2 = self.model(view2)
        
        # Contrastive loss (NT-Xent)
        z = torch.cat([z1, z2], dim=0)  # (2B, D)
        loss = self._nt_xent_loss(z, self.config.temperature)
        
        # Backward
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
        
        return loss.item()
    
    def mae_train_step(
        self,
        images: torch.Tensor,
        device: str = "cuda"
    ) -> float:
        """Masked Autoencoder training step"""
        images = images.to(device)
        
        loss, _, _ = self.model(images)
        
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
        
        return loss.item()
    
    def extract_features(
        self,
        images: torch.Tensor,
        device: str = "cuda",
        normalize: bool = True
    ) -> torch.Tensor:
        """
        Görüntülerden feature çıkar.
        
        Returns:
            (B, feature_dim) features
        """
        self.model.eval()
        images = images.to(device)
        
        with torch.no_grad():
            if self.config.pretext_task == "contrastive":
                features, _ = self.model(images)
            else:
                # MAE için encoder çıktısı
                features = self.model.encoder(images)
            
            if normalize:
                features = F.normalize(features, dim=1)
        
        return features
    
    def find_similar_images(
        self,
        query_features: torch.Tensor,
        database_features: torch.Tensor,
        top_k: int = 5
    ) -> List[Tuple[int, float]]:
        """
        Feature space'te benzer görüntüleri bul.
        
        Returns:
            [(index, similarity_score), ...]
        """
        # Cosine similarity
        similarities = torch.mm(query_features, database_features.t())
        
        # Top-k
        top_scores, top_indices = torch.topk(similarities, k=top_k, dim=1)
        
        results = []
        for idx, score in zip(top_indices[0], top_scores[0]):
            results.append((idx.item(), score.item()))
        
        return results
    
    def save_checkpoint(self, path: str) -> None:
        """Model checkpoint kaydet"""
        torch.save({
            'epoch': self.epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'config': self.config
        }, path)
        logger.info(f"Checkpoint saved: {path}")
    
    def load_checkpoint(self, path: str) -> None:
        """Model checkpoint yükle"""
        checkpoint = torch.load(path)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.epoch = checkpoint['epoch']
        logger.info(f"Checkpoint loaded: {path} (epoch {self.epoch})")
    
    def _nt_xent_loss(self, z: torch.Tensor, temperature: float) -> torch.Tensor:
        """Normalized Temperature-scaled Cross Entropy Loss (NT-Xent)"""
        # z: (2B, D)
        # Compute similarity matrix
        sim_matrix = torch.mm(z, z.t()) / temperature
        
        # Mask out self-similarity
        mask = torch.eye(sim_matrix.shape[0], device=z.device).bool()
        sim_matrix = sim_matrix.masked_fill(mask, -9e15)
        
        # Positive pairs: (i, i+B) and (i+B, i)
        pos_mask = torch.zeros_like(sim_matrix)
        B = z.shape[0] // 2
        for i in range(B):
            pos_mask[i, i + B] = 1
            pos_mask[i + B, i] = 1
        
        # Loss
        sim_matrix = F.softmax(sim_matrix, dim=1)
        loss = -torch.log(sim_matrix[pos_mask.bool()] + 1e-10).mean()
        
        return loss
    
    def _pil_to_tensor(self, pil_img: Image.Image) -> torch.Tensor:
        """PIL Image → Tensor"""
        import torchvision.transforms as transforms
        transform = transforms.ToTensor()
        return transform(pil_img)
    
    def _tensor_to_pil(self, tensor: torch.Tensor) -> Image.Image:
        """Tensor → PIL Image"""
        import torchvision.transforms as transforms
        tensor = tensor.cpu().clamp(0, 1)
        transform = transforms.ToPILImage()
        return transform(tensor)


# Global SSL service
ssl_config = SSLConfig(pretext_task="contrastive")
ssl_service = SelfSupervisedLearningService(ssl_config)
