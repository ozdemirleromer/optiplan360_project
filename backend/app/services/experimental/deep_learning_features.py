"""
Deep Learning Feature Extraction System
Advanced deep learning-based feature extraction with CNNs, RNNs, and transformers
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
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
import torchvision.models as models
from torch.utils.data import DataLoader, TensorDataset
import cv2
from PIL import Image
import transformers
from transformers import AutoTokenizer, AutoModel, AutoProcessor
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class FeatureExtractorType(Enum):
    """Feature extractor types"""
    CNN_FEATURE_EXTRACTOR = "cnn_feature_extractor"
    RNN_FEATURE_EXTRACTOR = "rnn_feature_extractor"
    TRANSFORMER_FEATURE_EXTRACTOR = "transformer_feature_extractor"
    AUTOENCODER_FEATURE_EXTRACTOR = "autoencoder_feature_extractor"
    SIAMESE_FEATURE_EXTRACTOR = "siamese_feature_extractor"
    TRIPLET_FEATURE_EXTRACTOR = "triplet_feature_extractor"
    ATTENTION_FEATURE_EXTRACTOR = "attention_feature_extractor"


class ModalityType(Enum):
    """Modality types"""
    IMAGE = "image"
    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    MULTIMODAL = "multimodal"


class FeatureType(Enum):
    """Feature types"""
    VISUAL_FEATURES = "visual_features"
    TEXT_FEATURES = "text_features"
    AUDIO_FEATURES = "audio_features"
    SEQUENCE_FEATURES = "sequence_features"
    EMBEDDING_FEATURES = "embedding_features"
    ATTENTION_FEATURES = "attention_features"
    LATENT_FEATURES = "latent_features"


@dataclass
class FeatureExtractionConfig:
    """Feature extraction configuration"""
    extractor_type: FeatureExtractorType
    modality_type: ModalityType
    input_shape: Tuple[int, ...]
    output_dim: int = 512
    pretrained: bool = True
    freeze_backbone: bool = False
    dropout_rate: float = 0.1
    batch_norm: bool = True
    activation: str = "relu"
    pooling_strategy: str = "avg_pool"
    attention_heads: int = 8
    num_layers: int = 6
    hidden_dim: int = 256


@dataclass
class ExtractedFeatures:
    """Extracted features representation"""
    feature_id: str
    extractor_type: FeatureExtractorType
    modality_type: ModalityType
    features: np.ndarray
    feature_type: FeatureType
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


class CNNFeatureExtractor:
    """CNN-based feature extractor"""
    
    def __init__(self, config: FeatureExtractionConfig):
        self.config = config
        self.model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._build_cnn_model()
        
    def _build_cnn_model(self) -> None:
        """Build CNN feature extractor"""
        try:
            if self.config.pretrained:
                # Use pretrained ResNet
                if self.config.modality_type == ModalityType.IMAGE:
                    self.model = models.resnet50(pretrained=True)
                    # Remove final classification layer
                    self.model = nn.Sequential(*list(self.model.children())[:-1])
                    
                    # Add custom layers
                    self.model.add_module('custom_features', nn.Sequential(
                        nn.AdaptiveAvgPool2d((1, 1)),
                        nn.Flatten(),
                        nn.Linear(2048, self.config.output_dim),
                        nn.ReLU(),
                        nn.Dropout(self.config.dropout_rate)
                    ))
                else:
                    # For other modalities, use different backbone
                    self.model = self._build_custom_cnn()
            else:
                # Build custom CNN
                self.model = self._build_custom_cnn()
            
            self.model.to(self.device)
            logger.info(f"Built CNN feature extractor: {self.config.extractor_type}")
            
        except Exception as e:
            logger.error(f"Error building CNN model: {e}")
            raise
    
    def _build_custom_cnn(self) -> nn.Module:
        """Build custom CNN architecture"""
        class CustomCNN(nn.Module):
            def __init__(self, input_shape, output_dim, dropout_rate=0.1):
                super().__init__()
                
                # Calculate input channels
                if len(input_shape) == 3:  # (C, H, W)
                    in_channels = input_shape[0]
                    height, width = input_shape[1], input_shape[2]
                else:  # (H, W, C) or (H, W)
                    in_channels = 3  # Assume RGB
                    height, width = input_shape[0], input_shape[1]
                
                self.features = nn.Sequential(
                    # Conv block 1
                    nn.Conv2d(in_channels, 64, kernel_size=3, padding=1),
                    nn.BatchNorm2d(64) if self.config.batch_norm else nn.Identity(),
                    nn.ReLU(),
                    nn.MaxPool2d(2, 2),
                    
                    # Conv block 2
                    nn.Conv2d(64, 128, kernel_size=3, padding=1),
                    nn.BatchNorm2d(128) if self.config.batch_norm else nn.Identity(),
                    nn.ReLU(),
                    nn.MaxPool2d(2, 2),
                    
                    # Conv block 3
                    nn.Conv2d(128, 256, kernel_size=3, padding=1),
                    nn.BatchNorm2d(256) if self.config.batch_norm else nn.Identity(),
                    nn.ReLU(),
                    nn.MaxPool2d(2, 2),
                    
                    # Conv block 4
                    nn.Conv2d(256, 512, kernel_size=3, padding=1),
                    nn.BatchNorm2d(512) if self.config.batch_norm else nn.Identity(),
                    nn.ReLU(),
                    nn.AdaptiveAvgPool2d((1, 1))
                )
                
                # Calculate flattened size
                dummy_input = torch.randn(1, in_channels, height, width)
                with torch.no_grad():
                    dummy_output = self.features(dummy_input)
                    flattened_size = dummy_output.view(dummy_output.size(0), -1).size(1)
                
                self.classifier = nn.Sequential(
                    nn.Flatten(),
                    nn.Linear(flattened_size, output_dim),
                    nn.ReLU(),
                    nn.Dropout(dropout_rate)
                )
            
            def forward(self, x):
                x = self.features(x)
                x = self.classifier(x)
                return x
        
        return CustomCNN(self.config.input_shape, self.config.output_dim, self.config.dropout_rate)
    
    def extract_features(self, data: Union[np.ndarray, torch.Tensor, List[str]]) -> np.ndarray:
        """Extract features using CNN"""
        try:
            self.model.eval()
            
            # Handle different input types
            if isinstance(data, list):
                # List of image paths
                features_list = []
                for item in data:
                    if isinstance(item, str):
                        # Load image
                        image = Image.open(item).convert('RGB')
                        transform = transforms.Compose([
                            transforms.Resize((224, 224)),
                            transforms.ToTensor(),
                            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                               std=[0.229, 0.224, 0.225])
                        ])
                        image_tensor = transform(image).unsqueeze(0).to(self.device)
                        
                        with torch.no_grad():
                            features = self.model(image_tensor)
                            features_list.append(features.cpu().numpy())
                    else:
                        # Assume numpy array
                        features_list.append(self._process_numpy_array(item))
                
                return np.array(features_list)
            
            elif isinstance(data, np.ndarray):
                # Single numpy array
                processed_data = self._process_numpy_array(data)
                return processed_data
            
            elif isinstance(data, torch.Tensor):
                # Single tensor
                with torch.no_grad():
                    features = self.model(data.to(self.device))
                    return features.cpu().numpy()
            
            else:
                raise ValueError(f"Unsupported input type: {type(data)}")
                
        except Exception as e:
            logger.error(f"Error extracting CNN features: {e}")
            return np.zeros((1, self.config.output_dim))
    
    def _process_numpy_array(self, data: np.ndarray) -> np.ndarray:
        """Process numpy array for CNN"""
        try:
            # Handle different array shapes
            if len(data.shape) == 3:  # (H, W, C)
                data = np.transpose(data, (2, 0, 1))  # (C, H, W)
            elif len(data.shape) == 2:  # (H, W)
                data = np.stack([data] * 3, axis=2)  # (H, W, 3)
                data = np.transpose(data, (2, 0, 1))  # (C, H, W)
            
            # Convert to tensor
            transform = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                   std=[0.229, 0.224, 0.225])
            ])
            
            image = transform(data)
            image_tensor = image.unsqueeze(0).to(self.device)
            
            # Extract features
            with torch.no_grad():
                features = self.model(image_tensor)
                return features.cpu().numpy()
                
        except Exception as e:
            logger.error(f"Error processing numpy array: {e}")
            return np.zeros((1, self.config.output_dim))


class RNNFeatureExtractor:
    """RNN-based feature extractor"""
    
    def __init__(self, config: FeatureExtractionConfig):
        self.config = config
        self.model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._build_rnn_model()
        
    def _build_rnn_model(self) -> None:
        """Build RNN feature extractor"""
        try:
            class RNNEncoder(nn.Module):
                def __init__(self, input_dim, hidden_dim, output_dim, num_layers=2, rnn_type='lstm', bidirectional=True):
                    super().__init__()
                    self.hidden_dim = hidden_dim
                    self.num_layers = num_layers
                    self.bidirectional = bidirectional
                    
                    # Embedding layer for sequences
                    self.embedding = nn.Embedding(input_dim, hidden_dim)
                    
                    # RNN layer
                    if rnn_type == 'lstm':
                        self.rnn = nn.LSTM(hidden_dim, hidden_dim, num_layers, 
                                         batch_first=True, bidirectional=bidirectional)
                    elif rnn_type == 'gru':
                        self.rnn = nn.GRU(hidden_dim, hidden_dim, num_layers, 
                                        batch_first=True, bidirectional=bidirectional)
                    else:
                        self.rnn = nn.RNN(hidden_dim, hidden_dim, num_layers, 
                                         batch_first=True, bidirectional=bidirectional)
                    
                    # Output layer
                    output_dim = hidden_dim * 2 if bidirectional else hidden_dim
                    self.fc = nn.Linear(output_dim, output_dim)
                    self.dropout = nn.Dropout(0.1)
                    
                def forward(self, x):
                    # x shape: (batch, seq_len)
                    embedded = self.embedding(x)
                    
                    # RNN forward pass
                    rnn_out, hidden = self.rnn(embedded)
                    
                    # Use last time step or mean pooling
                    if self.bidirectional:
                        # Concatenate forward and backward
                        rnn_out = rnn_out
                        # Mean pooling over sequence
                        pooled = torch.mean(rnn_out, dim=1)
                    else:
                        pooled = rnn_out[:, -1, :]  # Last time step
                    
                    output = self.dropout(self.fc(pooled))
                    return output
            
            # For text sequences, assume vocabulary size of 10000
            input_dim = 10000
            self.model = RNNEncoder(
                input_dim=input_dim,
                hidden_dim=self.config.hidden_dim,
                output_dim=self.config.output_dim,
                num_layers=self.config.num_layers
            )
            
            self.model.to(self.device)
            logger.info(f"Built RNN feature extractor: {self.config.extractor_type}")
            
        except Exception as e:
            logger.error(f"Error building RNN model: {e}")
            raise
    
    def extract_features(self, data: Union[List[str], np.ndarray, torch.Tensor]) -> np.ndarray:
        """Extract features using RNN"""
        try:
            self.model.eval()
            
            if isinstance(data, list):
                # List of text sequences
                features_list = []
                for text in data:
                    # Simple tokenization (in practice, use proper tokenizer)
                    tokens = self._tokenize_text(text)
                    text_tensor = torch.LongTensor(tokens).unsqueeze(0).to(self.device)
                    
                    with torch.no_grad():
                        features = self.model(text_tensor)
                        features_list.append(features.cpu().numpy())
                
                return np.array(features_list)
            
            elif isinstance(data, np.ndarray):
                # Assume tokenized sequences
                text_tensor = torch.LongTensor(data).to(self.device)
                
                with torch.no_grad():
                    features = self.model(text_tensor)
                    return features.cpu().numpy()
            
            elif isinstance(data, torch.Tensor):
                # Single tensor
                with torch.no_grad():
                    features = self.model(data.to(self.device))
                    return features.cpu().numpy()
            
            else:
                raise ValueError(f"Unsupported input type: {type(data)}")
                
        except Exception as e:
            logger.error(f"Error extracting RNN features: {e}")
            return np.zeros((1, self.config.output_dim))
    
    def _tokenize_text(self, text: str) -> List[int]:
        """Simple text tokenization"""
        # In practice, use proper tokenizer like BERT tokenizer
        words = text.lower().split()
        # Simple hash-based tokenization
        tokens = [hash(word) % 10000 for word in words]
        return tokens


class TransformerFeatureExtractor:
    """Transformer-based feature extractor"""
    
    def __init__(self, config: FeatureExtractionConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._build_transformer_model()
        
    def _build_transformer_model(self) -> None:
        """Build Transformer feature extractor"""
        try:
            if self.config.modality_type == ModalityType.TEXT:
                # Use BERT for text
                model_name = "bert-base-uncased"
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.model = AutoModel.from_pretrained(model_name)
                
            elif self.config.modality_type == ModalityType.IMAGE:
                # Use Vision Transformer
                self.model = models.vit_b_16(pretrained=True)
                # Remove final classification layer
                self.model.heads.head = nn.Identity()
                
            elif self.config.modality_type == ModalityType.MULTIMODAL:
                # Use CLIP for multimodal
                model_name = "openai/clip-vit-base-patch32"
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.model = AutoModel.from_pretrained(model_name)
                
            else:
                raise ValueError(f"Unsupported modality for Transformer: {self.config.modality_type}")
            
            self.model.to(self.device)
            logger.info(f"Built Transformer feature extractor: {self.config.extractor_type}")
            
        except Exception as e:
            logger.error(f"Error building Transformer model: {e}")
            raise
    
    def extract_features(self, data: Union[str, List[str], np.ndarray, torch.Tensor]) -> np.ndarray:
        """Extract features using Transformer"""
        try:
            self.model.eval()
            
            if self.config.modality_type == ModalityType.TEXT:
                return self._extract_text_features(data)
            elif self.config.modality_type == ModalityType.IMAGE:
                return self._extract_image_features(data)
            elif self.config.modality_type == ModalityType.MULTIMODAL:
                return self._extract_multimodal_features(data)
            else:
                raise ValueError(f"Unsupported modality: {self.config.modality_type}")
                
        except Exception as e:
            logger.error(f"Error extracting Transformer features: {e}")
            return np.zeros((1, self.config.output_dim))
    
    def _extract_text_features(self, data: Union[str, List[str]]) -> np.ndarray:
        """Extract text features using BERT"""
        try:
            if isinstance(data, str):
                texts = [data]
            else:
                texts = data
            
            # Tokenize texts
            inputs = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
            
            # Move to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Extract features
            with torch.no_grad():
                outputs = self.model(**inputs)
                # Use [CLS] token embedding
                features = outputs.last_hidden_state[:, 0, :]
            
            return features.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error extracting text features: {e}")
            return np.zeros((1, self.config.output_dim))
    
    def _extract_image_features(self, data: Union[np.ndarray, torch.Tensor, Image.Image]) -> np.ndarray:
        """Extract image features using Vision Transformer"""
        try:
            # Preprocess image
            if isinstance(data, np.ndarray):
                image = Image.fromarray(data)
            elif isinstance(data, torch.Tensor):
                image = transforms.ToPILImage()(data)
            elif isinstance(data, Image.Image):
                image = data
            else:
                raise ValueError(f"Unsupported image type: {type(data)}")
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Transform for ViT
            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
            ])
            
            image_tensor = transform(image).unsqueeze(0).to(self.device)
            
            # Extract features
            with torch.no_grad():
                features = self.model(image_tensor)
                # Global average pooling
                features = features.mean(dim=1)
            
            return features.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error extracting image features: {e}")
            return np.zeros((1, self.config.output_dim))
    
    def _extract_multimodal_features(self, data: Dict[str, Any]) -> np.ndarray:
        """Extract multimodal features using CLIP"""
        try:
            # Extract text and image from data
            text = data.get('text', '')
            image = data.get('image')
            
            # Process text
            text_inputs = self.tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=77)
            
            # Process image
            if isinstance(image, str):
                image = Image.open(image)
            elif isinstance(image, np.ndarray):
                image = Image.fromarray(image)
            elif isinstance(image, torch.Tensor):
                image = transforms.ToPILImage()(image)
            
            # Image preprocessing for CLIP
            image_transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                   std=[0.229, 0.224, 0.225])
            ])
            
            image_tensor = image_transform(image).unsqueeze(0)
            
            # Move to device
            text_inputs = {k: v.to(self.device) for k, v in text_inputs.items()}
            image_tensor = image_tensor.to(self.device)
            
            # Extract features
            with torch.no_grad():
                outputs = self.model.get_text_features(**text_inputs)
                image_features = self.model.get_image_features(image_tensor)
                
                # Combine features (simple concatenation)
                combined_features = torch.cat([outputs, image_features], dim=-1)
            
            return combined_features.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error extracting multimodal features: {e}")
            return np.zeros((1, self.config.output_dim))


class AutoencoderFeatureExtractor:
    """Autoencoder-based feature extractor"""
    
    def __init__(self, config: FeatureExtractionConfig):
        self.config = config
        self.model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._build_autoencoder_model()
        
    def _build_autoencoder_model(self) -> None:
        """Build autoencoder model"""
        try:
            class Autoencoder(nn.Module):
                def __init__(self, input_dim, hidden_dim, latent_dim, dropout_rate=0.1):
                    super().__init__()
                    
                    # Encoder
                    self.encoder = nn.Sequential(
                        nn.Linear(input_dim, hidden_dim),
                        nn.ReLU(),
                        nn.Dropout(dropout_rate),
                        nn.Linear(hidden_dim, hidden_dim // 2),
                        nn.ReLU(),
                        nn.Dropout(dropout_rate),
                        nn.Linear(hidden_dim // 2, latent_dim)
                    )
                    
                    # Decoder
                    self.decoder = nn.Sequential(
                        nn.Linear(latent_dim, hidden_dim // 2),
                        nn.ReLU(),
                        nn.Dropout(dropout_rate),
                        nn.Linear(hidden_dim // 2, hidden_dim),
                        nn.ReLU(),
                        nn.Dropout(dropout_rate),
                        nn.Linear(hidden_dim, input_dim),
                        nn.Sigmoid()  # For normalized output
                    )
                    
                def forward(self, x):
                    encoded = self.encoder(x)
                    decoded = self.decoder(encoded)
                    return decoded, encoded
            
            # Calculate input dimension based on modality
            if self.config.modality_type == ModalityType.IMAGE:
                # Flatten image dimensions
                input_dim = np.prod(self.config.input_shape)
            else:
                input_dim = self.config.input_shape[0] if self.config.input_shape else 512
            
            self.model = Autoencoder(
                input_dim=input_dim,
                hidden_dim=self.config.hidden_dim,
                latent_dim=self.config.output_dim,
                dropout_rate=self.config.dropout_rate
            )
            
            self.model.to(self.device)
            logger.info(f"Built Autoencoder feature extractor: {self.config.extractor_type}")
            
        except Exception as e:
            logger.error(f"Error building Autoencoder model: {e}")
            raise
    
    def extract_features(self, data: np.ndarray) -> np.ndarray:
        """Extract latent features using autoencoder"""
        try:
            self.model.eval()
            
            # Flatten input if needed
            if len(data.shape) > 2:
                data = data.reshape(data.shape[0], -1)
            
            # Convert to tensor
            data_tensor = torch.FloatTensor(data).to(self.device)
            
            # Extract latent features
            with torch.no_grad():
                _, latent_features = self.model(data_tensor)
            
            return latent_features.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error extracting autoencoder features: {e}")
            return np.zeros((1, self.config.output_dim))


class DeepLearningFeatureExtractor:
    """Main deep learning feature extraction service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.extractors = {}
        self.extracted_features = {}
        
    def create_feature_extractor(self, extractor_id: str, config: FeatureExtractionConfig) -> str:
        """Create feature extractor"""
        try:
            if config.extractor_type == FeatureExtractorType.CNN_FEATURE_EXTRACTOR:
                extractor = CNNFeatureExtractor(config)
            elif config.extractor_type == FeatureExtractorType.RNN_FEATURE_EXTRACTOR:
                extractor = RNNFeatureExtractor(config)
            elif config.extractor_type == FeatureExtractorType.TRANSFORMER_FEATURE_EXTRACTOR:
                extractor = TransformerFeatureExtractor(config)
            elif config.extractor_type == FeatureExtractorType.AUTOENCODER_FEATURE_EXTRACTOR:
                extractor = AutoencoderFeatureExtractor(config)
            else:
                raise ValueError(f"Unsupported extractor type: {config.extractor_type}")
            
            self.extractors[extractor_id] = {
                'extractor': extractor,
                'config': config,
                'created_at': datetime.utcnow()
            }
            
            logger.info(f"Created feature extractor {extractor_id}")
            return extractor_id
            
        except Exception as e:
            logger.error(f"Error creating feature extractor: {e}")
            raise
    
    def extract_features(self, extractor_id: str, data: Any, 
                        feature_type: Optional[FeatureType] = None) -> ExtractedFeatures:
        """Extract features using specified extractor"""
        try:
            if extractor_id not in self.extractors:
                raise ValueError(f"Extractor {extractor_id} not found")
            
            extractor_data = self.extractors[extractor_id]
            extractor = extractor_data['extractor']
            config = extractor_data['config']
            
            # Extract features
            features = extractor.extract_features(data)
            
            # Determine feature type if not provided
            if feature_type is None:
                if config.extractor_type == FeatureExtractorType.CNN_FEATURE_EXTRACTOR:
                    feature_type = FeatureType.VISUAL_FEATURES
                elif config.extractor_type == FeatureExtractorType.RNN_FEATURE_EXTRACTOR:
                    feature_type = FeatureType.SEQUENCE_FEATURES
                elif config.extractor_type == FeatureExtractorType.TRANSFORMER_FEATURE_EXTRACTOR:
                    feature_type = FeatureType.EMBEDDING_FEATURES
                elif config.extractor_type == FeatureExtractorType.AUTOENCODER_FEATURE_EXTRACTOR:
                    feature_type = FeatureType.LATENT_FEATURES
                else:
                    feature_type = FeatureType.EMBEDDING_FEATURES
            
            # Create extracted features object
            feature_id = f"feature_{hashlib.md5(str(data)).hexdigest()[:8]}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            
            extracted_features = ExtractedFeatures(
                feature_id=feature_id,
                extractor_type=config.extractor_type,
                modality_type=config.modality_type,
                features=features,
                feature_type=feature_type,
                confidence=1.0,  # Could be calculated based on model confidence
                metadata={
                    'extractor_id': extractor_id,
                    'input_shape': getattr(data, 'shape', None),
                    'output_shape': features.shape,
                    'extraction_time': datetime.utcnow().isoformat()
                }
            )
            
            # Store extracted features
            self.extracted_features[feature_id] = extracted_features
            
            # Save to Redis
            if self.redis:
                self._save_extracted_features(extracted_features)
            
            return extracted_features
            
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            raise
    
    def batch_extract_features(self, extractor_id: str, data_list: List[Any]) -> List[ExtractedFeatures]:
        """Batch extract features"""
        results = []
        
        for data in data_list:
            try:
                result = self.extract_features(extractor_id, data)
                results.append(result)
            except Exception as e:
                logger.error(f"Error in batch extraction: {e}")
                continue
        
        return results
    
    def get_feature_statistics(self, extractor_id: str) -> Dict[str, Any]:
        """Get statistics for extracted features"""
        try:
            if extractor_id not in self.extractors:
                return {'error': f'Extractor {extractor_id} not found'}
            
            # Get all features for this extractor
            features_list = []
            for feature_id, features in self.extracted_features.items():
                if features.extractor_id == extractor_id:
                    features_list.append(features)
            
            if not features_list:
                return {'error': 'No features found'}
            
            # Calculate statistics
            all_features = np.array([f.features.flatten() for f in features_list])
            
            statistics = {
                'extractor_id': extractor_id,
                'total_features': len(features_list),
                'feature_dimensions': all_features.shape[1],
                'feature_mean': np.mean(all_features),
                'feature_std': np.std(all_features),
                'feature_min': np.min(all_features),
                'feature_max': np.max(all_features),
                'feature_distribution': {
                    'mean': np.mean(all_features, axis=0),
                    'std': np.std(all_features, axis=0),
                    'percentiles': {
                        '25': np.percentile(all_features, 25, axis=0),
                        '50': np.percentile(all_features, 50, axis=0),
                        '75': np.percentile(all_features, 75, axis=0)
                    }
                },
                'feature_types': list(set([f.feature_type.value for f in features_list])),
                'extraction_times': [f.created_at for f in features_list],
                'created_at': datetime.utcnow().isoformat()
            }
            
            return statistics
            
        except Exception as e:
            logger.error(f"Error calculating feature statistics: {e}")
            return {'error': str(e)}
    
    def _save_extracted_features(self, features: ExtractedFeatures) -> None:
        """Save extracted features to Redis"""
        try:
            if self.redis:
                features_data = {
                    'feature_id': features.feature_id,
                    'extractor_type': features.extractor_type.value,
                    'modality_type': features.modality_type.value,
                    'features': features.features.tolist(),
                    'feature_type': features.feature_type.value,
                    'confidence': features.confidence,
                    'metadata': features.metadata,
                    'created_at': features.created_at.isoformat()
                }
                
                self.redis.setex(f"dl_features:{features.feature_id}", 
                               86400 * 7, json.dumps(features_data))  # 7 days TTL
                
                logger.info(f"Saved extracted features {features.feature_id}")
                
        except Exception as e:
            logger.error(f"Failed to save extracted features: {e}")


