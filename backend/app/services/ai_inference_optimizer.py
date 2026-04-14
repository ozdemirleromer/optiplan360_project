"""
OptiPlan 360 - AI/ML Inference Optimization
Model inference hızlandırma ve batch processing

Bu modül:
- Model quantization ve pruning
- Batch inference
- Model caching
- GPU memory optimizasyonu
- Dynamic batching
"""

import torch
import torch.nn as nn
from typing import List, Dict, Tuple, Optional, Any, Callable
from dataclasses import dataclass
from collections import deque
import time
import logging
from concurrent.futures import ThreadPoolExecutor
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class InferenceMetrics:
    """Inference metrikleri"""
    batch_size: int
    latency_ms: float
    throughput_qps: float
    gpu_memory_mb: float
    timestamp: float


class ModelCache:
    """
    Model ve tensor cache.
    
    Sık kullanılan model'leri ve tensor'ları cache'de tut.
    """
    
    def __init__(self, max_size: int = 5):
        self.max_size = max_size
        self.models: Dict[str, nn.Module] = {}
        self.tensors: Dict[str, torch.Tensor] = {}
        self.access_times: Dict[str, float] = {}
        
    def get_model(self, model_id: str) -> Optional[nn.Module]:
        """Cache'den model al"""
        if model_id in self.models:
            self.access_times[model_id] = time.time()
            return self.models[model_id]
        return None
    
    def put_model(self, model_id: str, model: nn.Module) -> None:
        """Model'i cache'e koy"""
        # Evict oldest if cache is full
        if len(self.models) >= self.max_size and model_id not in self.models:
            oldest = min(self.access_times.items(), key=lambda x: x[1])[0]
            del self.models[oldest]
            del self.access_times[oldest]
        
        self.models[model_id] = model
        self.access_times[model_id] = time.time()
        
    def get_tensor(self, key: str) -> Optional[torch.Tensor]:
        """Cache'den tensor al"""
        return self.tensors.get(key)
    
    def put_tensor(self, key: str, tensor: torch.Tensor) -> None:
        """Tensor'u cache'e koy"""
        self.tensors[key] = tensor
        
    def clear_tensors(self) -> None:
        """Tensor cache'i temizle"""
        self.tensors.clear()


