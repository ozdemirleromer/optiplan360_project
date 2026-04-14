"""
OptiPlan 360 - Logging and Tracing Service
Structured logging and distributed tracing implementation

Bu modül:
- Structured JSON logging
- Log aggregation with Loki/ELK
- Distributed tracing with OpenTelemetry
- Context propagation
- Performance tracing
"""

import logging
import json
import time
import uuid
from typing import Dict, Optional, Any, Callable
from dataclasses import dataclass, asdict
from contextvars import ContextVar
from functools import wraps
import sys
import traceback

# Try to import OpenTelemetry
try:
    from opentelemetry import trace
    from opentelemetry.exporter.jaeger.thrift import JaegerExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource as OTelResource
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.instrumentation.redis import RedisInstrumentor
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    # Fallback implementations
    class Span:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def set_attribute(self, *args, **kwargs): pass
        def set_status(self, *args, **kwargs): pass
        def record_exception(self, *args, **kwargs): pass
    
    class Tracer:
        def start_as_current_span(self, *args, **kwargs): return Span()
        def start_span(self, *args, **kwargs): return Span()
    
    def get_tracer(*args, **kwargs): return Tracer()

# Context variables for request tracking
request_id_context: ContextVar[str] = ContextVar('request_id', default='')
user_id_context: ContextVar[Optional[str]] = ContextVar('user_id', default=None)


