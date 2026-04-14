"""
OptiPlan 360 - Meta-Learning Service
AI-030: Few-shot learning ve model-agnostic meta-learning (MAML)

Bu modül:
- MAML (Model-Agnostic Meta-Learning)
- Prototypical Networks
- Relation Networks
- Task-aware feature extraction
- Support/query set handling
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass
import numpy as np
import logging
from copy import deepcopy

logger = logging.getLogger(__name__)


@dataclass
class MetaLearningConfig:
    """Meta-learning konfigürasyonu"""
    method: str = "maml"  # maml, protonet, relation
    
    # MAML
    inner_lr: float = 0.01
    inner_steps: int = 5
    first_order: bool = False  # First-order MAML (FOMAML)
    
    # Few-shot
    n_way: int = 5  # Sınıf sayısı
    k_shot: int = 1  # Örnek sayısı per sınıf
    q_query: int = 15  # Query örnek sayısı
    
    # Training
    meta_lr: float = 0.001
    meta_batch_size: int = 4  # Task sayısı per meta-batch
    num_iterations: int = 60000
    
    # Prototypical Networks
    distance_metric: str = "euclidean"  # euclidean, cosine


class Task:
    """
    Few-shot learning task tanımı.
    
    Support set: K-shot örnekler (eğitim için)
    Query set: Test örnekleri (değerlendirme için)
    """
    
    def __init__(
        self,
        support_x: torch.Tensor,
        support_y: torch.Tensor,
        query_x: torch.Tensor,
        query_y: torch.Tensor,
        class_names: Optional[List[str]] = None
    ):
        self.support_x = support_x
        self.support_y = support_y
        self.query_x = query_x
        self.query_y = query_y
        self.class_names = class_names
        
    def to(self, device: str):
        """Tüm tensörleri cihaza taşı"""
        self.support_x = self.support_x.to(device)
        self.support_y = self.support_y.to(device)
        self.query_x = self.query_x.to(device)
        self.query_y = self.query_y.to(device)
        return self


class MAML:
    """
    Model-Agnostic Meta-Learning (MAML).
    
    "Learning to learn fast": Birkaç gradient step ile yeni task'lara adapte ol.
    """
    
    def __init__(
        self,
        model: nn.Module,
        config: MetaLearningConfig,
        device: str = "cuda"
    ):
        self.model = model
        self.config = config
        self.device = device
        
        # Meta-optimizer
        self.meta_optimizer = torch.optim.Adam(
            self.model.parameters(),
            lr=config.meta_lr
        )
        
        self.inner_optimizer_cls = torch.optim.SGD
        
    def inner_loop(
        self,
        task: Task,
        create_graph: bool = True
    ) -> Tuple[nn.Module, torch.Tensor]:
        """
        Inner loop: Task-specific adaptation.
        
        Support set üzerinde birkaç gradient step.
        
        Returns:
            adapted_model: Adapted model
            inner_loss: Son inner loop loss
        """
        # Clone model
        adapted_model = deepcopy(self.model)
        adapted_model.train()
        
        # Inner optimizer
        inner_opt = self.inner_optimizer_cls(
            adapted_model.parameters(),
            lr=self.config.inner_lr
        )
        
        # Inner loop
        for step in range(self.config.inner_steps):
            # Forward on support set
            logits = adapted_model(task.support_x)
            inner_loss = F.cross_entropy(logits, task.support_y)
            
            # Backward
            inner_opt.zero_grad()
            inner_loss.backward(create_graph=create_graph)
            inner_opt.step()
            
            # First-order MAML: don't create computation graph
            if self.config.first_order:
                for param in adapted_model.parameters():
                    if param.grad is not None:
                        param.grad.detach_()
        
        # Final loss on query set
        query_logits = adapted_model(task.query_x)
        query_loss = F.cross_entropy(query_logits, task.query_y)
        
        # Accuracy
        with torch.no_grad():
            query_acc = (query_logits.argmax(1) == task.query_y).float().mean()
        
        return adapted_model, query_loss, query_acc
    
    def meta_train_step(self, batch_tasks: List[Task]) -> Dict[str, float]:
        """
        Meta-training step.
        
        Args:
            batch_tasks: List of Task objects
            
        Returns:
            Metrics dictionary
        """
        self.model.train()
        self.meta_optimizer.zero_grad()
        
        meta_loss = 0.0
        meta_acc = 0.0
        
        for task in batch_tasks:
            # Move to device
            task = task.to(self.device)
            
            # Inner loop
            adapted_model, query_loss, query_acc = self.inner_loop(
                task,
                create_graph=not self.config.first_order
            )
            
            # Accumulate meta-loss
            meta_loss += query_loss
            meta_acc += query_acc.item()
        
        # Average over tasks
        meta_loss = meta_loss / len(batch_tasks)
        meta_acc = meta_acc / len(batch_tasks)
        
        # Meta-backward
        meta_loss.backward()
        self.meta_optimizer.step()
        
        return {
            'meta_loss': meta_loss.item(),
            'meta_acc': meta_acc,
            'n_tasks': len(batch_tasks)
        }
    
    def evaluate(self, test_tasks: List[Task]) -> Dict[str, float]:
        """
        Test task'larını değerlendir.
        """
        self.model.eval()
        
        total_acc = 0.0
        total_loss = 0.0
        
        with torch.no_grad():
            for task in test_tasks:
                task = task.to(self.device)
                
                # Adapt
                adapted_model, query_loss, query_acc = self.inner_loop(
                    task,
                    create_graph=False
                )
                
                total_acc += query_acc.item()
                total_loss += query_loss.item()
        
        return {
            'test_acc': total_acc / len(test_tasks),
            'test_loss': total_loss / len(test_tasks)
        }


class PrototypicalNetworks:
    """
    Prototypical Networks.
    
    Her sınıf için prototype (centroid) hesapla,
    query örneklerini en yakın prototype'a göre sınıflandır.
    """
    
    def __init__(
        self,
        encoder: nn.Module,
        config: MetaLearningConfig,
        device: str = "cuda"
    ):
        self.encoder = encoder
        self.config = config
        self.device = device
        
        self.optimizer = torch.optim.Adam(
            self.encoder.parameters(),
            lr=config.meta_lr
        )
        
    def compute_prototypes(
        self,
        support_x: torch.Tensor,
        support_y: torch.Tensor
    ) -> torch.Tensor:
        """
        Support set'ten prototype vektörleri hesapla.
        
        prototype_c = mean(encoder(x)) for x in class c
        
        Returns:
            prototypes: (n_way, feature_dim)
        """
        # Encode support set
        support_features = self.encoder(support_x)
        
        n_way = self.config.n_way
        feature_dim = support_features.size(1)
        
        # Compute prototypes
        prototypes = torch.zeros(n_way, feature_dim).to(self.device)
        
        for c in range(n_way):
            mask = (support_y == c)
            if mask.sum() > 0:
                prototypes[c] = support_features[mask].mean(0)
        
        return prototypes
    
    def distance(self, x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
        """
        Compute distance between x and y.
        
        x: (n, d)
        y: (m, d)
        
        Returns: (n, m) distance matrix
        """
        if self.config.distance_metric == "euclidean":
            # Negative squared Euclidean distance
            n = x.size(0)
            m = y.size(0)
            d = x.size(1)
            
            x = x.unsqueeze(1).expand(n, m, d)
            y = y.unsqueeze(0).expand(n, m, d)
            
            return -torch.pow(x - y, 2).sum(2)
        
        elif self.config.distance_metric == "cosine":
            # Cosine similarity
            x_norm = F.normalize(x, p=2, dim=1)
            y_norm = F.normalize(y, p=2, dim=1)
            return torch.mm(x_norm, y_norm.t())
        
        else:
            raise ValueError(f"Unknown distance: {self.config.distance_metric}")
    
    def forward(self, task: Task) -> torch.Tensor:
        """
        Forward pass for a task.
        
        Returns:
            logits: (n_query, n_way)
        """
        # Compute prototypes
        prototypes = self.compute_prototypes(task.support_x, task.support_y)
        
        # Encode query set
        query_features = self.encoder(task.query_x)
        
        # Compute distances
        logits = self.distance(query_features, prototypes)
        
        return logits
    
    def train_step(self, batch_tasks: List[Task]) -> Dict[str, float]:
        """Training step"""
        self.encoder.train()
        self.optimizer.zero_grad()
        
        total_loss = 0.0
        total_acc = 0.0
        
        for task in batch_tasks:
            task = task.to(self.device)
            
            # Forward
            logits = self.forward(task)
            loss = F.cross_entropy(logits, task.query_y)
            
            # Accuracy
            acc = (logits.argmax(1) == task.query_y).float().mean()
            
            total_loss += loss
            total_acc += acc.item()
        
        # Average
        total_loss = total_loss / len(batch_tasks)
        total_acc = total_acc / len(batch_tasks)
        
        # Backward
        total_loss.backward()
        self.optimizer.step()
        
        return {
            'loss': total_loss.item(),
            'acc': total_acc
        }
    
    def evaluate(self, test_tasks: List[Task]) -> Dict[str, float]:
        """Evaluation"""
        self.encoder.eval()
        
        total_acc = 0.0
        
        with torch.no_grad():
            for task in test_tasks:
                task = task.to(self.device)
                logits = self.forward(task)
                acc = (logits.argmax(1) == task.query_y).float().mean()
                total_acc += acc.item()
        
        return {
            'test_acc': total_acc / len(test_tasks)
        }


class RelationNetworks:
    """
    Relation Networks.
    
    Learn a relation module to compare support and query samples.
    """
    
    def __init__(
        self,
        encoder: nn.Module,
        relation_module: nn.Module,
        config: MetaLearningConfig,
        device: str = "cuda"
    ):
        self.encoder = encoder
        self.relation_module = relation_module
        self.config = config
        self.device = device
        
        params = list(encoder.parameters()) + list(relation_module.parameters())
        self.optimizer = torch.optim.Adam(params, lr=config.meta_lr)
        
    def forward(self, task: Task) -> torch.Tensor:
        """
        Forward pass.
        
        1. Encode support and query
        2. Concatenate pairs
        3. Relation module predicts similarity
        """
        # Encode
        support_features = self.encoder(task.support_x)
        query_features = self.encoder(task.query_x)
        
        n_support = support_features.size(0)
        n_query = query_features.size(0)
        
        # Create pairs: each query with each support
        # Expand query features
        query_exp = query_features.unsqueeze(1).expand(n_query, n_support, -1)
        support_exp = support_features.unsqueeze(0).expand(n_query, n_support, -1)
        
        # Concatenate
        pairs = torch.cat([query_exp, support_exp], dim=2)
        
        # Relation module
        relations = self.relation_module(pairs.view(-1, pairs.size(2)))
        relations = relations.view(n_query, n_support)
        
        # Aggregate by class
        n_way = self.config.n_way
        logits = torch.zeros(n_query, n_way).to(self.device)
        
        for c in range(n_way):
            mask = (task.support_y == c)
            if mask.sum() > 0:
                logits[:, c] = relations[:, mask].mean(1)
        
        return logits
    
    def train_step(self, batch_tasks: List[Task]) -> Dict[str, float]:
        """Training step"""
        self.encoder.train()
        self.relation_module.train()
        self.optimizer.zero_grad()
        
        total_loss = 0.0
        total_acc = 0.0
        
        for task in batch_tasks:
            task = task.to(self.device)
            
            logits = self.forward(task)
            loss = F.cross_entropy(logits, task.query_y)
            acc = (logits.argmax(1) == task.query_y).float().mean()
            
            total_loss += loss
            total_acc += acc.item()
        
        total_loss = total_loss / len(batch_tasks)
        total_acc = total_acc / len(batch_tasks)
        
        total_loss.backward()
        self.optimizer.step()
        
        return {
            'loss': total_loss.item(),
            'acc': total_acc
        }


class TaskSampler:
    """
    Few-shot task sampler.
    
    Dataset'ten N-way K-shot task'ları örnekle.
    """
    
    def __init__(
        self,
        dataset: Dataset,
        n_way: int,
        k_shot: int,
        q_query: int,
        num_tasks: int = 1000
    ):
        self.dataset = dataset
        self.n_way = n_way
        self.k_shot = k_shot
        self.q_query = q_query
        self.num_tasks = num_tasks
        
        # Organize by class
        self.class_to_indices = self._organize_by_class()
        self.classes = list(self.class_to_indices.keys())
        
    def _organize_by_class(self) -> Dict[int, List[int]]:
        """Dataset'i sınıfa göre organize et"""
        class_to_indices = {}
        
        for idx, (_, label) in enumerate(self.dataset):
            if label not in class_to_indices:
                class_to_indices[label] = []
            class_to_indices[label].append(idx)
        
        return class_to_indices
    
    def sample_task(self) -> Task:
        """Rastgele bir task örnekle"""
        # Random classes
        selected_classes = np.random.choice(
            self.classes,
            self.n_way,
            replace=False
        )
        
        support_x = []
        support_y = []
        query_x = []
        query_y = []
        
        for class_idx, cls in enumerate(selected_classes):
            # Get indices for this class
            indices = self.class_to_indices[cls]
            
            # Random sample
            selected_indices = np.random.choice(
                indices,
                self.k_shot + self.q_query,
                replace=False
            )
            
            # Split support and query
            support_indices = selected_indices[:self.k_shot]
            query_indices = selected_indices[self.k_shot:]
            
            # Get data
            for idx in support_indices:
                x, _ = self.dataset[idx]
                support_x.append(x)
                support_y.append(class_idx)
            
            for idx in query_indices:
                x, _ = self.dataset[idx]
                query_x.append(x)
                query_y.append(class_idx)
        
        # Convert to tensors
        support_x = torch.stack(support_x)
        support_y = torch.tensor(support_y)
        query_x = torch.stack(query_x)
        query_y = torch.tensor(query_y)
        
        return Task(support_x, support_y, query_x, query_y)
    
    def sample_batch(self, batch_size: int) -> List[Task]:
        """Batch of tasks"""
        return [self.sample_task() for _ in range(batch_size)]