class BatchInferenceEngine:
    """
    Batch inference engine.
    
    Dynamic batching ile throughput'u artır.
    """
    
    def __init__(
        self,
        model: nn.Module,
        device: str = "cuda",
        max_batch_size: int = 32,
        max_wait_time_ms: float = 50,
        timeout_ms: float = 5000
    ):
        self.model = model.to(device)
        self.device = device
        self.max_batch_size = max_batch_size
        self.max_wait_time_ms = max_wait_time_ms
        self.timeout_ms = timeout_ms
        
        self.request_queue: deque = deque()
        self.model_cache = ModelCache()
        self.metrics: List[InferenceMetrics] = []
        
    def predict_single(self, input_data: torch.Tensor) -> torch.Tensor:
        """Tek inference (single item)"""
        with torch.no_grad():
            input_data = input_data.to(self.device)
            output = self.model(input_data)
            return output.cpu()
    
    def predict_batch(
        self,
        inputs: List[torch.Tensor],
        batch_size: Optional[int] = None
    ) -> List[torch.Tensor]:
        """
        Batch inference.
        
        Args:
            inputs: Input tensor listesi
            batch_size: Batch boyutu (None = auto)
            
        Returns:
            Output tensor listesi
        """
        if not inputs:
            return []
        
        batch_size = batch_size or min(len(inputs), self.max_batch_size)
        results = []
        
        start_time = time.time()
        
        with torch.no_grad():
            for i in range(0, len(inputs), batch_size):
                batch = inputs[i:i + batch_size]
                
                # Stack into single tensor
                batch_tensor = torch.stack(batch).to(self.device)
                
                # Inference
                outputs = self.model(batch_tensor)
                
                # Split results
                for output in outputs:
                    results.append(output.cpu())
                
                # Clear GPU cache periodically
                if i % (batch_size * 10) == 0:
                    torch.cuda.empty_cache()
        
        # Record metrics
        elapsed = (time.time() - start_time) * 1000
        gpu_memory = torch.cuda.memory_allocated() / 1024 / 1024 if torch.cuda.is_available() else 0
        
        self.metrics.append(InferenceMetrics(
            batch_size=len(inputs),
            latency_ms=elapsed,
            throughput_qps=len(inputs) / (elapsed / 1000),
            gpu_memory_mb=gpu_memory,
            timestamp=time.time()
        ))
        
        return results
    
    def predict_async(
        self,
        inputs: List[torch.Tensor],
        num_workers: int = 4
    ) -> List[torch.Tensor]:
        """
        Async batch inference with thread pool.
        
        Args:
            inputs: Input tensor listesi
            num_workers: Thread pool worker sayısı
            
        Returns:
            Output tensor listesi
        """
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            # Split into chunks
            chunk_size = max(1, len(inputs) // num_workers)
            chunks = [inputs[i:i + chunk_size] for i in range(0, len(inputs), chunk_size)]
            
            # Process in parallel
            futures = [executor.submit(self.predict_batch, chunk) for chunk in chunks]
            
            # Collect results
            results = []
            for future in futures:
                results.extend(future.result())
            
            return results


class DynamicBatcher:
    """
    Dynamic batching engine.
    
    Request'leri dinamik olarak batch'lere grupla.
    """
    
    def __init__(
        self,
        process_fn: Callable[[List[Any]], List[Any]],
        max_batch_size: int = 16,
        max_wait_time_ms: float = 100
    ):
        self.process_fn = process_fn
        self.max_batch_size = max_batch_size
        self.max_wait_time_ms = max_wait_time_ms
        
        self.request_queue: deque = deque()
        self.results: Dict[str, Any] = {}
        
    def submit(self, request_id: str, request_data: Any) -> None:
        """Request submit et"""
        self.request_queue.append((request_id, request_data, time.time()))
        
    def process_batch(self) -> Dict[str, Any]:
        """
        Mevcut queue'yu batch olarak işle.
        
        Returns:
            {request_id: result} mapping
        """
        if not self.request_queue:
            return {}
        
        # Collect batch
        batch = []
        request_ids = []
        
        current_time = time.time()
        max_wait_seconds = self.max_wait_time_ms / 1000
        
        while (
            len(batch) < self.max_batch_size and
            self.request_queue and
            (current_time - self.request_queue[0][2]) >= max_wait_seconds
        ):
            req_id, req_data, _ = self.request_queue.popleft()
            batch.append(req_data)
            request_ids.append(req_id)
        
        if not batch:
            return {}
        
        # Process batch
        try:
            results = self.process_fn(batch)
            
            # Map results to request IDs
            for req_id, result in zip(request_ids, results):
                self.results[req_id] = result
                
        except Exception as e:
            logger.error(f"Batch processing error: {e}")
            # Mark as failed
            for req_id in request_ids:
                self.results[req_id] = {"error": str(e)}
        
        return {rid: self.results[rid] for rid in request_ids}


class GPUMemoryOptimizer:
    """
    GPU memory optimizasyonu.
    """
    
    @staticmethod
    def get_memory_stats() -> Dict:
        """GPU memory istatistiklerini al"""
        if not torch.cuda.is_available():
            return {'message': 'CUDA not available'}
        
        return {
            'allocated_mb': torch.cuda.memory_allocated() / 1024 / 1024,
            'reserved_mb': torch.cuda.memory_reserved() / 1024 / 1024,
            'max_allocated_mb': torch.cuda.max_memory_allocated() / 1024 / 1024,
            'free_mb': (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated()) / 1024 / 1024
        }
    
    @staticmethod
    def optimize_memory() -> None:
        """GPU memory optimizasyonu yap"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
    
    @staticmethod
    def set_memory_fraction(fraction: float = 0.8) -> None:
        """GPU memory limit'i ayarla"""
        if torch.cuda.is_available():
            torch.cuda.set_per_process_memory_fraction(fraction)


class ModelQuantizer:
    """
    Model quantization.
    
    INT8 ve FP16 quantization.
    """
    
    @staticmethod
    def quantize_int8(model: nn.Module) -> nn.Module:
        """
        Model'i INT8 olarak quantize et.
        
        Args:
            model: PyTorch model
            
        Returns:
            Quantized model
        """
        model.eval()
        
        # Dynamic quantization
        quantized_model = torch.quantization.quantize_dynamic(
            model,
            {nn.Linear, nn.Conv2d},
            dtype=torch.qint8
        )
        
        return quantized_model
    
    @staticmethod
    def quantize_fp16(model: nn.Module) -> nn.Module:
        """
        Model'i FP16 olarak quantize et.
        
        Args:
            model: PyTorch model
            
        Returns:
            FP16 model
        """
        return model.half()
    
    @staticmethod
    def get_model_size(model: nn.Module) -> Dict[str, float]:
        """Model boyutunu hesapla"""
        param_size = sum(p.nelement() * p.element_size() for p in model.parameters())
        buffer_size = sum(b.nelement() * b.element_size() for b in model.buffers())
        
        return {
            'parameters_mb': param_size / 1024 / 1024,
            'buffers_mb': buffer_size / 1024 / 1024,
            'total_mb': (param_size + buffer_size) / 1024 / 1024
        }


class InferencePipeline:
    """
    End-to-end inference pipeline.
    
    Preprocessing → Model → Postprocessing
    """
    
    def __init__(
        self,
        model: nn.Module,
        preprocessor: Optional[Callable] = None,
        postprocessor: Optional[Callable] = None,
        device: str = "cuda",
        batch_size: int = 16
    ):
        self.model = model.to(device)
        self.preprocessor = preprocessor or (lambda x: x)
        self.postprocessor = postprocessor or (lambda x: x)
        self.device = device
        self.batch_size = batch_size
        
        self.metrics: List[InferenceMetrics] = []
        
    def process(self, inputs: List[Any]) -> List[Any]:
        """
        Full pipeline processing.
        
        Args:
            inputs: Raw inputs
            
        Returns:
            Processed outputs
        """
        start_time = time.time()
        
        # Preprocess
        preprocessed = [self.preprocessor(inp) for inp in inputs]
        
        # Convert to tensors
        tensor_inputs = [
            torch.tensor(p) if not isinstance(p, torch.Tensor) else p
            for p in preprocessed
        ]
        
        # Batch inference
        with torch.no_grad():
            batch_outputs = []
            for i in range(0, len(tensor_inputs), self.batch_size):
                batch = torch.stack(tensor_inputs[i:i + self.batch_size]).to(self.device)
                outputs = self.model(batch)
                batch_outputs.extend(outputs.cpu())
        
        # Postprocess
        results = [self.postprocessor(out) for out in batch_outputs]
        
        # Record metrics
        elapsed = (time.time() - start_time) * 1000
        gpu_memory = torch.cuda.memory_allocated() / 1024 / 1024 if torch.cuda.is_available() else 0
        
        self.metrics.append(InferenceMetrics(
            batch_size=len(inputs),
            latency_ms=elapsed,
            throughput_qps=len(inputs) / (elapsed / 1000),
            gpu_memory_mb=gpu_memory,
            timestamp=time.time()
        ))
        
        return results
    
    def get_metrics(self) -> Dict:
        """Pipeline metriklerini al"""
        if not self.metrics:
            return {'message': 'No metrics recorded'}
        
        avg_latency = sum(m.latency_ms for m in self.metrics) / len(self.metrics)
        avg_throughput = sum(m.throughput_qps for m in self.metrics) / len(self.metrics)
        
        return {
            'total_requests': len(self.metrics),
            'avg_latency_ms': avg_latency,
            'avg_throughput_qps': avg_throughput,
            'max_gpu_memory_mb': max(m.gpu_memory_mb for m in self.metrics)
        }


class AIInferenceOptimizer:
    """
    AI inference optimizasyon ana servisi.
    """
    
    def __init__(self):
        self.model_cache = ModelCache(max_size=10)
        self.batch_engines: Dict[str, BatchInferenceEngine] = {}
        self.pipelines: Dict[str, InferencePipeline] = {}
        
    def register_model(
        self,
        model_id: str,
        model: nn.Module,
        device: str = "cuda",
        max_batch_size: int = 32
    ) -> None:
        """Model kaydet"""
        engine = BatchInferenceEngine(
            model=model,
            device=device,
            max_batch_size=max_batch_size
        )
        self.batch_engines[model_id] = engine
        self.model_cache.put_model(model_id, model)
        
    def get_engine(self, model_id: str) -> Optional[BatchInferenceEngine]:
        """Model engine al"""
        return self.batch_engines.get(model_id)
    
    def optimize_all_models(self) -> Dict:
        """Tüm modelleri optimize et"""
        results = {}
        
        for model_id, engine in self.batch_engines.items():
            # Clear GPU cache
            GPUMemoryOptimizer.optimize_memory()
            
            # Get model stats
            model = self.model_cache.get_model(model_id)
            if model:
                size_stats = ModelQuantizer.get_model_size(model)
                results[model_id] = {
                    'size_mb': size_stats['total_mb'],
                    'memory_stats': GPUMemoryOptimizer.get_memory_stats()
                }
        
        return results
    
    def get_performance_report(self) -> Dict:
        """Performans raporu oluştur"""
        report = {
            'models': {},
            'gpu_memory': GPUMemoryOptimizer.get_memory_stats(),
            'timestamp': time.time()
        }
        
        for model_id, engine in self.batch_engines.items():
            if engine.metrics:
                avg_latency = sum(m.latency_ms for m in engine.metrics) / len(engine.metrics)
                avg_throughput = sum(m.throughput_qps for m in engine.metrics) / len(engine.metrics)
                
                report['models'][model_id] = {
                    'avg_latency_ms': avg_latency,
                    'avg_throughput_qps': avg_throughput,
                    'total_inferences': len(engine.metrics)
                }
        
        return report


# Global AI inference optimizer
ai_optimizer = AIInferenceOptimizer()
