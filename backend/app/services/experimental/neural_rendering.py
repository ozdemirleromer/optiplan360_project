"""
OptiPlan 360 - Neural Rendering Service
AI-053: 3D scene representation ve neural rendering

Bu modül:
- NeRF (Neural Radiance Fields) implementasyonu
- 3D reconstruction from images
- Novel view synthesis
- Volume rendering
- Instant NGP (hash encoding)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Tuple, List, Dict, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class NeRFConfig:
    """NeRF konfigürasyonu"""
    # Network architecture
    pos_encoding_L: int = 10  # Pozisyon encoding seviyesi
    dir_encoding_L: int = 4   # Yön encoding seviyesi
    hidden_dim: int = 256
    num_layers: int = 8
    skip_layer: int = 4  # Skip connection katmanı
    
    # Volume rendering
    num_samples: int = 64  # Coarse sampling
    num_samples_fine: int = 64  # Fine sampling
    near_bound: float = 2.0
    far_bound: float = 6.0
    
    # Training
    learning_rate: float = 5e-4
    batch_size: int = 1024  # Ray batch size
    num_iterations: int = 100000
    
    # Hash encoding (Instant NGP)
    use_hash_encoding: bool = True
    hash_levels: int = 16
    hash_features_per_level: int = 2
    hash_log2_size: int = 19
    hash_base_resolution: int = 16


class HashEncoding(nn.Module):
    """
    Multi-resolution hash encoding (Instant NGP).
    
    Konum bilgilerini çoklu çözünürlükte hash tabanlı encode eder.
    """
    
    def __init__(
        self,
        num_levels: int = 16,
        features_per_level: int = 2,
        log2_hashmap_size: int = 19,
        base_resolution: int = 16,
        device: str = "cuda"
    ):
        super().__init__()
        
        self.num_levels = num_levels
        self.features_per_level = features_per_level
        self.log2_hashmap_size = log2_hashmap_size
        self.base_resolution = base_resolution
        self.device = device
        
        # Hash tablosu boyutu
        self.hashmap_size = 2 ** log2_hashmap_size
        
        # Her seviye için hash tablosu
        self.hash_tables = nn.ParameterList([
            nn.Parameter(torch.randn(self.hashmap_size, features_per_level) * 1e-4)
            for _ in range(num_levels)
        ])
        
    def forward(self, positions: torch.Tensor) -> torch.Tensor:
        """
        Pozisyonları hash encode et.
        
        Args:
            positions: (N, 3) normalized pozisyonlar [-1, 1]
            
        Returns:
            Encoded features: (N, num_levels * features_per_level)
        """
        features = []
        
        for level in range(self.num_levels):
            # Resolution for this level
            resolution = int(self.base_resolution * (1.5 ** level))
            
            # Scale positions
            scaled_pos = (positions + 1) / 2 * resolution
            
            # Voxel corners
            voxel_min_vertex = torch.floor(scaled_pos).long()
            voxel_max_vertex = torch.ceil(scaled_pos).long()
            
            # Trilinear interpolation weights
            voxel_d = scaled_pos - voxel_min_vertex.float()
            
            # Hash function
            def hash_fn(coords):
                # Spatial hash function
                primes = torch.tensor([1, 2654435761, 805459861], device=coords.device)
                coords = coords % self.hashmap_size
                hashed = (coords * primes).sum(dim=-1) % self.hashmap_size
                return hashed.long()
            
            # Get features for 8 corners
            corners = []
            for dx in [0, 1]:
                for dy in [0, 1]:
                    for dz in [0, 1]:
                        corner = voxel_min_vertex + torch.tensor([dx, dy, dz], device=positions.device)
                        corner = torch.clamp(corner, 0, resolution - 1)
                        hash_idx = hash_fn(corner)
                        corners.append(self.hash_tables[level][hash_idx])
            
            # Trilinear interpolation
            c000, c001, c010, c011, c100, c101, c110, c111 = corners
            
            c00 = c000 * (1 - voxel_d[:, 0:1]) + c100 * voxel_d[:, 0:1]
            c01 = c001 * (1 - voxel_d[:, 0:1]) + c101 * voxel_d[:, 0:1]
            c10 = c010 * (1 - voxel_d[:, 0:1]) + c110 * voxel_d[:, 0:1]
            c11 = c011 * (1 - voxel_d[:, 0:1]) + c111 * voxel_d[:, 0:1]
            
            c0 = c00 * (1 - voxel_d[:, 1:2]) + c10 * voxel_d[:, 1:2]
            c1 = c01 * (1 - voxel_d[:, 1:2]) + c11 * voxel_d[:, 1:2]
            
            feature = c0 * (1 - voxel_d[:, 2:3]) + c1 * voxel_d[:, 2:3]
            features.append(feature)
        
        return torch.cat(features, dim=-1)


class NeRFModel(nn.Module):
    """
    Neural Radiance Fields (NeRF) modeli.
    
    Pozisyon ve yön bilgisinden renk (RGB) ve yoğunluk (sigma) tahmini.
    """
    
    def __init__(self, config: NeRFConfig, device: str = "cuda"):
        super().__init__()
        
        self.config = config
        self.device = device
        
        # Positional encoding dimensions
        self.pos_dim = 3 + 3 * 2 * config.pos_encoding_L  # 3D pozisyon + encoding
        self.dir_dim = 3 + 3 * 2 * config.dir_encoding_L  # 3D yön + encoding
        
        # Hash encoding
        if config.use_hash_encoding:
            self.hash_encoding = HashEncoding(
                num_levels=config.hash_levels,
                features_per_level=config.hash_features_per_level,
                log2_hashmap_size=config.hash_log2_size,
                base_resolution=config.hash_base_resolution,
                device=device
            )
            self.input_dim = config.hash_levels * config.hash_features_per_level
        else:
            self.positional_encoding = lambda x: self._positional_encoding(x, config.pos_encoding_L)
            self.input_dim = self.pos_dim
        
        # Density network (sigma prediction)
        self.density_layers = nn.ModuleList()
        in_dim = self.input_dim
        for i in range(config.num_layers):
            out_dim = config.hidden_dim
            self.density_layers.append(nn.Linear(in_dim, out_dim))
            if i == config.skip_layer:
                in_dim = config.hidden_dim + self.input_dim  # Skip connection
            else:
                in_dim = config.hidden_dim
        
        self.density_head = nn.Linear(config.hidden_dim, 1)
        self.feature_layer = nn.Linear(config.hidden_dim, config.hidden_dim)
        
        # Color network (RGB prediction)
        self.color_layers = nn.Sequential(
            nn.Linear(config.hidden_dim + self.dir_dim, config.hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(config.hidden_dim // 2, 3),
            nn.Sigmoid()
        )
        
    def _positional_encoding(self, x: torch.Tensor, L: int) -> torch.Tensor:
        """
        Pozisyonel encoding.
        
        Args:
            x: (N, 3) pozisyonlar
            L: Encoding seviyesi
            
        Returns:
            (N, 3 + 3*2*L) encoded features
        """
        encoded = [x]
        for i in range(L):
            encoded.append(torch.sin(2 ** i * np.pi * x))
            encoded.append(torch.cos(2 ** i * np.pi * x))
        return torch.cat(encoded, dim=-1)
    
    def forward(
        self,
        positions: torch.Tensor,
        directions: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass.
        
        Args:
            positions: (N, 3) 3D pozisyonlar
            directions: (N, 3) 3D yön vektörleri (normalized)
            
        Returns:
            rgb: (N, 3) renk değerleri [0, 1]
            sigma: (N, 1) yoğunluk değerleri
        """
        # Encode positions
        if self.config.use_hash_encoding:
            h = self.hash_encoding(positions)
        else:
            h = self.positional_encoding(positions)
        
        # Density network
        h_input = h
        for i, layer in enumerate(self.density_layers):
            h = F.relu(layer(h))
            if i == self.config.skip_layer:
                h = torch.cat([h, h_input], dim=-1)
        
        sigma = self.density_head(h)
        features = self.feature_layer(h)
        
        # Encode directions
        d_encoded = self._positional_encoding(directions, self.config.dir_encoding_L)
        
        # Color network
        color_input = torch.cat([features, d_encoded], dim=-1)
        rgb = self.color_layers(color_input)
        
        return rgb, sigma


