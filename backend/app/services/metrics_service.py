"""
OptiPlan 360 - Prometheus Metrics Service
Application metrics collection for Prometheus

Bu modül:
- Custom metrics collection
- Business metrics
- Performance metrics
- AI/ML metrics
- Prometheus exposition format
"""

import time
import functools
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass
from enum import Enum
import threading
from collections import defaultdict

# Try to import prometheus_client, fallback if not available
try:
    from prometheus_client import Counter, Histogram, Gauge, Info, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    # Fallback implementations
    class Counter:
        def __init__(self, *args, **kwargs): pass
        def inc(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
    
    class Histogram:
        def __init__(self, *args, **kwargs): pass
        def observe(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
    
    class Gauge:
        def __init__(self, *args, **kwargs): pass
        def set(self, *args, **kwargs): pass
        def inc(self, *args, **kwargs): pass
        def dec(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
    
    class Info:
        def __init__(self, *args, **kwargs): pass
        def info(self, *args, **kwargs): pass
    
    class CollectorRegistry:
        pass
    
    def generate_latest(*args): return b""
    CONTENT_TYPE_LATEST = "text/plain"


class MetricType(Enum):
    """Metric tipi"""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class MetricValue:
    """Metric değeri"""
    name: str
    value: float
    labels: Dict[str, str]
    timestamp: float
    metric_type: MetricType


class MetricsCollector:
    """
    Central metrics collector for OptiPlan 360.
    """
    
    def __init__(self, namespace: str = "optiplan360"):
        self.namespace = namespace
        self.registry = CollectorRegistry() if PROMETHEUS_AVAILABLE else None
        self.custom_metrics: Dict[str, Any] = {}
        self._lock = threading.Lock()
        
        # Initialize default metrics
        self._init_default_metrics()
    
    def _init_default_metrics(self) -> None:
        """Initialize default application metrics"""
        prefix = self.namespace
        
        # HTTP Request metrics
        self.http_requests_total = Counter(
            f'{prefix}_http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status'],
            registry=self.registry
        )
        
        self.http_request_duration_seconds = Histogram(
            f'{prefix}_http_request_duration_seconds',
            'HTTP request duration in seconds',
            ['method', 'endpoint'],
            buckets=[.005, .01, .025, .05, .075, .1, .25, .5, .75, 1.0, 2.5, 5.0, 7.5, 10.0, float('inf')],
            registry=self.registry
        )
        
        self.http_request_size_bytes = Histogram(
            f'{prefix}_http_request_size_bytes',
            'HTTP request size in bytes',
            ['method', 'endpoint'],
            buckets=[100, 1000, 10000, 100000, 1000000, float('inf')],
            registry=self.registry
        )
        
        # Business metrics
        self.exports_total = Counter(
            f'{prefix}_exports_total',
            'Total number of exports',
            ['status', 'format'],
            registry=self.registry
        )
        
        self.export_duration_seconds = Histogram(
            f'{prefix}_export_duration_seconds',
            'Export operation duration',
            ['format'],
            registry=self.registry
        )
        
        self.active_locks = Gauge(
            f'{prefix}_active_locks',
            'Number of active distributed locks',
            ['lock_type'],
            registry=self.registry
        )
        
        self.checkpoint_operations_total = Counter(
            f'{prefix}_checkpoint_operations_total',
            'Total checkpoint operations',
            ['operation', 'status'],
            registry=self.registry
        )
        
        # Database metrics
        self.db_connections_active = Gauge(
            f'{prefix}_db_connections_active',
            'Active database connections',
            ['pool'],
            registry=self.registry
        )
        
        self.db_query_duration_seconds = Histogram(
            f'{prefix}_db_query_duration_seconds',
            'Database query duration',
            ['query_type'],
            buckets=[.001, .005, .01, .025, .05, .1, .25, .5, 1.0, 2.5, 5.0],
            registry=self.registry
        )
        
        # Cache metrics
        self.cache_hits_total = Counter(
            f'{prefix}_cache_hits_total',
            'Total cache hits',
            ['cache_level'],
            registry=self.registry
        )
        
        self.cache_misses_total = Counter(
            f'{prefix}_cache_misses_total',
            'Total cache misses',
            ['cache_level'],
            registry=self.registry
        )
        
        self.cache_size = Gauge(
            f'{prefix}_cache_size',
            'Current cache size',
            ['cache_level'],
            registry=self.registry
        )
        
        # AI/ML metrics
        self.ai_inference_duration_seconds = Histogram(
            f'{prefix}_ai_inference_duration_seconds',
            'AI inference duration',
            ['model_type'],
            buckets=[.01, .025, .05, .1, .25, .5, 1.0, 2.5, 5.0, 10.0],
            registry=self.registry
        )
        
        self.ai_inference_requests_total = Counter(
            f'{prefix}_ai_inference_requests_total',
            'Total AI inference requests',
            ['model_type', 'status'],
            registry=self.registry
        )
        
        self.ai_model_load_duration_seconds = Histogram(
            f'{prefix}_ai_model_load_duration_seconds',
            'AI model loading duration',
            ['model_name'],
            registry=self.registry
        )
        
        self.ai_gpu_memory_usage_bytes = Gauge(
            f'{prefix}_ai_gpu_memory_usage_bytes',
            'GPU memory usage',
            ['device'],
            registry=self.registry
        )
        
        # System metrics
        self.system_info = Info(
            f'{prefix}_system_info',
            'System information',
            registry=self.registry
        )
        
        self.app_info = Info(
            f'{prefix}_app_info',
            'Application information',
            registry=self.registry
        )
    
    def set_system_info(self, version: str, environment: str) -> None:
        """Set system information metrics"""
        import platform
        
        self.system_info.info({
            'python_version': platform.python_version(),
            'platform': platform.platform(),
            'processor': platform.processor()
        })
        
        self.app_info.info({
            'version': version,
            'environment': environment
        })
    
    # HTTP metrics helpers
    def record_http_request(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration_seconds: float,
        request_size_bytes: int = 0
    ) -> None:
        """Record HTTP request metrics"""
        status_class = f"{status_code // 100}xx"
        
        self.http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status=status_class
        ).inc()
        
        self.http_request_duration_seconds.labels(
            method=method,
            endpoint=endpoint
        ).observe(duration_seconds)
        
        if request_size_bytes > 0:
            self.http_request_size_bytes.labels(
                method=method,
                endpoint=endpoint
            ).observe(request_size_bytes)
    
    # Business metrics helpers
    def record_export(self, status: str, format: str, duration_seconds: float) -> None:
        """Record export operation metrics"""
        self.exports_total.labels(status=status, format=format).inc()
        self.export_duration_seconds.labels(format=format).observe(duration_seconds)
    
    def update_active_locks(self, lock_type: str, count: int) -> None:
        """Update active locks gauge"""
        self.active_locks.labels(lock_type=lock_type).set(count)
    
    def record_checkpoint_operation(self, operation: str, status: str) -> None:
        """Record checkpoint operation metrics"""
        self.checkpoint_operations_total.labels(operation=operation, status=status).inc()
    
    # Database metrics helpers
    def update_db_connections(self, pool: str, count: int) -> None:
        """Update database connection count"""
        self.db_connections_active.labels(pool=pool).set(count)
    
    def record_db_query(self, query_type: str, duration_seconds: float) -> None:
        """Record database query metrics"""
        self.db_query_duration_seconds.labels(query_type=query_type).observe(duration_seconds)
    
    # Cache metrics helpers
    def record_cache_hit(self, cache_level: str) -> None:
        """Record cache hit"""
        self.cache_hits_total.labels(cache_level=cache_level).inc()
    
    def record_cache_miss(self, cache_level: str) -> None:
        """Record cache miss"""
        self.cache_misses_total.labels(cache_level=cache_level).inc()
    
    def update_cache_size(self, cache_level: str, size: int) -> None:
        """Update cache size"""
        self.cache_size.labels(cache_level=cache_level).set(size)
    
    # AI/ML metrics helpers
    def record_ai_inference(
        self,
        model_type: str,
        duration_seconds: float,
        success: bool = True
    ) -> None:
        """Record AI inference metrics"""
        status = "success" if success else "failure"
        
        self.ai_inference_requests_total.labels(
            model_type=model_type,
            status=status
        ).inc()
        
        self.ai_inference_duration_seconds.labels(
            model_type=model_type
        ).observe(duration_seconds)
    
    def record_model_load(self, model_name: str, duration_seconds: float) -> None:
        """Record model loading metrics"""
        self.ai_model_load_duration_seconds.labels(model_name=model_name).observe(duration_seconds)
    
    def update_gpu_memory(self, device: str, bytes_used: int) -> None:
        """Update GPU memory usage"""
        self.ai_gpu_memory_usage_bytes.labels(device=device).set(bytes_used)
    
    # Custom metrics
    def create_counter(
        self,
        name: str,
        description: str,
        labels: Optional[List[str]] = None
    ) -> Counter:
        """Create custom counter metric"""
        full_name = f'{self.namespace}_{name}'
        
        if full_name not in self.custom_metrics:
            self.custom_metrics[full_name] = Counter(
                full_name,
                description,
                labels or [],
                registry=self.registry
            )
        
        return self.custom_metrics[full_name]
    
    def create_gauge(
        self,
        name: str,
        description: str,
        labels: Optional[List[str]] = None
    ) -> Gauge:
        """Create custom gauge metric"""
        full_name = f'{self.namespace}_{name}'
        
        if full_name not in self.custom_metrics:
            self.custom_metrics[full_name] = Gauge(
                full_name,
                description,
                labels or [],
                registry=self.registry
            )
        
        return self.custom_metrics[full_name]
    
    def create_histogram(
        self,
        name: str,
        description: str,
        labels: Optional[List[str]] = None,
        buckets: Optional[List[float]] = None
    ) -> Histogram:
        """Create custom histogram metric"""
        full_name = f'{self.namespace}_{name}'
        
        if full_name not in self.custom_metrics:
            self.custom_metrics[full_name] = Histogram(
                full_name,
                description,
                labels or [],
                buckets=buckets or [.005, .01, .025, .05, .1, .25, .5, 1.0, 2.5, 5.0, 10.0],
                registry=self.registry
            )
        
        return self.custom_metrics[full_name]
    
    # Metric exposition
    def get_metrics(self) -> bytes:
        """Get metrics in Prometheus exposition format"""
        if PROMETHEUS_AVAILABLE:
            return generate_latest(self.registry)
        return b""
    
    def get_metrics_content_type(self) -> str:
        """Get metrics content type"""
        return CONTENT_TYPE_LATEST


# Decorator for automatic metric collection
def timed(metric_collector: MetricsCollector, metric_name: str, labels: Optional[Dict] = None):
    """
    Decorator to automatically time function execution.
    
    Usage:
        @timed(metrics, "function_duration")
        def my_function():
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                status = "success"
                return result
            except Exception as e:
                status = "error"
                raise
            finally:
                duration = time.time() - start_time
                
                # Record to appropriate metric
                if hasattr(metric_collector, metric_name):
                    metric = getattr(metric_collector, metric_name)
                    if labels:
                        metric.labels(**labels).observe(duration)
                    else:
                        metric.observe(duration)
        
        return wrapper
    return decorator


# Global metrics collector
metrics_collector: Optional[MetricsCollector] = None

def init_metrics(namespace: str = "optiplan360") -> MetricsCollector:
    """Initialize global metrics collector"""
    global metrics_collector
    metrics_collector = MetricsCollector(namespace)
    return metrics_collector

def get_metrics() -> MetricsCollector:
    """Get global metrics collector"""
    if metrics_collector is None:
        raise RuntimeError("Metrics collector not initialized")
    return metrics_collector

# FastAPI integration helper
def setup_metrics_endpoint(app, path: str = "/metrics"):
    """Setup Prometheus metrics endpoint for FastAPI"""
    from fastapi import Response
    
    @app.get(path)
    async def metrics():
        """Prometheus metrics endpoint"""
        collector = get_metrics()
        return Response(
            content=collector.get_metrics(),
            media_type=collector.get_metrics_content_type()
        )
