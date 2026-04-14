"""
OptiPlan 360 - Continual Learning Service
AI-027: Catastrophic forgetting prevention ve concept drift detection

Bu modül:
- Elastic Weight Consolidation (EWC)
- Progressive Neural Networks
- Experience Replay
- Concept drift detection
- Memory buffer management
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass, field
import numpy as np
from collections import deque
import logging
from copy import deepcopy

logger = logging.getLogger(__name__)


@dataclass
class ContinualLearningConfig:
    """Continual learning konfigürasyonu"""
    method: str = "ewc"  # ewc, progressive, replay, lwf
    
    # EWC
    ewc_lambda: float = 5000.0  # EWC regularization strength
    fisher_sample_size: int = 200
    
    # Progressive Neural Networks
    num_columns: int = 5  # Maksimum task sayısı
    lateral_activation: str = "relu"
    
    # Experience Replay
    buffer_size: int = 1000
    replay_batch_size: int = 32
    
    # Learning without Forgetting (LwF)
    lwf_alpha: float = 1.0
    lwf_temperature: float = 2.0
    
    # Concept Drift
    drift_detection_window: int = 100
    drift_threshold: float = 0.05


class ElasticWeightConsolidation:
    """
    Elastic Weight Consolidation (EWC).
    
    Önceki task'larda önemli olan ağırlıkları koru.
    Fisher Information Matrix kullanarak ağırlık önemini hesapla.
    """
    
    def __init__(self, model: nn.Module, config: ContinualLearningConfig):
        self.model = model
        self.config = config
        
        # Fisher Information ve optimal ağırlıkları sakla
        self.fisher_dict: Dict[int, Dict[str, torch.Tensor]] = {}
        self.optimal_params: Dict[int, Dict[str, torch.Tensor]] = {}
        self.task_count = 0
        
    def compute_fisher(
        self,
        dataloader: DataLoader,
        task_id: int,
        num_samples: Optional[int] = None
    ):
        """
        Fisher Information Matrix hesapla.
        
        Fisher = E[(dL/dw)^2] ≈ mean of gradient squares over data
        """
        self.model.train()
        
        fisher = {n: torch.zeros_like(p) for n, p in self.model.named_parameters()}
        
        num_samples = num_samples or self.config.fisher_sample_size
        processed = 0
        
        for batch in dataloader:
            if processed >= num_samples:
                break
            
            self.model.zero_grad()
            
            # Forward + backward
            x, y = batch[0], batch[1]
            if torch.cuda.is_available():
                x, y = x.cuda(), y.cuda()
            
            output = self.model(x)
            loss = F.cross_entropy(output, y)
            loss.backward()
            
            # Accumulate squared gradients
            for n, p in self.model.named_parameters():
                if p.grad is not None:
                    fisher[n] += p.grad.pow(2) * len(x)
            
            processed += len(x)
        
        # Normalize
        for n in fisher:
            fisher[n] /= processed
        
        # Store
        self.fisher_dict[task_id] = fisher
        
        # Store optimal parameters
        self.optimal_params[task_id] = {
            n: p.clone().detach()
            for n, p in self.model.named_parameters()
        }
        
        logger.info(f"Fisher Information computed for task {task_id}")
    
    def penalty(self, model: nn.Module) -> torch.Tensor:
        """
        EWC penalty hesapla.
        
        Loss_ewc = lambda * sum(F_i * (theta_i - theta*_i)^2)
        """
        if self.task_count == 0:
            return torch.tensor(0.0)
        
        loss = 0
        for task_id in range(self.task_count):
            for n, p in model.named_parameters():
                if n in self.fisher_dict[task_id]:
                    fisher = self.fisher_dict[task_id][n]
                    optimal = self.optimal_params[task_id][n]
                    
                    loss += (fisher * (p - optimal).pow(2)).sum()
        
        return self.config.ewc_lambda * loss
    
    def on_task_completion(self, task_id: int, dataloader: DataLoader):
        """Task tamamlandığında Fisher hesapla"""
        self.compute_fisher(dataloader, task_id)
        self.task_count += 1


class ExperienceReplay:
    """
    Experience Replay Buffer.
    
    Önceki task'lardan örnekleri sakla ve yeni task ile karışık eğit.
    """
    
    def __init__(self, config: ContinualLearningConfig, input_shape: Tuple[int, ...]):
        self.config = config
        self.input_shape = input_shape
        
        # Circular buffer
        self.buffer_images = []
        self.buffer_labels = []
        self.buffer_task_ids = []
        self.current_size = 0
        
    def add_samples(
        self,
        images: torch.Tensor,
        labels: torch.Tensor,
        task_id: int
    ):
        """Yeni örnekleri buffer'a ekle"""
        batch_size = images.shape[0]
        
        for i in range(batch_size):
            if self.current_size < self.config.buffer_size:
                # Buffer dolmadı, ekle
                self.buffer_images.append(images[i].cpu())
                self.buffer_labels.append(labels[i].cpu())
                self.buffer_task_ids.append(task_id)
                self.current_size += 1
            else:
                # Buffer dolu, rastgele yer değiştir
                idx = np.random.randint(0, self.current_size)
                self.buffer_images[idx] = images[i].cpu()
                self.buffer_labels[idx] = labels[i].cpu()
                self.buffer_task_ids[idx] = task_id
    
    def sample(self, batch_size: int) -> Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]]:
        """Buffer'dan rastgele örnek seç"""
        if self.current_size == 0:
            return None
        
        # Sample indices
        indices = np.random.choice(self.current_size, min(batch_size, self.current_size), replace=False)
        
        # Gather samples
        images = torch.stack([self.buffer_images[i] for i in indices])
        labels = torch.tensor([self.buffer_labels[i] for i in indices])
        task_ids = torch.tensor([self.buffer_task_ids[i] for i in indices])
        
        return images, labels, task_ids
    
    def get_dataloader(self, batch_size: int) -> DataLoader:
        """Buffer'dan DataLoader oluştur"""
        if self.current_size == 0:
            return None
        
        images = torch.stack(self.buffer_images)
        labels = torch.tensor(self.buffer_labels)
        
        dataset = torch.utils.data.TensorDataset(images, labels)
        return DataLoader(dataset, batch_size=batch_size, shuffle=True)


