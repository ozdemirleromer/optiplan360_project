"""
Multi-Modal AI and Cross-Modal Learning System
Advanced multi-modal AI with cross-modal learning and fusion capabilities
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
from torch.utils.data import DataLoader, TensorDataset
import torchvision.transforms as transforms
import torchvision.models as models
from PIL import Image
import cv2
import transformers
from transformers import AutoTokenizer, AutoModel, AutoProcessor, BlipProcessor, BlipForConditionalGeneration
from sklearn.metrics import accuracy_score, mean_squared_error
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class ModalityType(Enum):
    """Modality types"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    TABULAR = "tabular"
    SENSOR = "sensor"
    GRAPH = "graph"
    TIME_SERIES = "time_series"


class FusionType(Enum):
    """Fusion types"""
    EARLY_FUSION = "early_fusion"
    LATE_FUSION = "late_fusion"
    INTERMEDIATE_FUSION = "intermediate_fusion"
    ATTENTION_FUSION = "attention_fusion"
    GATING_FUSION = "gating_fusion"
    CROSS_MODAL_ATTENTION = "cross_modal_attention"


class CrossModalTask(Enum):
    """Cross-modal tasks"""
    IMAGE_TEXT_RETRIEVAL = "image_text_retrieval"
    TEXT_IMAGE_GENERATION = "text_image_generation"
    VISUAL_QUESTION_ANSWERING = "visual_question_answering"
    IMAGE_CAPTIONING = "image_captioning"
    TEXT_TO_SPEECH = "text_to_speech"
    SPEECH_TO_TEXT = "speech_to_text"
    MULTI_MODAL_CLASSIFICATION = "multi_modal_classification"
    CROSS_MODAL_TRANSLATION = "cross_modal_translation"


@dataclass
class ModalityData:
    """Multi-modal data representation"""
    modality_type: ModalityType
    data: Any
    metadata: Dict[str, Any] = field(default_factory=dict)
    embeddings: Optional[np.ndarray] = None
    preprocessed: bool = False
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CrossModalSample:
    """Cross-modal training sample"""
    sample_id: str
    modalities: Dict[ModalityType, ModalityData]
    labels: Dict[str, Any] = field(default_factory=dict)
    task_type: CrossModalTask
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MultiModalConfig:
    """Multi-modal AI configuration"""
    modalities: List[ModalityType]
    fusion_type: FusionType
    task_type: CrossModalTask
    embedding_dim: int = 512
    hidden_dim: int = 256
    num_classes: int = 10
    learning_rate: float = 0.001
    batch_size: int = 32
    max_epochs: int = 100
    dropout_rate: float = 0.1
    weight_decay: float = 1e-5
    enable_pretraining: bool = True
    cross_modal_attention_heads: int = 8


