"""
Federated Learning and Distributed Training System
Advanced federated learning with privacy-preserving distributed model training
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
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import accuracy_score, mean_squared_error, classification_report
import joblib
import threading
import queue
import hashlib
import time
from cryptography.fernet import Fernet
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger(__name__)


class FederatedLearningType(Enum):
    """Federated learning types"""
    FEDERATED_AVERAGING = "federated_averaging"
    FEDERATED_DISTILLATION = "federated_distillation"
    SECURE_AGGREGATION = "secure_aggregation"
    DIFFERENTIAL_PRIVACY = "differential_privacy"
    HOMOMORPHIC_ENCRYPTION = "homomorphic_encryption"


class AggregationStrategy(Enum):
    """Aggregation strategies"""
    WEIGHTED_AVERAGING = "weighted_averaging"
    MEDIAN_AGGREGATION = "median_aggregation"
    TRIMMED_MEAN = "trimmed_mean"
    ROBUST_AGGREGATION = "robust_aggregation"
    KRUM_AGGREGATION = "krum_aggregation"


class PrivacyLevel(Enum):
    """Privacy levels"""
    NONE = "none"
    BASIC = "basic"
    MEDIUM = "medium"
    HIGH = "high"
    MAXIMUM = "maximum"


@dataclass
class ClientInfo:
    """Client information"""
    client_id: str
    num_samples: int
    data_distribution: Dict[str, Any]
    computation_capability: str
    network_bandwidth: str
    privacy_level: PrivacyLevel
    last_active: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FederatedModel:
    """Federated model information"""
    model_id: str
    model_type: str
    global_model: Any
    client_models: Dict[str, Any]
    aggregation_strategy: AggregationStrategy
    round_number: int
    performance_metrics: Dict[str, float]
    privacy_metrics: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FederatedConfig:
    """Federated learning configuration"""
    learning_type: FederatedLearningType
    aggregation_strategy: AggregationStrategy
    privacy_level: PrivacyLevel
    min_clients: int = 2
    max_clients: int = 100
    rounds: int = 100
    local_epochs: int = 5
    batch_size: int = 32
    learning_rate: float = 0.01
    communication_rounds: int = 1
    dropout_rate: float = 0.1
    epsilon: float = 1.0  # For differential privacy
    delta: float = 1e-5  # For differential privacy


class FederatedClient:
    """Federated learning client"""
    
    def __init__(self, client_id: str, config: FederatedConfig):
        self.client_id = client_id
        self.config = config
        self.local_model = None
        self.local_data = None
        self.local_labels = None
        self.encryption_key = None
        
    def load_data(self, X: pd.DataFrame, y: pd.Series) -> None:
        """Load local data"""
        self.local_data = X
        self.local_labels = y
        logger.info(f"Client {self.client_id} loaded {len(X)} samples")
    
    def initialize_model(self, global_model: Any) -> None:
        """Initialize local model from global model"""
        try:
            # Create local model copy
            if hasattr(global_model, 'coef_'):
                # Linear model
                self.local_model = type(global_model)(
                    learning_rate=self.config.learning_rate,
                    max_iter=1000,
                    random_state=42
                )
                self.local_model.coef_ = global_model.coef_.copy()
                self.local_model.intercept_ = global_model.intercept_.copy()
            elif hasattr(global_model, 'feature_importances_'):
                # Tree-based model
                self.local_model = type(global_model)(
                    n_estimators=global_model.n_estimators,
                    random_state=42
                )
                self.local_model.feature_importances_ = global_model.feature_importances_.copy()
            else:
                # Neural network
                self.local_model = MLPClassifier(
                    hidden_layer_sizes=(100, 50),
                    learning_rate_init=self.config.learning_rate,
                    random_state=42
                )
            
            logger.info(f"Client {self.client_id} initialized local model")
            
        except Exception as e:
            logger.error(f"Error initializing model for client {self.client_id}: {e}")
            raise
    
    def train_local_model(self) -> Dict[str, Any]:
        """Train local model"""
        if self.local_model is None or self.local_data is None:
            raise ValueError("Model or data not initialized")
        
        try:
            start_time = time.time()
            
            # Train model
            self.local_model.fit(self.local_data, self.local_labels)
            
            # Calculate training metrics
            train_pred = self.local_model.predict(self.local_data)
            
            if self.config.learning_type == FederatedLearningType.FEDERATED_AVERAGING:
                if len(self.local_labels.unique()) < 20:  # Classification
                    accuracy = accuracy_score(self.local_labels, train_pred)
                    metrics = {'accuracy': accuracy}
                else:  # Regression
                    mse = mean_squared_error(self.local_labels, train_pred)
                    metrics = {'mse': mse}
            
            training_time = time.time() - start_time
            
            # Apply privacy mechanisms
            if self.config.privacy_level != PrivacyLevel.NONE:
                self._apply_privacy_mechanisms()
            
            result = {
                'client_id': self.client_id,
                'num_samples': len(self.local_data),
                'training_time': training_time,
                'model_parameters': self._get_model_parameters(),
                'training_metrics': metrics,
                'privacy_level': self.config.privacy_level.value
            }
            
            logger.info(f"Client {self.client_id} completed local training")
            return result
            
        except Exception as e:
            logger.error(f"Error in local training for client {self.client_id}: {e}")
            raise
    
    def _get_model_parameters(self) -> Dict[str, Any]:
        """Get model parameters for aggregation"""
        if hasattr(self.local_model, 'coef_'):
            # Linear model parameters
            return {
                'coef': self.local_model.coef_.tolist(),
                'intercept': self.local_model.intercept_.tolist() if hasattr(self.local_model.intercept_, '__len__') else self.local_model.intercept_
            }
        elif hasattr(self.local_model, 'feature_importances_'):
            # Tree-based model parameters
            return {
                'feature_importances': self.local_model.feature_importances_.tolist(),
                'n_estimators': self.local_model.n_estimators,
                'max_depth': getattr(self.local_model, 'max_depth', None)
            }
        else:
            # Neural network parameters
            return {
                'coefs': [coef.tolist() for coef in self.local_model.coefs_],
                'intercepts': [intercept.tolist() for intercept in self.local_model.intercepts_]
            }
    
    def _apply_privacy_mechanisms(self) -> None:
        """Apply privacy-preserving mechanisms"""
        if self.config.privacy_level == PrivacyLevel.DIFFERENTIAL_PRIVACY:
            # Add noise to model parameters
            self._add_differential_privacy_noise()
        elif self.config.privacy_level == PrivacyLevel.SECURE_AGGREGATION:
            # Encrypt model parameters
            self._encrypt_parameters()
    
    def _add_differential_privacy_noise(self) -> None:
        """Add differential privacy noise"""
        try:
            # Calculate noise scale
            sensitivity = 1.0  # L2 sensitivity
            noise_scale = sensitivity * self.config.epsilon / self.config.delta
            
            # Add noise to parameters
            if hasattr(self.local_model, 'coef_'):
                noise = np.random.normal(0, noise_scale, self.local_model.coef_.shape)
                self.local_model.coef_ += noise
            
            logger.info(f"Added differential privacy noise to client {self.client_id}")
            
        except Exception as e:
            logger.error(f"Error adding DP noise: {e}")
    
    def _encrypt_parameters(self) -> None:
        """Encrypt model parameters"""
        try:
            # Generate encryption key
            self.encryption_key = Fernet.generate_key()
            cipher = Fernet(self.encryption_key)
            
            # Encrypt parameters (simplified)
            parameters = self._get_model_parameters()
            encrypted_params = cipher.encrypt(json.dumps(parameters).encode())
            
            # Store encrypted parameters
            self.encrypted_parameters = encrypted_params
            
            logger.info(f"Encrypted parameters for client {self.client_id}")
            
        except Exception as e:
            logger.error(f"Error encrypting parameters: {e}")


class FederatedServer:
    """Federated learning server"""
    
    def __init__(self, config: FederatedConfig):
        self.config = config
        self.global_model = None
        self.clients = {}
        self.aggregation_history = []
        self.round_number = 0
        
    def register_client(self, client_id: str, client_info: ClientInfo) -> None:
        """Register federated client"""
        self.clients[client_id] = client_info
        logger.info(f"Registered client {client_id}")
    
    def initialize_global_model(self, X: pd.DataFrame, y: pd.Series) -> None:
        """Initialize global model"""
        try:
            # Create initial global model
            if len(y.unique()) < 20:  # Classification
                self.global_model = RandomForestClassifier(n_estimators=100, random_state=42)
            else:  # Regression
                self.global_model = RandomForestRegressor(n_estimators=100, random_state=42)
            
            # Train on initial data (could be synthetic or public data)
            self.global_model.fit(X, y)
            
            logger.info("Initialized global model")
            
        except Exception as e:
            logger.error(f"Error initializing global model: {e}")
            raise
    
    def aggregate_models(self, client_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate client model updates"""
        if not client_updates:
            raise ValueError("No client updates provided")
        
        try:
            # Extract model parameters
            client_params = []
            client_weights = []
            
            for update in client_updates:
                params = update['model_parameters']
                weight = update['num_samples']
                
                client_params.append(params)
                client_weights.append(weight)
            
            # Normalize weights
            total_weight = sum(client_weights)
            normalized_weights = [w / total_weight for w in client_weights]
            
            # Aggregate parameters
            aggregated_params = self._aggregate_parameters(client_params, normalized_weights)
            
            # Update global model
            self._update_global_model(aggregated_params)
            
            # Calculate aggregation metrics
            aggregation_metrics = {
                'round': self.round_number,
                'num_clients': len(client_updates),
                'total_samples': sum(client_weights),
                'aggregation_strategy': self.config.aggregation_strategy.value,
                'client_weights': normalized_weights
            }
            
            self.aggregation_history.append(aggregation_metrics)
            self.round_number += 1
            
            logger.info(f"Completed aggregation round {self.round_number}")
            return aggregation_metrics
            
        except Exception as e:
            logger.error(f"Error in model aggregation: {e}")
            raise
    
    def _aggregate_parameters(self, client_params: List[Dict[str, Any]], 
                            weights: List[float]) -> Dict[str, Any]:
        """Aggregate model parameters from clients"""
        if self.config.aggregation_strategy == AggregationStrategy.WEIGHTED_AVERAGING:
            return self._weighted_averaging(client_params, weights)
        elif self.config.aggregation_strategy == AggregationStrategy.MEDIAN_AGGREGATION:
            return self._median_aggregation(client_params)
        elif self.config.aggregation_strategy == AggregationStrategy.TRIMMED_MEAN:
            return self._trimmed_mean_aggregation(client_params)
        else:
            return self._weighted_averaging(client_params, weights)
    
    def _weighted_averaging(self, client_params: List[Dict[str, Any]], 
                           weights: List[float]) -> Dict[str, Any]:
        """Weighted averaging aggregation"""
        if not client_params:
            return {}
        
        # Get parameter structure from first client
        first_params = client_params[0]
        aggregated = {}
        
        for key in first_params:
            if isinstance(first_params[key], list):
                # Handle multi-dimensional parameters
                if isinstance(first_params[key][0], list):
                    # 2D array (neural network weights)
                    aggregated[key] = []
                    for i in range(len(first_params[key])):
                        layer_params = [client_params[j][key][i] for j in range(len(client_params))]
                        weighted_avg = np.average(layer_params, axis=0, weights=weights)
                        aggregated[key].append(weighted_avg.tolist())
                else:
                    # 1D array
                    layer_params = [client_params[j][key] for j in range(len(client_params))]
                    weighted_avg = np.average(layer_params, axis=0, weights=weights)
                    aggregated[key] = weighted_avg.tolist()
            else:
                # Scalar parameters
                param_values = [client_params[j][key] for j in range(len(client_params))]
                weighted_avg = np.average(param_values, axis=0, weights=weights)
                aggregated[key] = float(weighted_avg)
        
        return aggregated
    
    def _median_aggregation(self, client_params: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Median aggregation"""
        if not client_params:
            return {}
        
        first_params = client_params[0]
        aggregated = {}
        
        for key in first_params:
            if isinstance(first_params[key], list):
                if isinstance(first_params[key][0], list):
                    # 2D array
                    aggregated[key] = []
                    for i in range(len(first_params[key])):
                        layer_params = [client_params[j][key][i] for j in range(len(client_params))]
                        median_val = np.median(layer_params, axis=0)
                        aggregated[key].append(median_val.tolist())
                else:
                    # 1D array
                    layer_params = [client_params[j][key] for j in range(len(client_params))]
                    median_val = np.median(layer_params, axis=0)
                    aggregated[key] = median_val.tolist()
            else:
                # Scalar
                param_values = [client_params[j][key] for j in range(len(client_params))]
                aggregated[key] = float(np.median(param_values))
        
        return aggregated
    
    def _trimmed_mean_aggregation(self, client_params: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Trimmed mean aggregation"""
        if not client_params:
            return {}
        
        first_params = client_params[0]
        aggregated = {}
        trim_ratio = 0.1  # Trim 10% from each end
        
        for key in first_params:
            if isinstance(first_params[key], list):
                if isinstance(first_params[key][0], list):
                    # 2D array
                    aggregated[key] = []
                    for i in range(len(first_params[key])):
                        layer_params = [client_params[j][key][i] for j in range(len(client_params))]
                        flattened = np.array(layer_params).flatten()
                        trimmed = np.sort(flattened)[int(len(flattened) * trim_ratio):int(len(flattened) * (1 - trim_ratio))]
                        trimmed_mean = np.mean(trimmed)
                        # Reshape back
                        original_shape = np.array(layer_params[0]).shape
                        aggregated[key].append(trimmed_mean.reshape(original_shape).tolist())
                else:
                    # 1D array
                    layer_params = [client_params[j][key] for j in range(len(client_params))]
                    flattened = np.array(layer_params).flatten()
                    trimmed = np.sort(flattened)[int(len(flattened) * trim_ratio):int(len(flattened) * (1 - trim_ratio))]
                    aggregated[key] = float(np.mean(trimmed))
            else:
                # Scalar
                param_values = [client_params[j][key] for j in range(len(client_params))]
                trimmed = np.sort(param_values)[int(len(param_values) * trim_ratio):int(len(param_values) * (1 - trim_ratio))]
                aggregated[key] = float(np.mean(trimmed))
        
        return aggregated
    
    def _update_global_model(self, aggregated_params: Dict[str, Any]) -> None:
        """Update global model with aggregated parameters"""
        try:
            if hasattr(self.global_model, 'coef_'):
                # Linear model
                self.global_model.coef_ = np.array(aggregated_params['coef'])
                self.global_model.intercept_ = np.array(aggregated_params['intercept'])
            elif hasattr(self.global_model, 'feature_importances_'):
                # Tree-based model
                self.global_model.feature_importances_ = np.array(aggregated_params['feature_importances'])
            else:
                # Neural network
                self.global_model.coefs_ = [np.array(coef) for coef in aggregated_params['coefs']]
                self.global_model.intercepts_ = [np.array(intercept) for intercept in aggregated_params['intercepts']]
            
            logger.info("Updated global model with aggregated parameters")
            
        except Exception as e:
            logger.error(f"Error updating global model: {e}")
            raise
    
    def evaluate_global_model(self, X_test: pd.DataFrame, y_test: pd.Series) -> Dict[str, float]:
        """Evaluate global model"""
        try:
            y_pred = self.global_model.predict(X_test)
            
            if len(y_test.unique()) < 20:  # Classification
                accuracy = accuracy_score(y_test, y_pred)
                metrics = {'accuracy': accuracy}
            else:  # Regression
                mse = mean_squared_error(y_test, y_pred)
                metrics = {'mse': mse}
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error evaluating global model: {e}")
            return {}


class FederatedLearningService:
    """Main federated learning service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.server = None
        self.clients = {}
        self.federated_models = {}
        
    def create_federated_learning_system(self, config: FederatedConfig, 
                                        initial_data: Optional[Tuple[pd.DataFrame, pd.Series]] = None) -> str:
        """Create federated learning system"""
        system_id = f"fed_system_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            # Create server
            self.server = FederatedServer(config)
            
            # Initialize global model if initial data provided
            if initial_data:
                X, y = initial_data
                self.server.initialize_global_model(X, y)
            
            # Store system
            self.federated_models[system_id] = {
                'server': self.server,
                'config': config,
                'clients': {},
                'created_at': datetime.utcnow()
            }
            
            # Save to Redis
            self._save_system(system_id)
            
            logger.info(f"Created federated learning system {system_id}")
            return system_id
            
        except Exception as e:
            logger.error(f"Error creating federated learning system: {e}")
            raise
    
    def register_client(self, system_id: str, client_id: str, 
                     client_info: ClientInfo) -> FederatedClient:
        """Register client in federated system"""
        if system_id not in self.federated_models:
            raise ValueError(f"System {system_id} not found")
        
        try:
            # Create client
            client = FederatedClient(client_id, self.federated_models[system_id]['config'])
            
            # Register with server
            self.federated_models[system_id]['server'].register_client(client_id, client_info)
            
            # Store client
            self.federated_models[system_id]['clients'][client_id] = client
            
            logger.info(f"Registered client {client_id} in system {system_id}")
            return client
            
        except Exception as e:
            logger.error(f"Error registering client: {e}")
            raise
    
    def run_federated_round(self, system_id: str) -> Dict[str, Any]:
        """Run one round of federated learning"""
        if system_id not in self.federated_models:
            raise ValueError(f"System {system_id} not found")
        
        system_data = self.federated_models[system_id]
        server = system_data['server']
        clients = system_data['clients']
        
        try:
            # Distribute global model to clients
            client_updates = []
            
            for client_id, client in clients.items():
                if client.local_data is not None:
                    # Initialize client model with global model
                    client.initialize_model(server.global_model)
                    
                    # Train local model
                    update = client.train_local_model()
                    client_updates.append(update)
            
            # Aggregate updates
            if client_updates:
                aggregation_metrics = server.aggregate_models(client_updates)
                
                # Evaluate global model (if test data available)
                # This would require test data from clients or public dataset
                
                round_result = {
                    'system_id': system_id,
                    'round_number': server.round_number,
                    'num_active_clients': len(client_updates),
                    'total_samples': sum(update['num_samples'] for update in client_updates),
                    'aggregation_metrics': aggregation_metrics,
                    'completed_at': datetime.utcnow().isoformat()
                }
                
                # Save round result
                self._save_round_result(system_id, round_result)
                
                return round_result
            
            else:
                return {'error': 'No client updates available'}
            
        except Exception as e:
            logger.error(f"Error in federated round: {e}")
            raise
    
    def run_federated_training(self, system_id: str, rounds: Optional[int] = None) -> List[Dict[str, Any]]:
        """Run complete federated training"""
        if system_id not in self.federated_models:
            raise ValueError(f"System {system_id} not found")
        
        system_data = self.federated_models[system_id]
        config = system_data['config']
        
        if rounds is None:
            rounds = config.rounds
        
        round_results = []
        
        for round_num in range(rounds):
            logger.info(f"Starting federated round {round_num + 1}/{rounds}")
            
            try:
                round_result = self.run_federated_round(system_id)
                round_results.append(round_result)
                
                # Check convergence criteria
                if self._check_convergence(round_results):
                    logger.info(f"Convergence detected at round {round_num + 1}")
                    break
                    
            except Exception as e:
                logger.error(f"Error in round {round_num + 1}: {e}")
                continue
        
        return round_results
    
    def _check_convergence(self, round_results: List[Dict[str, Any]]) -> bool:
        """Check if training has converged"""
        if len(round_results) < 3:
            return False
        
        # Simple convergence check based on performance stability
        recent_rounds = round_results[-3:]
        
        # Check if performance metrics are stable
        if 'aggregation_metrics' in recent_rounds[0]:
            # Would need actual performance metrics
            pass
        
        return False  # Simplified convergence check
    
    def _save_system(self, system_id: str) -> None:
        """Save federated learning system to Redis"""
        try:
            if self.redis:
                system_data = self.federated_models[system_id]
                serialized_data = {
                    'config': system_data['config'].__dict__,
                    'num_clients': len(system_data['clients']),
                    'created_at': system_data['created_at'].isoformat()
                }
                
                self.redis.setex(f"federated_system:{system_id}", 
                               86400 * 30, json.dumps(serialized_data))
                logger.info(f"Saved federated system {system_id}")
        except Exception as e:
            logger.error(f"Failed to save federated system: {e}")
    
    def _save_round_result(self, system_id: str, result: Dict[str, Any]) -> None:
        """Save round result to Redis"""
        try:
            if self.redis:
                self.redis.setex(f"federated_round:{system_id}:{result['round_number']}", 
                               86400 * 7, json.dumps(result))
                logger.info(f"Saved round result for system {system_id}")
        except Exception as e:
            logger.error(f"Failed to save round result: {e}")


# Global federated learning service instance
federated_learning_service = FederatedLearningService()

# Export functions
def create_federated_learning_system(config: FederatedConfig, 
                                initial_data: Optional[Tuple[pd.DataFrame, pd.Series]] = None) -> str:
    """Create federated learning system"""
    return federated_learning_service.create_federated_learning_system(config, initial_data)

def register_federated_client(system_id: str, client_id: str, 
                           client_info: ClientInfo) -> FederatedClient:
    """Register federated client"""
    return federated_learning_service.register_client(system_id, client_id, client_info)

def run_federated_round(system_id: str) -> Dict[str, Any]:
    """Run federated learning round"""
    return federated_learning_service.run_federated_round(system_id)

def run_federated_training(system_id: str, rounds: Optional[int] = None) -> List[Dict[str, Any]]:
    """Run complete federated training"""
    return federated_learning_service.run_federated_training(system_id, rounds)

# Export all components
__all__ = [
    'FederatedLearningType',
    'AggregationStrategy',
    'PrivacyLevel',
    'ClientInfo',
    'FederatedModel',
    'FederatedConfig',
    'FederatedClient',
    'FederatedServer',
    'FederatedLearningService',
    'create_federated_learning_system',
    'register_federated_client',
    'run_federated_round',
    'run_federated_training',
    'federated_learning_service',
]