class ProgressiveNeuralNetworks:
    """
    Progressive Neural Networks.
    
    Her yeni task için yeni bir column ekle,
    önceki task'ların bilgisini lateral connections ile kullan.
    """
    
    def __init__(
        self,
        base_model: nn.Module,
        config: ContinualLearningConfig,
        input_dim: int,
        hidden_dims: List[int]
    ):
        self.config = config
        self.base_model = base_model
        self.task_count = 0
        
        # Columns - her task için bir column
        self.columns: List[nn.ModuleList] = []
        
        # Lateral connections
        self.lateral_connections: List[List[nn.Module]] = []
        
        self.input_dim = input_dim
        self.hidden_dims = hidden_dims
        
    def add_column(self, task_id: int) -> nn.Module:
        """
        Yeni task için yeni column ekle.
        """
        # Yeni column layers
        column = nn.ModuleList()
        
        # Input layer
        in_dim = self.input_dim
        for hidden_dim in self.hidden_dims:
            layer = nn.Linear(in_dim, hidden_dim)
            column.append(layer)
            in_dim = hidden_dim
        
        # Lateral connections to previous columns
        lateral_conns = []
        for prev_column in self.columns:
            lateral_column = nn.ModuleList()
            in_dim = self.input_dim
            for hidden_dim in self.hidden_dims:
                lateral_layer = nn.Linear(in_dim, hidden_dim)
                lateral_column.append(lateral_layer)
                in_dim = hidden_dim
            lateral_conns.append(lateral_column)
        
        self.columns.append(column)
        self.lateral_connections.append(lateral_conns)
        self.task_count += 1
        
        logger.info(f"New column added for task {task_id}. Total columns: {self.task_count}")
        
        # Return the new column
        return self._create_combined_model(task_id)
    
    def _create_combined_model(self, task_id: int) -> nn.Module:
        """
        Task için column ve lateral connections'u birleştir.
        """
        return ProgressiveColumn(
            self.columns[task_id],
            self.lateral_connections[task_id] if task_id > 0 else [],
            self.columns[:task_id] if task_id > 0 else []
        )
    
    def freeze_columns(self, task_id: int):
        """Önceki column'ları dondur"""
        for i in range(task_id):
            for param in self.columns[i].parameters():
                param.requires_grad = False
            # Lateral connections da dondur
            if i < len(self.lateral_connections):
                for lateral_col in self.lateral_connections[i]:
                    for param in lateral_col.parameters():
                        param.requires_grad = False