class ModalityEncoder:
    """Encoder for different modalities"""
    
    def __init__(self, config: MultiModalConfig):
        self.config = config
        self.encoders = {}
        self.tokenizers = {}
        self.processors = {}
        
    def build_encoders(self) -> None:
        """Build encoders for all modalities"""
        for modality in self.config.modalities:
            if modality == ModalityType.TEXT:
                self._build_text_encoder()
            elif modality == ModalityType.IMAGE:
                self._build_image_encoder()
            elif modality == ModalityType.AUDIO:
                self._build_audio_encoder()
            elif modality == ModalityType.VIDEO:
                self._build_video_encoder()
            elif modality == ModalityType.TABULAR:
                self._build_tabular_encoder()
    
    def _build_text_encoder(self) -> None:
        """Build text encoder"""
        try:
            # Use BERT for text encoding
            model_name = "bert-base-uncased"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name)
            
            self.tokenizers[ModalityType.TEXT] = tokenizer
            self.encoders[ModalityType.TEXT] = model
            
            logger.info("Built BERT text encoder")
            
        except Exception as e:
            logger.error(f"Error building text encoder: {e}")
            raise
    
    def _build_image_encoder(self) -> None:
        """Build image encoder"""
        try:
            # Use ResNet for image encoding
            model = models.resnet50(pretrained=True)
            # Remove final classification layer
            model = nn.Sequential(*list(model.children())[:-1])
            
            # Image preprocessing
            processor = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                   std=[0.229, 0.224, 0.225])
            ])
            
            self.processors[ModalityType.IMAGE] = processor
            self.encoders[ModalityType.IMAGE] = model
            
            logger.info("Built ResNet image encoder")
            
        except Exception as e:
            logger.error(f"Error building image encoder: {e}")
            raise
    
    def _build_audio_encoder(self) -> None:
        """Build audio encoder"""
        try:
            # Simple audio encoder using 1D CNN
            class AudioEncoder(nn.Module):
                def __init__(self, input_dim=1, hidden_dim=256, output_dim=512):
                    super().__init__()
                    self.conv1 = nn.Conv1d(input_dim, 64, kernel_size=3, padding=1)
                    self.conv2 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
                    self.conv3 = nn.Conv1d(128, 256, kernel_size=3, padding=1)
                    self.pool = nn.AdaptiveAvgPool1d(1)
                    self.fc = nn.Linear(256, output_dim)
                    self.relu = nn.ReLU()
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, x):
                    x = self.relu(self.conv1(x))
                    x = self.relu(self.conv2(x))
                    x = self.relu(self.conv3(x))
                    x = self.pool(x).squeeze(-1)
                    x = self.dropout(self.fc(x))
                    return x
            
            self.encoders[ModalityType.AUDIO] = AudioEncoder()
            
            logger.info("Built audio encoder")
            
        except Exception as e:
            logger.error(f"Error building audio encoder: {e}")
            raise
    
    def _build_video_encoder(self) -> None:
        """Build video encoder"""
        try:
            # Use 3D CNN for video encoding
            class VideoEncoder(nn.Module):
                def __init__(self, input_channels=3, hidden_dim=256, output_dim=512):
                    super().__init__()
                    self.conv1 = nn.Conv3d(input_channels, 64, kernel_size=(3, 3, 3), padding=1)
                    self.conv2 = nn.Conv3d(64, 128, kernel_size=(3, 3, 3), padding=1)
                    self.conv3 = nn.Conv3d(128, 256, kernel_size=(3, 3, 3), padding=1)
                    self.pool = nn.AdaptiveAvgPool3d((1, 1, 1))
                    self.fc = nn.Linear(256, output_dim)
                    self.relu = nn.ReLU()
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, x):
                    # x shape: (batch, channels, depth, height, width)
                    x = self.relu(self.conv1(x))
                    x = self.relu(self.conv2(x))
                    x = self.relu(self.conv3(x))
                    x = self.pool(x).view(x.size(0), -1)
                    x = self.dropout(self.fc(x))
                    return x
            
            self.encoders[ModalityType.VIDEO] = VideoEncoder()
            
            logger.info("Built video encoder")
            
        except Exception as e:
            logger.error(f"Error building video encoder: {e}")
            raise
    
    def _build_tabular_encoder(self) -> None:
        """Build tabular encoder"""
        try:
            class TabularEncoder(nn.Module):
                def __init__(self, input_dim, hidden_dim=256, output_dim=512):
                    super().__init__()
                    self.fc1 = nn.Linear(input_dim, hidden_dim)
                    self.fc2 = nn.Linear(hidden_dim, hidden_dim)
                    self.fc3 = nn.Linear(hidden_dim, output_dim)
                    self.relu = nn.ReLU()
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, x):
                    x = self.relu(self.fc1(x))
                    x = self.dropout(x)
                    x = self.relu(self.fc2(x))
                    x = self.dropout(x)
                    x = self.fc3(x)
                    return x
            
            # Note: input_dim needs to be set based on data
            self.encoders[ModalityType.TABULAR] = TabularEncoder(
                input_dim=100,  # Will be updated based on actual data
                hidden_dim=self.config.hidden_dim,
                output_dim=self.config.embedding_dim
            )
            
            logger.info("Built tabular encoder")
            
        except Exception as e:
            logger.error(f"Error building tabular encoder: {e}")
            raise
    
    def encode_modality(self, modality: ModalityType, data: Any) -> np.ndarray:
        """Encode data for specific modality"""
        try:
            if modality not in self.encoders:
                raise ValueError(f"Encoder for modality {modality} not built")
            
            encoder = self.encoders[modality]
            
            if modality == ModalityType.TEXT:
                return self._encode_text(data)
            elif modality == ModalityType.IMAGE:
                return self._encode_image(data)
            elif modality == ModalityType.AUDIO:
                return self._encode_audio(data)
            elif modality == ModalityType.VIDEO:
                return self._encode_video(data)
            elif modality == ModalityType.TABULAR:
                return self._encode_tabular(data)
            else:
                raise ValueError(f"Unsupported modality: {modality}")
                
        except Exception as e:
            logger.error(f"Error encoding modality {modality}: {e}")
            raise
    
    def _encode_text(self, text: str) -> np.ndarray:
        """Encode text using BERT"""
        try:
            tokenizer = self.tokenizers[ModalityType.TEXT]
            encoder = self.encoders[ModalityType.TEXT]
            
            # Tokenize text
            inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
            
            # Get embeddings
            with torch.no_grad():
                outputs = encoder(**inputs)
                # Use [CLS] token embedding
                embeddings = outputs.last_hidden_state[:, 0, :]
            
            return embeddings.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error encoding text: {e}")
            return np.zeros((1, self.config.embedding_dim))
    
    def _encode_image(self, image: Union[str, np.ndarray, Image.Image]) -> np.ndarray:
        """Encode image using ResNet"""
        try:
            processor = self.processors[ModalityType.IMAGE]
            encoder = self.encoders[ModalityType.IMAGE]
            
            # Convert PIL Image if needed
            if isinstance(image, str):
                image = Image.open(image)
            elif isinstance(image, np.ndarray):
                image = Image.fromarray(image)
            
            # Preprocess image
            if len(image.shape) == 2:  # Grayscale
                image = image.convert('RGB')
            
            image_tensor = processor(image).unsqueeze(0)
            
            # Get embeddings
            with torch.no_grad():
                embeddings = encoder(image_tensor)
                # Flatten if needed
                embeddings = embeddings.view(embeddings.size(0), -1)
            
            return embeddings.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error encoding image: {e}")
            return np.zeros((1, self.config.embedding_dim))
    
    def _encode_audio(self, audio: np.ndarray) -> np.ndarray:
        """Encode audio using 1D CNN"""
        try:
            encoder = self.encoders[ModalityType.AUDIO]
            
            # Ensure audio is in the right format
            if len(audio.shape) == 1:
                audio = audio.reshape(1, -1, 1)  # Add channel and depth dimensions
            elif len(audio.shape) == 2:
                audio = audio.reshape(1, audio.shape[0], audio.shape[1])
            
            audio_tensor = torch.FloatTensor(audio)
            
            # Get embeddings
            with torch.no_grad():
                embeddings = encoder(audio_tensor)
            
            return embeddings.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error encoding audio: {e}")
            return np.zeros((1, self.config.embedding_dim))
    
    def _encode_video(self, video: np.ndarray) -> np.ndarray:
        """Encode video using 3D CNN"""
        try:
            encoder = self.encoders[ModalityType.VIDEO]
            
            # Ensure video is in the right format (T, H, W, C)
            if len(video.shape) == 3:
                video = np.expand_dims(video, axis=0)
            elif len(video.shape) == 4 and video.shape[-1] == 3:
                video = np.transpose(video, (0, 3, 1, 2))  # T, C, H, W
            
            video_tensor = torch.FloatTensor(video)
            
            # Get embeddings
            with torch.no_grad():
                embeddings = encoder(video_tensor)
            
            return embeddings.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error encoding video: {e}")
            return np.zeros((1, self.config.embedding_dim))
    
    def _encode_tabular(self, data: np.ndarray) -> np.ndarray:
        """Encode tabular data"""
        try:
            encoder = self.encoders[ModalityType.TABULAR]
            
            # Update input dimension if needed
            if hasattr(encoder, 'fc1'):
                current_input_dim = encoder.fc1.in_features
                if current_input_dim != data.shape[1]:
                    # Rebuild encoder with correct input dimension
                    class TabularEncoder(nn.Module):
                        def __init__(self, input_dim, hidden_dim=256, output_dim=512):
                            super().__init__()
                            self.fc1 = nn.Linear(input_dim, hidden_dim)
                            self.fc2 = nn.Linear(hidden_dim, hidden_dim)
                            self.fc3 = nn.Linear(hidden_dim, output_dim)
                            self.relu = nn.ReLU()
                            self.dropout = nn.Dropout(0.1)
                            
                        def forward(self, x):
                            x = self.relu(self.fc1(x))
                            x = self.dropout(x)
                            x = self.relu(self.fc2(x))
                            x = self.dropout(x)
                            x = self.fc3(x)
                            return x
                    
                    self.encoders[ModalityType.TABULAR] = TabularEncoder(
                        input_dim=data.shape[1],
                        hidden_dim=self.config.hidden_dim,
                        output_dim=self.config.embedding_dim
                    )
                    encoder = self.encoders[ModalityType.TABULAR]
            
            data_tensor = torch.FloatTensor(data)
            
            # Get embeddings
            with torch.no_grad():
                embeddings = encoder(data_tensor)
            
            return embeddings.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error encoding tabular data: {e}")
            return np.zeros((len(data), self.config.embedding_dim))