class JSONFormatter(logging.Formatter):
    """JSON formatında structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'source': {
                'file': record.pathname,
                'line': record.lineno,
                'function': record.funcName
            }
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': traceback.format_exception(*record.exc_info)
            }
        
        # Add request context
        request_id = request_id_context.get()
        if request_id:
            log_data['request_id'] = request_id
        
        user_id = user_id_context.get()
        if user_id:
            log_data['user_id'] = user_id
        
        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'exc_info', 'exc_text', 'stack_info', 
                          'lineno', 'funcName', 'created', 'msecs', 'relativeCreated', 
                          'thread', 'threadName', 'processName', 'process', 'getMessage', 
                          'message']:
                log_data[key] = value
        
        return json.dumps(log_data, default=str)


class StructuredLogger:
    """Structured logging wrapper"""
    
    def __init__(self, name: str, level: int = logging.INFO):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        
        # Prevent propagation to avoid duplicate logs
        self.logger.propagate = False
        
        # Add JSON handler if not already present
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(JSONFormatter())
            self.logger.addHandler(handler)
    
    def debug(self, message: str, **kwargs):
        """Debug level log"""
        self.logger.debug(message, extra=kwargs)
    
    def info(self, message: str, **kwargs):
        """Info level log"""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs):
        """Warning level log"""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, exc_info: bool = False, **kwargs):
        """Error level log"""
        self.logger.error(message, exc_info=exc_info, extra=kwargs)
    
    def critical(self, message: str, exc_info: bool = False, **kwargs):
        """Critical level log"""
        self.logger.critical(message, exc_info=exc_info, extra=kwargs)
    
    def exception(self, message: str, **kwargs):
        """Exception log with traceback"""
        self.logger.exception(message, extra=kwargs)
    
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        **kwargs
    ):
        """Log HTTP request"""
        self.info(
            f"{method} {path} {status_code} {duration_ms:.2f}ms",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            **kwargs
        )
    
    def log_database_query(
        self,
        query: str,
        duration_ms: float,
        rows_affected: int = 0,
        **kwargs
    ):
        """Log database query"""
        self.debug(
            f"Database query executed",
            query=query[:200],
            duration_ms=duration_ms,
            rows_affected=rows_affected,
            **kwargs
        )
    
    def log_export_operation(
        self,
        operation: str,
        islem_id: str,
        status: str,
        duration_ms: float,
        record_count: int = 0,
        **kwargs
    ):
        """Log export operation"""
        self.info(
            f"Export {operation} {status}",
            operation=operation,
            islem_id=islem_id,
            status=status,
            duration_ms=duration_ms,
            record_count=record_count,
            **kwargs
        )
    
    def log_ai_inference(
        self,
        model_type: str,
        duration_ms: float,
        success: bool,
        input_size: int = 0,
        output_size: int = 0,
        **kwargs
    ):
        """Log AI inference"""
        self.info(
            f"AI inference {model_type} {'success' if success else 'failed'}",
            model_type=model_type,
            duration_ms=duration_ms,
            success=success,
            input_size=input_size,
            output_size=output_size,
            **kwargs
        )


class RequestContext:
    """Request context manager"""
    
    def __init__(self, request_id: Optional[str] = None, user_id: Optional[str] = None):
        self.request_id = request_id or str(uuid.uuid4())
        self.user_id = user_id
        self._tokens = []
    
    def __enter__(self):
        # Set context variables
        self._tokens.append(request_id_context.set(self.request_id))
        if self.user_id:
            self._tokens.append(user_id_context.set(self.user_id))
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Reset context variables
        for token in reversed(self._tokens):
            try:
                if token:
                    request_id_context.reset(token)
            except:
                pass
    
    @property
    def context(self) -> Dict[str, Any]:
        """Get current context as dictionary"""
        return {
            'request_id': self.request_id,
            'user_id': self.user_id
        }


def get_current_request_id() -> str:
    """Get current request ID from context"""
    return request_id_context.get()


def get_current_user_id() -> Optional[str]:
    """Get current user ID from context"""
    return user_id_context.get()


# Distributed Tracing

class TracingManager:
    """Distributed tracing manager"""
    
    def __init__(
        self,
        service_name: str = "optiplan360",
        jaeger_endpoint: Optional[str] = None,
        sampling_rate: float = 1.0
    ):
        self.service_name = service_name
        self.jaeger_endpoint = jaeger_endpoint
        self.sampling_rate = sampling_rate
        self.tracer = None
        
        if OTEL_AVAILABLE and jaeger_endpoint:
            self._setup_tracer()
    
    def _setup_tracer(self):
        """Setup OpenTelemetry tracer"""
        resource = OTelResource.create({"service.name": self.service_name})
        
        # Create Jaeger exporter
        jaeger_exporter = JaegerExporter(
            agent_host_name=self.jaeger_endpoint.split(':')[0],
            agent_port=int(self.jaeger_endpoint.split(':')[1]) if ':' in self.jaeger_endpoint else 6831
        )
        
        # Create tracer provider
        provider = TracerProvider(resource=resource)
        processor = BatchSpanProcessor(jaeger_exporter)
        provider.add_span_processor(processor)
        
        # Set global tracer provider
        trace.set_tracer_provider(provider)
        
        self.tracer = trace.get_tracer(self.service_name)
    
    def start_span(
        self,
        name: str,
        kind: Optional[Any] = None,
        attributes: Optional[Dict] = None
    ):
        """Start a new span"""
        if not self.tracer:
            return Span()  # Return dummy span
        
        return self.tracer.start_as_current_span(
            name,
            kind=kind,
            attributes=attributes
        )
    
    def instrument_fastapi(self, app):
        """Instrument FastAPI application"""
        if OTEL_AVAILABLE:
            FastAPIInstrumentor.instrument_app(app)
    
    def instrument_sqlalchemy(self, engine):
        """Instrument SQLAlchemy"""
        if OTEL_AVAILABLE:
            SQLAlchemyInstrumentor().instrument()
    
    def instrument_redis(self):
        """Instrument Redis"""
        if OTEL_AVAILABLE:
            RedisInstrumentor().instrument()


# Tracing decorators

def traced(
    operation_name: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None
):
    """
    Decorator to add tracing to functions.
    
    Usage:
        @traced("my_operation", {"custom_attr": "value"})
        def my_function():
            pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            span_name = operation_name or func.__name__
            
            # Get tracer
            tracer = trace.get_tracer(__name__) if OTEL_AVAILABLE else None
            
            if tracer:
                with tracer.start_as_current_span(span_name) as span:
                    # Set attributes
                    if attributes:
                        for key, value in attributes.items():
                            span.set_attribute(key, value)
                    
                    # Set function name
                    span.set_attribute("function.name", func.__name__)
                    span.set_attribute("function.module", func.__module__)
                    
                    try:
                        result = func(*args, **kwargs)
                        span.set_status(trace.Status(trace.StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(trace.Status(trace.StatusCode.ERROR))
                        span.record_exception(e)
                        raise
            else:
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


class PerformanceTracer:
    """Performance tracing utility"""
    
    def __init__(self, name: str, logger: Optional[StructuredLogger] = None):
        self.name = name
        self.logger = logger
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        duration_ms = (self.end_time - self.start_time) * 1000
        
        if self.logger:
            self.logger.info(
                f"{self.name} completed",
                operation=self.name,
                duration_ms=duration_ms,
                success=exc_type is None
            )
        
        return False
    
    @property
    def duration_ms(self) -> float:
        """Get duration in milliseconds"""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time) * 1000
        return 0.0


# Log aggregation helpers

class LogAggregator:
    """
    Log aggregation helper for Loki/ELK.
    
    Bu sınıf, log'ları external aggregation sistemine göndermek için kullanılır.
    """
    
    def __init__(
        self,
        loki_url: Optional[str] = None,
        elasticsearch_url: Optional[str] = None
    ):
        self.loki_url = loki_url
        self.elasticsearch_url = elasticsearch_url
    
    async def send_to_loki(self, logs: list) -> bool:
        """Send logs to Loki"""
        if not self.loki_url:
            return False
        
        try:
            import aiohttp
            
            payload = {
                "streams": [
                    {
                        "stream": {"service": "optiplan360"},
                        "values": [
                            [str(int(time.time() * 1e9)), json.dumps(log)]
                            for log in logs
                        ]
                    }
                ]
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.loki_url}/loki/api/v1/push",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    return response.status == 204
                    
        except Exception as e:
            # Don't log here to avoid infinite loop
            return False
    
    async def send_to_elasticsearch(self, logs: list, index: str = "optiplan360-logs") -> bool:
        """Send logs to Elasticsearch"""
        if not self.elasticsearch_url:
            return False
        
        try:
            import aiohttp
            
            bulk_data = []
            for log in logs:
                bulk_data.append(json.dumps({"index": {"_index": index}}))
                bulk_data.append(json.dumps(log))
            
            payload = "\n".join(bulk_data) + "\n"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.elasticsearch_url}/_bulk",
                    data=payload,
                    headers={"Content-Type": "application/x-ndjson"}
                ) as response:
                    return response.status == 200
                    
        except Exception:
            return False


# Global instances
structured_logger: Optional[StructuredLogger] = None
tracing_manager: Optional[TracingManager] = None

def init_logging(
    service_name: str = "optiplan360",
    level: int = logging.INFO,
    jaeger_endpoint: Optional[str] = None
) -> tuple:
    """
    Initialize logging and tracing.
    
    Returns:
        Tuple of (StructuredLogger, TracingManager)
    """
    global structured_logger, tracing_manager
    
    # Setup structured logger
    structured_logger = StructuredLogger(service_name, level)
    
    # Setup tracing
    if jaeger_endpoint:
        tracing_manager = TracingManager(service_name, jaeger_endpoint)
    
    return structured_logger, tracing_manager

def get_logger() -> StructuredLogger:
    """Get global structured logger"""
    if structured_logger is None:
        raise RuntimeError("Logging not initialized")
    return structured_logger

def get_tracing() -> Optional[TracingManager]:
    """Get global tracing manager"""
    return tracing_manager
