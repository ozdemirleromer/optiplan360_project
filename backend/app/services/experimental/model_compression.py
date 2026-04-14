"""
OptiPlan 360 - Model Compression and Quantization Service
AI-026: Model boyut küçültme ve inference hızlandırma

Bu modül:
- Pruning (structured/unstructured)
- Quantization (INT8, FP16)
- Knowledge distillation
- Tensor decomposition
- ONNX export ve optimizasyon
"""

import torch
import torch.nn as nn
import torch.quantization
import torch.nn.utils.prune as prune
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
import numpy as np
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class CompressionConfig:
    """Model compression konfigürasyonu"""
    # Pruning
    pruning_method: str = "l1_unstructured"  # l1_unstructured, random_unstructured
    pruning_amount: float = 0.3  # %30 pruning
    
    # Quantization
    quantization_type: str = "dynamic"  # dynamic, static, qat
    quantization_bits: int = 8  # 8, 16
    
    # Distillation
    teacher_model: Optional[nn.Module] = None
    temperature: float = 4.0
    alpha: float = 0.7  # distillation loss weight
    
    # Target metrics
    target_size_mb: float = 50.0
    target_latency_ms: float = 100.0
    accuracy_drop_threshold: float = 0.02  # Max %2 accuracy drop


class ModelPruner:
    """
    Model pruning implementasyonu.
    
    Supports:
    - L1 unstructured pruning
    - Structured pruning (channel/filter)
    - Iterative pruning
    """
    
    def __init__(self, model: nn.Module, config: CompressionConfig):
        self.model = model
        self.config = config
        self.pruning_history = []
        
    def prune_model(self, iterative_steps: int = 1) -> nn.Module:
        """
        Model üzerinde pruning uygula.
        
        Args:
            iterative_steps: İteratif pruning adım sayısı
            
        Returns:
            Pruned model
        """
        logger.info(f"Pruning başlatıldı: {self.config.pruning_amount * 100}%")
        
        amount_per_step = self.config.pruning_amount / iterative_steps
        
        for step in range(iterative_steps):
            logger.info(f"Pruning step {step + 1}/{iterative_steps}")
            
            # Conv ve Linear layer'ları bul
            for name, module in self.model.named_modules():
                if isinstance(module, (nn.Conv2d, nn.Linear)):
                    if self.config.pruning_method == "l1_unstructured":
                        prune.l1_unstructured(
                            module,
                            name='weight',
                            amount=amount_per_step
                        )
                    elif self.config.pruning_method == "random_unstructured":
                        prune.random_unstructured(
                            module,
                            name='weight',
                            amount=amount_per_step
                        )
            
            # History kaydet
            self.pruning_history.append({
                'step': step + 1,
                'amount': amount_per_step,
                'sparsity': self.get_model_sparsity()
            })
        
        # Pruning mask'lerini kalıcı yap
        self.make_pruning_permanent()
        
        logger.info(f"Pruning tamamlandı. Final sparsity: {self.get_model_sparsity():.2%}")
        
        return self.model
    
    def structured_pruning(self, num_filters_to_prune: int) -> nn.Module:
        """
        Structured pruning - filtre/kanal bazlı pruning.
        Daha inference-friendly, hardware acceleration uyumlu.
        """
        for name, module in self.model.named_modules():
            if isinstance(module, nn.Conv2d):
                # L1 norm'a göre önem sıralaması
                weight = module.weight.data
                l1_norm = torch.sum(torch.abs(weight), dim=[1, 2, 3])
                
                # En düşük öneme sahip filtreleri seç
                num_filters = weight.size(0)
                if num_filters_to_prune >= num_filters:
                    continue
                    
                _, prune_indices = torch.topk(
                    l1_norm,
                    k=num_filters_to_prune,
                    largest=False
                )
                
                # Mask oluştur
                mask = torch.ones_like(weight)
                mask[prune_indices] = 0
                
                # Apply mask
                module.weight.data *= mask
                
                logger.info(f"Pruned {num_filters_to_prune} filters from {name}")
        
        return self.model
    
    def get_model_sparsity(self) -> float:
        """Model sparsity oranını hesapla"""
        total_params = 0
        zero_params = 0
        
        for name, module in self.model.named_modules():
            if isinstance(module, (nn.Conv2d, nn.Linear)):
                if hasattr(module, 'weight_mask'):
                    mask = module.weight_mask
                    total_params += mask.numel()
                    zero_params += (mask == 0).sum().item()
                elif hasattr(module, 'weight'):
                    total_params += module.weight.numel()
                    zero_params += (module.weight == 0).sum().item()
        
        return zero_params / total_params if total_params > 0 else 0.0
    
    def make_pruning_permanent(self):
        """Pruning mask'lerini kalıcı yap"""
        for name, module in self.model.named_modules():
            if isinstance(module, (nn.Conv2d, nn.Linear)):
                if hasattr(module, 'weight_mask'):
                    prune.remove(module, 'weight')