class VolumeRenderer:
    """
    Volume rendering pipeline.
    
    Ray'ler boyunca renk ve derinlik değerlerini hesapla.
    """
    
    def __init__(self, nerf_model: NeRFModel, config: NeRFConfig):
        self.model = nerf_model
        self.config = config
        
    def render_rays(
        self,
        ray_origins: torch.Tensor,
        ray_directions: torch.Tensor,
        use_hierarchical: bool = True
    ) -> Dict[str, torch.Tensor]:
        """
        Ray'leri render et.
        
        Args:
            ray_origins: (N, 3) ray başlangıç noktaları
            ray_directions: (N, 3) ray yönleri (normalized)
            
        Returns:
            {
                'rgb': (N, 3) render edilen renkler,
                'depth': (N,) derinlik değerleri,
                'weights': (N, num_samples) sample ağırlıkları
            }
        """
        batch_size = ray_origins.shape[0]
        device = ray_origins.device
        
        # Coarse sampling
        t_vals = torch.linspace(
            self.config.near_bound,
            self.config.far_bound,
            self.config.num_samples,
            device=device
        )
        t_vals = t_vals.expand(batch_size, self.config.num_samples)
        
        # Stratified sampling
        mids = 0.5 * (t_vals[:, :-1] + t_vals[:, 1:])
        upper = torch.cat([mids, t_vals[:, -1:]], dim=-1)
        lower = torch.cat([t_vals[:, :1], mids], dim=-1)
        
        t_rand = torch.rand(t_vals.shape, device=device)
        t_vals_coarse = lower + (upper - lower) * t_rand
        
        # Sample points along rays
        points_coarse = ray_origins.unsqueeze(1) + t_vals_coarse.unsqueeze(2) * ray_directions.unsqueeze(1)
        points_coarse = points_coarse.reshape(-1, 3)
        
        # Expand directions
        dirs_coarse = ray_directions.unsqueeze(1).expand(-1, self.config.num_samples, -1)
        dirs_coarse = dirs_coarse.reshape(-1, 3)
        
        # Query NeRF
        with torch.no_grad():
            rgb_coarse, sigma_coarse = self.model(points_coarse, dirs_coarse)
        
        rgb_coarse = rgb_coarse.reshape(batch_size, self.config.num_samples, 3)
        sigma_coarse = sigma_coarse.reshape(batch_size, self.config.num_samples)
        
        # Volume rendering
        result_coarse = self._volume_rendering(rgb_coarse, sigma_coarse, t_vals_coarse)
        
        if not use_hierarchical:
            return result_coarse
        
        # Hierarchical sampling (importance sampling)
        weights = result_coarse['weights']
        
        # Sample PDF
        t_vals_mid = 0.5 * (t_vals_coarse[:, :-1] + t_vals_coarse[:, 1:])
        t_vals_fine = self._sample_pdf(t_vals_mid, weights[:, 1:-1], self.config.num_samples_fine)
        
        # Combine coarse and fine samples
        t_vals_all, _ = torch.sort(
            torch.cat([t_vals_coarse, t_vals_fine], dim=-1),
            dim=-1
        )
        
        # Sample points again
        points_fine = ray_origins.unsqueeze(1) + t_vals_all.unsqueeze(2) * ray_directions.unsqueeze(1)
        points_fine = points_fine.reshape(-1, 3)
        
        dirs_fine = ray_directions.unsqueeze(1).expand(-1, self.config.num_samples + self.config.num_samples_fine, -1)
        dirs_fine = dirs_fine.reshape(-1, 3)
        
        # Query NeRF again
        with torch.no_grad():
            rgb_fine, sigma_fine = self.model(points_fine, dirs_fine)
        
        num_total = self.config.num_samples + self.config.num_samples_fine
        rgb_fine = rgb_fine.reshape(batch_size, num_total, 3)
        sigma_fine = sigma_fine.reshape(batch_size, num_total)
        
        # Final volume rendering
        result_fine = self._volume_rendering(rgb_fine, sigma_fine, t_vals_all)
        
        return result_fine
    
    def _volume_rendering(
        self,
        rgb: torch.Tensor,
        sigma: torch.Tensor,
        t_vals: torch.Tensor
    ) -> Dict[str, torch.Tensor]:
        """
        Volume rendering equation.
        
        C = sum(T_i * alpha_i * c_i)
        where:
            T_i = exp(-sum_{j=1}^{i-1} sigma_j * delta_j)
            alpha_i = 1 - exp(-sigma_i * delta_i)
        """
        # Deltas
        dists = t_vals[:, 1:] - t_vals[:, :-1]
        dists = torch.cat([dists, torch.ones_like(dists[:, :1]) * 1e10], dim=-1)
        
        # Alpha values
        alpha = 1.0 - torch.exp(-sigma * dists)
        
        # Transmittance
        transmittance = torch.cumprod(
            torch.cat([torch.ones_like(alpha[:, :1]), 1.0 - alpha + 1e-10], dim=-1),
            dim=-1
        )[:, :-1]
        
        # Weights
        weights = alpha * transmittance
        
        # RGB
        rgb_rendered = torch.sum(weights.unsqueeze(-1) * rgb, dim=1)
        
        # Depth
        depth = torch.sum(weights * t_vals, dim=-1)
        
        # Accumulated weight (for background)
        acc_weight = torch.sum(weights, dim=-1)
        
        # Composite with white background
        rgb_rendered = rgb_rendered + (1.0 - acc_weight.unsqueeze(-1))
        
        return {
            'rgb': rgb_rendered,
            'depth': depth,
            'weights': weights,
            'alpha': alpha
        }
    
    def _sample_pdf(
        self,
        bins: torch.Tensor,
        weights: torch.Tensor,
        num_samples: int
    ) -> torch.Tensor:
        """
        Importance sampling için PDF'den sample al.
        """
        # Normalize weights
        weights = weights + 1e-5
        pdf = weights / torch.sum(weights, dim=-1, keepdim=True)
        cdf = torch.cumsum(pdf, dim=-1)
        cdf = torch.cat([torch.zeros_like(cdf[:, :1]), cdf], dim=-1)
        
        # Sample from CDF
        u = torch.rand(bins.shape[0], num_samples, device=bins.device)
        
        # Invert CDF
        inds = torch.searchsorted(cdf, u, right=True)
        below = torch.clamp(inds - 1, 0, bins.shape[1] - 1)
        above = torch.clamp(inds, 0, bins.shape[1] - 1)
        
        cdf_below = torch.gather(cdf, 1, below)
        cdf_above = torch.gather(cdf, 1, above)
        bins_below = torch.gather(bins, 1, below)
        bins_above = torch.gather(bins, 1, above)
        
        # Linear interpolation
        denom = cdf_above - cdf_below
        denom = torch.where(denom < 1e-5, torch.ones_like(denom), denom)
        t = (u - cdf_below) / denom
        samples = bins_below + t * (bins_above - bins_below)
        
        return samples