# Global deep learning feature extraction service instance
dl_feature_extractor_service = DeepLearningFeatureExtractor()

# Export functions
def create_dl_feature_extractor(extractor_id: str, config: FeatureExtractionConfig) -> str:
    """Create deep learning feature extractor"""
    return dl_feature_extractor_service.create_feature_extractor(extractor_id, config)

def extract_dl_features(extractor_id: str, data: Any, 
                         feature_type: Optional[FeatureType] = None) -> ExtractedFeatures:
    """Extract deep learning features"""
    return dl_feature_extractor_service.extract_features(extractor_id, data, feature_type)

def batch_extract_dl_features(extractor_id: str, data_list: List[Any]) -> List[ExtractedFeatures]:
    """Batch extract deep learning features"""
    return dl_feature_extractor_service.batch_extract_features(extractor_id, data_list)

def get_dl_feature_statistics(extractor_id: str) -> Dict[str, Any]:
    """Get deep learning feature statistics"""
    return dl_feature_extractor_service.get_feature_statistics(extractor_id)

# Export all components
__all__ = [
    'FeatureExtractorType',
    'ModalityType',
    'FeatureType',
    'FeatureExtractionConfig',
    'ExtractedFeatures',
    'CNNFeatureExtractor',
    'RNNFeatureExtractor',
    'TransformerFeatureExtractor',
    'AutoencoderFeatureExtractor',
    'DeepLearningFeatureExtractor',
    'create_dl_feature_extractor',
    'extract_dl_features',
    'batch_extract_dl_features',
    'get_dl_feature_statistics',
    'dl_feature_extractor_service',
]
