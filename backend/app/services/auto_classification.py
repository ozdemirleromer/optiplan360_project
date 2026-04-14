"""
Automatic Classification and Labeling System
Advanced classification and labeling with multiple ML algorithms and ensemble methods
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder, MinMaxScaler
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import classification_report, accuracy_score, precision_score, recall_score, f1_score
import joblib
from PIL import Image
import cv2
import torch
import torchvision.transforms as transforms
import torchvision.models as models

logger = logging.getLogger(__name__)


class ClassificationType(Enum):
    """Classification types"""
    TEXT_CLASSIFICATION = "text_classification"
    IMAGE_CLASSIFICATION = "image_classification"
    DOCUMENT_CLASSIFICATION = "document_classification"
    PRODUCT_CLASSIFICATION = "product_classification"
    CUSTOMER_CLASSIFICATION = "customer_classification"
    ORDER_CLASSIFICATION = "order_classification"
    SENTIMENT_CLASSIFICATION = "sentiment_classification"
    INTENT_CLASSIFICATION = "intent_classification"
    ANOMALY_CLASSIFICATION = "anomaly_classification"


class ModelType(Enum):
    """ML model types"""
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    LOGISTIC_REGRESSION = "logistic_regression"
    SVM = "svm"
    NAIVE_BAYES = "naive_bayes"
    KNN = "knn"
    DECISION_TREE = "decision_tree"
    NEURAL_NETWORK = "neural_network"
    ENSEMBLE = "ensemble"
    DEEP_LEARNING = "deep_learning"


@dataclass
class ClassificationResult:
    """Classification result"""
    task_id: str
    classification_type: ClassificationType
    input_data: Any
    predicted_class: str
    confidence: float
    class_probabilities: Dict[str, float]
    model_used: str
    processing_time_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ModelMetrics:
    """Model performance metrics"""
    model_name: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: List[List[int]]
    cross_val_score: float
    training_time_ms: float
    model_size_bytes: int


@dataclass
class ClassificationConfig:
    """Classification configuration"""
    model_type: ModelType
    classification_type: ClassificationType
    feature_extraction: str = "tfidf"
    cross_validation_folds: int = 5
    test_size: float = 0.2
    random_state: int = 42
    hyperparameter_tuning: bool = True
    ensemble_methods: List[str] = field(default_factory=lambda: ['voting', 'stacking'])
    retrain_frequency_hours: int = 24
    min_training_samples: int = 50


class TextClassifier:
    """Text classification service"""
    
    def __init__(self, config: ClassificationConfig):
        self.config = config
        self.vectorizers = {}
        self.models = {}
        self.label_encoders = {}
        
    def extract_features(self, texts: List[str], method: str = 'tfidf') -> np.ndarray:
        """Extract features from text"""
        if method == 'tfidf':
            if 'tfidf' not in self.vectorizers:
                self.vectorizers['tfidf'] = TfidfVectorizer(
                    max_features=5000,
                    ngram_range=(1, 2),
                    stop_words='english',
                    lowercase=True
                )
            return self.vectorizers['tfidf'].fit_transform(texts).toarray()
        elif method == 'count':
            if 'count' not in self.vectorizers:
                self.vectorizers['count'] = CountVectorizer(
                    max_features=5000,
                    ngram_range=(1, 2),
                    stop_words='english',
                    lowercase=True
                )
            return self.vectorizers['count'].fit_transform(texts).toarray()
        else:
            raise ValueError(f"Unknown feature extraction method: {method}")
    
    def train_model(self, X: np.ndarray, y: np.ndarray, model_type: ModelType) -> Dict[str, Any]:
        """Train classification model"""
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model based on type
        if model_type == ModelType.RANDOM_FOREST:
            model = RandomForestClassifier(
                n_estimators=100,
                random_state=self.config.random_state,
                n_jobs=-1
            )
        elif model_type == ModelType.GRADIENT_BOOSTING:
            model = GradientBoostingClassifier(
                n_estimators=100,
                random_state=self.config.random_state
            )
        elif model_type == ModelType.LOGISTIC_REGRESSION:
            model = LogisticRegression(
                random_state=self.config.random_state,
                max_iter=1000
            )
        elif model_type == ModelType.SVM:
            model = SVC(
                kernel='rbf',
                random_state=self.config.random_state,
                probability=True
            )
        elif model_type == ModelType.NAIVE_BAYES:
            model = MultinomialNB()
        elif model_type == ModelType.KNN:
            model = KNeighborsClassifier(n_neighbors=5)
        elif model_type == ModelType.DECISION_TREE:
            model = DecisionTreeClassifier(random_state=self.config.random_state)
        elif model_type == ModelType.NEURAL_NETWORK:
            model = MLPClassifier(
                hidden_layer_sizes=(100, 50),
                max_iter=1000,
                random_state=self.config.random_state
            )
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Train model
        model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        y_pred = model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        # Cross validation
        cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=self.config.cross_validation_folds)
        
        return {
            'model': model,
            'scaler': scaler,
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'cv_score': cv_scores.mean(),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
    
    def train_ensemble(self, X: np.ndarray, y: np.ndarray, base_models: List[ModelType]) -> Dict[str, Any]:
        """Train ensemble model"""
        # Train base models
        base_model_results = []
        for model_type in base_models:
            result = self.train_model(X, y, model_type)
            base_model_results.append((model_type.value, result['model']))
        
        # Create voting classifier
        voting_classifier = VotingClassifier(
            estimators=base_model_results,
            voting='soft'
        )
        
        # Split and scale data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train ensemble
        voting_classifier.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = voting_classifier.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        return {
            'model': voting_classifier,
            'scaler': scaler,
            'base_models': base_model_results,
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
    
    def predict(self, text: str, model_info: Dict[str, Any]) -> Dict[str, Any]:
        """Predict class for text"""
        try:
            # Extract features
            text_features = self.extract_features([text], self.config.feature_extraction)
            
            # Scale features
            X_scaled = model_info['scaler'].transform(text_features)
            
            # Predict
            model = model_info['model']
            prediction = model.predict(X_scaled)[0]
            probabilities = model.predict_proba(X_scaled)[0]
            
            # Get class labels
            if hasattr(model, 'classes_'):
                class_labels = model.classes_
            else:
                class_labels = list(range(len(probabilities)))
            
            # Create probability dictionary
            prob_dict = dict(zip(class_labels, probabilities))
            
            return {
                'predicted_class': str(prediction),
                'confidence': float(max(probabilities)),
                'class_probabilities': {str(k): float(v) for k, v in prob_dict.items()}
            }
            
        except Exception as e:
            logger.error(f"Text classification prediction error: {e}")
            return {
                'predicted_class': 'unknown',
                'confidence': 0.0,
                'class_probabilities': {}
            }


class ImageClassifier:
    """Image classification service"""
    
    def __init__(self, config: ClassificationConfig):
        self.config = config
        self.models = {}
        self.transforms = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
    def load_pretrained_model(self, model_name: str, num_classes: int) -> torch.nn.Module:
        """Load pretrained model"""
        if model_name == 'resnet18':
            model = models.resnet18(pretrained=True)
            model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
        elif model_name == 'resnet50':
            model = models.resnet50(pretrained=True)
            model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
        elif model_name == 'vgg16':
            model = models.vgg16(pretrained=True)
            model.classifier[6] = torch.nn.Linear(model.classifier[6].in_features, num_classes)
        elif model_name == 'efficientnet':
            model = models.efficientnet_b0(pretrained=True)
            model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, num_classes)
        else:
            raise ValueError(f"Unknown model: {model_name}")
        
        return model
    
    def extract_features(self, image_paths: List[str]) -> np.ndarray:
        """Extract features from images"""
        features = []
        
        for image_path in image_paths:
            try:
                # Load and preprocess image
                image = Image.open(image_path).convert('RGB')
                image_tensor = self.transforms(image)
                
                # Flatten features
                features.append(image_tensor.numpy().flatten())
                
            except Exception as e:
                logger.error(f"Feature extraction error for {image_path}: {e}")
                features.append(np.zeros(224 * 224 * 3))  # Placeholder
        
        return np.array(features)
    
    def train_model(self, image_paths: List[str], labels: List[str], model_name: str = 'resnet18') -> Dict[str, Any]:
        """Train image classification model"""
        # Extract features
        X = self.extract_features(image_paths)
        
        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train traditional ML model
        model = RandomForestClassifier(
            n_estimators=100,
            random_state=self.config.random_state,
            n_jobs=-1
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        return {
            'model': model,
            'scaler': scaler,
            'label_encoder': label_encoder,
            'accuracy': accuracy,
            'feature_extractor': 'traditional'
        }
    
    def predict(self, image_path: str, model_info: Dict[str, Any]) -> Dict[str, Any]:
        """Predict class for image"""
        try:
            # Extract features
            features = self.extract_features([image_path])
            
            # Scale features
            X_scaled = model_info['scaler'].transform(features)
            
            # Predict
            model = model_info['model']
            prediction = model.predict(X_scaled)[0]
            probabilities = model.predict_proba(X_scaled)[0]
            
            # Convert back to original label
            label_encoder = model_info['label_encoder']
            predicted_label = label_encoder.inverse_transform([prediction])[0]
            
            # Get class labels
            class_labels = label_encoder.classes_
            
            # Create probability dictionary
            prob_dict = dict(zip(class_labels, probabilities))
            
            return {
                'predicted_class': predicted_label,
                'confidence': float(max(probabilities)),
                'class_probabilities': {str(k): float(v) for k, v in prob_dict.items()}
            }
            
        except Exception as e:
            logger.error(f"Image classification prediction error: {e}")
            return {
                'predicted_class': 'unknown',
                'confidence': 0.0,
                'class_probabilities': {}
            }


class DocumentClassifier:
    """Document classification service"""
    
    def __init__(self, config: ClassificationConfig):
        self.config = config
        self.text_classifier = TextClassifier(config)
        self.image_classifier = ImageClassifier(config)
        
    def extract_document_features(self, document_data: Dict[str, Any]) -> np.ndarray:
        """Extract features from document"""
        features = []
        
        # Text features
        if 'text' in document_data:
            text_features = self.text_classifier.extract_features([document_data['text']])
            features.extend(text_features[0])
        
        # Metadata features
        metadata_features = [
            document_data.get('page_count', 1),
            document_data.get('word_count', 0),
            document_data.get('image_count', 0),
            document_data.get('table_count', 0),
            len(document_data.get('text', '')),
            document_data.get('file_size', 0)
        ]
        features.extend(metadata_features)
        
        return np.array(features)
    
    def train_model(self, documents: List[Dict[str, Any]], labels: List[str]) -> Dict[str, Any]:
        """Train document classification model"""
        # Extract features
        X = np.array([self.extract_document_features(doc) for doc in documents])
        
        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = RandomForestClassifier(
            n_estimators=100,
            random_state=self.config.random_state,
            n_jobs=-1
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        return {
            'model': model,
            'scaler': scaler,
            'label_encoder': label_encoder,
            'accuracy': accuracy,
            'feature_types': ['text', 'metadata']
        }
    
    def predict(self, document: Dict[str, Any], model_info: Dict[str, Any]) -> Dict[str, Any]:
        """Predict class for document"""
        try:
            # Extract features
            features = self.extract_document_features(document)
            
            # Scale features
            X_scaled = model_info['scaler'].transform([features])
            
            # Predict
            model = model_info['model']
            prediction = model.predict(X_scaled)[0]
            probabilities = model.predict_proba(X_scaled)[0]
            
            # Convert back to original label
            label_encoder = model_info['label_encoder']
            predicted_label = label_encoder.inverse_transform([prediction])[0]
            
            # Get class labels
            class_labels = label_encoder.classes_
            
            # Create probability dictionary
            prob_dict = dict(zip(class_labels, probabilities))
            
            return {
                'predicted_class': predicted_label,
                'confidence': float(max(probabilities)),
                'class_probabilities': {str(k): float(v) for k, v in prob_dict.items()}
            }
            
        except Exception as e:
            logger.error(f"Document classification prediction error: {e}")
            return {
                'predicted_class': 'unknown',
                'confidence': 0.0,
                'class_probabilities': {}
            }


class AutoClassificationService:
    """Main automatic classification service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.text_classifier = TextClassifier(ClassificationConfig(
            model_type=ModelType.RANDOM_FOREST,
            classification_type=ClassificationType.TEXT_CLASSIFICATION
        ))
        self.image_classifier = ImageClassifier(ClassificationConfig(
            model_type=ModelType.RANDOM_FOREST,
            classification_type=ClassificationType.IMAGE_CLASSIFICATION
        ))
        self.document_classifier = DocumentClassifier(ClassificationConfig(
            model_type=ModelType.RANDOM_FOREST,
            classification_type=ClassificationType.DOCUMENT_CLASSIFICATION
        ))
        self.models = {}
        
        # Load models if available
        self._load_models()
    
    def _load_models(self) -> None:
        """Load pre-trained models"""
        try:
            if self.redis:
                models_data = self.redis.get('classification_models:all_models')
                if models_data:
                    self.models = pickle.loads(models_data)
                    logger.info("Loaded classification models from Redis")
                    
        except Exception as e:
            logger.error(f"Model loading error: {e}")
    
    def _save_models(self) -> None:
        """Save trained models to Redis"""
        try:
            if self.redis:
                models_data = pickle.dumps(self.models)
                self.redis.setex('classification_models:all_models', 86400, models_data)
                logger.info("Saved classification models to Redis")
                
        except Exception as e:
            logger.error(f"Model saving error: {e}")
    
    def train_text_classifier(self, texts: List[str], labels: List[str], model_type: ModelType = ModelType.RANDOM_FOREST) -> Dict[str, Any]:
        """Train text classification model"""
        logger.info("Training text classification model...")
        
        # Extract features
        X = self.text_classifier.extract_features(texts)
        
        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        # Train model
        result = self.text_classifier.train_model(X, y, model_type)
        
        # Store model
        model_key = f"text_classification_{model_type.value}"
        self.models[model_key] = {
            'model': result['model'],
            'scaler': result['scaler'],
            'label_encoder': label_encoder,
            'metrics': {
                'accuracy': result['accuracy'],
                'precision': result['precision'],
                'recall': result['recall'],
                'f1_score': result['f1_score'],
                'cv_score': result['cv_score']
            },
            'trained_at': datetime.now(timezone.utc)
        }
        
        # Save models
        self._save_models()
        
        return {
            'model_key': model_key,
            'metrics': self.models[model_key]['metrics'],
            'trained_at': self.models[model_key]['trained_at']
        }
    
    def train_image_classifier(self, image_paths: List[str], labels: List[str], model_name: str = 'resnet18') -> Dict[str, Any]:
        """Train image classification model"""
        logger.info("Training image classification model...")
        
        # Train model
        result = self.image_classifier.train_model(image_paths, labels, model_name)
        
        # Store model
        model_key = f"image_classification_{model_name}"
        self.models[model_key] = {
            'model': result['model'],
            'scaler': result['scaler'],
            'label_encoder': result['label_encoder'],
            'metrics': {
                'accuracy': result['accuracy']
            },
            'trained_at': datetime.now(timezone.utc)
        }
        
        # Save models
        self._save_models()
        
        return {
            'model_key': model_key,
            'metrics': self.models[model_key]['metrics'],
            'trained_at': self.models[model_key]['trained_at']
        }
    
    def train_document_classifier(self, documents: List[Dict[str, Any]], labels: List[str]) -> Dict[str, Any]:
        """Train document classification model"""
        logger.info("Training document classification model...")
        
        # Train model
        result = self.document_classifier.train_model(documents, labels)
        
        # Store model
        model_key = "document_classification"
        self.models[model_key] = {
            'model': result['model'],
            'scaler': result['scaler'],
            'label_encoder': result['label_encoder'],
            'metrics': {
                'accuracy': result['accuracy']
            },
            'trained_at': datetime.now(timezone.utc)
        }
        
        # Save models
        self._save_models()
        
        return {
            'model_key': model_key,
            'metrics': self.models[model_key]['metrics'],
            'trained_at': self.models[model_key]['trained_at']
        }
    
    def classify_text(self, text: str, model_key: str = None) -> Dict[str, Any]:
        """Classify text"""
        if model_key and model_key in self.models:
            model_info = self.models[model_key]
            return self.text_classifier.predict(text, model_info)
        else:
            # Use default model
            default_key = f"text_classification_{ModelType.RANDOM_FOREST.value}"
            if default_key in self.models:
                return self.text_classifier.predict(text, self.models[default_key])
        
        return {'predicted_class': 'unknown', 'confidence': 0.0}
    
    def classify_image(self, image_path: str, model_key: str = None) -> Dict[str, Any]:
        """Classify image"""
        if model_key and model_key in self.models:
            model_info = self.models[model_key]
            return self.image_classifier.predict(image_path, model_info)
        else:
            # Use default model
            default_key = "image_classification_resnet18"
            if default_key in self.models:
                return self.image_classifier.predict(image_path, self.models[default_key])
        
        return {'predicted_class': 'unknown', 'confidence': 0.0}
    
    def classify_document(self, document: Dict[str, Any], model_key: str = None) -> Dict[str, Any]:
        """Classify document"""
        if model_key and model_key in self.models:
            model_info = self.models[model_key]
            return self.document_classifier.predict(document, model_info)
        else:
            # Use default model
            default_key = "document_classification"
            if default_key in self.models:
                return self.document_classifier.predict(document, self.models[default_key])
        
        return {'predicted_class': 'unknown', 'confidence': 0.0}
    
    def batch_classify(self, items: List[Any], classification_type: ClassificationType, model_key: str = None) -> List[Dict[str, Any]]:
        """Batch classify items"""
        results = []
        
        for item in items:
            try:
                if classification_type == ClassificationType.TEXT_CLASSIFICATION:
                    result = self.classify_text(item, model_key)
                elif classification_type == ClassificationType.IMAGE_CLASSIFICATION:
                    result = self.classify_image(item, model_key)
                elif classification_type == ClassificationType.DOCUMENT_CLASSIFICATION:
                    result = self.classify_document(item, model_key)
                else:
                    result = {'predicted_class': 'unknown', 'confidence': 0.0}
                
                results.append(result)
                
            except Exception as e:
                logger.error(f"Batch classification error: {e}")
                results.append({'predicted_class': 'error', 'confidence': 0.0})
        
        return results
    
    def get_model_info(self, model_key: str) -> Dict[str, Any]:
        """Get model information"""
        if model_key in self.models:
            return {
                'model_key': model_key,
                'metrics': self.models[model_key]['metrics'],
                'trained_at': self.models[model_key]['trained_at'],
                'model_type': model_key.split('_')[0] + '_' + model_key.split('_')[1]
            }
        else:
            return {'error': f'Model {model_key} not found'}
    
    def list_models(self) -> Dict[str, Any]:
        """List all available models"""
        return {
            model_key: {
                'metrics': model_data['metrics'],
                'trained_at': model_data['trained_at']
            }
            for model_key, model_data in self.models.items()
        }