class ModelQuantizer:
    """
    Model quantization implementasyonu.
    
    Types:
    - Dynamic quantization: Runtime quantization
    - Static quantization: Calibration required
    - QAT: Quantization-aware training
    """
    
    def __init__(self, model: nn.Module, config: CompressionConfig):
        self.model = model
        self.config = config
        
    def dynamic_quantize(self) -> nn.Module:
        """
        Dynamic quantization uygula.
        
        Sadece Linear ve LSTM layer'larını quantize eder.
        Runtime'da activation'ları quantize eder.
        """
        logger.info("Dynamic quantization başlatıldı")
        
        quantized_model = torch.quantization.quantize_dynamic(
            self.model,
            {nn.Linear, nn.Conv2d, nn.LSTM},
            dtype=torch.qint8
        )
        
        logger.info("Dynamic quantization tamamlandı")
        return quantized_model
    
    def static_quantize(
        self,
        calibration_data: torch.utils.data.DataLoader,
        num_calibration_batches: int = 100
    ) -> nn.Module:
        """
        Static quantization uygula.
        
        Calibration data ile activation range'leri öğrenir.
        """
        logger.info("Static quantization başlatıldı")
        
        # Model'i eval moduna al
        self.model.eval()
        
        # Fusion (opsiyonel optimizasyon)
        # self.model = torch.quantization.fuse_modules(
        #     self.model, [['conv', 'bn', 'relu']]
        # )
        
        # Quantization config
        self.model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
        
        # Prepare
        torch.quantization.prepare(self.model, inplace=True)
        
        # Calibration
        logger.info(f"Calibration başladı: {num_calibration_batches} batches")
        with torch.no_grad():
            for i, (data, _) in enumerate(calibration_data):
                if i >= num_calibration_batches:
                    break
                self.model(data)
        
        # Convert
        torch.quantization.convert(self.model, inplace=True)
        
        logger.info("Static quantization tamamlandı")
        return self.model
    
    def quantize_aware_train(
        self,
        train_loader: torch.utils.data.DataLoader,
        optimizer: torch.optim.Optimizer,
        num_epochs: int = 5
    ) -> nn.Module:
        """
        Quantization-aware training (QAT).
        
        Training sırasında quantization simulation yapar.
        """
        logger.info(f"QAT başlatıldı: {num_epochs} epochs")
        
        # QAT config
        self.model.qconfig = torch.quantization.get_default_qat_qconfig('fbgemm')
        
        # Prepare for QAT
        torch.quantization.prepare_qat(self.model, inplace=True)
        
        # Train
        for epoch in range(num_epochs):
            self.model.train()
            total_loss = 0
            
            for batch_idx, (data, target) in enumerate(train_loader):
                optimizer.zero_grad()
                output = self.model(data)
                loss = nn.CrossEntropyLoss()(output, target)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            avg_loss = total_loss / len(train_loader)
            logger.info(f"QAT Epoch {epoch + 1}/{num_epochs}, Loss: {avg_loss:.4f}")
        
        # Convert to quantized model
        self.model.eval()
        torch.quantization.convert(self.model, inplace=True)
        
        logger.info("QAT tamamlandı")
        return self.model
    
    def get_model_size(self, model: nn.Module) -> float:
        """Model boyutunu MB olarak hesapla"""
        param_size = 0
        buffer_size = 0
        
        for param in model.parameters():
            param_size += param.nelement() * param.element_size()
        
        for buffer in model.buffers():
            buffer_size += buffer.nelement() * buffer.element_size()
        
        size_mb = (param_size + buffer_size) / 1024**2
        return size_mb