class NeRFTrainer:
    """
    NeRF eğitim servisi.
    """
    
    def __init__(
        self,
        model: NeRFModel,
        renderer: VolumeRenderer,
        config: NeRFConfig
    ):
        self.model = model
        self.renderer = renderer
        self.config = config
        
        self.optimizer = torch.optim.Adam(
            model.parameters(),
            lr=config.learning_rate
        )
        
        self.scheduler = torch.optim.lr_scheduler.ExponentialLR(
            self.optimizer,
            gamma=0.999
        )
        
    def train_step(
        self,
        ray_origins: torch.Tensor,
        ray_directions: torch.Tensor,
        target_rgb: torch.Tensor
    ) -> Dict[str, float]:
        """
        Tek eğitim adımı.
        
        Args:
            ray_origins: (N, 3)
            ray_directions: (N, 3)
            target_rgb: (N, 3) ground truth renkler
            
        Returns:
            Loss değerleri
        """
        self.model.train()
        self.optimizer.zero_grad()
        
        # Render
        result = self.renderer.render_rays(ray_origins, ray_directions)
        pred_rgb = result['rgb']
        
        # Loss
        loss = F.mse_loss(pred_rgb, target_rgb)
        
        # Backward
        loss.backward()
        self.optimizer.step()
        self.scheduler.step()
        
        return {
            'loss': loss.item(),
            'psnr': self._calculate_psnr(loss.item())
        }
    
    def _calculate_psnr(self, mse: float) -> float:
        """PSNR hesapla"""
        if mse == 0:
            return float('inf')
        return -10 * np.log10(mse)
    
    def train_epoch(
        self,
        dataloader: torch.utils.data.DataLoader
    ) -> Dict[str, float]:
        """
        Bir epoch eğit.
        """
        total_loss = 0
        total_psnr = 0
        num_batches = 0
        
        for batch in dataloader:
            ray_origins = batch['origins'].to(self.model.device)
            ray_directions = batch['directions'].to(self.model.device)
            target_rgb = batch['colors'].to(self.model.device)
            
            metrics = self.train_step(ray_origins, ray_directions, target_rgb)
            
            total_loss += metrics['loss']
            total_psnr += metrics['psnr']
            num_batches += 1
        
        return {
            'avg_loss': total_loss / num_batches,
            'avg_psnr': total_psnr / num_batches
        }


# Global NeRF servisi
nerf_config = NeRFConfig(
    use_hash_encoding=True,
    hidden_dim=256
)
nerf_model = NeRFModel(nerf_config)
renderer = VolumeRenderer(nerf_model, nerf_config)
nerf_trainer = NeRFTrainer(nerf_model, renderer, nerf_config)