# Global classification service instance
auto_classification_service = AutoClassificationService()

# Export functions
def train_text_classifier(texts: List[str], labels: List[str], model_type: ModelType = ModelType.RANDOM_FOREST) -> Dict[str, Any]:
    """Train text classification model"""
    return auto_classification_service.train_text_classifier(texts, labels, model_type)

def train_image_classifier(image_paths: List[str], labels: List[str], model_name: str = 'resnet18') -> Dict[str, Any]:
    """Train image classification model"""
    return auto_classification_service.train_image_classifier(image_paths, labels, model_name)

def train_document_classifier(documents: List[Dict[str, Any]], labels: List[str]) -> Dict[str, Any]:
    """Train document classification model"""
    return auto_classification_service.train_document_classifier(documents, labels)

def classify_text(text: str, model_key: str = None) -> Dict[str, Any]:
    """Classify text"""
    return auto_classification_service.classify_text(text, model_key)

def classify_image(image_path: str, model_key: str = None) -> Dict[str, Any]:
    """Classify image"""
    return auto_classification_service.classify_image(image_path, model_key)

def classify_document(document: Dict[str, Any], model_key: str = None) -> Dict[str, Any]:
    """Classify document"""
    return auto_classification_service.classify_document(document, model_key)

def batch_classify(items: List[Any], classification_type: ClassificationType, model_key: str = None) -> List[Dict[str, Any]]:
    """Batch classify items"""
    return auto_classification_service.batch_classify(items, classification_type, model_key)

def get_classification_model_info(model_key: str) -> Dict[str, Any]:
    """Get model information"""
    return auto_classification_service.get_model_info(model_key)

def list_classification_models() -> Dict[str, Any]:
    """List all available models"""
    return auto_classification_service.list_models()

# Export all components
__all__ = [
    'ClassificationType',
    'ModelType',
    'ClassificationResult',
    'ModelMetrics',
    'ClassificationConfig',
    'TextClassifier',
    'ImageClassifier',
    'DocumentClassifier',
    'AutoClassificationService',
    'train_text_classifier',
    'train_image_classifier',
    'train_document_classifier',
    'classify_text',
    'classify_image',
    'classify_document',
    'batch_classify',
    'get_classification_model_info',
    'list_classification_models',
    'auto_classification_service',
]