class CrossModalFusion:
    """Cross-modal fusion mechanisms"""
    
    def __init__(self, config: MultiModalConfig):
        self.config = config
        self.fusion_network = None
        self._build_fusion_network()
    
    def _build_fusion_network(self) -> None:
        """Build fusion network based on fusion type"""
        if self.config.fusion_type == FusionType.EARLY_FUSION:
            self._build_early_fusion()
        elif self.config.fusion_type == FusionType.LATE_FUSION:
            self._build_late_fusion()
        elif self.config.fusion_type == FusionType.ATTENTION_FUSION:
            self._build_attention_fusion()
        elif self.config.fusion_type == FusionType.CROSS_MODAL_ATTENTION:
            self._build_cross_modal_attention()
    
    def _build_early_fusion(self) -> None:
        """Build early fusion network"""
        try:
            class EarlyFusion(nn.Module):
                def __init__(self, input_dims, hidden_dim, output_dim, num_classes):
                    super().__init__()
                    self.input_dims = input_dims
                    total_input_dim = sum(input_dims)
                    
                    self.fusion_layer = nn.Linear(total_input_dim, hidden_dim)
                    self.classifier = nn.Linear(hidden_dim, num_classes)
                    self.relu = nn.ReLU()
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, modal_features):
                    # Concatenate all modalities
                    fused = torch.cat(modal_features, dim=-1)
                    
                    # Pass through fusion layers
                    fused = self.relu(self.fusion_layer(fused))
                    fused = self.dropout(fused)
                    output = self.classifier(fused)
                    
                    return output
            
            # Calculate input dimensions based on modalities
            input_dims = [self.config.embedding_dim] * len(self.config.modalities)
            
            self.fusion_network = EarlyFusion(
                input_dims=input_dims,
                hidden_dim=self.config.hidden_dim,
                output_dim=self.config.embedding_dim,
                num_classes=self.config.num_classes
            )
            
            logger.info("Built early fusion network")
            
        except Exception as e:
            logger.error(f"Error building early fusion: {e}")
            raise
    
    def _build_late_fusion(self) -> None:
        """Build late fusion network"""
        try:
            class LateFusion(nn.Module):
                def __init__(self, modality_encoders, hidden_dim, num_classes):
                    super().__init__()
                    self.modality_encoders = modality_encoders
                    self.fusion_weights = nn.Parameter(torch.ones(len(modality_encoders)))
                    self.classifier = nn.Linear(hidden_dim, num_classes)
                    self.softmax = nn.Softmax(dim=-1)
                    
                def forward(self, modal_features):
                    # Apply individual encoders
                    encoded_features = []
                    for i, (modality, encoder) in enumerate(self.modality_encoders.items()):
                        encoded = encoder(modal_features[i])
                        encoded_features.append(encoded)
                    
                    # Weighted fusion
                    weights = self.softmax(self.fusion_weights)
                    fused = sum(w * feat for w, feat in zip(weights, encoded_features))
                    
                    # Classification
                    output = self.classifier(fused)
                    
                    return output
            
            # Create individual encoders for each modality
            modality_encoders = {}
            for modality in self.config.modalities:
                modality_encoders[modality] = nn.Linear(
                    self.config.embedding_dim, self.config.hidden_dim
                )
            
            self.fusion_network = LateFusion(
                modality_encoders=modality_encoders,
                hidden_dim=self.config.hidden_dim,
                num_classes=self.config.num_classes
            )
            
            logger.info("Built late fusion network")
            
        except Exception as e:
            logger.error(f"Error building late fusion: {e}")
            raise
    
    def _build_attention_fusion(self) -> None:
        """Build attention fusion network"""
        try:
            class AttentionFusion(nn.Module):
                def __init__(self, embedding_dim, hidden_dim, num_heads, num_classes):
                    super().__init__()
                    self.embedding_dim = embedding_dim
                    self.hidden_dim = hidden_dim
                    self.num_heads = num_heads
                    self.head_dim = hidden_dim // num_heads
                    
                    self.query = nn.Linear(embedding_dim, hidden_dim)
                    self.key = nn.Linear(embedding_dim, hidden_dim)
                    self.value = nn.Linear(embedding_dim, hidden_dim)
                    
                    self.classifier = nn.Linear(hidden_dim, num_classes)
                    self.softmax = nn.Softmax(dim=-1)
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, modal_features):
                    batch_size = modal_features[0].size(0)
                    num_modalities = len(modal_features)
                    
                    # Stack modalities
                    stacked = torch.stack(modal_features, dim=1)  # [batch, modalities, embedding]
                    
                    # Compute attention
                    queries = self.query(stacked)  # [batch, modalities, hidden]
                    keys = self.key(stacked)      # [batch, modalities, hidden]
                    values = self.value(stacked)    # [batch, modalities, hidden]
                    
                    # Reshape for multi-head attention
                    queries = queries.view(batch_size, num_modalities, self.num_heads, self.head_dim)
                    keys = keys.view(batch_size, num_modalities, self.num_heads, self.head_dim)
                    values = values.view(batch_size, num_modalities, self.num_heads, self.head_dim)
                    
                    # Compute attention scores
                    attention_scores = torch.matmul(queries, keys.transpose(-2, -1))
                    attention_scores = attention_scores / (self.head_dim ** 0.5)
                    attention_weights = self.softmax(attention_scores)
                    
                    # Apply attention
                    attended = torch.matmul(attention_weights, values)
                    attended = attended.view(batch_size, num_modalities, self.hidden_dim)
                    
                    # Global pooling
                    fused = torch.mean(attended, dim=1)
                    fused = self.dropout(fused)
                    
                    # Classification
                    output = self.classifier(fused)
                    
                    return output
            
            self.fusion_network = AttentionFusion(
                embedding_dim=self.config.embedding_dim,
                hidden_dim=self.config.hidden_dim,
                num_heads=self.config.cross_modal_attention_heads,
                num_classes=self.config.num_classes
            )
            
            logger.info("Built attention fusion network")
            
        except Exception as e:
            logger.error(f"Error building attention fusion: {e}")
            raise
    
    def _build_cross_modal_attention(self) -> None:
        """Build cross-modal attention network"""
        try:
            class CrossModalAttention(nn.Module):
                def __init__(self, embedding_dim, hidden_dim, num_classes):
                    super().__init__()
                    self.embedding_dim = embedding_dim
                    self.hidden_dim = hidden_dim
                    
                    # Cross-modal attention layers
                    self.text_to_image_attn = nn.MultiheadAttention(embedding_dim, 8)
                    self.image_to_text_attn = nn.MultiheadAttention(embedding_dim, 8)
                    
                    # Fusion layers
                    self.fusion_layer = nn.Linear(embedding_dim * 2, hidden_dim)
                    self.classifier = nn.Linear(hidden_dim, num_classes)
                    self.relu = nn.ReLU()
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, modal_features):
                    # Assume first two modalities are text and image
                    if len(modal_features) < 2:
                        raise ValueError("Cross-modal attention requires at least 2 modalities")
                    
                    text_features = modal_features[0].unsqueeze(1)  # [batch, 1, embedding]
                    image_features = modal_features[1].unsqueeze(1)  # [batch, 1, embedding]
                    
                    # Cross-modal attention
                    text_attended, _ = self.text_to_image_attn(text_features, image_features, image_features)
                    image_attended, _ = self.image_to_text_attn(image_features, text_features, text_features)
                    
                    # Combine attended features
                    combined = torch.cat([text_attended.squeeze(1), image_attended.squeeze(1)], dim=-1)
                    
                    # Fusion and classification
                    fused = self.relu(self.fusion_layer(combined))
                    fused = self.dropout(fused)
                    output = self.classifier(fused)
                    
                    return output
            
            self.fusion_network = CrossModalAttention(
                embedding_dim=self.config.embedding_dim,
                hidden_dim=self.config.hidden_dim,
                num_classes=self.config.num_classes
            )
            
            logger.info("Built cross-modal attention network")
            
        except Exception as e:
            logger.error(f"Error building cross-modal attention: {e}")
            raise
    
    def fuse_modalities(self, modal_features: List[torch.Tensor]) -> torch.Tensor:
        """Fuse multiple modalities"""
        try:
            if self.fusion_network is None:
                raise ValueError("Fusion network not built")
            
            return self.fusion_network(modal_features)
            
        except Exception as e:
            logger.error(f"Error fusing modalities: {e}")
            raise


