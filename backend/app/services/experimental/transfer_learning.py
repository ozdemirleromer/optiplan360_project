"""
Transfer Learning and Fine-Tuning System
Advanced transfer learning with fine-tuning, domain adaptation, and model customization
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
import hashlib
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
import torchvision.models as models
from torch.utils.data import DataLoader, TensorDataset
from PIL import Image
import transformers
from transformers import AutoTokenizer, AutoModel, AutoModelForSequenceClassification, AutoModelForImageClassification
from sklearn.metrics import accuracy_score, mean_squared_error, f1_score
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class TransferLearningType(Enum):
    """Transfer learning types"""
    FEATURE_EXTRACTION = "feature_extraction"
    FINE_TUNING = "fine_tuning"
    FEW_SHOT_LEARNING = "few_shot_learning"
    DOMAIN_ADAPTATION = "domain_adaptation"
    MULTI_TASK_LEARNING = "multi_task_learning"
    PROGRESSIVE_NETWORKS = "progressive_networks"
    ADAPTER_TUNING = "adapter_tuning"


class FineTuningStrategy(Enum):
    """Fine-tuning strategies"""
    FULL_FINE_TUNING = "full_fine_tuning"
    LAYER_WISE_FINE_TUNING = "layer_wise_fine_tuning"
    GRADUAL_UNFREEZING = "gradual_unfreezing"
    DISCRIMINATIVE_FINE_TUNING = "discriminative_fine_tuning"
    ADAPTER_BASED_FINE_TUNING = "adapter_based_fine_tuning"
    LORA_FINE_TUNING = "lora_fine_tuning"


class ModelType(Enum):
    """Model types"""
    VISION_MODEL = "vision_model"
    LANGUAGE_MODEL = "language_model"
    MULTIMODAL_MODEL = "multimodal_model"
    AUDIO_MODEL = "audio_model"
    CUSTOM_MODEL = "custom_model"


@dataclass
class TransferLearningConfig:
    """Transfer learning configuration"""
    base_model_name: str
    model_type: ModelType
    transfer_type: TransferLearningType
    fine_tuning_strategy: FineTuningStrategy
    num_classes: int
    input_shape: Tuple[int, ...]
    learning_rate: float = 0.001
    batch_size: int = 32
    max_epochs: int = 50
    freeze_backbone: bool = True
    unfreeze_layers: int = 0
    dropout_rate: float = 0.1
    weight_decay: float = 1e-5
    early_stopping_patience: int = 10
    save_best_model: bool = True
    enable_data_augmentation: bool = True
    adapter_dim: int = 64
    lora_rank: int = 16


@dataclass
class TransferLearningResult:
    """Transfer learning result"""
    experiment_id: str
    base_model_name: str
    model_type: ModelType
    transfer_type: TransferLearningType
    fine_tuning_strategy: FineTuningStrategy
    fine_tuned_model: Any
    training_history: Dict[str, List[float]]
    validation_metrics: Dict[str, float]
    best_epoch: int
    training_time_seconds: float
    model_size_mb: float
    performance_improvement: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


class BaseModelLoader:
    """Base model loading utilities"""
    
    def __init__(self):
        self.loaded_models = {}
        
    def load_vision_model(self, model_name: str, pretrained: bool = True) -> nn.Module:
        """Load pretrained vision model"""
        try:
            if model_name == "resnet50":
                model = models.resnet50(pretrained=pretrained)
                # Remove final classification layer
                model.fc = nn.Identity()
            elif model_name == "resnet18":
                model = models.resnet18(pretrained=pretrained)
                model.fc = nn.Identity()
            elif model_name == "efficientnet_b0":
                model = models.efficientnet_b0(pretrained=pretrained)
                model.classifier[1] = nn.Identity()
            elif model_name == "vit_b_16":
                model = models.vit_b_16(pretrained=pretrained)
                model.heads.head = nn.Identity()
            elif model_name == "swin_t":
                model = models.swin_t(pretrained=pretrained)
                model.head = nn.Identity()
            else:
                # Default to ResNet50
                model = models.resnet50(pretrained=pretrained)
                model.fc = nn.Identity()
            
            self.loaded_models[model_name] = model
            logger.info(f"Loaded vision model: {model_name}")
            return model
            
        except Exception as e:
            logger.error(f"Error loading vision model {model_name}: {e}")
            raise
    
    def load_language_model(self, model_name: str, pretrained: bool = True) -> nn.Module:
        """Load pretrained language model"""
        try:
            if pretrained:
                model = AutoModel.from_pretrained(model_name)
            else:
                # Create model from config (simplified)
                config = transformers.AutoConfig.from_pretrained(model_name)
                model = AutoModel.from_config(config)
            
            self.loaded_models[model_name] = model
            logger.info(f"Loaded language model: {model_name}")
            return model
            
        except Exception as e:
            logger.error(f"Error loading language model {model_name}: {e}")
            raise
    
    def load_multimodal_model(self, model_name: str, pretrained: bool = True) -> nn.Module:
        """Load pretrained multimodal model"""
        try:
            if "clip" in model_name.lower():
                # Load CLIP model
                import clip
                model, _ = clip.load(model_name, device="cpu")
            else:
                # Default to CLIP
                import clip
                model, _ = clip.load("ViT-B/32", device="cpu")
            
            self.loaded_models[model_name] = model
            logger.info(f"Loaded multimodal model: {model_name}")
            return model
            
        except Exception as e:
            logger.error(f"Error loading multimodal model {model_name}: {e}")
            raise


class FineTuningStrategy:
    """Fine-tuning strategies implementation"""
    
    def __init__(self, config: TransferLearningConfig):
        self.config = config
        
    def apply_strategy(self, model: nn.Module) -> nn.Module:
        """Apply fine-tuning strategy to model"""
        try:
            if self.config.fine_tuning_strategy == FineTuningStrategy.FULL_FINE_TUNING:
                return self._full_fine_tuning(model)
            elif self.config.fine_tuning_strategy == FineTuningStrategy.LAYER_WISE_FINE_TUNING:
                return self._layer_wise_fine_tuning(model)
            elif self.config.fine_tuning_strategy == FineTuningStrategy.GRADUAL_UNFREEZING:
                return self._gradual_unfreezing(model)
            elif self.config.fine_tuning_strategy == FineTuningStrategy.DISCRIMINATIVE_FINE_TUNING:
                return self._discriminative_fine_tuning(model)
            elif self.config.fine_tuning_strategy == FineTuningStrategy.ADAPTER_BASED_FINE_TUNING:
                return self._adapter_based_fine_tuning(model)
            elif self.config.fine_tuning_strategy == FineTuningStrategy.LORA_FINE_TUNING:
                return self._lora_fine_tuning(model)
            else:
                return model
                
        except Exception as e:
            logger.error(f"Error applying fine-tuning strategy: {e}")
            raise
    
    def _full_fine_tuning(self, model: nn.Module) -> nn.Module:
        """Full fine-tuning - unfreeze all layers"""
        try:
            # Unfreeze all parameters
            for param in model.parameters():
                param.requires_grad = True
            
            # Add new classification head
            if hasattr(model, 'fc'):
                in_features = model.fc.in_features
                model.fc = nn.Linear(in_features, self.config.num_classes)
            elif hasattr(model, 'classifier'):
                # Handle different classifier architectures
                if hasattr(model.classifier, 'in_features'):
                    in_features = model.classifier.in_features
                elif hasattr(model.classifier, '1'):  # Sequential
                    in_features = model.classifier[1].in_features
                else:
                    in_features = 768  # Default for many transformers
                
                model.classifier = nn.Linear(in_features, self.config.num_classes)
            
            logger.info("Applied full fine-tuning strategy")
            return model
            
        except Exception as e:
            logger.error(f"Error in full fine-tuning: {e}")
            raise
    
    def _layer_wise_fine_tuning(self, model: nn.Module) -> nn.Module:
        """Layer-wise fine-tuning - unfreeze specific layers"""
        try:
            # Freeze all layers first
            for param in model.parameters():
                param.requires_grad = False
            
            # Unfreeze last N layers
            layers = list(model.children())
            for layer in layers[-self.config.unfreeze_layers:]:
                for param in layer.parameters():
                    param.requires_grad = True
            
            # Add new classification head
            if hasattr(model, 'fc'):
                in_features = model.fc.in_features
                model.fc = nn.Linear(in_features, self.config.num_classes)
            
            logger.info(f"Applied layer-wise fine-tuning with {self.config.unfreeze_layers} unfrozen layers")
            return model
            
        except Exception as e:
            logger.error(f"Error in layer-wise fine-tuning: {e}")
            raise
    
    def _gradual_unfreezing(self, model: nn.Module) -> nn.Module:
        """Gradual unfreezing - start with frozen backbone"""
        try:
            # Initially freeze all layers
            for param in model.parameters():
                param.requires_grad = False
            
            # Only unfreeze final classification layer
            if hasattr(model, 'fc'):
                for param in model.fc.parameters():
                    param.requires_grad = True
                
                # Replace with new classifier
                in_features = model.fc.in_features
                model.fc = nn.Linear(in_features, self.config.num_classes)
            
            # Store gradual unfreezing schedule
            model.unfreeze_schedule = list(range(len(list(model.children())) - self.config.unfreeze_layers, len(list(model.children()))))
            model.current_unfreeze_epoch = 0
            
            logger.info("Applied gradual unfreezing strategy")
            return model
            
        except Exception as e:
            logger.error(f"Error in gradual unfreezing: {e}")
            raise
    
    def _discriminative_fine_tuning(self, model: nn.Module) -> nn.Module:
        """Discriminative fine-tuning - different learning rates for different layers"""
        try:
            # Create parameter groups with different learning rates
            parameter_groups = []
            
            # Backbone layers with lower learning rate
            backbone_params = []
            classifier_params = []
            
            for name, param in model.named_parameters():
                if 'fc' in name or 'classifier' in name:
                    classifier_params.append(param)
                else:
                    backbone_params.append(param)
            
            # Add parameter groups
            if backbone_params:
                parameter_groups.append({
                    'params': backbone_params,
                    'lr': self.config.learning_rate * 0.1,  # 10x lower learning rate
                    'name': 'backbone'
                })
            
            if classifier_params:
                parameter_groups.append({
                    'params': classifier_params,
                    'lr': self.config.learning_rate,
                    'name': 'classifier'
                })
            
            # Store parameter groups for optimizer
            model.parameter_groups = parameter_groups
            
            # Add new classification head
            if hasattr(model, 'fc'):
                in_features = model.fc.in_features
                model.fc = nn.Linear(in_features, self.config.num_classes)
            
            logger.info("Applied discriminative fine-tuning strategy")
            return model
            
        except Exception as e:
            logger.error(f"Error in discriminative fine-tuning: {e}")
            raise
    
    def _adapter_based_fine_tuning(self, model: nn.Module) -> nn.Module:
        """Adapter-based fine-tuning - add adapter layers"""
        try:
            class AdapterLayer(nn.Module):
                def __init__(self, input_dim, adapter_dim):
                    super().__init__()
                    self.adapter = nn.Sequential(
                        nn.Linear(input_dim, adapter_dim),
                        nn.ReLU(),
                        nn.Linear(adapter_dim, input_dim)
                    )
                
                def forward(self, x):
                    return x + self.adapter(x)
            
            # Add adapters to transformer layers
            if hasattr(model, 'encoder') or hasattr(model, 'transformer'):
                # Find linear layers to add adapters
                for name, module in model.named_modules():
                    if 'linear' in name.lower() and 'output' not in name.lower():
                        if isinstance(module, nn.Linear):
                            # Add adapter after linear layer
                            adapter = AdapterLayer(module.out_features, self.config.adapter_dim)
                            # Replace module with adapter wrapper
                            parent_name = name.rsplit('.', 1)[0] if '.' in name else ''
                            if parent_name and hasattr(model, parent_name):
                                setattr(getattr(model, parent_name), name.split('.')[-1], adapter)
            
            # Add new classification head
            if hasattr(model, 'fc'):
                in_features = model.fc.in_features
                model.fc = nn.Linear(in_features, self.config.num_classes)
            
            logger.info("Applied adapter-based fine-tuning strategy")
            return model
            
        except Exception as e:
            logger.error(f"Error in adapter-based fine-tuning: {e}")
            raise
    
    def _lora_fine_tuning(self, model: nn.Module) -> nn.Module:
        """LoRA fine-tuning - Low-Rank Adaptation"""
        try:
            class LoRALayer(nn.Module):
                def __init__(self, in_features, out_features, rank, alpha=16):
                    super().__init__()
                    self.rank = rank
                    self.alpha = alpha
                    self.lora_A = nn.Parameter(torch.randn(rank, in_features))
                    self.lora_B = nn.Parameter(torch.randn(out_features, rank))
                    self.scaling = alpha / rank
                
                def forward(self, x):
                    # LoRA: W + BA
                    lora_output = (x @ self.lora_A.T) @ self.lora_B.T
                    return x + lora_output * self.scaling
            
            # Add LoRA layers to linear layers
            for name, module in model.named_modules():
                if isinstance(module, nn.Linear) and 'classifier' not in name.lower():
                    # Replace with LoRA layer
                    lora_layer = LoRALayer(
                        module.in_features, 
                        module.out_features, 
                        self.config.lora_rank
                    )
                    
                    # Keep original weights
                    lora_layer.weight = module.weight
                    lora_layer.bias = module.bias
                    
                    # Replace module
                    parent_name = name.rsplit('.', 1)[0] if '.' in name else ''
                    if parent_name and hasattr(model, parent_name):
                        setattr(getattr(model, parent_name), name.split('.')[-1], lora_layer)
            
            # Add new classification head
            if hasattr(model, 'fc'):
                in_features = model.fc.in_features
                model.fc = nn.Linear(in_features, self.config.num_classes)
            
            logger.info("Applied LoRA fine-tuning strategy")
            return model
            
        except Exception as e:
            logger.error(f"Error in LoRA fine-tuning: {e}")
            raise


class TransferLearningTrainer:
    """Transfer learning training engine"""
    
    def __init__(self, config: TransferLearningConfig):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_loader = BaseModelLoader()
        self.fine_tuning_strategy = FineTuningStrategy(config)
        
    def train_model(self, train_data: DataLoader, val_data: Optional[DataLoader] = None) -> TransferLearningResult:
        """Train transfer learning model"""
        experiment_id = f"transfer_exp_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        training_start = time.time()
        
        try:
            # Load base model
            base_model = self._load_base_model()
            
            # Apply fine-tuning strategy
            model = self.fine_tuning_strategy.apply_strategy(base_model)
            model.to(self.device)
            
            # Setup optimizer
            optimizer = self._setup_optimizer(model)
            
            # Setup criterion
            criterion = self._setup_criterion()
            
            # Training loop
            training_history = self._train_model(model, train_data, val_data, optimizer, criterion)
            
            # Calculate final metrics
            validation_metrics = self._calculate_metrics(model, val_data or train_data, criterion)
            
            # Calculate model size
            model_size = self._calculate_model_size(model)
            
            # Calculate performance improvement (simplified)
            performance_improvement = 0.0  # Would need baseline comparison
            
            training_time = time.time() - training_start
            
            # Create result
            result = TransferLearningResult(
                experiment_id=experiment_id,
                base_model_name=self.config.base_model_name,
                model_type=self.config.model_type,
                transfer_type=self.config.transfer_type,
                fine_tuning_strategy=self.config.fine_tuning_strategy,
                fine_tuned_model=model,
                training_history=training_history,
                validation_metrics=validation_metrics,
                best_epoch=self._get_best_epoch(training_history),
                training_time_seconds=training_time,
                model_size_mb=model_size,
                performance_improvement=performance_improvement,
                metadata={
                    'device': str(self.device),
                    'total_parameters': sum(p.numel() for p in model.parameters()),
                    'trainable_parameters': sum(p.numel() for p in model.parameters() if p.requires_grad)
                }
            )
            
            logger.info(f"Transfer learning training completed: {experiment_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error in transfer learning training: {e}")
            raise
    
    def _load_base_model(self) -> nn.Module:
        """Load base model"""
        try:
            if self.config.model_type == ModelType.VISION_MODEL:
                return self.model_loader.load_vision_model(self.config.base_model_name)
            elif self.config.model_type == ModelType.LANGUAGE_MODEL:
                return self.model_loader.load_language_model(self.config.base_model_name)
            elif self.config.model_type == ModelType.MULTIMODAL_MODEL:
                return self.model_loader.load_multimodal_model(self.config.base_model_name)
            else:
                raise ValueError(f"Unsupported model type: {self.config.model_type}")
                
        except Exception as e:
            logger.error(f"Error loading base model: {e}")
            raise
    
    def _setup_optimizer(self, model: nn.Module) -> optim.Optimizer:
        """Setup optimizer based on fine-tuning strategy"""
        try:
            if hasattr(model, 'parameter_groups'):
                # Discriminative fine-tuning
                return optim.AdamW(model.parameter_groups, lr=self.config.learning_rate, weight_decay=self.config.weight_decay)
            else:
                # Standard fine-tuning
                trainable_params = [p for p in model.parameters() if p.requires_grad]
                return optim.AdamW(trainable_params, lr=self.config.learning_rate, weight_decay=self.config.weight_decay)
                
        except Exception as e:
            logger.error(f"Error setting up optimizer: {e}")
            raise
    
    def _setup_criterion(self) -> nn.Module:
        """Setup loss criterion"""
        try:
            if self.config.num_classes > 2:
                return nn.CrossEntropyLoss()
            else:
                return nn.BCEWithLogitsLoss()
                
        except Exception as e:
            logger.error(f"Error setting up criterion: {e}")
            raise
    
    def _train_model(self, model: nn.Module, train_data: DataLoader, 
                   val_data: Optional[DataLoader], optimizer: optim.Optimizer, 
                   criterion: nn.Module) -> Dict[str, List[float]]:
        """Train the model"""
        try:
            training_history = {
                'train_loss': [],
                'train_accuracy': [],
                'val_loss': [],
                'val_accuracy': []
            }
            
            best_val_loss = float('inf')
            patience_counter = 0
            
            for epoch in range(self.config.max_epochs):
                # Training phase
                model.train()
                train_loss = 0.0
                train_correct = 0
                train_total = 0
                
                for batch_idx, (data, targets) in enumerate(train_data):
                    data, targets = data.to(self.device), targets.to(self.device)
                    
                    optimizer.zero_grad()
                    outputs = model(data)
                    
                    # Handle different output formats
                    if len(outputs.shape) == 1:
                        outputs = outputs.unsqueeze(1)
                    
                    loss = criterion(outputs, targets)
                    loss.backward()
                    optimizer.step()
                    
                    train_loss += loss.item()
                    
                    # Calculate accuracy
                    if self.config.num_classes > 2:
                        _, predicted = torch.max(outputs.data, 1)
                    else:
                        predicted = (outputs > 0.5).float()
                    
                    train_correct += (predicted == targets).sum().item()
                    train_total += targets.size(0)
                
                # Calculate training metrics
                train_accuracy = 100.0 * train_correct / train_total
                avg_train_loss = train_loss / len(train_data)
                
                training_history['train_loss'].append(avg_train_loss)
                training_history['train_accuracy'].append(train_accuracy)
                
                # Validation phase
                if val_data:
                    model.eval()
                    val_loss = 0.0
                    val_correct = 0
                    val_total = 0
                    
                    with torch.no_grad():
                        for data, targets in val_data:
                            data, targets = data.to(self.device), targets.to(self.device)
                            outputs = model(data)
                            
                            if len(outputs.shape) == 1:
                                outputs = outputs.unsqueeze(1)
                            
                            loss = criterion(outputs, targets)
                            val_loss += loss.item()
                            
                            if self.config.num_classes > 2:
                                _, predicted = torch.max(outputs.data, 1)
                            else:
                                predicted = (outputs > 0.5).float()
                            
                            val_correct += (predicted == targets).sum().item()
                            val_total += targets.size(0)
                    
                    # Calculate validation metrics
                    val_accuracy = 100.0 * val_correct / val_total
                    avg_val_loss = val_loss / len(val_data)
                    
                    training_history['val_loss'].append(avg_val_loss)
                    training_history['val_accuracy'].append(val_accuracy)
                    
                    # Early stopping
                    if avg_val_loss < best_val_loss:
                        best_val_loss = avg_val_loss
                        patience_counter = 0
                        
                        # Save best model
                        if self.config.save_best_model:
                            self._save_best_model(model, epoch)
                    else:
                        patience_counter += 1
                        
                        if patience_counter >= self.config.early_stopping_patience:
                            logger.info(f"Early stopping at epoch {epoch}")
                            break
                
                # Gradual unfreezing
                if (self.config.fine_tuning_strategy == FineTuningStrategy.GRADUAL_UNFREEZING and 
                    hasattr(model, 'unfreeze_schedule') and 
                    epoch in model.unfreeze_schedule):
                    self._unfreeze_next_layer(model, epoch)
                
                # Log progress
                if epoch % 10 == 0:
                    logger.info(f"Epoch {epoch}, Train Loss: {avg_train_loss:.4f}, Train Acc: {train_accuracy:.2f}%, "
                               f"Val Loss: {avg_val_loss:.4f if val_data else 'N/A'}, Val Acc: {val_accuracy:.2f}%")
            
            return training_history
            
        except Exception as e:
            logger.error(f"Error in model training: {e}")
            raise
    
    def _unfreeze_next_layer(self, model: nn.Module, epoch: int) -> None:
        """Unfreeze next layer in gradual unfreezing"""
        try:
            if hasattr(model, 'current_unfreeze_epoch') and epoch > model.current_unfreeze_epoch:
                layers = list(model.children())
                layer_to_unfreeze = model.unfreeze_schedule[model.current_unfreeze_epoch]
                
                if layer_to_unfreeze < len(layers):
                    for param in layers[layer_to_unfreeze].parameters():
                        param.requires_grad = True
                    
                    model.current_unfreeze_epoch += 1
                    logger.info(f"Unfroze layer {layer_to_unfreeze} at epoch {epoch}")
                    
        except Exception as e:
            logger.error(f"Error in gradual unfreezing: {e}")
    
    def _calculate_metrics(self, model: nn.Module, data: DataLoader, criterion: nn.Module) -> Dict[str, float]:
        """Calculate final metrics"""
        try:
            model.eval()
            total_loss = 0.0
            correct = 0
            total = 0
            
            with torch.no_grad():
                for batch_data, targets in data:
                    batch_data, targets = batch_data.to(self.device), targets.to(self.device)
                    outputs = model(batch_data)
                    
                    if len(outputs.shape) == 1:
                        outputs = outputs.unsqueeze(1)
                    
                    loss = criterion(outputs, targets)
                    total_loss += loss.item()
                    
                    if self.config.num_classes > 2:
                        _, predicted = torch.max(outputs.data, 1)
                    else:
                        predicted = (outputs > 0.5).float()
                    
                    correct += (predicted == targets).sum().item()
                    total += targets.size(0)
            
            accuracy = 100.0 * correct / total
            avg_loss = total_loss / len(data)
            
            return {
                'accuracy': accuracy,
                'loss': avg_loss,
                'f1_score': 0.0,  # Would need more calculation
                'precision': 0.0,  # Would need more calculation
                'recall': 0.0     # Would need more calculation
            }
            
        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            return {'accuracy': 0.0, 'loss': float('inf')}
    
    def _calculate_model_size(self, model: nn.Module) -> float:
        """Calculate model size in MB"""
        try:
            param_size = 0
            buffer_size = 0
            
            for param in model.parameters():
                param_size += param.nelement() * param.element_size()
            
            for buffer in model.buffers():
                buffer_size += buffer.nelement() * buffer.element_size()
            
            total_size = (param_size + buffer_size) / (1024 * 1024)  # Convert to MB
            return total_size
            
        except Exception as e:
            logger.error(f"Error calculating model size: {e}")
            return 0.0
    
    def _get_best_epoch(self, training_history: Dict[str, List[float]]) -> int:
        """Get best epoch from training history"""
        try:
            if 'val_loss' in training_history and training_history['val_loss']:
                best_val_loss = min(training_history['val_loss'])
                return training_history['val_loss'].index(best_val_loss)
            else:
                return len(training_history['train_loss']) - 1
                
        except Exception as e:
            logger.error(f"Error getting best epoch: {e}")
            return 0
    
    def _save_best_model(self, model: nn.Module, epoch: int) -> None:
        """Save best model"""
        try:
            model_path = f"best_transfer_model_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_epoch_{epoch}.pt"
            torch.save(model.state_dict(), model_path)
            logger.info(f"Saved best model to {model_path}")
            
        except Exception as e:
            logger.error(f"Error saving best model: {e}")


class TransferLearningService:
    """Main transfer learning service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.trainer = None
        self.experiments = {}
        
    def create_transfer_learning_experiment(self, config: TransferLearningConfig) -> str:
        """Create transfer learning experiment"""
        experiment_id = f"transfer_exp_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            self.trainer = TransferLearningTrainer(config)
            self.experiments[experiment_id] = {
                'config': config,
                'trainer': self.trainer,
                'created_at': datetime.utcnow()
            }
            
            # Save to Redis
            if self.redis:
                self._save_experiment(experiment_id, config)
            
            logger.info(f"Created transfer learning experiment {experiment_id}")
            return experiment_id
            
        except Exception as e:
            logger.error(f"Error creating transfer learning experiment: {e}")
            raise
    
    def train_transfer_model(self, experiment_id: str, train_data: DataLoader, 
                          val_data: Optional[DataLoader] = None) -> TransferLearningResult:
        """Train transfer learning model"""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        try:
            trainer = self.experiments[experiment_id]['trainer']
            result = trainer.train_model(train_data, val_data)
            
            # Store result
            self.experiments[experiment_id]['result'] = result
            
            # Save to Redis
            if self.redis:
                self._save_result(experiment_id, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error training transfer model: {e}")
            raise
    
    def get_experiment_info(self, experiment_id: str) -> Dict[str, Any]:
        """Get experiment information"""
        if experiment_id not in self.experiments:
            return {'error': f'Experiment {experiment_id} not found'}
        
        experiment_data = self.experiments[experiment_id]
        config = experiment_data['config']
        
        return {
            'experiment_id': experiment_id,
            'base_model_name': config.base_model_name,
            'model_type': config.model_type.value,
            'transfer_type': config.transfer_type.value,
            'fine_tuning_strategy': config.fine_tuning_strategy.value,
            'num_classes': config.num_classes,
            'learning_rate': config.learning_rate,
            'batch_size': config.batch_size,
            'max_epochs': config.max_epochs,
            'freeze_backbone': config.freeze_backbone,
            'unfreeze_layers': config.unfreeze_layers,
            'dropout_rate': config.dropout_rate,
            'weight_decay': config.weight_decay,
            'early_stopping_patience': config.early_stopping_patience,
            'created_at': experiment_data['created_at'].isoformat()
        }
    
    def list_experiments(self) -> List[Dict[str, Any]]:
        """List all transfer learning experiments"""
        experiments = []
        
        for exp_id, exp_data in self.experiments.items():
            config = exp_data['config']
            experiments.append({
                'experiment_id': exp_id,
                'base_model_name': config.base_model_name,
                'model_type': config.model_type.value,
                'transfer_type': config.transfer_type.value,
                'fine_tuning_strategy': config.fine_tuning_strategy.value,
                'num_classes': config.num_classes,
                'created_at': exp_data['created_at'].isoformat(),
                'has_result': 'result' in exp_data
            })
        
        return experiments
    
    def _save_experiment(self, experiment_id: str, config: TransferLearningConfig) -> None:
        """Save experiment to Redis"""
        try:
            experiment_data = {
                'experiment_id': experiment_id,
                'base_model_name': config.base_model_name,
                'model_type': config.model_type.value,
                'transfer_type': config.transfer_type.value,
                'fine_tuning_strategy': config.fine_tuning_strategy.value,
                'num_classes': config.num_classes,
                'learning_rate': config.learning_rate,
                'batch_size': config.batch_size,
                'max_epochs': config.max_epochs,
                'freeze_backbone': config.freeze_backbone,
                'unfreeze_layers': config.unfreeze_layers,
                'dropout_rate': config.dropout_rate,
                'weight_decay': config.weight_decay,
                'early_stopping_patience': config.early_stopping_patience,
                'created_at': datetime.utcnow().isoformat()
            }
            
            self.redis.setex(f"transfer_experiment:{experiment_id}", 
                           86400 * 30, json.dumps(experiment_data))  # 30 days TTL
            
            logger.info(f"Saved transfer learning experiment {experiment_id}")
            
        except Exception as e:
            logger.error(f"Failed to save experiment: {e}")
    
    def _save_result(self, experiment_id: str, result: TransferLearningResult) -> None:
        """Save training result to Redis"""
        try:
            result_data = {
                'experiment_id': experiment_id,
                'base_model_name': result.base_model_name,
                'model_type': result.model_type.value,
                'transfer_type': result.transfer_type.value,
                'fine_tuning_strategy': result.fine_tuning_strategy.value,
                'validation_metrics': result.validation_metrics,
                'best_epoch': result.best_epoch,
                'training_time_seconds': result.training_time_seconds,
                'model_size_mb': result.model_size_mb,
                'performance_improvement': result.performance_improvement,
                'metadata': result.metadata,
                'created_at': result.created_at.isoformat()
            }
            
            self.redis.setex(f"transfer_result:{experiment_id}", 
                           86400 * 30, json.dumps(result_data))  # 30 days TTL
            
            logger.info(f"Saved transfer learning result {experiment_id}")
            
        except Exception as e:
            logger.error(f"Failed to save result: {e}")


# Global transfer learning service instance
transfer_learning_service = TransferLearningService()

# Export functions
def create_transfer_learning_experiment(config: TransferLearningConfig) -> str:
    """Create transfer learning experiment"""
    return transfer_learning_service.create_transfer_learning_experiment(config)

def train_transfer_model(experiment_id: str, train_data: DataLoader, 
                       val_data: Optional[DataLoader] = None) -> TransferLearningResult:
    """Train transfer learning model"""
    return transfer_learning_service.train_transfer_model(experiment_id, train_data, val_data)

def get_transfer_experiment_info(experiment_id: str) -> Dict[str, Any]:
    """Get transfer learning experiment info"""
    return transfer_learning_service.get_experiment_info(experiment_id)

def list_transfer_learning_experiments() -> List[Dict[str, Any]]:
    """List transfer learning experiments"""
    return transfer_learning_service.list_experiments()

# Export all components
__all__ = [
    'TransferLearningType',
    'FineTuningStrategy',
    'ModelType',
    'TransferLearningConfig',
    'TransferLearningResult',
    'BaseModelLoader',
    'FineTuningStrategy',
    'TransferLearningTrainer',
    'TransferLearningService',
    'create_transfer_learning_experiment',
    'train_transfer_model',
    'get_transfer_experiment_info',
    'list_transfer_learning_experiments',
    'transfer_learning_service',
]
