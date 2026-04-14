"""
Distributed Tracing and Log Aggregation Service
Comprehensive distributed tracing with OpenTelemetry and log aggregation
"""

import logging
import asyncio
import json
import time
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import uuid
import redis
import opentelemetry
from opentelemetry import trace, baggage, context
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.exporter.otlp.proto.grpc.exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
import structlog

logger = logging.getLogger(__name__)


class LogLevel(Enum):
    """Log levels for structured logging"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class TraceStatus(Enum):
    """Trace status types"""
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: datetime
    level: LogLevel
    message: str
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    service_name: str = "optiplan360"
    service_version: str = "1.0.0"
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    component: Optional[str] = None
    function: Optional[str] = None
    line: Optional[int] = None
    exception: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)


@dataclass
class TraceConfig:
    """Distributed tracing configuration"""
    service_name: str = "optiplan360"
    service_version: str = "1.0.0"
    environment: str = "production"
    jaeger_endpoint: str = "http://jaeger:14268/api/traces"
    otlp_endpoint: str = "http://otel-collector:4317"
    sampling_ratio: float = 0.1  # 10% sampling
    enable_redis: bool = True
    enable_sql: bool = True
    enable_requests: bool = True
    batch_size: int = 512
    max_export_batch_size: int = 512
    export_timeout_millis: int = 30000


class LogAggregator:
    """Log aggregation service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.log_buffer: List[LogEntry] = []
        self.max_buffer_size = 10000
        self.flush_interval_seconds = 5
        self.log_handlers: List[Callable] = []
        
        # Log aggregation patterns
        self.aggregation_rules = {
            'error_patterns': [
                r'Exception',
                r'Error',
                r'Failed',
                r'Timeout',
                r'Connection refused'
            ],
            'performance_patterns': [
                r'slow query',
                r'high latency',
                r'timeout',
                r'performance'
            ],
            'security_patterns': [
                r'unauthorized',
                r'forbidden',
                r'sql injection',
                r'xss',
                r'csrf'
            ]
        }
    
    def add_log_handler(self, handler: Callable) -> None:
        """Add custom log handler"""
        self.log_handlers.append(handler)
    
    def log(self, entry: LogEntry) -> None:
        """Add log entry to aggregator"""
        # Add to buffer
        self.log_buffer.append(entry)
        
        # Check buffer size
        if len(self.log_buffer) >= self.max_buffer_size:
            self.flush_logs()
        
        # Process log entry
        self._process_log_entry(entry)
        
        # Trigger handlers
        for handler in self.log_handlers:
            try:
                handler(entry)
            except Exception as e:
                logger.error(f"Log handler error: {e}")
    
    def _process_log_entry(self, entry: LogEntry) -> None:
        """Process log entry for aggregation"""
        # Check for patterns
        self._check_patterns(entry)
        
        # Store in Redis if available
        if self.redis:
            self._store_log_redis(entry)
        
        # Update metrics
        self._update_metrics(entry)
    
    def _check_patterns(self, entry: LogEntry) -> None:
        """Check log entry against patterns"""
        message = entry.message.lower()
        
        # Error patterns
        for pattern in self.aggregation_rules['error_patterns']:
            if pattern.lower() in message:
                self._increment_metric('log_error_pattern', pattern)
                break
        
        # Performance patterns
        for pattern in self.aggregation_rules['performance_patterns']:
            if pattern.lower() in message:
                self._increment_metric('log_performance_pattern', pattern)
                break
        
        # Security patterns
        for pattern in self.aggregation_rules['security_patterns']:
            if pattern.lower() in message:
                self._increment_metric('log_security_pattern', pattern)
                self._create_security_alert(entry, pattern)
                break
    
    def _store_log_redis(self, entry: LogEntry) -> None:
        """Store log entry in Redis"""
        try:
            # Store recent logs
            log_key = f"logs:{entry.service_name}:{entry.timestamp.strftime('%Y%m%d%H')}"
            log_data = {
                'timestamp': entry.timestamp.isoformat(),
                'level': entry.level.value,
                'message': entry.message,
                'trace_id': entry.trace_id,
                'span_id': entry.span_id,
                'user_id': entry.user_id,
                'component': entry.component,
                'metadata': entry.metadata
            }
            
            self.redis.lpush(log_key, json.dumps(log_data))
            self.redis.expire(log_key, 3600)  # 1 hour TTL
            
            # Store error logs separately
            if entry.level in [LogLevel.ERROR, LogLevel.CRITICAL]:
                error_key = f"errors:{entry.service_name}:{entry.timestamp.strftime('%Y%m%d%H')}"
                self.redis.lpush(error_key, json.dumps(log_data))
                self.redis.expire(error_key, 86400)  # 24 hour TTL
            
        except Exception as e:
            logger.error(f"Redis log storage error: {e}")
    
    def _update_metrics(self, entry: LogEntry) -> None:
        """Update log metrics"""
        self._increment_metric('log_total', 1)
        self._increment_metric(f'log_level_{entry.level.value.lower()}', 1)
        
        if entry.component:
            self._increment_metric(f'log_component_{entry.component}', 1)
        
        if entry.user_id:
            self._increment_metric('log_user_authenticated', 1)
    
    def _increment_metric(self, metric_name: str, value: float = 1) -> None:
        """Increment metric counter"""
        if self.redis:
            try:
                key = f"metrics:{metric_name}"
                self.redis.incrby(key, int(value))
                self.redis.expire(key, 86400)  # 24 hour TTL
            except Exception as e:
                logger.error(f"Metric increment error: {e}")
    
    def _create_security_alert(self, entry: LogEntry, pattern: str) -> None:
        """Create security alert"""
        alert = {
            'timestamp': entry.timestamp.isoformat(),
            'type': 'security_pattern_detected',
            'pattern': pattern,
            'message': entry.message,
            'trace_id': entry.trace_id,
            'user_id': entry.user_id,
            'ip_address': entry.metadata.get('ip_address'),
            'user_agent': entry.metadata.get('user_agent'),
            'severity': 'medium'
        }
        
        # Store alert
        if self.redis:
            alert_key = f"alerts:security:{entry.timestamp.strftime('%Y%m%d%H')}"
            self.redis.lpush(alert_key, json.dumps(alert))
            self.redis.expire(alert_key, 86400)
    
    def flush_logs(self) -> None:
        """Flush log buffer to storage"""
        if not self.log_buffer:
            return
        
        try:
            # Batch process logs
            for entry in self.log_buffer:
                self._process_log_entry(entry)
            
            # Clear buffer
            self.log_buffer.clear()
            
            logger.info(f"Flushed {len(self.log_buffer)} log entries")
            
        except Exception as e:
            logger.error(f"Log flush error: {e}")
    
    def get_logs(self, 
                 service_name: Optional[str] = None,
                 level: Optional[LogLevel] = None,
                 start_time: Optional[datetime] = None,
                 end_time: Optional[datetime] = None,
                 trace_id: Optional[str] = None,
                 limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve logs with filters"""
        if not self.redis:
            return []
        
        logs = []
        
        try:
            # Search through recent log keys
            current_time = datetime.utcnow()
            for hours_ago in range(24):  # Search last 24 hours
                search_time = current_time - timedelta(hours=hours_ago)
                log_key = f"logs:{service_name or 'optiplan360'}:{search_time.strftime('%Y%m%d%H')}"
                
                if self.redis.exists(log_key):
                    log_entries = self.redis.lrange(log_key, 0, -1)
                    
                    for log_data in log_entries:
                        try:
                            log_entry = json.loads(log_data)
                            
                            # Apply filters
                            if level and log_entry.get('level') != level.value:
                                continue
                            
                            if trace_id and log_entry.get('trace_id') != trace_id:
                                continue
                            
                            if start_time:
                                log_time = datetime.fromisoformat(log_entry['timestamp'])
                                if log_time < start_time:
                                    continue
                            
                            if end_time:
                                log_time = datetime.fromisoformat(log_entry['timestamp'])
                                if log_time > end_time:
                                    continue
                            
                            logs.append(log_entry)
                            
                            if len(logs) >= limit:
                                break
                                
                        except json.JSONDecodeError:
                            continue
                
                if len(logs) >= limit:
                    break
            
            # Sort by timestamp
            logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            return logs[:limit]
            
        except Exception as e:
            logger.error(f"Log retrieval error: {e}")
            return []


class DistributedTracer:
    """Distributed tracing service"""
    
    def __init__(self, config: TraceConfig):
        self.config = config
        self.tracer = None
        self.log_aggregator = LogAggregator()
        self._setup_tracing()
    
    def _setup_tracing(self) -> None:
        """Setup OpenTelemetry tracing"""
        # Create resource
        resource = Resource.create(
            attributes={
                "service.name": self.config.service_name,
                "service.version": self.config.service_version,
                "deployment.environment": self.config.environment,
            }
        )
        
        # Create tracer provider
        tracer_provider = TracerProvider(resource=resource)
        
        # Add Jaeger exporter
        jaeger_exporter = JaegerExporter(
            endpoint=self.config.jaeger_endpoint,
            collector_endpoint=self.config.jaeger_endpoint,
        )
        
        # Add OTLP exporter for OpenTelemetry Collector
        otlp_exporter = OTLPSpanExporter(
            endpoint=self.config.jaeger_endpoint,
            insecure=True,
        )
        
        # Add batch processors
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                jaeger_exporter,
                max_export_batch_size=self.config.max_export_batch_size,
                export_timeout_millis=self.config.export_timeout_millis,
            )
        )
        
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                otlp_exporter,
                max_export_batch_size=self.config.max_export_batch_size,
                export_timeout_millis=self.config.export_timeout_millis,
            )
        )
        
        # Set sampling
        tracer_provider.set_sampler(
            TraceIdRatioBased(self.config.sampling_ratio)
        )
        
        # Register tracer provider
        trace.set_tracer_provider(tracer_provider)
        
        # Get tracer
        self.tracer = trace.get_tracer(self.config.service_name)
        
        # Instrument libraries
        if self.config.enable_sql:
            SQLAlchemyInstrumentor().instrument()
        
        if self.config.enable_redis:
            RedisInstrumentor().instrument()
        
        if self.config.enable_requests:
            RequestsInstrumentor().instrument()
        
        # Configure structured logging
        self._setup_structured_logging()
    
    def _setup_structured_logging(self) -> None:
        """Setup structured logging with trace context"""
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )
    
    def start_span(self, 
                   name: str, 
                   kind: str = "INTERNAL",
                   attributes: Optional[Dict[str, Any]] = None) -> trace.Span:
        """Start a new span"""
        span = self.tracer.start_span(name, kind=kind)
        
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, value)
        
        return span
    
    def log_with_trace(self, 
                      message: str, 
                      level: LogLevel = LogLevel.INFO,
                      attributes: Optional[Dict[str, Any]] = None) -> None:
        """Log message with trace context"""
        current_span = trace.get_current_span()
        
        log_entry = LogEntry(
            timestamp=datetime.utcnow(),
            level=level,
            message=message,
            trace_id=self._get_trace_id(),
            span_id=self._get_span_id(),
            metadata=attributes or {}
        )
        
        self.log_aggregator.log(log_entry)
        
        # Also add to span attributes
        if current_span:
            current_span.set_attribute(f"log.{level.value.lower()}", message)
    
    def _get_trace_id(self) -> Optional[str]:
        """Get current trace ID"""
        current_span = trace.get_current_span()
        if current_span:
            return current_span.get_span_context().trace_id
        return None
    
    def _get_span_id(self) -> Optional[str]:
        """Get current span ID"""
        current_span = trace.get_current_span()
        if current_span:
            return current_span.get_span_context().span_id
        return None
    
    def trace_function(self, name: Optional[str] = None):
        """Decorator for tracing functions"""
        def decorator(func):
            func_name = name or f"{func.__module__}.{func.__name__}"
            
            async def async_wrapper(*args, **kwargs):
                with self.start_span(func_name) as span:
                    span.set_attribute("function.name", func.__name__)
                    span.set_attribute("function.module", func.__module__)
                    
                    try:
                        result = await func(*args, **kwargs)
                        span.set_attribute("function.success", True)
                        return result
                    except Exception as e:
                        span.set_attribute("function.success", False)
                        span.set_attribute("function.error", str(e))
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        self.log_with_trace(
                            f"Function {func_name} failed: {str(e)}",
                            LogLevel.ERROR,
                            {"function": func_name, "error": str(e)}
                        )
                        raise
            
            def sync_wrapper(*args, **kwargs):
                with self.start_span(func_name) as span:
                    span.set_attribute("function.name", func.__name__)
                    span.set_attribute("function.module", func.__module__)
                    
                    try:
                        result = func(*args, **kwargs)
                        span.set_attribute("function.success", True)
                        return result
                    except Exception as e:
                        span.set_attribute("function.success", False)
                        span.set_attribute("function.error", str(e))
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        self.log_with_trace(
                            f"Function {func_name} failed: {str(e)}",
                            LogLevel.ERROR,
                            {"function": func_name, "error": str(e)}
                        )
                        raise
            
            return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        
        return decorator
    
    def get_trace_analytics(self, hours: int = 24) -> Dict[str, Any]:
        """Get trace analytics"""
        if not self.log_aggregator.redis:
            return {"error": "Redis not available"}
        
        analytics = {
            'total_traces': 0,
            'error_traces': 0,
            'avg_duration_ms': 0,
            'slow_traces': 0,
            'services': {},
            'errors': []
        }
        
        try:
            # Analyze recent traces
            current_time = datetime.utcnow()
            trace_durations = []
            
            for hours_ago in range(hours):
                search_time = current_time - timedelta(hours=hours_ago)
                trace_key = f"traces:{search_time.strftime('%Y%m%d%H')}"
                
                if self.log_aggregator.redis.exists(trace_key):
                    traces = self.log_aggregator.redis.lrange(trace_key, 0, -1)
                    
                    for trace_data in traces:
                        try:
                            trace_info = json.loads(trace_data)
                            analytics['total_traces'] += 1
                            
                            if trace_info.get('status') == 'error':
                                analytics['error_traces'] += 1
                                analytics['errors'].append(trace_info)
                            
                            duration = trace_info.get('duration_ms', 0)
                            trace_durations.append(duration)
                            
                            if duration > 5000:  # Slow trace threshold
                                analytics['slow_traces'] += 1
                            
                            service = trace_info.get('service', 'unknown')
                            if service not in analytics['services']:
                                analytics['services'][service] = {
                                    'count': 0,
                                    'errors': 0,
                                    'avg_duration': 0
                                }
                            
                            analytics['services'][service]['count'] += 1
                            
                            if trace_info.get('status') == 'error':
                                analytics['services'][service]['errors'] += 1
                                
                        except json.JSONDecodeError:
                            continue
            
            # Calculate averages
            if trace_durations:
                analytics['avg_duration_ms'] = sum(trace_durations) / len(trace_durations)
            
            # Calculate service metrics
            for service, metrics in analytics['services'].items():
                if metrics['count'] > 0:
                    metrics['error_rate'] = metrics['errors'] / metrics['count']
                    metrics['avg_duration'] = metrics.get('avg_duration', 0)
            
            return analytics
            
        except Exception as e:
            logger.error(f"Trace analytics error: {e}")
            return {"error": str(e)}


# Global instances
trace_config = TraceConfig()
distributed_tracer = DistributedTracer(trace_config)
log_aggregator = distributed_tracer.log_aggregator

# Export functions
def trace_function(name: Optional[str] = None):
    """Decorator for tracing functions"""
    return distributed_tracer.trace_function(name)

def log_with_trace(message: str, 
                 level: LogLevel = LogLevel.INFO,
                 attributes: Optional[Dict[str, Any]] = None) -> None:
    """Log message with trace context"""
    distributed_tracer.log_with_trace(message, level, attributes)

def start_span(name: str, kind: str = "INTERNAL", attributes: Optional[Dict[str, Any]] = None) -> trace.Span:
    """Start a new span"""
    return distributed_tracer.start_span(name, kind, attributes)

def get_trace_analytics(hours: int = 24) -> Dict[str, Any]:
    """Get trace analytics"""
    return distributed_tracer.get_trace_analytics(hours)

def get_logs(service_name: Optional[str] = None,
             level: Optional[LogLevel] = None,
             start_time: Optional[datetime] = None,
             end_time: Optional[datetime] = None,
             trace_id: Optional[str] = None,
             limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieve logs with filters"""
    return log_aggregator.get_logs(service_name, level, start_time, end_time, trace_id, limit)

# Export all components
__all__ = [
    'LogLevel',
    'TraceStatus',
    'LogEntry',
    'TraceConfig',
    'LogAggregator',
    'DistributedTracer',
    'trace_function',
    'log_with_trace',
    'start_span',
    'get_trace_analytics',
    'get_logs',
    'trace_config',
    'distributed_tracer',
    'log_aggregator',
]
