"""
Edge Computing and On-Device Inference System
Advanced edge computing with model compression, optimization, and on-device inference
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
import torch.quantization
from torch.utils.mobile_optimizer import optimize_for_mobile
import onnx
import onnxruntime as ort
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, mean_squared_error
import time
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor
import asyncio

logger = logging.getLogger(__name__)


class InferenceEngine(Enum):
    """Inference engines"""
    PYTORCH = "pytorch"
    ONNX = "onnx"
    TENSORFLOW_LITE = "tensorflow_lite"
    CORE_ML = "core_ml"
    OPENVINO = "openvino"


class CompressionType(Enum):
    """Model compression types"""
    QUANTIZATION = "quantization"
    PRUNING = "pruning"
    KNOWLEDGE_DISTILLATION = "knowledge_distillation"
    WEIGHT_SHARING = "weight_sharing"
    LOW_RANK_DECOMPOSITION = "low_rank_decomposition"


class OptimizationTarget(Enum):
    """Optimization targets"""
    LATENCY = "latency"
    MEMORY_USAGE = "memory_usage"
    MODEL_SIZE = "model_size"
    ACCURACY = "accuracy"
    POWER_CONSUMPTION = "power_consumption"


@dataclass
class DeviceInfo:
    """Device information"""
    device_id: str
    device_type: str
    cpu_cores: int
    memory_gb: float
    storage_gb: float
    gpu_available: bool
    gpu_memory_gb: float
    battery_level: float
    network_type: str
    thermal_state: str
    last_seen: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ModelInfo:
    """Model information"""
    model_id: str
    model_type: str
    original_size_mb: float
    compressed_size_mb: float
    compression_ratio: float
    accuracy_drop: float
    latency_ms: float
    memory_usage_mb: float
    target_device: str
    inference_engine: InferenceEngine
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EdgeConfig:
    """Edge computing configuration"""
    inference_engine: InferenceEngine
    compression_type: CompressionType
    optimization_target: OptimizationTarget
    quantization_bits: int = 8
    pruning_ratio: float = 0.5
    batch_size: int = 1
    max_latency_ms: float = 100.0
    max_memory_mb: float = 512.0
    enable_caching: bool = True
    cache_size: int = 1000
    enable_streaming: bool = False


class ModelCompressor:
    """Model compression and optimization"""
    
    def __init__(self, config: EdgeConfig):
        self.config = config
        
    def compress_model(self, model: nn.Module, calibration_data: torch.utils.data.DataLoader) -> Dict[str, Any]:
        """Compress model using specified techniques"""
        compression_results = {}
        
        try:
            # Quantization
            if self.config.compression_type in [CompressionType.QUANTIZATION, CompressionType.WEIGHT_SHARING]:
                quantized_model = self._quantize_model(model, calibration_data)
                compression_results['quantization'] = quantized_model
            
            # Pruning
            if self.config.compression_type in [CompressionType.PRUNING, CompressionType.WEIGHT_SHARING]:
                pruned_model = self._prune_model(model, calibration_data)
                compression_results['pruning'] = pruned_model
            
            # Knowledge distillation
            if self.config.compression_type == CompressionType.KNOWLEDGE_DISTILLATION:
                distilled_model = self._distill_model(model, calibration_data)
                compression_results['distillation'] = distilled_model
            
            compression_results['original_model'] = model
            compression_results['compression_type'] = self.config.compression_type.value
            
            return compression_results
            
        except Exception as e:
            logger.error(f"Error in model compression: {e}")
            raise
    
    def _quantize_model(self, model: nn.Module, calibration_data: torch.utils.data.DataLoader) -> Dict[str, Any]:
        """Quantize model"""
        try:
            # Prepare model for quantization
            model.eval()
            model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
            model_prepared = torch.quantization.prepare(model, inplace=False)
            
            # Calibrate with sample data
            with torch.no_grad():
                for data, _ in calibration_data:
                    model_prepared(data)
                    break  # Use first batch for calibration
            
            # Convert to quantized model
            quantized_model = torch.quantization.convert(model_prepared, inplace=False)
            
            # Calculate compression metrics
            original_size = self._calculate_model_size(model)
            quantized_size = self._calculate_model_size(quantized_model)
            compression_ratio = original_size / quantized_size
            
            return {
                'model': quantized_model,
                'original_size_mb': original_size,
                'compressed_size_mb': quantized_size,
                'compression_ratio': compression_ratio,
                'quantization_bits': self.config.quantization_bits
            }
            
        except Exception as e:
            logger.error(f"Error in model quantization: {e}")
            raise
    
    def _prune_model(self, model: nn.Module, calibration_data: torch.utils.data.DataLoader) -> Dict[str, Any]:
        """Prune model"""
        try:
            # Simple magnitude-based pruning
            import torch.nn.utils.prune as prune
            
            model.eval()
            
            # Calculate pruning threshold
            all_weights = []
            for name, param in model.named_parameters():
                if 'weight' in name:
                    all_weights.extend(param.data.abs().flatten().cpu().numpy())
            
            threshold = np.percentile(all_weights, self.config.pruning_ratio * 100)
            
            # Apply pruning
            pruned_model = model
            for name, module in model.named_modules():
                if isinstance(module, (nn.Linear, nn.Conv2d)):
                    prune.l1_unstructured(module, name='weight', amount=self.config.pruning_ratio)
            
            # Calculate compression metrics
            original_size = self._calculate_model_size(model)
            pruned_size = self._calculate_model_size(pruned_model)
            compression_ratio = original_size / pruned_size
            
            return {
                'model': pruned_model,
                'original_size_mb': original_size,
                'compressed_size_mb': pruned_size,
                'compression_ratio': compression_ratio,
                'pruning_ratio': self.config.pruning_ratio
            }
            
        except Exception as e:
            logger.error(f"Error in model pruning: {e}")
            raise
    
    def _distill_model(self, teacher_model: nn.Module, calibration_data: torch.utils.data.DataLoader) -> Dict[str, Any]:
        """Knowledge distillation"""
        try:
            # Create smaller student model
            student_model = self._create_student_model(teacher_model)
            
            # Distillation training (simplified)
            student_model.train()
            teacher_model.eval()
            
            optimizer = torch.optim.Adam(student_model.parameters(), lr=0.001)
            criterion = nn.KLDivLoss(reduction='batchmean')
            
            # Training loop (simplified)
            for epoch in range(10):  # Reduced for demo
                for data, _ in calibration_data:
                    # Get teacher and student predictions
                    with torch.no_grad():
                        teacher_logits = teacher_model(data)
                    
                    student_logits = student_model(data)
                    
                    # Calculate distillation loss
                    distillation_loss = criterion(
                        F.log_softmax(student_logits / 3.0, dim=1),
                        F.softmax(teacher_logits / 3.0, dim=1)
                    )
                    
                    optimizer.zero_grad()
                    distillation_loss.backward()
                    optimizer.step()
            
            # Calculate compression metrics
            original_size = self._calculate_model_size(teacher_model)
            student_size = self._calculate_model_size(student_model)
            compression_ratio = original_size / student_size
            
            return {
                'model': student_model,
                'original_size_mb': original_size,
                'compressed_size_mb': student_size,
                'compression_ratio': compression_ratio,
                'distillation_epochs': 10
            }
            
        except Exception as e:
            logger.error(f"Error in knowledge distillation: {e}")
            raise
    
    def _create_student_model(self, teacher_model: nn.Module) -> nn.Module:
        """Create smaller student model"""
        # Simplified student model creation
        if isinstance(teacher_model, nn.Sequential):
            # Create smaller sequential model
            layers = []
            for i, layer in enumerate(teacher_model):
                if isinstance(layer, nn.Linear):
                    if i < len(teacher_model) - 1:
                        out_features = layer.out_features // 2
                    else:
                        out_features = layer.out_features
                    layers.append(nn.Linear(layer.in_features, out_features))
                elif isinstance(layer, nn.ReLU):
                    layers.append(nn.ReLU())
            
            return nn.Sequential(*layers)
        else:
            # Default to smaller MLP
            return nn.Sequential(
                nn.Linear(teacher_model[0].in_features, 64),
                nn.ReLU(),
                nn.Linear(64, 32),
                nn.ReLU(),
                nn.Linear(32, teacher_model[-1].out_features)
            )
    
    def _calculate_model_size(self, model: nn.Module) -> float:
        """Calculate model size in MB"""
        param_size = 0
        buffer_size = 0
        
        for param in model.parameters():
            param_size += param.nelement() * param.element_size()
        
        for buffer in model.buffers():
            buffer_size += buffer.nelement() * buffer.element_size()
        
        total_size = (param_size + buffer_size) / (1024 * 1024)  # Convert to MB
        return total_size


class OnDeviceInference:
    """On-device inference engine"""
    
    def __init__(self, config: EdgeConfig):
        self.config = config
        self.model = None
        self.preprocessor = None
        self.cache = {}
        self.inference_stats = []
        
    def load_model(self, model_path: str, model_info: ModelInfo) -> None:
        """Load compressed model for on-device inference"""
        try:
            if model_info.inference_engine == InferenceEngine.PYTORCH:
                self.model = torch.load(model_path, map_location='cpu')
                self.model.eval()
            elif model_info.inference_engine == InferenceEngine.ONNX:
                self.model = ort.InferenceSession(model_path)
            
            logger.info(f"Loaded model {model_info.model_id} for on-device inference")
            
        except Exception as e:
            logger.error(f"Error loading on-device model: {e}")
            raise
    
    def preprocess_input(self, input_data: Any) -> Any:
        """Preprocess input data"""
        # Simplified preprocessing
        if isinstance(input_data, np.ndarray):
            return torch.FloatTensor(input_data)
        elif isinstance(input_data, pd.DataFrame):
            return torch.FloatTensor(input_data.values)
        else:
            return input_data
    
    def predict(self, input_data: Any) -> Dict[str, Any]:
        """Make prediction with performance monitoring"""
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        
        try:
            # Preprocess input
            processed_input = self.preprocess_input(input_data)
            
            # Check cache
            cache_key = self._get_cache_key(processed_input)
            if cache_key in self.cache:
                cached_result = self.cache[cache_key]
                return {
                    'prediction': cached_result['prediction'],
                    'cache_hit': True,
                    'inference_time_ms': 0,
                    'memory_usage_mb': 0
                }
            
            # Make inference
            if self.config.inference_engine == InferenceEngine.PYTORCH:
                with torch.no_grad():
                    if isinstance(processed_input, torch.Tensor):
                        processed_input = processed_input.unsqueeze(0) if len(processed_input.shape) == 1 else processed_input
                    prediction = self.model(processed_input)
                    
                    if isinstance(prediction, torch.Tensor):
                        prediction = prediction.cpu().numpy()
                        if len(prediction.shape) > 1 and prediction.shape[1] == 1:
                            prediction = prediction.flatten()
            else:
                # ONNX inference
                if not isinstance(processed_input, np.ndarray):
                    processed_input = processed_input.cpu().numpy()
                
                prediction = self.model.run(None, {self.model.get_inputs()[0].name: processed_input})
                prediction = prediction[0]
            
            # Calculate metrics
            inference_time = (time.time() - start_time) * 1000  # ms
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            memory_usage = max(0, end_memory - start_memory)
            
            # Update cache
            if self.config.enable_caching:
                self.cache[cache_key] = {
                    'prediction': prediction,
                    'timestamp': datetime.utcnow()
                }
                
                # Limit cache size
                if len(self.cache) > self.config.cache_size:
                    oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['timestamp'])
                    del self.cache[oldest_key]
            
            # Update statistics
            self.inference_stats.append({
                'timestamp': datetime.utcnow(),
                'inference_time_ms': inference_time,
                'memory_usage_mb': memory_usage,
                'cache_hit': False
            })
            
            # Check latency constraint
            if inference_time > self.config.max_latency_ms:
                logger.warning(f"Inference latency {inference_time:.2f}ms exceeds limit {self.config.max_latency_ms}ms")
            
            # Check memory constraint
            if memory_usage > self.config.max_memory_mb:
                logger.warning(f"Memory usage {memory_usage:.2f}MB exceeds limit {self.config.max_memory_mb}MB")
            
            return {
                'prediction': prediction,
                'cache_hit': False,
                'inference_time_ms': inference_time,
                'memory_usage_mb': memory_usage
            }
            
        except Exception as e:
            logger.error(f"Error in on-device inference: {e}")
            return {
                'prediction': None,
                'cache_hit': False,
                'inference_time_ms': 0,
                'memory_usage_mb': 0,
                'error': str(e)
            }
    
    def _get_cache_key(self, input_data: Any) -> str:
        """Generate cache key for input"""
        if isinstance(input_data, torch.Tensor):
            input_hash = hash(input_data.data.tobytes())
        elif isinstance(input_data, np.ndarray):
            input_hash = hash(input_data.tobytes())
        else:
            input_hash = hash(str(input_data))
        
        return f"cache_{input_hash}"
    
    def get_inference_stats(self) -> Dict[str, Any]:
        """Get inference performance statistics"""
        if not self.inference_stats:
            return {}
        
        df = pd.DataFrame(self.inference_stats)
        
        return {
            'total_inferences': len(df),
            'avg_inference_time_ms': df['inference_time_ms'].mean(),
            'avg_memory_usage_mb': df['memory_usage_mb'].mean(),
            'max_inference_time_ms': df['inference_time_ms'].max(),
            'max_memory_usage_mb': df['memory_usage_mb'].max(),
            'cache_hit_rate': df['cache_hit'].mean(),
            'performance_window_hours': (df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 3600
        }


class EdgeComputingService:
    """Main edge computing service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.devices = {}
        self.models = {}
        self.compressor = None
        
    def register_device(self, device_id: str, device_info: DeviceInfo) -> None:
        """Register edge device"""
        self.devices[device_id] = device_info
        logger.info(f"Registered edge device {device_id}")
        
        # Save to Redis
        self._save_device(device_id, device_info)
    
    def compress_and_deploy_model(self, model_id: str, model: nn.Module, 
                                target_device: str, calibration_data: torch.utils.data.DataLoader,
                                config: EdgeConfig) -> ModelInfo:
        """Compress and deploy model to edge device"""
        try:
            # Create compressor
            self.compressor = ModelCompressor(config)
            
            # Compress model
            compression_results = self.compressor.compress_model(model, calibration_data)
            
            # Get compressed model
            if config.compression_type in compression_results:
                compressed_model = compression_results[config.compression_type]['model']
            else:
                compressed_model = model
            
            # Convert to target format
            if config.inference_engine == InferenceEngine.ONNX:
                model_path = self._convert_to_onnx(compressed_model, model_id, target_device)
            else:
                model_path = self._save_pytorch_model(compressed_model, model_id, target_device)
            
            # Create model info
            original_size = compression_results.get('quantization', {}).get('original_size_mb', 0)
            compressed_size = compression_results.get('quantization', {}).get('compressed_size_mb', 0)
            
            model_info = ModelInfo(
                model_id=model_id,
                model_type=str(type(model).__name__),
                original_size_mb=original_size,
                compressed_size_mb=compressed_size,
                compression_ratio=original_size / compressed_size if compressed_size > 0 else 1.0,
                accuracy_drop=0.0,  # Would need evaluation
                latency_ms=0.0,   # Would need benchmarking
                memory_usage_mb=0.0,  # Would need profiling
                target_device=target_device,
                inference_engine=config.inference_engine,
                metadata={
                    'compression_type': config.compression_type.value,
                    'quantization_bits': config.quantization_bits,
                    'model_path': model_path
                }
            )
            
            # Save model info
            self.models[model_id] = model_info
            self._save_model(model_id, model_info)
            
            logger.info(f"Compressed and deployed model {model_id} to {target_device}")
            return model_info
            
        except Exception as e:
            logger.error(f"Error in model compression and deployment: {e}")
            raise
    
    def create_inference_engine(self, model_id: str) -> OnDeviceInference:
        """Create on-device inference engine"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        model_info = self.models[model_id]
        config = EdgeConfig(
            inference_engine=model_info.inference_engine,
            compression_type=CompressionType(model_info.metadata.get('compression_type', 'quantization')),
            max_latency_ms=100.0,
            max_memory_mb=512.0,
            enable_caching=True
        )
        
        inference_engine = OnDeviceInference(config)
        inference_engine.load_model(model_info.metadata['model_path'], model_info)
        
        return inference_engine
    
    def benchmark_model(self, model_id: str, test_data: torch.utils.data.DataLoader) -> Dict[str, Any]:
        """Benchmark model performance"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        model_info = self.models[model_id]
        inference_engine = self.create_inference_engine(model_id)
        
        try:
            # Run benchmark
            predictions = []
            latencies = []
            memory_usages = []
            
            for data, target in test_data:
                result = inference_engine.predict(data)
                predictions.append(result['prediction'])
                latencies.append(result['inference_time_ms'])
                memory_usages.append(result['memory_usage_mb'])
            
            # Calculate metrics
            avg_latency = np.mean(latencies)
            avg_memory = np.mean(memory_usages)
            p95_latency = np.percentile(latencies, 95)
            p99_latency = np.percentile(latencies, 99)
            
            benchmark_results = {
                'model_id': model_id,
                'target_device': model_info.target_device,
                'inference_engine': model_info.inference_engine,
                'compression_ratio': model_info.compression_ratio,
                'avg_latency_ms': avg_latency,
                'p95_latency_ms': p95_latency,
                'p99_latency_ms': p99_latency,
                'avg_memory_mb': avg_memory,
                'max_memory_mb': np.max(memory_usages),
                'total_samples': len(predictions),
                'benchmark_timestamp': datetime.utcnow().isoformat()
            }
            
            # Save benchmark results
            self._save_benchmark(model_id, benchmark_results)
            
            return benchmark_results
            
        except Exception as e:
            logger.error(f"Error in model benchmarking: {e}")
            raise
    
    def _convert_to_onnx(self, model: nn.Module, model_id: str, target_device: str) -> str:
        """Convert model to ONNX format"""
        try:
            # Create dummy input
            dummy_input = torch.randn(1, 10)  # Adjust based on model input
            
            # Export to ONNX
            torch.onnx.export(
                model,
                dummy_input,
                f"model_{model_id}_{target_device}.onnx",
                export_params=True,
                opset_version=11,
                do_constant_folding=True,
                input_names=['input'],
                output_names=['output']
            )
            
            return f"model_{model_id}_{target_device}.onnx"
            
        except Exception as e:
            logger.error(f"Error converting to ONNX: {e}")
            raise
    
    def _save_pytorch_model(self, model: nn.Module, model_id: str, target_device: str) -> str:
        """Save PyTorch model"""
        try:
            model_path = f"model_{model_id}_{target_device}.pt"
            torch.save(model.state_dict(), model_path)
            return model_path
            
        except Exception as e:
            logger.error(f"Error saving PyTorch model: {e}")
            raise
    
    def _save_device(self, device_id: str, device_info: DeviceInfo) -> None:
        """Save device info to Redis"""
        try:
            if self.redis:
                device_data = {
                    'device_id': device_id,
                    'device_type': device_info.device_type,
                    'cpu_cores': device_info.cpu_cores,
                    'memory_gb': device_info.memory_gb,
                    'gpu_available': device_info.gpu_available,
                    'last_seen': device_info.last_seen.isoformat()
                }
                self.redis.setex(f"edge_device:{device_id}", 86400 * 7, json.dumps(device_data))
        except Exception as e:
            logger.error(f"Failed to save device: {e}")
    
    def _save_model(self, model_id: str, model_info: ModelInfo) -> None:
        """Save model info to Redis"""
        try:
            if self.redis:
                model_data = {
                    'model_id': model_id,
                    'model_type': model_info.model_type,
                    'original_size_mb': model_info.original_size_mb,
                    'compressed_size_mb': model_info.compressed_size_mb,
                    'compression_ratio': model_info.compression_ratio,
                    'target_device': model_info.target_device,
                    'inference_engine': model_info.inference_engine.value,
                    'metadata': model_info.metadata,
                    'created_at': model_info.created_at.isoformat()
                }
                self.redis.setex(f"edge_model:{model_id}", 86400 * 30, json.dumps(model_data))
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    def _save_benchmark(self, model_id: str, benchmark_results: Dict[str, Any]) -> None:
        """Save benchmark results to Redis"""
        try:
            if self.redis:
                self.redis.setex(f"edge_benchmark:{model_id}", 86400 * 7, json.dumps(benchmark_results))
        except Exception as e:
            logger.error(f"Failed to save benchmark: {e}")
    
    def get_device_status(self, device_id: str) -> Dict[str, Any]:
        """Get device status"""
        if device_id in self.devices:
            device_info = self.devices[device_id]
            return {
                'device_id': device_id,
                'device_type': device_info.device_type,
                'cpu_cores': device_info.cpu_cores,
                'memory_gb': device_info.memory_gb,
                'gpu_available': device_info.gpu_available,
                'battery_level': device_info.battery_level,
                'network_type': device_info.network_type,
                'thermal_state': device_info.thermal_state,
                'last_seen': device_info.last_seen.isoformat(),
                'status': 'active' if (datetime.utcnow() - device_info.last_seen).seconds < 300 else 'inactive'
            }
        else:
            return {'error': f'Device {device_id} not found'}
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get model information"""
        if model_id in self.models:
            model_info = self.models[model_id]
            return {
                'model_id': model_id,
                'model_type': model_info.model_type,
                'original_size_mb': model_info.original_size_mb,
                'compressed_size_mb': model_info.compressed_size_mb,
                'compression_ratio': model_info.compression_ratio,
                'target_device': model_info.target_device,
                'inference_engine': model_info.inference_engine.value,
                'metadata': model_info.metadata,
                'created_at': model_info.created_at.isoformat()
            }
        else:
            return {'error': f'Model {model_id} not found'}


# Global edge computing service instance
edge_computing_service = EdgeComputingService()

# Export functions
def register_edge_device(device_id: str, device_info: DeviceInfo) -> None:
    """Register edge device"""
    edge_computing_service.register_device(device_id, device_info)

def compress_and_deploy_model(model_id: str, model: nn.Module, target_device: str,
                           calibration_data: torch.utils.data.DataLoader, config: EdgeConfig) -> ModelInfo:
    """Compress and deploy model to edge device"""
    return edge_computing_service.compress_and_deploy_model(model_id, model, target_device, calibration_data, config)

def create_edge_inference_engine(model_id: str) -> OnDeviceInference:
    """Create on-device inference engine"""
    return edge_computing_service.create_inference_engine(model_id)

def benchmark_edge_model(model_id: str, test_data: torch.utils.data.DataLoader) -> Dict[str, Any]:
    """Benchmark edge model performance"""
    return edge_computing_service.benchmark_model(model_id, test_data)

def get_edge_device_status(device_id: str) -> Dict[str, Any]:
    """Get edge device status"""
    return edge_computing_service.get_device_status(device_id)

def get_edge_model_info(model_id: str) -> Dict[str, Any]:
    """Get edge model information"""
    return edge_computing_service.get_model_info(model_id)

# Export all components
__all__ = [
    'InferenceEngine',
    'CompressionType',
    'OptimizationTarget',
    'DeviceInfo',
    'ModelInfo',
    'EdgeConfig',
    'ModelCompressor',
    'OnDeviceInference',
    'EdgeComputingService',
    'register_edge_device',
    'compress_and_deploy_model',
    'create_edge_inference_engine',
    'benchmark_edge_model',
    'get_edge_device_status',
    'get_edge_model_info',
    'edge_computing_service',
]