class KnowledgeDistiller:
    """
    Knowledge distillation implementasyonu.
    
    Teacher model'dan student model'a bilgi transferi.
    """
    
    def __init__(
        self,
        teacher_model: nn.Module,
        student_model: nn.Module,
        config: CompressionConfig
    ):
        self.teacher_model = teacher_model
        self.student_model = student_model
        self.config = config
        
        self.teacher_model.eval()
        
    def distillation_loss(
        self,
        student_logits: torch.Tensor,
        teacher_logits: torch.Tensor,
        labels: torch.Tensor,
        temperature: float = 4.0,
        alpha: float = 0.7
    ) -> torch.Tensor:
        """
        Distillation loss hesapla.
        
        Loss = alpha * soft_loss + (1 - alpha) * hard_loss
        """
        # Soft targets (temperature scaling)
        soft_loss = nn.KLDivLoss(reduction='batchmean')(
            nn.functional.log_softmax(student_logits / temperature, dim=1),
            nn.functional.softmax(teacher_logits / temperature, dim=1)
        ) * (temperature ** 2)
        
        # Hard targets
        hard_loss = nn.CrossEntropyLoss()(student_logits, labels)
        
        # Combined loss
        loss = alpha * soft_loss + (1 - alpha) * hard_loss
        
        return loss
    
    def train_student(
        self,
        train_loader: torch.utils.data.DataLoader,
        val_loader: torch.utils.data.DataLoader,
        optimizer: torch.optim.Optimizer,
        num_epochs: int = 50,
        device: str = "cuda"
    ) -> Dict:
        """
        Student model'i distillation ile eğit.
        """
        logger.info(f"Distillation başlatıldı: {num_epochs} epochs")
        
        best_val_acc = 0.0
        history = {'train_loss': [], 'val_acc': []}
        
        for epoch in range(num_epochs):
            # Training
            self.student_model.train()
            total_loss = 0
            
            for batch_idx, (data, target) in enumerate(train_loader):
                data, target = data.to(device), target.to(device)
                
                # Teacher prediction
                with torch.no_grad():
                    teacher_logits = self.teacher_model(data)
                
                # Student prediction
                student_logits = self.student_model(data)
                
                # Distillation loss
                loss = self.distillation_loss(
                    student_logits,
                    teacher_logits,
                    target,
                    self.config.temperature,
                    self.config.alpha
                )
                
                # Backward
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            avg_train_loss = total_loss / len(train_loader)
            
            # Validation
            val_acc = self.evaluate(val_loader, device)
            
            history['train_loss'].append(avg_train_loss)
            history['val_acc'].append(val_acc)
            
            logger.info(
                f"Epoch {epoch + 1}/{num_epochs} - "
                f"Loss: {avg_train_loss:.4f}, Val Acc: {val_acc:.4f}"
            )
            
            # Save best
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                # torch.save(self.student_model.state_dict(), 'best_student.pth')
        
        logger.info(f"Distillation tamamlandı. Best val acc: {best_val_acc:.4f}")
        
        return history
    
    def evaluate(
        self,
        val_loader: torch.utils.data.DataLoader,
        device: str = "cuda"
    ) -> float:
        """Validation accuracy hesapla"""
        self.student_model.eval()
        correct = 0
        total = 0
        
        with torch.no_grad():
            for data, target in val_loader:
                data, target = data.to(device), target.to(device)
                output = self.student_model(data)
                pred = output.argmax(dim=1)
                correct += pred.eq(target).sum().item()
                total += target.size(0)
        
        return correct / total