class MultiModalLearner:
    """Multi-modal learning system"""
    
    def __init__(self, config: MultiModalConfig):
        self.config = config
        self.modality_encoder = ModalityEncoder(config)
        self.fusion_network = CrossModalFusion(config)
        self.optimizer = None
        self.criterion = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Build components
        self.modality_encoder.build_encoders()
        
        # Move to device
        for encoder in self.modality_encoder.encoders.values():
            if hasattr(encoder, 'to'):
                encoder.to(self.device)
        
        if hasattr(self.fusion_network, 'fusion_network') and self.fusion_network.fusion_network:
            self.fusion_network.fusion_network.to(self.device)
        
        # Setup optimizer and criterion
        self._setup_training()
    
    def _setup_training(self) -> None:
        """Setup training components"""
        try:
            # Get all parameters
            parameters = []
            
            # Encoder parameters
            for encoder in self.modality_encoder.encoders.values():
                parameters.extend(list(encoder.parameters()))
            
            # Fusion network parameters
            if hasattr(self.fusion_network, 'fusion_network') and self.fusion_network.fusion_network:
                parameters.extend(list(self.fusion_network.fusion_network.parameters()))
            
            # Setup optimizer
            self.optimizer = optim.Adam(
                parameters,
                lr=self.config.learning_rate,
                weight_decay=self.config.weight_decay
            )
            
            # Setup criterion
            if self.config.task_type in [CrossModalTask.MULTI_MODAL_CLASSIFICATION]:
                self.criterion = nn.CrossEntropyLoss()
            else:
                self.criterion = nn.MSELoss()
            
            logger.info("Setup training components")
            
        except Exception as e:
            logger.error(f"Error setting up training: {e}")
            raise
    
    def train(self, train_samples: List[CrossModalSample], 
              val_samples: Optional[List[CrossModalSample]] = None) -> Dict[str, Any]:
        """Train multi-modal model"""
        try:
            # Prepare data loaders
            train_loader = self._prepare_data_loader(train_samples, shuffle=True)
            
            if val_samples:
                val_loader = self._prepare_data_loader(val_samples, shuffle=False)
            else:
                val_loader = None
            
            # Training loop
            train_losses = []
            val_losses = []
            best_val_loss = float('inf')
            
            for epoch in range(self.config.max_epochs):
                # Training phase
                self.fusion_network.fusion_network.train()
                epoch_train_loss = 0.0
                
                for batch_idx, batch in enumerate(train_loader):
                    # Extract modalities and labels
                    modal_features = []
                    labels = batch['labels']
                    
                    # Encode each modality
                    for modality in self.config.modalities:
                        if modality in batch:
                            modality_data = batch[modality]
                            encoded = self.modality_encoder.encode_modality(modality, modality_data)
                            modal_features.append(torch.FloatTensor(encoded).to(self.device))
                    
                    # Forward pass
                    self.optimizer.zero_grad()
                    outputs = self.fusion_network.fuse_modalities(modal_features)
                    
                    # Calculate loss
                    if self.config.task_type == CrossModalTask.MULTI_MODAL_CLASSIFICATION:
                        loss = self.criterion(outputs, labels)
                    else:
                        loss = self.criterion(outputs, labels.float().unsqueeze(1))
                    
                    # Backward pass
                    loss.backward()
                    self.optimizer.step()
                    
                    epoch_train_loss += loss.item()
                
                avg_train_loss = epoch_train_loss / len(train_loader)
                train_losses.append(avg_train_loss)
                
                # Validation phase
                if val_loader:
                    self.fusion_network.fusion_network.eval()
                    epoch_val_loss = 0.0
                    
                    with torch.no_grad():
                        for batch in val_loader:
                            modal_features = []
                            labels = batch['labels']
                            
                            for modality in self.config.modalities:
                                if modality in batch:
                                    modality_data = batch[modality]
                                    encoded = self.modality_encoder.encode_modality(modality, modality_data)
                                    modal_features.append(torch.FloatTensor(encoded).to(self.device))
                            
                            outputs = self.fusion_network.fuse_modalities(modal_features)
                            
                            if self.config.task_type == CrossModalTask.MULTI_MODAL_CLASSIFICATION:
                                loss = self.criterion(outputs, labels)
                            else:
                                loss = self.criterion(outputs, labels.float().unsqueeze(1))
                            
                            epoch_val_loss += loss.item()
                    
                    avg_val_loss = epoch_val_loss / len(val_loader)
                    val_losses.append(avg_val_loss)
                    
                    # Save best model
                    if avg_val_loss < best_val_loss:
                        best_val_loss = avg_val_loss
                        self._save_model()
                
                # Log progress
                if epoch % 10 == 0:
                    logger.info(f"Epoch {epoch}, Train Loss: {avg_train_loss:.4f}, Val Loss: {avg_val_loss:.4f if val_loader else 'N/A'}")
            
            return {
                'train_losses': train_losses,
                'val_losses': val_losses,
                'best_val_loss': best_val_loss,
                'epochs_trained': self.config.max_epochs,
                'final_train_loss': train_losses[-1] if train_losses else None,
                'final_val_loss': val_losses[-1] if val_losses else None
            }
            
        except Exception as e:
            logger.error(f"Error in training: {e}")
            raise
    
    def _prepare_data_loader(self, samples: List[CrossModalSample], shuffle: bool = True) -> DataLoader:
        """Prepare data loader from samples"""
        try:
            # Convert samples to tensors
            batch_data = []
            
            for sample in samples:
                data_point = {'labels': sample.labels.get('label', 0)}
                
                # Add modality data
                for modality, modality_data in sample.modalities.items():
                    if modality == ModalityType.TEXT:
                        data_point[modality] = modality_data.data
                    elif modality == ModalityType.IMAGE:
                        data_point[modality] = modality_data.data
                    elif modality == ModalityType.AUDIO:
                        data_point[modality] = modality_data.data
                    elif modality == ModalityType.VIDEO:
                        data_point[modality] = modality_data.data
                    elif modality == ModalityType.TABULAR:
                        data_point[modality] = modality_data.data
                
                batch_data.append(data_point)
            
            # Create dataset (simplified)
            class MultiModalDataset:
                def __init__(self, data):
                    self.data = data
                
                def __len__(self):
                    return len(self.data)
                
                def __getitem__(self, idx):
                    item = self.data[idx]
                    
                    # Convert labels to tensor
                    if isinstance(item['labels'], dict):
                        label = item['labels'].get('label', 0)
                    else:
                        label = item['labels']
                    
                    # Convert to tensor
                    if isinstance(label, (int, np.integer)):
                        label_tensor = torch.LongTensor([label])
                    else:
                        label_tensor = torch.FloatTensor([label])
                    
                    result = {'labels': label_tensor}
                    
                    # Add modality data
                    for modality in [ModalityType.TEXT, ModalityType.IMAGE, ModalityType.AUDIO, ModalityType.VIDEO, ModalityType.TABULAR]:
                        if modality in item:
                            result[modality] = item[modality]
                    
                    return result
            
            dataset = MultiModalDataset(batch_data)
            
            return DataLoader(
                dataset,
                batch_size=self.config.batch_size,
                shuffle=shuffle,
                num_workers=0  # Set to 0 for simplicity
            )
            
        except Exception as e:
            logger.error(f"Error preparing data loader: {e}")
            raise
    
    def predict(self, sample: CrossModalSample) -> Dict[str, Any]:
        """Make prediction on multi-modal sample"""
        try:
            self.fusion_network.fusion_network.eval()
            
            with torch.no_grad():
                # Encode modalities
                modal_features = []
                
                for modality in self.config.modalities:
                    if modality in sample.modalities:
                        modality_data = sample.modalities[modality].data
                        encoded = self.modality_encoder.encode_modality(modality, modality_data)
                        modal_features.append(torch.FloatTensor(encoded).to(self.device))
                
                # Forward pass
                outputs = self.fusion_network.fuse_modalities(modal_features)
                
                # Get predictions
                if self.config.task_type == CrossModalTask.MULTI_MODAL_CLASSIFICATION:
                    probabilities = torch.softmax(outputs, dim=-1)
                    predictions = torch.argmax(outputs, dim=-1)
                    confidence = torch.max(probabilities, dim=-1)[0]
                else:
                    predictions = outputs
                    confidence = 1.0
                
                return {
                    'predictions': predictions.cpu().numpy(),
                    'confidence': confidence.cpu().numpy(),
                    'probabilities': probabilities.cpu().numpy() if self.config.task_type == CrossModalTask.MULTI_MODAL_CLASSIFICATION else None,
                    'modalities_used': [mod.value for mod in sample.modalities.keys()],
                    'sample_id': sample.sample_id
                }
                
        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            return {'error': str(e)}
    
    def _save_model(self) -> None:
        """Save trained model"""
        try:
            model_state = {
                'config': self.config,
                'modality_encoder_state': {
                    mod.value: encoder.state_dict() 
                    for mod, encoder in self.modality_encoder.encoders.items()
                },
                'fusion_network_state': self.fusion_network.fusion_network.state_dict(),
                'optimizer_state': self.optimizer.state_dict(),
                'trained_at': datetime.utcnow().isoformat()
            }
            
            # Save to file (simplified)
            model_path = f"multimodal_model_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pt"
            torch.save(model_state, model_path)
            
            logger.info(f"Saved model to {model_path}")
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")


