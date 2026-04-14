"""
Real-time Inference and Streaming Analytics System
Advanced real-time inference with streaming data processing and analytics
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
import asyncio
import aioredis
import pika
import kafka
from kafka import KafkaConsumer, KafkaProducer
import threading
import time
import queue
from concurrent.futures import ThreadPoolExecutor
import joblib
from sklearn.preprocessing import StandardScaler
import torch
import torch.nn as nn
from collections import defaultdict, deque
import statistics

logger = logging.getLogger(__name__)


class StreamType(Enum):
    """Stream types"""
    KAFKA = "kafka"
    RABBITMQ = "rabbitmq"
    REDIS_STREAMS = "redis_streams"
    WEBSOCKET = "websocket"
    HTTP_STREAM = "http_stream"


class InferenceMode(Enum):
    """Inference modes"""
    REAL_TIME = "real_time"
    BATCH = "batch"
    STREAMING = "streaming"
    HYBRID = "hybrid"


class AggregationType(Enum):
    """Aggregation types"""
    SUM = "sum"
    AVERAGE = "average"
    MIN = "min"
    MAX = "max"
    COUNT = "count"
    DISTINCT_COUNT = "distinct_count"
    PERCENTILE = "percentile"
    VARIANCE = "variance"
    STANDARD_DEVIATION = "standard_deviation"


@dataclass
class StreamConfig:
    """Stream configuration"""
    stream_type: StreamType
    bootstrap_servers: Optional[List[str]] = None
    topics: List[str] = field(default_factory=list)
    queue_name: Optional[str] = None
    redis_key: Optional[str] = None
    batch_size: int = 100
    batch_timeout_ms: int = 1000
    consumer_group: Optional[str] = None
    auto_offset_reset: str = "latest"
    enable_auto_commit: bool = True


@dataclass
class InferenceRequest:
    """Inference request"""
    request_id: str
    model_id: str
    input_data: Any
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    priority: int = 1


@dataclass
class InferenceResult:
    """Inference result"""
    request_id: str
    model_id: str
    prediction: Any
    confidence: float
    inference_time_ms: float
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamWindow:
    """Stream window for time-based aggregations"""
    window_id: str
    start_time: datetime
    end_time: datetime
    size_seconds: int
    events: List[Dict[str, Any]] = field(default_factory=list)
    aggregations: Dict[str, float] = field(default_factory=dict)


class StreamConsumer:
    """Stream data consumer"""
    
    def __init__(self, config: StreamConfig):
        self.config = config
        self.consumer = None
        self.is_running = False
        self.message_queue = queue.Queue()
        
    def connect(self) -> None:
        """Connect to stream"""
        try:
            if self.config.stream_type == StreamType.KAFKA:
                self._connect_kafka()
            elif self.config.stream_type == StreamType.RABBITMQ:
                self._connect_rabbitmq()
            elif self.config.stream_type == StreamType.REDIS_STREAMS:
                self._connect_redis_streams()
            
            logger.info(f"Connected to {self.config.stream_type.value} stream")
            
        except Exception as e:
            logger.error(f"Error connecting to stream: {e}")
            raise
    
    def _connect_kafka(self) -> None:
        """Connect to Kafka"""
        self.consumer = KafkaConsumer(
            *self.config.topics,
            bootstrap_servers=self.config.bootstrap_servers,
            group_id=self.config.consumer_group,
            auto_offset_reset=self.config.auto_offset_reset,
            enable_auto_commit=self.config.enable_auto_commit,
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
    
    def _connect_rabbitmq(self) -> None:
        """Connect to RabbitMQ"""
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=self.config.bootstrap_servers[0])
        )
        channel = connection.channel()
        
        channel.queue_declare(queue=self.config.queue_name)
        channel.basic_consume(
            queue=self.config.queue_name,
            on_message_callback=self._rabbitmq_callback,
            auto_ack=True
        )
        
        self.consumer = channel
        self.connection = connection
    
    def _connect_redis_streams(self) -> None:
        """Connect to Redis Streams"""
        # Redis streams connection would be handled in consume method
        pass
    
    def _rabbitmq_callback(self, channel, method, properties, body) -> None:
        """RabbitMQ message callback"""
        try:
            message = json.loads(body.decode('utf-8'))
            self.message_queue.put({
                'data': message,
                'timestamp': datetime.utcnow(),
                'source': 'rabbitmq'
            })
        except Exception as e:
            logger.error(f"Error processing RabbitMQ message: {e}")
    
    def consume(self) -> List[Dict[str, Any]]:
        """Consume messages from stream"""
        messages = []
        
        try:
            if self.config.stream_type == StreamType.KAFKA:
                messages = self._consume_kafka()
            elif self.config.stream_type == StreamType.RABBITMQ:
                messages = self._consume_rabbitmq()
            elif self.config.stream_type == StreamType.REDIS_STREAMS:
                messages = self._consume_redis_streams()
            
        except Exception as e:
            logger.error(f"Error consuming messages: {e}")
        
        return messages
    
    def _consume_kafka(self) -> List[Dict[str, Any]]:
        """Consume from Kafka"""
        messages = []
        
        try:
            message_batch = self.consumer.poll(timeout_ms=self.config.batch_timeout_ms)
            
            for topic_partition, msg_list in message_batch.items():
                for msg in msg_list:
                    messages.append({
                        'data': msg.value,
                        'timestamp': datetime.utcnow(),
                        'source': 'kafka',
                        'topic': msg.topic,
                        'partition': msg.partition,
                        'offset': msg.offset
                    })
            
        except Exception as e:
            logger.error(f"Error consuming from Kafka: {e}")
        
        return messages
    
    def _consume_rabbitmq(self) -> List[Dict[str, Any]]:
        """Consume from RabbitMQ"""
        messages = []
        
        try:
            # Process queued messages
            while not self.message_queue.empty():
                messages.append(self.message_queue.get())
            
            # Start consuming if not running
            if not self.is_running:
                self.is_running = True
                self.consumer.start_consuming()
                
        except Exception as e:
            logger.error(f"Error consuming from RabbitMQ: {e}")
        
        return messages
    
    def _consume_redis_streams(self) -> List[Dict[str, Any]]:
        """Consume from Redis Streams"""
        messages = []
        
        # This would need aioredis for async Redis streams
        # Simplified implementation
        return messages
    
    def start(self) -> None:
        """Start consuming"""
        self.connect()
        self.is_running = True
        logger.info(f"Started consuming from {self.config.stream_type.value}")
    
    def stop(self) -> None:
        """Stop consuming"""
        self.is_running = False
        
        if self.config.stream_type == StreamType.RABBITMQ:
            self.consumer.stop_consuming()
            self.connection.close()
        elif self.config.stream_type == StreamType.KAFKA:
            self.consumer.close()
        
        logger.info("Stopped consuming")


class RealTimeInference:
    """Real-time inference engine"""
    
    def __init__(self, model_cache: Dict[str, Any], redis_client: Optional[redis.Redis] = None):
        self.models = model_cache
        self.redis = redis_client
        self.inference_queue = queue.Queue()
        self.result_queue = queue.Queue()
        self.performance_metrics = defaultdict(list)
        self.is_running = False
        
    def load_model(self, model_id: str, model_path: str) -> None:
        """Load model for inference"""
        try:
            # Load model based on type
            if model_path.endswith('.pt'):
                model = torch.load(model_path, map_location='cpu')
                model.eval()
            elif model_path.endswith('.pkl'):
                model = joblib.load(model_path)
            else:
                raise ValueError(f"Unsupported model format: {model_path}")
            
            self.models[model_id] = {
                'model': model,
                'model_type': 'pytorch' if model_path.endswith('.pt') else 'sklearn',
                'loaded_at': datetime.utcnow()
            }
            
            logger.info(f"Loaded model {model_id} for real-time inference")
            
        except Exception as e:
            logger.error(f"Error loading model {model_id}: {e}")
            raise
    
    def predict(self, request: InferenceRequest) -> InferenceResult:
        """Make real-time prediction"""
        start_time = time.time()
        
        try:
            if request.model_id not in self.models:
                raise ValueError(f"Model {request.model_id} not loaded")
            
            model_data = self.models[request.model_id]
            model = model_data['model']
            model_type = model_data['model_type']
            
            # Preprocess input
            processed_input = self._preprocess_input(request.input_data, model_type)
            
            # Make prediction
            if model_type == 'pytorch':
                prediction = self._predict_pytorch(model, processed_input)
            else:
                prediction = self._predict_sklearn(model, processed_input)
            
            # Calculate confidence (simplified)
            confidence = self._calculate_confidence(prediction, model_type)
            
            inference_time = (time.time() - start_time) * 1000  # ms
            
            # Create result
            result = InferenceResult(
                request_id=request.request_id,
                model_id=request.model_id,
                prediction=prediction,
                confidence=confidence,
                inference_time_ms=inference_time,
                timestamp=datetime.utcnow()
            )
            
            # Update performance metrics
            self.performance_metrics[request.model_id].append(inference_time)
            
            # Cache result
            if self.redis:
                self._cache_result(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in real-time inference: {e}")
            return InferenceResult(
                request_id=request.request_id,
                model_id=request.model_id,
                prediction=None,
                confidence=0.0,
                inference_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow(),
                metadata={'error': str(e)}
            )
    
    def _preprocess_input(self, input_data: Any, model_type: str) -> Any:
        """Preprocess input data"""
        # Simplified preprocessing
        if isinstance(input_data, (list, tuple)):
            return np.array(input_data)
        elif isinstance(input_data, dict):
            # Convert dict to array (simplified)
            return np.array(list(input_data.values()))
        else:
            return input_data
    
    def _predict_pytorch(self, model: nn.Module, input_data: Any) -> Any:
        """Make prediction with PyTorch model"""
        with torch.no_grad():
            if isinstance(input_data, np.ndarray):
                input_tensor = torch.FloatTensor(input_data)
                if len(input_tensor.shape) == 1:
                    input_tensor = input_tensor.unsqueeze(0)
            else:
                input_tensor = input_data
            
            output = model(input_tensor)
            
            if isinstance(output, torch.Tensor):
                return output.cpu().numpy()
            else:
                return output
    
    def _predict_sklearn(self, model: Any, input_data: Any) -> Any:
        """Make prediction with sklearn model"""
        if isinstance(input_data, torch.Tensor):
            input_data = input_data.cpu().numpy()
        
        return model.predict(input_data.reshape(1, -1) if len(input_data.shape) == 1 else input_data)
    
    def _calculate_confidence(self, prediction: Any, model_type: str) -> float:
        """Calculate confidence score"""
        # Simplified confidence calculation
        if model_type == 'pytorch':
            if isinstance(prediction, np.ndarray):
                if prediction.size > 1:
                    # Classification
                    max_prob = np.max(prediction)
                    return float(max_prob)
                else:
                    # Regression
                    return 0.8  # Default confidence for regression
        else:
            # sklearn
            return 0.75  # Default confidence
        
        return 0.5
    
    def _cache_result(self, result: InferenceResult) -> None:
        """Cache inference result"""
        try:
            cache_key = f"inference_result:{result.request_id}"
            cache_data = {
                'request_id': result.request_id,
                'model_id': result.model_id,
                'prediction': result.prediction,
                'confidence': result.confidence,
                'inference_time_ms': result.inference_time_ms,
                'timestamp': result.timestamp.isoformat()
            }
            
            self.redis.setex(cache_key, 3600, json.dumps(cache_data))  # 1 hour TTL
            
        except Exception as e:
            logger.error(f"Error caching result: {e}")
    
    def get_performance_metrics(self, model_id: str, window_minutes: int = 60) -> Dict[str, float]:
        """Get performance metrics for a model"""
        if model_id not in self.performance_metrics:
            return {}
        
        metrics = self.performance_metrics[model_id]
        if not metrics:
            return {}
        
        # Calculate statistics
        avg_latency = np.mean(metrics)
        p95_latency = np.percentile(metrics, 95)
        p99_latency = np.percentile(metrics, 99)
        min_latency = np.min(metrics)
        max_latency = np.max(metrics)
        
        return {
            'model_id': model_id,
            'avg_latency_ms': avg_latency,
            'p95_latency_ms': p95_latency,
            'p99_latency_ms': p99_latency,
            'min_latency_ms': min_latency,
            'max_latency_ms': max_latency,
            'total_inferences': len(metrics),
            'window_minutes': window_minutes
        }


class StreamingAnalytics:
    """Streaming analytics engine"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.windows = {}
        self.aggregations = defaultdict(lambda: defaultdict(list))
        self.is_running = False
        
    def create_window(self, window_id: str, size_seconds: int) -> StreamWindow:
        """Create time window for analytics"""
        window = StreamWindow(
            window_id=window_id,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(seconds=size_seconds),
            size_seconds=size_seconds
        )
        
        self.windows[window_id] = window
        return window
    
    def process_event(self, event: Dict[str, Any], window_id: str) -> None:
        """Process streaming event"""
        try:
            if window_id not in self.windows:
                self.create_window(window_id, 60)  # Default 60-second window
            
            window = self.windows[window_id]
            
            # Check if event is within window
            event_time = event.get('timestamp', datetime.utcnow())
            if isinstance(event_time, str):
                event_time = datetime.fromisoformat(event_time)
            
            if window.start_time <= event_time <= window.end_time:
                window.events.append(event)
                
                # Update aggregations
                self._update_aggregations(event, window_id)
            
        except Exception as e:
            logger.error(f"Error processing event: {e}")
    
    def _update_aggregations(self, event: Dict[str, Any], window_id: str) -> None:
        """Update aggregations for window"""
        # Extract numeric fields
        for key, value in event.items():
            if isinstance(value, (int, float)):
                self.aggregations[window_id][key].append(value)
    
    def calculate_window_aggregations(self, window_id: str) -> Dict[str, Any]:
        """Calculate aggregations for window"""
        if window_id not in self.windows:
            return {}
        
        window = self.windows[window_id]
        aggregations = {}
        
        for field, values in self.aggregations[window_id].items():
            if values:
                aggregations[field] = {
                    'count': len(values),
                    'sum': sum(values),
                    'average': np.mean(values),
                    'min': min(values),
                    'max': max(values),
                    'variance': np.var(values),
                    'std_deviation': np.std(values),
                    'percentiles': {
                        'p50': np.percentile(values, 50),
                        'p95': np.percentile(values, 95),
                        'p99': np.percentile(values, 99)
                    }
                }
        
        return {
            'window_id': window_id,
            'start_time': window.start_time.isoformat(),
            'end_time': window.end_time.isoformat(),
            'event_count': len(window.events),
            'aggregations': aggregations
        }
    
    def sliding_window_aggregation(self, field: str, window_size: int, 
                                aggregation_type: AggregationType) -> List[float]:
        """Calculate sliding window aggregation"""
        if field not in self.aggregations or not self.aggregations[field]:
            return []
        
        values = self.aggregations[field]
        results = []
        
        for i in range(len(values) - window_size + 1):
            window_values = values[i:i + window_size]
            
            if aggregation_type == AggregationType.AVERAGE:
                results.append(np.mean(window_values))
            elif aggregation_type == AggregationType.SUM:
                results.append(sum(window_values))
            elif aggregation_type == AggregationType.MIN:
                results.append(min(window_values))
            elif aggregation_type == AggregationType.MAX:
                results.append(max(window_values))
            elif aggregation_type == AggregationType.VARIANCE:
                results.append(np.var(window_values))
            elif aggregation_type == AggregationType.STANDARD_DEVIATION:
                results.append(np.std(window_values))
        
        return results


