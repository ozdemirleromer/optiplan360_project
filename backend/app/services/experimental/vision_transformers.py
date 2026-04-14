"""
OptiPlan 360 - Vision Transformers (ViT) Service
AI-051: Vision transformers ve multimodal transformers entegrasyonu

Bu modül:
- Vision Transformer (ViT) implementasyonu
- Multimodal transformers (CLIP, BLIP)
- Image-text alignment
- Zero-shot classification
- Image captioning
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import (
    ViTModel,
    ViTForImageClassification,
    ViTImageProcessor,
    CLIPModel,
    CLIPProcessor,
    BlipProcessor,
    BlipForConditionalGeneration
)
from typing import List, Dict, Tuple, Optional, Union
from dataclasses import dataclass
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)


@dataclass
class ViTConfig:
    """Vision Transformer konfigürasyonu"""
    model_name: str = "google/vit-base-patch16-224"
    image_size: int = 224
    patch_size: int = 16
    num_classes: int = 1000
    hidden_size: int = 768
    num_hidden_layers: int = 12
    num_attention_heads: int = 12
    intermediate_size: int = 3072
    dropout: float = 0.1
    
    # Multimodal
    use_clip: bool = True
    clip_model: str = "openai/clip-vit-base-patch32"
    use_blip: bool = False
    blip_model: str = "Salesforce/blip-image-captioning-base"


class VisionTransformerService:
    """
    Vision Transformer servisi.
    
    Features:
    - Image classification
    - Feature extraction
    - Zero-shot classification (with CLIP)
    - Image captioning (with BLIP)
    """
    
    def __init__(self, config: ViTConfig):
        self.config = config
        self.model = None
        self.processor = None
        self.clip_model = None
        self.clip_processor = None
        self.blip_model = None
        self.blip_processor = None
        self.is_loaded = False
        
    def load_model(self) -> bool:
        """ViT modelini yükle"""
        logger.info(f"ViT yükleniyor: {self.config.model_name}")
        
        try:
            # Processor
            self.processor = ViTImageProcessor.from_pretrained(self.config.model_name)
            
            # Model
            self.model = ViTForImageClassification.from_pretrained(
                self.config.model_name,
                num_labels=self.config.num_classes,
                ignore_mismatched_sizes=True
            )
            
            self.model.eval()
            self.is_loaded = True
            
            logger.info("ViT başarıyla yüklendi")
            return True
            
        except Exception as e:
            logger.error(f"ViT yükleme hatası: {e}")
            return False
    
    def load_clip(self) -> bool:
        """CLIP modelini yükle"""
        if not self.config.use_clip:
            return False
        
        logger.info(f"CLIP yükleniyor: {self.config.clip_model}")
        
        try:
            self.clip_processor = CLIPProcessor.from_pretrained(self.config.clip_model)
            self.clip_model = CLIPModel.from_pretrained(self.config.clip_model)
            self.clip_model.eval()
            
            logger.info("CLIP başarıyla yüklendi")
            return True
            
        except Exception as e:
            logger.error(f"CLIP yükleme hatası: {e}")
            return False
    
    def load_blip(self) -> bool:
        """BLIP modelini yükle"""
        if not self.config.use_blip:
            return False
        
        logger.info(f"BLIP yükleniyor: {self.config.blip_model}")
        
        try:
            self.blip_processor = BlipProcessor.from_pretrained(self.config.blip_model)
            self.blip_model = BlipForConditionalGeneration.from_pretrained(
                self.config.blip_model
            )
            self.blip_model.eval()
            
            logger.info("BLIP başarıyla yüklendi")
            return True
            
        except Exception as e:
            logger.error(f"BLIP yükleme hatası: {e}")
            return False
    
    def classify_image(
        self,
        image: Union[Image.Image, str],
        top_k: int = 5
    ) -> List[Dict]:
        """
        Görüntü sınıflandırma.
        
        Args:
            image: PIL Image veya path
            top_k: Döndürülecek top sınıf sayısı
            
        Returns:
            [{'label': str, 'score': float}, ...]
        """
        if not self.is_loaded:
            raise RuntimeError("Model yüklenmemiş")
        
        # Load image
        if isinstance(image, str):
            image = Image.open(image).convert('RGB')
        
        # Preprocess
        inputs = self.processor(images=image, return_tensors="pt")
        
        # Inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
        
        # Top-k
        probs = F.softmax(logits, dim=-1)
        top_probs, top_indices = torch.topk(probs, k=top_k, dim=-1)
        
        results = []
        for prob, idx in zip(top_probs[0], top_indices[0]):
            label = self.model.config.id2label.get(idx.item(), f"CLASS_{idx.item()}")
            results.append({
                'label': label,
                'score': prob.item()
            })
        
        return results
    
    def extract_features(
        self,
        image: Union[Image.Image, str],
        layer: str = "last_hidden_state"
    ) -> np.ndarray:
        """
        Görüntüden feature çıkar.
        
        Args:
            image: PIL Image veya path
            layer: Hangi layer'dan feature çıkarılacak
            
        Returns:
            Feature vektörü
        """
        if not self.is_loaded:
            raise RuntimeError("Model yüklenmemiş")
        
        # Load image
        if isinstance(image, str):
            image = Image.open(image).convert('RGB')
        
        # Preprocess
        inputs = self.processor(images=image, return_tensors="pt")
        
        # Inference
        with torch.no_grad():
            outputs = self.model.vit(**inputs)
        
        # Extract features
        if layer == "last_hidden_state":
            features = outputs.last_hidden_state[:, 0, :]  # CLS token
        elif layer == "pooler_output":
            features = outputs.pooler_output
        else:
            features = outputs.last_hidden_state.mean(dim=1)  # Mean pooling
        
        return features.cpu().numpy()
    
    def zero_shot_classify(
        self,
        image: Union[Image.Image, str],
        candidate_labels: List[str],
        hypothesis_template: str = "Bu bir {} fotoğrafı."
    ) -> List[Dict]:
        """
        Zero-shot classification with CLIP.
        
        Args:
            image: PIL Image
            candidate_labels: Sınıf adları
            hypothesis_template: Text template
            
        Returns:
            [{'label': str, 'score': float}, ...]
        """
        if self.clip_model is None or self.clip_processor is None:
            raise RuntimeError("CLIP yüklenmemiş")
        
        # Load image
        if isinstance(image, str):
            image = Image.open(image).convert('RGB')
        
        # Prepare text inputs
        texts = [hypothesis_template.format(label) for label in candidate_labels]
        
        # Process
        inputs = self.clip_processor(
            text=texts,
            images=image,
            return_tensors="pt",
            padding=True
        )
        
        # Inference
        with torch.no_grad():
            outputs = self.clip_model(**inputs)
        
        # Compute similarity
        logits_per_image = outputs.logits_per_image
        probs = F.softmax(logits_per_image, dim=1)
        
        # Results
        results = []
        for label, prob in zip(candidate_labels, probs[0]):
            results.append({
                'label': label,
                'score': prob.item()
            })
        
        # Sort by score
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return results
    
    def generate_caption(
        self,
        image: Union[Image.Image, str],
        max_length: int = 50
    ) -> str:
        """
        Görüntü için caption üret (BLIP).
        
        Args:
            image: PIL Image
            max_length: Maksimum caption uzunluğu
            
        Returns:
            Caption metni
        """
        if self.blip_model is None or self.blip_processor is None:
            raise RuntimeError("BLIP yüklenmemiş")
        
        # Load image
        if isinstance(image, str):
            image = Image.open(image).convert('RGB')
        
        # Process
        inputs = self.blip_processor(images=image, return_tensors="pt")
        
        # Generate
        with torch.no_grad():
            outputs = self.blip_model.generate(
                **inputs,
                max_length=max_length,
                num_beams=5,
                early_stopping=True
            )
        
        # Decode
        caption = self.blip_processor.decode(outputs[0], skip_special_tokens=True)
        
        return caption
    
    def image_text_similarity(
        self,
        image: Union[Image.Image, str],
        text: str
    ) -> float:
        """
        Görüntü ve metin arasındaki benzerlik skoru (CLIP).
        
        Returns:
            Similarity score (0-1)
        """
        if self.clip_model is None:
            raise RuntimeError("CLIP yüklenmemiş")
        
        # Load image
        if isinstance(image, str):
            image = Image.open(image).convert('RGB')
        
        # Process
        inputs = self.clip_processor(
            text=[text],
            images=image,
            return_tensors="pt",
            padding=True
        )
        
        # Inference
        with torch.no_grad():
            outputs = self.clip_model(**inputs)
        
        # Cosine similarity
        logits_per_image = outputs.logits_per_image
        probs = F.softmax(logits_per_image, dim=1)
        
        return probs[0, 0].item()
    
    def batch_process(
        self,
        images: List[Union[Image.Image, str]],
        task: str = "classify"
    ) -> List:
        """
        Batch görüntü işleme.
        
        Args:
            images: Görüntü listesi
            task: 'classify', 'caption', 'features'
            
        Returns:
            Sonuç listesi
        """
        results = []
        
        for image in images:
            try:
                if task == "classify":
                    result = self.classify_image(image)
                elif task == "caption":
                    result = self.generate_caption(image)
                elif task == "features":
                    result = self.extract_features(image)
                else:
                    raise ValueError(f"Unknown task: {task}")
                
                results.append(result)
                
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                results.append(None)
        
        return results


class MultimodalFusion:
    """
    Image + Text multimodal fusion modülü.
    """
    
    def __init__(self, hidden_size: int = 768):
        self.hidden_size = hidden_size
        
        # Cross-attention layers
        self.cross_attention = nn.MultiheadAttention(
            embed_dim=hidden_size,
            num_heads=8,
            batch_first=True
        )
        
        self.fusion_layer = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.LayerNorm(hidden_size),
            nn.GELU(),
            nn.Dropout(0.1)
        )
    
    def fuse(
        self,
        image_features: torch.Tensor,
        text_features: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Image ve text feature'larını fuse et.
        
        Args:
            image_features: (batch, seq_len_img, hidden_size)
            text_features: (batch, seq_len_txt, hidden_size)
            attention_mask: Text attention mask
            
        Returns:
            Fused features: (batch, hidden_size)
        """
        # Cross-attention: Image attends to Text
        fused, _ = self.cross_attention(
            query=image_features,
            key=text_features,
            value=text_features,
            key_padding_mask=attention_mask
        )
        
        # Mean pooling
        image_pooled = fused.mean(dim=1)
        text_pooled = text_features.mean(dim=1)
        
        # Concatenate and fuse
        combined = torch.cat([image_pooled, text_pooled], dim=-1)
        output = self.fusion_layer(combined)
        
        return output