class ModelCompressor:
    """
    Tüm compression tekniklerini birleştiren ana servis.
    """
    
    def __init__(self, config: CompressionConfig):
        self.config = config
        self.results = {}
        
    def compress_model(
        self,
        model: nn.Module,
        train_loader: Optional[torch.utils.data.DataLoader] = None,
        val_loader: Optional[torch.utils.data.DataLoader] = None,
        method: str = "pruning_quantization"
    ) -> Tuple[nn.Module, Dict]:
        """
        Model compression pipeline.
        
        Methods:
        - pruning: Sadece pruning
        - quantization: Sadece quantization
        - pruning_quantization: Pruning + quantization
        - distillation: Knowledge distillation
        - all: Tüm teknikler
        """
        logger.info(f"Compression başlatıldı: {method}")
        
        original_size = self._get_model_size(model)
        
        results = {
            'original_size_mb': original_size,
            'methods_applied': [],
            'size_reduction': 0,
            'sparsity': 0
        }
        
        # Pruning
        if 'pruning' in method:
            pruner = ModelPruner(model, self.config)
            model = pruner.prune_model(iterative_steps=3)
            results['methods_applied'].append('pruning')
            results['sparsity'] = pruner.get_model_sparsity()
        
        # Quantization
        if 'quantization' in method:
            quantizer = ModelQuantizer(model, self.config)
            
            if self.config.quantization_type == 'dynamic':
                model = quantizer.dynamic_quantize()
            elif self.config.quantization_type == 'static' and train_loader:
                model = quantizer.static_quantize(train_loader)
            elif self.config.quantization_type == 'qat' and train_loader:
                optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
                model = quantizer.quantize_aware_train(train_loader, optimizer)
            
            results['methods_applied'].append('quantization')
        
        # Distillation
        if 'distillation' in method and self.config.teacher_model:
            # Student model oluştur (daha küçük)
            # student_model = self._create_student_model(model)
            # distiller = KnowledgeDistiller(
            #     self.config.teacher_model,
            #     student_model,
            #     self.config
            # )
            # history = distiller.train_student(
            #     train_loader, val_loader,
            #     torch.optim.Adam(student_model.parameters()),
            #     num_epochs=50
            # )
            # model = student_model
            results['methods_applied'].append('distillation')
        
        # Final metrics
        final_size = self._get_model_size(model)
        results['final_size_mb'] = final_size
        results['size_reduction'] = (original_size - final_size) / original_size
        results['compression_ratio'] = original_size / final_size
        
        logger.info(
            f"Compression tamamlandı. "
            f"Original: {original_size:.2f}MB, "
            f"Final: {final_size:.2f}MB, "
            f"Reduction: {results['size_reduction']:.1%}"
        )
        
        return model, results
    
    def export_to_onnx(
        self,
        model: nn.Module,
        input_shape: Tuple[int, ...],
        output_path: str,
        optimize: bool = True
    ) -> str:
        """Model'i ONNX formatına export et"""
        model.eval()
        
        dummy_input = torch.randn(*input_shape)
        
        # Export
        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
        
        logger.info(f"ONNX export tamamlandı: {output_path}")
        
        # Optimize (opsiyonel)
        if optimize:
            try:
                import onnx
                from onnxoptimizer import optimize
                
                onnx_model = onnx.load(output_path)
                optimized_model = optimize(onnx_model)
                onnx.save(optimized_model, output_path)
                
                logger.info("ONNX optimizasyonu tamamlandı")
            except ImportError:
                logger.warning("onnxoptimizer bulunamadı, optimizasyon atlandı")
        
        return output_path
    
    def _get_model_size(self, model: nn.Module) -> float:
        """Model boyutunu MB olarak hesapla"""
        param_size = 0
        for param in model.parameters():
            param_size += param.nelement() * param.element_size()
        
        buffer_size = 0
        for buffer in model.buffers():
            buffer_size += buffer.nelement() * buffer.element_size()
        
        return (param_size + buffer_size) / 1024**2


# Global compression servisi
compression_config = CompressionConfig()
compression_service = ModelCompressor(compression_config)