class StreamingInferenceService:
    """Main streaming inference service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.consumers = {}
        self.inference_engine = RealTimeInference({}, redis_client)
        self.analytics = StreamingAnalytics(redis_client)
        self.models = {}
        
    def setup_stream_consumer(self, consumer_id: str, config: StreamConfig) -> StreamConsumer:
        """Setup stream consumer"""
        consumer = StreamConsumer(config)
        self.consumers[consumer_id] = consumer
        
        logger.info(f"Setup stream consumer {consumer_id}")
        return consumer
    
    def load_inference_model(self, model_id: str, model_path: str) -> None:
        """Load model for inference"""
        self.inference_engine.load_model(model_id, model_path)
        self.models[model_id] = model_path
    
    def start_stream_processing(self, consumer_id: str, model_id: str,
                             window_id: str = "default") -> None:
        """Start processing stream with inference"""
        if consumer_id not in self.consumers:
            raise ValueError(f"Consumer {consumer_id} not found")
        
        consumer = self.consumers[consumer_id]
        
        def process_stream():
            consumer.start()
            
            while consumer.is_running:
                try:
                    # Consume messages
                    messages = consumer.consume()
                    
                    for message in messages:
                        # Create inference request
                        request = InferenceRequest(
                            request_id=f"req_{secrets.token_hex(8)}",
                            model_id=model_id,
                            input_data=message['data'],
                            timestamp=message['timestamp'],
                            metadata=message
                        )
                        
                        # Make inference
                        result = self.inference_engine.predict(request)
                        
                        # Process event for analytics
                        event_data = {
                            **message,
                            'prediction': result.prediction,
                            'confidence': result.confidence,
                            'inference_time_ms': result.inference_time_ms,
                            'request_id': request.request_id
                        }
                        
                        self.analytics.process_event(event_data, window_id)
                        
                        # Store result
                        if self.redis:
                            self._store_inference_result(result)
                    
                    # Small delay to prevent busy waiting
                    time.sleep(0.01)
                    
                except Exception as e:
                    logger.error(f"Error in stream processing: {e}")
                    time.sleep(1)
        
        # Start processing in separate thread
        processing_thread = threading.Thread(target=process_stream)
        processing_thread.daemon = True
        processing_thread.start()
        
        logger.info(f"Started stream processing for {consumer_id}")
    
    def get_stream_metrics(self, consumer_id: str) -> Dict[str, Any]:
        """Get stream processing metrics"""
        if consumer_id not in self.consumers:
            return {'error': f'Consumer {consumer_id} not found'}
        
        consumer = self.consumers[consumer_id]
        
        # Get queue size
        queue_size = 0
        try:
            queue_size = consumer.message_queue.qsize()
        except:
            pass
        
        return {
            'consumer_id': consumer_id,
            'stream_type': consumer.config.stream_type.value,
            'is_running': consumer.is_running,
            'queue_size': queue_size,
            'last_activity': datetime.utcnow().isoformat()
        }
    
    def get_inference_metrics(self, model_id: str, window_minutes: int = 60) -> Dict[str, Any]:
        """Get inference performance metrics"""
        return self.inference_engine.get_performance_metrics(model_id, window_minutes)
    
    def get_analytics_summary(self, window_id: str) -> Dict[str, Any]:
        """Get streaming analytics summary"""
        return self.analytics.calculate_window_aggregations(window_id)
    
    def _store_inference_result(self, result: InferenceResult) -> None:
        """Store inference result"""
        try:
            result_key = f"stream_inference:{result.request_id}"
            result_data = {
                'request_id': result.request_id,
                'model_id': result.model_id,
                'prediction': result.prediction,
                'confidence': result.confidence,
                'inference_time_ms': result.inference_time_ms,
                'timestamp': result.timestamp.isoformat()
            }
            
            self.redis.setex(result_key, 3600, json.dumps(result_data))  # 1 hour TTL
            
        except Exception as e:
            logger.error(f"Error storing inference result: {e}")


# Global streaming inference service instance
streaming_inference_service = StreamingInferenceService()

# Export functions
def setup_stream_consumer(consumer_id: str, config: StreamConfig) -> StreamConsumer:
    """Setup stream consumer"""
    return streaming_inference_service.setup_stream_consumer(consumer_id, config)

def load_streaming_model(model_id: str, model_path: str) -> None:
    """Load model for streaming inference"""
    streaming_inference_service.load_inference_model(model_id, model_path)

def start_stream_processing(consumer_id: str, model_id: str, window_id: str = "default") -> None:
    """Start processing stream with inference"""
    streaming_inference_service.start_stream_processing(consumer_id, model_id, window_id)

def get_stream_metrics(consumer_id: str) -> Dict[str, Any]:
    """Get stream processing metrics"""
    return streaming_inference_service.get_stream_metrics(consumer_id)

def get_streaming_inference_metrics(model_id: str, window_minutes: int = 60) -> Dict[str, Any]:
    """Get inference performance metrics"""
    return streaming_inference_service.get_inference_metrics(model_id, window_minutes)

def get_streaming_analytics_summary(window_id: str) -> Dict[str, Any]:
    """Get streaming analytics summary"""
    return streaming_inference_service.get_analytics_summary(window_id)

# Export all components
__all__ = [
    'StreamType',
    'InferenceMode',
    'AggregationType',
    'StreamConfig',
    'InferenceRequest',
    'InferenceResult',
    'StreamWindow',
    'StreamConsumer',
    'RealTimeInference',
    'StreamingAnalytics',
    'StreamingInferenceService',
    'setup_stream_consumer',
    'load_streaming_model',
    'start_stream_processing',
    'get_stream_metrics',
    'get_streaming_inference_metrics',
    'get_streaming_analytics_summary',
    'streaming_inference_service',
]