class MetaLearningService:
    """
    Meta-learning servisi.
    
    Few-shot learning için unified interface.
    """
    
    def __init__(
        self,
        config: MetaLearningConfig,
        device: str = "cuda"
    ):
        self.config = config
        self.device = device
        self.model = None
        self.learner = None
        
    def setup_model(self, encoder: nn.Module, relation_module: Optional[nn.Module] = None):
        """Model ve learner'ı ayarla"""
        if self.config.method == "maml":
            self.learner = MAML(encoder, self.config, self.device)
        elif self.config.method == "protonet":
            self.learner = PrototypicalNetworks(encoder, self.config, self.device)
        elif self.config.method == "relation":
            if relation_module is None:
                raise ValueError("Relation module required for Relation Networks")
            self.learner = RelationNetworks(encoder, relation_module, self.config, self.device)
        else:
            raise ValueError(f"Unknown method: {self.config.method}")
        
        self.model = encoder
        
    def train(
        self,
        train_dataset: Dataset,
        val_dataset: Optional[Dataset] = None,
        num_iterations: int = None
    ) -> Dict:
        """
        Meta-training.
        """
        num_iterations = num_iterations or self.config.num_iterations
        
        # Samplers
        train_sampler = TaskSampler(
            train_dataset,
            self.config.n_way,
            self.config.k_shot,
            self.config.q_query
        )
        
        history = {'train_loss': [], 'train_acc': [], 'val_acc': []}
        
        for iteration in range(num_iterations):
            # Sample batch of tasks
            batch_tasks = train_sampler.sample_batch(self.config.meta_batch_size)
            
            # Train
            if self.config.method == "maml":
                metrics = self.learner.meta_train_step(batch_tasks)
            else:
                metrics = self.learner.train_step(batch_tasks)
            
            history['train_loss'].append(metrics.get('meta_loss', metrics.get('loss')))
            history['train_acc'].append(metrics.get('meta_acc', metrics.get('acc')))
            
            # Validation
            if val_dataset and iteration % 100 == 0:
                val_sampler = TaskSampler(
                    val_dataset,
                    self.config.n_way,
                    self.config.k_shot,
                    self.config.q_query
                )
                val_tasks = [val_sampler.sample_task() for _ in range(100)]
                val_metrics = self.learner.evaluate(val_tasks)
                history['val_acc'].append(val_metrics['test_acc'])
                
                logger.info(
                    f"Iter {iteration}: "
                    f"train_acc={history['train_acc'][-1]:.3f}, "
                    f"val_acc={val_metrics['test_acc']:.3f}"
                )
        
        return history
    
    def predict(self, support_x: torch.Tensor, support_y: torch.Tensor, query_x: torch.Tensor) -> torch.Tensor:
        """
        Few-shot prediction.
        
        Args:
            support_x: (n_support, ...) support images
            support_y: (n_support,) support labels
            query_x: (n_query, ...) query images
            
        Returns:
            predictions: (n_query,) predicted labels
        """
        # Create dummy query labels
        query_y = torch.zeros(query_x.size(0), dtype=torch.long)
        
        task = Task(support_x, support_y, query_x, query_y)
        task = task.to(self.device)
        
        if self.config.method == "maml":
            with torch.no_grad():
                adapted_model, _, _ = self.learner.inner_loop(task, create_graph=False)
                logits = adapted_model(query_x.to(self.device))
        else:
            with torch.no_grad():
                logits = self.learner.forward(task)
        
        return logits.argmax(1)
    
    def save(self, path: str):
        """Model kaydet"""
        torch.save({
            'model_state': self.model.state_dict(),
            'config': self.config
        }, path)
        logger.info(f"Model saved to {path}")
    
    def load(self, path: str):
        """Model yükle"""
        checkpoint = torch.load(path)
        self.model.load_state_dict(checkpoint['model_state'])
        logger.info(f"Model loaded from {path}")


# Global meta-learning servisi
meta_config = MetaLearningConfig(
    method="protonet",
    n_way=5,
    k_shot=1
)
# meta_service = MetaLearningService(meta_config)