class MultiModalAIService:
    """Main multi-modal AI service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.models = {}
        
    def create_multimodal_model(self, model_id: str, config: MultiModalConfig) -> MultiModalLearner:
        """Create multi-modal model"""
        try:
            model = MultiModalLearner(config)
            self.models[model_id] = {
                'model': model,
                'config': config,
                'created_at': datetime.utcnow()
            }
            
            logger.info(f"Created multi-modal model {model_id}")
            return model
            
        except Exception as e:
            logger.error(f"Error creating multi-modal model: {e}")
            raise
    
    def train_multimodal_model(self, model_id: str, train_samples: List[CrossModalSample],
                             val_samples: Optional[List[CrossModalSample]] = None) -> Dict[str, Any]:
        """Train multi-modal model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        model = self.models[model_id]['model']
        return model.train(train_samples, val_samples)
    
    def predict_multimodal(self, model_id: str, sample: CrossModalSample) -> Dict[str, Any]:
        """Make prediction with multi-modal model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        model = self.models[model_id]['model']
        return model.predict(sample)
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get model information"""
        if model_id not in self.models:
            return {'error': f'Model {model_id} not found'}
        
        model_data = self.models[model_id]
        
        return {
            'model_id': model_id,
            'config': {
                'modalities': [mod.value for mod in model_data['config'].modalities],
                'fusion_type': model_data['config'].fusion_type.value,
                'task_type': model_data['config'].task_type.value,
                'embedding_dim': model_data['config'].embedding_dim,
                'hidden_dim': model_data['config'].hidden_dim,
                'num_classes': model_data['config'].num_classes,
                'learning_rate': model_data['config'].learning_rate,
                'batch_size': model_data['config'].batch_size,
                'max_epochs': model_data['config'].max_epochs
            },
            'created_at': model_data['created_at'].isoformat()
        }