class ProgressiveColumn(nn.Module):
    """
    Progressive Neural Networks - tek column implementasyonu.
    """
    
    def __init__(
        self,
        column: nn.ModuleList,
        lateral_connections: List[nn.ModuleList],
        previous_columns: List[nn.ModuleList]
    ):
        super().__init__()
        
        self.column = column
        self.lateral_connections = nn.ModuleList(lateral_connections)
        self.previous_columns = previous_columns
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward with lateral connections"""
        # Store activations from lateral connections
        lateral_outputs = []
        for prev_col in self.previous_columns:
            h = x
            for layer in prev_col:
                h = F.relu(layer(h))
            lateral_outputs.append(h)
        
        # Main column forward
        for i, layer in enumerate(self.column):
            # Main transformation
            h_main = layer(x)
            
            # Lateral connection (if exists)
            if i < len(self.lateral_connections):
                h_lateral = self.lateral_connections[i](x)
                h_main = h_main + h_lateral
            
            # Add previous column outputs
            for lateral_h in lateral_outputs:
                if lateral_h.shape == h_main.shape:
                    h_main = h_main + lateral_h
            
            x = F.relu(h_main)
        
        return x


class LearningWithoutForgetting:
    """
    Learning without Forgetting (LwF).
    
    Önceki task'ların soft target'larını kullanarak distillation yap.
    """
    
    def __init__(self, model: nn.Module, config: ContinualLearningConfig):
        self.model = model
        self.config = config
        
        # Önceki task'ların çıktıları
        self.previous_models: Dict[int, nn.Module] = {}
        self.task_count = 0
        
    def distillation_loss(
        self,
        current_logits: torch.Tensor,
        task_id: int
    ) -> torch.Tensor:
        """
        Knowledge distillation loss.
        """
        if task_id == 0 or task_id not in self.previous_models:
            return torch.tensor(0.0)
        
        # Önceki modelin çıktıları
        prev_model = self.previous_models[task_id]
        prev_model.eval()
        
        with torch.no_grad():
            # Burada input gerekiyor, bu yüzden bu metod dışarıdan çağrılmalı
            pass
        
        # Soft targets
        T = self.config.lwf_temperature
        soft_targets = F.softmax(current_logits / T, dim=1)
        
        # Distillation loss (KL divergence)
        loss = F.kl_div(
            F.log_softmax(current_logits / T, dim=1),
            soft_targets,
            reduction='batchmean'
        ) * (T ** 2)
        
        return self.config.lwf_alpha * loss
    
    def on_task_completion(self, task_id: int):
        """Task tamamlandığında modeli kaydet"""
        self.previous_models[task_id] = deepcopy(self.model)
        self.previous_models[task_id].eval()
        for param in self.previous_models[task_id].parameters():
            param.requires_grad = False
        
        self.task_count += 1


class ConceptDriftDetector:
    """
    Concept drift detection.
    
    Veri dağılımındaki değişiklikleri tespit et.
    """
    
    def __init__(self, config: ContinualLearningConfig):
        self.config = config
        
        # Monitoring window
        self.accuracy_window = deque(maxlen=config.drift_detection_window)
        self.loss_window = deque(maxlen=config.drift_detection_window)
        
        # Baseline metrics
        self.baseline_accuracy = None
        self.baseline_loss = None
        
        self.drift_detected = False
        self.drift_count = 0
        
    def update(self, accuracy: float, loss: float):
        """Yeni metrikleri ekle"""
        self.accuracy_window.append(accuracy)
        self.loss_window.append(loss)
        
        # Check for drift
        if len(self.accuracy_window) >= self.config.drift_detection_window:
            self._detect_drift()
    
    def _detect_drift(self):
        """Drift tespiti"""
        if self.baseline_accuracy is None:
            # İlk dönem - baseline belirle
            self.baseline_accuracy = np.mean(self.accuracy_window)
            self.baseline_loss = np.mean(self.loss_window)
            return
        
        # Son window'ın metrikleri
        current_accuracy = np.mean(self.accuracy_window)
        current_loss = np.mean(self.loss_window)
        
        # Accuracy drop
        acc_drop = self.baseline_accuracy - current_accuracy
        loss_increase = current_loss - self.baseline_loss
        
        # Threshold kontrolü
        if acc_drop > self.config.drift_threshold or loss_increase > self.config.drift_threshold:
            if not self.drift_detected:
                self.drift_detected = True
                self.drift_count += 1
                logger.warning(
                    f"Concept drift detected! "
                    f"Accuracy drop: {acc_drop:.4f}, "
                    f"Loss increase: {loss_increase:.4f}"
                )
        else:
            self.drift_detected = False
    
    def get_status(self) -> Dict:
        """Drift durumunu raporla"""
        return {
            'drift_detected': self.drift_detected,
            'drift_count': self.drift_count,
            'window_size': len(self.accuracy_window),
            'current_accuracy': np.mean(self.accuracy_window) if self.accuracy_window else 0,
            'baseline_accuracy': self.baseline_accuracy
        }


class ContinualLearningService:
    """
    Continual Learning ana servisi.
    """
    
    def __init__(
        self,
        model: nn.Module,
        config: ContinualLearningConfig,
        input_shape: Tuple[int, ...] = (3, 224, 224)
    ):
        self.model = model
        self.config = config
        self.input_shape = input_shape
        
        # Methods
        self.ewc = ElasticWeightConsolidation(model, config) if config.method == "ewc" else None
        self.replay = ExperienceReplay(config, input_shape) if config.method == "replay" else None
        self.lwf = LearningWithoutForgetting(model, config) if config.method == "lwf" else None
        self.drift_detector = ConceptDriftDetector(config)
        
        self.current_task = 0
        self.task_names: Dict[int, str] = {}
        
    def train_task(
        self,
        dataloader: DataLoader,
        task_name: str,
        num_epochs: int = 10
    ) -> Dict:
        """
        Yeni task için eğitim.
        """
        logger.info(f"Training task {self.current_task}: {task_name}")
        self.task_names[self.current_task] = task_name
        
        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.001)
        
        history = {'loss': [], 'accuracy': []}
        
        for epoch in range(num_epochs):
            self.model.train()
            epoch_loss = 0
            correct = 0
            total = 0
            
            for batch in dataloader:
                images, labels = batch[0], batch[1]
                if torch.cuda.is_available():
                    images, labels = images.cuda(), labels.cuda()
                
                optimizer.zero_grad()
                
                # Forward
                outputs = self.model(images)
                loss = F.cross_entropy(outputs, labels)
                
                # Continual learning penalty
                if self.ewc:
                    ewc_penalty = self.ewc.penalty(self.model)
                    loss = loss + ewc_penalty
                
                if self.lwf:
                    # LwF requires logits from previous model
                    # Implementation would need current batch for previous model
                    pass
                
                # Replay samples
                if self.replay:
                    replay_samples = self.replay.sample(self.config.replay_batch_size)
                    if replay_samples:
                        r_images, r_labels, _ = replay_samples
                        if torch.cuda.is_available():
                            r_images, r_labels = r_images.cuda(), r_labels.cuda()
                        
                        r_outputs = self.model(r_images)
                        r_loss = F.cross_entropy(r_outputs, r_labels)
                        loss = loss + r_loss
                
                # Backward
                loss.backward()
                optimizer.step()
                
                epoch_loss += loss.item()
                
                # Accuracy
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
            
            avg_loss = epoch_loss / len(dataloader)
            accuracy = correct / total if total > 0 else 0
            
            history['loss'].append(avg_loss)
            history['accuracy'].append(accuracy)
            
            # Drift detection
            self.drift_detector.update(accuracy, avg_loss)
            
            logger.info(
                f"Epoch {epoch+1}/{num_epochs} - "
                f"Loss: {avg_loss:.4f}, Acc: {accuracy:.4f}"
            )
        
        # Add samples to replay buffer
        if self.replay:
            for batch in dataloader:
                images, labels = batch[0], batch[1]
                self.replay.add_samples(images, labels, self.current_task)
        
        # On task completion
        if self.ewc:
            self.ewc.on_task_completion(self.current_task, dataloader)
        
        if self.lwf:
            self.lwf.on_task_completion(self.current_task)
        
        self.current_task += 1
        
        return history
    
    def evaluate_all_tasks(self, task_dataloaders: Dict[int, DataLoader]) -> Dict:
        """Tüm task'ları değerlendir"""
        results = {}
        
        for task_id, dataloader in task_dataloaders.items():
            if task_id not in self.task_names:
                continue
            
            accuracy = self._evaluate_task(dataloader)
            results[self.task_names[task_id]] = accuracy
        
        return results
    
    def _evaluate_task(self, dataloader: DataLoader) -> float:
        """Tek task değerlendir"""
        self.model.eval()
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch in dataloader:
                images, labels = batch[0], batch[1]
                if torch.cuda.is_available():
                    images, labels = images.cuda(), labels.cuda()
                
                outputs = self.model(images)
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
        
        return correct / total if total > 0 else 0.0
    
    def get_status(self) -> Dict:
        """Servis durumunu raporla"""
        return {
            'current_task': self.current_task,
            'task_names': self.task_names,
            'drift_status': self.drift_detector.get_status(),
            'buffer_size': self.replay.current_size if self.replay else 0,
            'method': self.config.method
        }


# Global continual learning servisi
cl_config = ContinualLearningConfig(method="ewc")
# continual_learning_service = ContinualLearningService(model, cl_config)