class VisionTransformerTrainer:
    """
    ViT fine-tuning trainer.
    """
    
    def __init__(
        self,
        model: ViTForImageClassification,
        num_classes: int,
        learning_rate: float = 5e-5
    ):
        self.model = model
        self.num_classes = num_classes
        self.learning_rate = learning_rate
        
    def fine_tune(
        self,
        train_loader,
        val_loader,
        num_epochs: int = 5,
        device: str = "cuda"
    ) -> Dict:
        """
        ViT fine-tuning.
        
        Args:
            train_loader: Eğitim veri yükleyici
            val_loader: Validasyon veri yükleyici
            num_epochs: Epoch sayısı
            
        Returns:
            Eğitim metrikleri
        """
        import torch.optim as optim
        
        self.model.to(device)
        optimizer = optim.AdamW(
            self.model.parameters(),
            lr=self.learning_rate
        )
        criterion = nn.CrossEntropyLoss()
        
        history = {'train_loss': [], 'val_acc': []}
        
        for epoch in range(num_epochs):
            # Training
            self.model.train()
            total_loss = 0
            
            for batch_idx, (images, labels) in enumerate(train_loader):
                images, labels = images.to(device), labels.to(device)
                
                optimizer.zero_grad()
                outputs = self.model(images)
                loss = criterion(outputs.logits, labels)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            avg_train_loss = total_loss / len(train_loader)
            history['train_loss'].append(avg_train_loss)
            
            # Validation
            val_acc = self.evaluate(val_loader, device)
            history['val_acc'].append(val_acc)
            
            logger.info(
                f"Epoch {epoch + 1}/{num_epochs} - "
                f"Loss: {avg_train_loss:.4f}, Val Acc: {val_acc:.4f}"
            )
        
        return history
    
    def evaluate(self, val_loader, device: str = "cuda") -> float:
        """Validasyon accuracy"""
        self.model.eval()
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = self.model(images)
                preds = outputs.logits.argmax(dim=-1)
                correct += (preds == labels).sum().item()
                total += labels.size(0)
        
        return correct / total if total > 0 else 0.0


# Global ViT servisi
vit_config = ViTConfig(
    model_name="google/vit-base-patch16-224",
    use_clip=True,
    use_blip=False
)
vit_service = VisionTransformerService(vit_config)