# Global multi-modal AI service instance
multimodal_ai_service = MultiModalAIService()

# Export functions
def create_multimodal_model(model_id: str, config: MultiModalConfig) -> MultiModalLearner:
    """Create multi-modal model"""
    return multimodal_ai_service.create_multimodal_model(model_id, config)

def train_multimodal_model(model_id: str, train_samples: List[CrossModalSample],
                         val_samples: Optional[List[CrossModalSample]] = None) -> Dict[str, Any]:
    """Train multi-modal model"""
    return multimodal_ai_service.train_multimodal_model(model_id, train_samples, val_samples)

def predict_multimodal(model_id: str, sample: CrossModalSample) -> Dict[str, Any]:
    """Make prediction with multi-modal model"""
    return multimodal_ai_service.predict_multimodal(model_id, sample)

def get_multimodal_model_info(model_id: str) -> Dict[str, Any]:
    """Get multi-modal model information"""
    return multimodal_ai_service.get_model_info(model_id)

# Export all components
__all__ = [
    'ModalityType',
    'FusionType',
    'CrossModalTask',
    'ModalityData',
    'CrossModalSample',
    'MultiModalConfig',
    'ModalityEncoder',
    'CrossModalFusion',
    'MultiModalLearner',
    'MultiModalAIService',
    'create_multimodal_model',
    'train_multimodal_model',
    'predict_multimodal',
    'get_multimodal_model_info',
    'multimodal_ai_service',
]
