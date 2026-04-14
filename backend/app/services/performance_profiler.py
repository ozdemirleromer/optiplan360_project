"""
OptiPlan 360 - Performance Profiling Service
Backend servisleri için profiling ve optimizasyon araçları

Bu modül:
- CPU ve memory profiling
- Function execution time tracking
- Database query profiling
- Async operation monitoring
- Bottleneck detection
"""

import time
import functools
import logging
import asyncio
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from collections import defaultdict
from contextlib import contextmanager
import psutil
import tracemalloc
from datetime import datetime
import json

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performans metrikleri"""
    function_name: str
    execution_time_ms: float
    cpu_percent: float
    memory_mb: float
    call_count: int = 1
    timestamp: datetime = field(default_factory=datetime.utcnow)
    additional_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DatabaseQueryMetrics:
    """Database query metrikleri"""
    query: str
    execution_time_ms: float
    rows_affected: int
    timestamp: datetime = field(default_factory=datetime.utcnow)
    slow_query: bool = False


class PerformanceProfiler:
    """
    Performance profiler - function execution tracking.
    """
    
    def __init__(self):
        self.metrics: List[PerformanceMetrics] = []
        self.function_stats: Dict[str, Dict[str, float]] = defaultdict(lambda: {
            'total_time': 0.0,
            'call_count': 0,
            'avg_time': 0.0,
            'max_time': 0.0,
            'min_time': float('inf')
        })
        self.enabled = True
        self.memory_tracking = False
        
    def enable_memory_tracking(self):
        """Memory tracking'i etkinleştir"""
        tracemalloc.start()
        self.memory_tracking = True
        
    def profile(self, func_name: Optional[str] = None):
        """
        Decorator for profiling function execution.
        
        Usage:
            @profiler.profile()
            def my_function():
                pass
        """
        def decorator(func: Callable) -> Callable:
            name = func_name or func.__name__
            
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                if not self.enabled:
                    return func(*args, **kwargs)
                
                start_time = time.perf_counter()
                start_cpu = psutil.cpu_percent()
                
                if self.memory_tracking:
                    tracemalloc.reset_peak()
                
                try:
                    result = func(*args, **kwargs)
                    
                    end_time = time.perf_counter()
                    end_cpu = psutil.cpu_percent()
                    
                    execution_time = (end_time - start_time) * 1000  # ms
                    
                    # Memory usage
                    memory_mb = 0
                    if self.memory_tracking:
                        current, peak = tracemalloc.get_traced_memory()
                        memory_mb = peak / 1024 / 1024
                    
                    # Record metrics
                    metric = PerformanceMetrics(
                        function_name=name,
                        execution_time_ms=execution_time,
                        cpu_percent=end_cpu - start_cpu,
                        memory_mb=memory_mb
                    )
                    self.metrics.append(metric)
                    
                    # Update stats
                    stats = self.function_stats[name]
                    stats['total_time'] += execution_time
                    stats['call_count'] += 1
                    stats['avg_time'] = stats['total_time'] / stats['call_count']
                    stats['max_time'] = max(stats['max_time'], execution_time)
                    stats['min_time'] = min(stats['min_time'], execution_time)
                    
                    # Log slow functions
                    if execution_time > 1000:  # > 1 second
                        logger.warning(
                            f"Slow function detected: {name} took {execution_time:.2f}ms"
                        )
                    
                    return result
                    
                except Exception as e:
                    logger.error(f"Error profiling {name}: {e}")
                    raise
            
            return wrapper
        return decorator
    
    @contextmanager
    def profile_context(self, name: str):
        """Context manager for profiling code blocks"""
        start_time = time.perf_counter()
        start_cpu = psutil.cpu_percent()
        
        try:
            yield
        finally:
            end_time = time.perf_counter()
            end_cpu = psutil.cpu_percent()
            
            execution_time = (end_time - start_time) * 1000
            
            metric = PerformanceMetrics(
                function_name=name,
                execution_time_ms=execution_time,
                cpu_percent=end_cpu - start_cpu,
                memory_mb=0
            )
            self.metrics.append(metric)
            
            # Update stats
            stats = self.function_stats[name]
            stats['total_time'] += execution_time
            stats['call_count'] += 1
            stats['avg_time'] = stats['total_time'] / stats['call_count']
    
    def get_slow_functions(self, threshold_ms: float = 500) -> List[Dict]:
        """Yavaş fonksiyonları bul"""
        slow_functions = []
        for name, stats in self.function_stats.items():
            if stats['avg_time'] > threshold_ms:
                slow_functions.append({
                    'function': name,
                    'avg_time_ms': stats['avg_time'],
                    'max_time_ms': stats['max_time'],
                    'call_count': stats['call_count'],
                    'total_time_ms': stats['total_time']
                })
        
        # Sort by average time
        slow_functions.sort(key=lambda x: x['avg_time_ms'], reverse=True)
        return slow_functions
    
    def get_top_consumers(self, n: int = 10) -> List[Dict]:
        """En çok zaman tüketen fonksiyonlar"""
        consumers = []
        for name, stats in self.function_stats.items():
            consumers.append({
                'function': name,
                'total_time_ms': stats['total_time'],
                'call_count': stats['call_count'],
                'avg_time_ms': stats['avg_time']
            })
        
        consumers.sort(key=lambda x: x['total_time_ms'], reverse=True)
        return consumers[:n]
    
    def generate_report(self) -> Dict:
        """Profil raporu oluştur"""
        total_calls = sum(s['call_count'] for s in self.function_stats.values())
        total_time = sum(s['total_time'] for s in self.function_stats.values())
        
        return {
            'total_functions': len(self.function_stats),
            'total_calls': total_calls,
            'total_time_ms': total_time,
            'slow_functions': self.get_slow_functions(),
            'top_consumers': self.get_top_consumers(),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def reset(self):
        """Metrikleri sıfırla"""
        self.metrics.clear()
        self.function_stats.clear()


class DatabaseQueryProfiler:
    """
    Database query profiling.
    
    SQLAlchemy event listeners ile query'leri izle.
    """
    
    def __init__(self, slow_query_threshold_ms: float = 100):
        self.slow_query_threshold_ms = slow_query_threshold_ms
        self.query_metrics: List[DatabaseQueryMetrics] = []
        self.query_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'count': 0,
            'total_time': 0.0,
            'avg_time': 0.0,
            'max_time': 0.0
        })
        self.enabled = True
        
    def start_profiling(self, engine):
        """SQLAlchemy engine'de profiling başlat"""
        from sqlalchemy import event
        
        @event.listens_for(engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            context._query_start_time = time.perf_counter()
            context._query_statement = statement
        
        @event.listens_for(engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            if not self.enabled:
                return
            
            total_time = (time.perf_counter() - context._query_start_time) * 1000
            
            # Simplify query for stats (remove specific values)
            simplified_query = self._simplify_query(statement)
            
            # Update stats
            stats = self.query_stats[simplified_query]
            stats['count'] += 1
            stats['total_time'] += total_time
            stats['avg_time'] = stats['total_time'] / stats['count']
            stats['max_time'] = max(stats['max_time'], total_time)
            
            # Record metric
            metric = DatabaseQueryMetrics(
                query=simplified_query,
                execution_time_ms=total_time,
                rows_affected=getattr(cursor, 'rowcount', 0),
                slow_query=total_time > self.slow_query_threshold_ms
            )
            self.query_metrics.append(metric)
            
            # Log slow queries
            if total_time > self.slow_query_threshold_ms:
                logger.warning(
                    f"Slow query ({total_time:.2f}ms): {simplified_query[:100]}..."
                )
    
    def _simplify_query(self, query: str) -> str:
        """Query'i istatistik için basitleştir"""
        # Remove values (basic implementation)
        import re
        # Replace string literals
        query = re.sub(r"'[^']*'", "'?'", query)
        # Replace numeric values
        query = re.sub(r"\b\d+\b", "?", query)
        return query[:200]  # Limit length
    
    def get_slow_queries(self, limit: int = 10) -> List[Dict]:
        """Yavaş query'leri getir"""
        slow = [m for m in self.query_metrics if m.slow_query]
        
        # Group by query
        grouped = defaultdict(lambda: {'count': 0, 'total_time': 0.0, 'query': ''})
        for m in slow:
            grouped[m.query]['count'] += 1
            grouped[m.query]['total_time'] += m.execution_time_ms
            grouped[m.query]['query'] = m.query
        
        results = [
            {
                'query': data['query'],
                'count': data['count'],
                'total_time_ms': data['total_time'],
                'avg_time_ms': data['total_time'] / data['count']
            }
            for data in grouped.values()
        ]
        
        results.sort(key=lambda x: x['total_time_ms'], reverse=True)
        return results[:limit]
    
    def get_query_stats(self) -> Dict[str, Dict[str, Any]]:
        """Query istatistiklerini getir"""
        return dict(self.query_stats)
    
    def generate_report(self) -> Dict:
        """Query profil raporu"""
        total_queries = len(self.query_metrics)
        slow_queries = len([m for m in self.query_metrics if m.slow_query])
        
        return {
            'total_queries': total_queries,
            'slow_queries': slow_queries,
            'slow_query_percentage': (slow_queries / total_queries * 100) if total_queries > 0 else 0,
            'top_slow_queries': self.get_slow_queries(),
            'query_stats': self.get_query_stats(),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def reset(self):
        """Metrikleri sıfırla"""
        self.query_metrics.clear()
        self.query_stats.clear()


class AsyncProfiler:
    """
    Async operation profiling.
    
    Async task'ların performansını izle.
    """
    
    def __init__(self):
        self.task_metrics: List[Dict] = []
        self.enabled = True
        
    async def profile_task(self, coro: asyncio.Coroutine, name: str) -> Any:
        """
        Async task'ı profille.
        
        Usage:
            result = await async_profiler.profile_task(
                my_async_function(),
                "my_async_function"
            )
        """
        if not self.enabled:
            return await coro
        
        start_time = time.perf_counter()
        task = asyncio.current_task()
        task_id = id(task)
        
        try:
            result = await coro
            
            end_time = time.perf_counter()
            execution_time = (end_time - start_time) * 1000
            
            self.task_metrics.append({
                'task_id': task_id,
                'name': name,
                'execution_time_ms': execution_time,
                'timestamp': datetime.utcnow()
            })
            
            # Log slow tasks
            if execution_time > 1000:
                logger.warning(f"Slow async task: {name} took {execution_time:.2f}ms")
            
            return result
            
        except Exception as e:
            end_time = time.perf_counter()
            execution_time = (end_time - start_time) * 1000
            
            self.task_metrics.append({
                'task_id': task_id,
                'name': name,
                'execution_time_ms': execution_time,
                'error': str(e),
                'timestamp': datetime.utcnow()
            })
            
            raise
    
    def get_slow_tasks(self, threshold_ms: float = 500) -> List[Dict]:
        """Yavaş async task'ları bul"""
        slow = [m for m in self.task_metrics if m['execution_time_ms'] > threshold_ms]
        return sorted(slow, key=lambda x: x['execution_time_ms'], reverse=True)
    
    def generate_report(self) -> Dict:
        """Async profil raporu"""
        if not self.task_metrics:
            return {'message': 'No async tasks recorded'}
        
        total_tasks = len(self.task_metrics)
        total_time = sum(m['execution_time_ms'] for m in self.task_metrics)
        avg_time = total_time / total_tasks
        
        return {
            'total_tasks': total_tasks,
            'total_time_ms': total_time,
            'avg_time_ms': avg_time,
            'slow_tasks': self.get_slow_tasks(),
            'timestamp': datetime.utcnow().isoformat()
        }


class SystemResourceMonitor:
    """
    Sistem kaynak kullanımını izle.
    """
    
    def __init__(self):
        self.process = psutil.Process()
        self.history: List[Dict] = []
        self.max_history = 1000
        
    def get_current_stats(self) -> Dict:
        """Mevcut sistem istatistiklerini al"""
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        process_cpu = self.process.cpu_percent()
        process_memory = self.process.memory_info()
        
        stats = {
            'timestamp': datetime.utcnow().isoformat(),
            'system': {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available_gb': memory.available / 1024 / 1024 / 1024,
                'disk_percent': disk.percent,
                'disk_free_gb': disk.free / 1024 / 1024 / 1024
            },
            'process': {
                'cpu_percent': process_cpu,
                'memory_mb': process_memory.rss / 1024 / 1024,
                'threads': self.process.num_threads(),
                'open_files': len(self.process.open_files())
            }
        }
        
        self.history.append(stats)
        
        # Trim history
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]
        
        return stats
    
    def get_resource_trends(self, hours: int = 1) -> Dict:
        """Kaynak kullanım trendlerini al"""
        cutoff = datetime.utcnow().timestamp() - (hours * 3600)
        recent = [h for h in self.history 
                  if datetime.fromisoformat(h['timestamp']).timestamp() > cutoff]
        
        if not recent:
            return {'message': 'No data available'}
        
        cpu_values = [h['system']['cpu_percent'] for h in recent]
        memory_values = [h['system']['memory_percent'] for h in recent]
        
        return {
            'cpu': {
                'avg': sum(cpu_values) / len(cpu_values),
                'max': max(cpu_values),
                'min': min(cpu_values)
            },
            'memory': {
                'avg': sum(memory_values) / len(memory_values),
                'max': max(memory_values),
                'min': min(memory_values)
            },
            'sample_count': len(recent)
        }


class PerformanceOptimizationService:
    """
    Performans optimizasyon ana servisi.
    """
    
    def __init__(self):
        self.profiler = PerformanceProfiler()
        self.db_profiler = DatabaseQueryProfiler()
        self.async_profiler = AsyncProfiler()
        self.resource_monitor = SystemResourceMonitor()
        
    def start_monitoring(self, engine=None):
        """Tüm monitoring'i başlat"""
        if engine:
            self.db_profiler.start_profiling(engine)
        
        logger.info("Performance monitoring started")
        
    def get_comprehensive_report(self) -> Dict:
        """Kapsamlı performans raporu"""
        return {
            'function_performance': self.profiler.generate_report(),
            'database_performance': self.db_profiler.generate_report(),
            'async_performance': self.async_profiler.generate_report(),
            'system_resources': self.resource_monitor.get_current_stats(),
            'recommendations': self._generate_recommendations()
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Optimizasyon önerileri oluştur"""
        recommendations = []
        
        # Function recommendations
        slow_functions = self.profiler.get_slow_functions(threshold_ms=1000)
        if slow_functions:
            recommendations.append(
                f"{len(slow_functions)} yavaş fonksiyon tespit edildi. "
                f"En yavaşı: {slow_functions[0]['function']} "
                f"({slow_functions[0]['avg_time_ms']:.0f}ms)"
            )
        
        # Database recommendations
        slow_queries = self.db_profiler.get_slow_queries(limit=5)
        if slow_queries:
            recommendations.append(
                f"{len(slow_queries)} yavaş query tespit edildi. "
                "Index optimizasyonu önerilir."
            )
        
        # Resource recommendations
        stats = self.resource_monitor.get_current_stats()
        if stats['system']['memory_percent'] > 80:
            recommendations.append("Memory kullanımı yüksek (%80+). Cache temizliği önerilir.")
        
        if stats['system']['cpu_percent'] > 70:
            recommendations.append("CPU kullanımı yüksek (%70+). Async işlemler gözden geçirilmeli.")
        
        return recommendations
    
    def optimize_hot_paths(self) -> Dict:
        """Sık kullanılan path'leri optimize et"""
        top_consumers = self.profiler.get_top_consumers(n=5)
        
        optimizations = []
        for consumer in top_consumers:
            if consumer['avg_time_ms'] > 100:
                optimizations.append({
                    'function': consumer['function'],
                    'current_avg_ms': consumer['avg_time_ms'],
                    'recommendation': 'Consider caching or async processing'
                })
        
        return {
            'hot_paths': top_consumers,
            'optimization_suggestions': optimizations
        }


# Global profiler instance
performance_service = PerformanceOptimizationService()
