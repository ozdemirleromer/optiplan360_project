"""
OptiPlan 360 - Caching Strategy Service
Multi-layer caching ve cache invalidation

Bu modül:
- LRU cache implementasyonu
- Redis distributed cache
- Cache warming strategies
- Smart invalidation
- Cache analytics
"""

import time
import hashlib
import logging
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass, field
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
import threading
import json
import functools

import redis

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry metadata"""
    key: str
    value: Any
    created_at: datetime
    ttl_seconds: int
    access_count: int = 0
    last_accessed: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    size_bytes: int = 0


class LRUCache:
    """
    Thread-safe LRU (Least Recently Used) cache.
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.lock = threading.RLock()
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'total_items': 0
        }
        
    def get(self, key: str) -> Optional[Any]:
        """Cache'den değer al"""
        with self.lock:
            if key not in self.cache:
                self.stats['misses'] += 1
                return None
            
            entry = self.cache[key]
            
            # Check TTL
            age = (datetime.now(timezone.utc) - entry.created_at).total_seconds()
            if age > entry.ttl_seconds:
                del self.cache[key]
                self.stats['misses'] += 1
                return None
            
            # Update access stats
            entry.access_count += 1
            entry.last_accessed = datetime.now(timezone.utc)
            
            # Move to end (most recently used)
            self.cache.move_to_end(key)
            
            self.stats['hits'] += 1
            return entry.value
    
    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Cache'e değer koy"""
        ttl = ttl or self.default_ttl
        
        with self.lock:
            # Calculate size (approximate)
            size = self._estimate_size(value)
            
            # Check if key exists
            if key in self.cache:
                # Update existing
                self.cache[key] = CacheEntry(
                    key=key,
                    value=value,
                    created_at=datetime.now(timezone.utc),
                    ttl_seconds=ttl,
                    size_bytes=size
                )
                self.cache.move_to_end(key)
            else:
                # Evict oldest if necessary
                while len(self.cache) >= self.max_size:
                    self._evict_oldest()
                
                # Add new entry
                self.cache[key] = CacheEntry(
                    key=key,
                    value=value,
                    created_at=datetime.now(timezone.utc),
                    ttl_seconds=ttl,
                    size_bytes=size
                )
                self.stats['total_items'] += 1
    
    def _evict_oldest(self) -> None:
        """En eski entry'yi çıkar"""
        if self.cache:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
            self.stats['evictions'] += 1
    
    def _estimate_size(self, value: Any) -> int:
        """Değer boyutunu tahmin et"""
        try:
            return len(str(value).encode('utf-8'))
        except:
            return 100  # Default estimate
    
    def invalidate(self, pattern: Optional[str] = None) -> int:
        """Cache'i temizle"""
        with self.lock:
            if pattern is None:
                count = len(self.cache)
                self.cache.clear()
                return count
            else:
                keys_to_delete = [k for k in self.cache.keys() if pattern in k]
                for k in keys_to_delete:
                    del self.cache[k]
                return len(keys_to_delete)
    
    def get_stats(self) -> Dict:
        """Cache istatistikleri"""
        with self.lock:
            total_requests = self.stats['hits'] + self.stats['misses']
            hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
            
            return {
                'hits': self.stats['hits'],
                'misses': self.stats['misses'],
                'hit_rate_percent': hit_rate,
                'evictions': self.stats['evictions'],
                'current_size': len(self.cache),
                'max_size': self.max_size,
                'memory_estimate_kb': sum(e.size_bytes for e in self.cache.values()) / 1024
            }
    
    def get_popular_keys(self, n: int = 10) -> List[Tuple[str, int]]:
        """En çok erişilen key'leri al"""
        with self.lock:
            sorted_entries = sorted(
                self.cache.values(),
                key=lambda e: e.access_count,
                reverse=True
            )
            return [(e.key, e.access_count) for e in sorted_entries[:n]]


class DistributedCache:
    """
    Redis-based distributed cache.
    """
    
    def __init__(
        self,
        redis_client: redis.Redis,
        default_ttl: int = 300,
        key_prefix: str = "optiplan:"
    ):
        self.redis = redis_client
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0
        }
        
    def _make_key(self, key: str) -> str:
        """Key'e prefix ekle"""
        return f"{self.key_prefix}{key}"
    
    def get(self, key: str) -> Optional[Any]:
        """Cache'den değer al"""
        try:
            full_key = self._make_key(key)
            value = self.redis.get(full_key)
            
            if value is None:
                self.stats['misses'] += 1
                return None
            
            self.stats['hits'] += 1
            return json.loads(value)
            
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self.stats['errors'] += 1
            return None
    
    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Cache'e değer koy"""
        try:
            full_key = self._make_key(key)
            ttl = ttl or self.default_ttl
            
            serialized = json.dumps(value, default=str)
            self.redis.setex(full_key, ttl, serialized)
            
            self.stats['sets'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            self.stats['errors'] += 1
            return False
    
    def invalidate(self, pattern: str = "*") -> int:
        """Pattern'e uyan key'leri sil"""
        try:
            full_pattern = self._make_key(pattern)
            keys = self.redis.keys(full_pattern)
            
            if keys:
                return self.redis.delete(*keys)
            return 0
            
        except Exception as e:
            logger.error(f"Redis invalidation error: {e}")
            return 0
    
    def invalidate_by_tag(self, tag: str) -> int:
        """Tag'e göre invalidation"""
        try:
            # Get keys associated with tag
            tag_key = self._make_key(f"tag:{tag}")
            keys = self.redis.smembers(tag_key)
            
            if keys:
                # Delete all keys
                pipe = self.redis.pipeline()
                for key in keys:
                    pipe.delete(key)
                pipe.delete(tag_key)
                results = pipe.execute()
                return sum(1 for r in results if r)
            return 0
            
        except Exception as e:
            logger.error(f"Redis tag invalidation error: {e}")
            return 0
    
    def get_stats(self) -> Dict:
        """Cache istatistikleri"""
        try:
            redis_info = self.redis.info('memory')
            
            return {
                'hits': self.stats['hits'],
                'misses': self.stats['misses'],
                'hit_rate_percent': (
                    self.stats['hits'] / (self.stats['hits'] + self.stats['misses']) * 100
                    if (self.stats['hits'] + self.stats['misses']) > 0 else 0
                ),
                'sets': self.stats['sets'],
                'errors': self.stats['errors'],
                'redis_memory_used_mb': redis_info.get('used_memory', 0) / 1024 / 1024
            }
        except Exception as e:
            logger.error(f"Redis stats error: {e}")
            return self.stats.copy()


class MultiLevelCache:
    """
    L1 (LRU) + L2 (Redis) multi-level cache.
    """
    
    def __init__(
        self,
        l1_cache: LRUCache,
        l2_cache: Optional[DistributedCache] = None
    ):
        self.l1 = l1_cache
        self.l2 = l2_cache
        
    def get(self, key: str) -> Optional[Any]:
        """L1 → L2 sırasıyla cache'den al"""
        # Try L1 first
        value = self.l1.get(key)
        if value is not None:
            return value
        
        # Try L2
        if self.l2:
            value = self.l2.get(key)
            if value is not None:
                # Promote to L1
                self.l1.put(key, value)
                return value
        
        return None
    
    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Her iki cache'e de koy"""
        self.l1.put(key, value, ttl)
        if self.l2:
            self.l2.put(key, value, ttl)
    
    def invalidate(self, pattern: Optional[str] = None) -> Dict[str, int]:
        """Her iki cache'i de temizle"""
        l1_count = self.l1.invalidate(pattern)
        l2_count = self.l2.invalidate(pattern) if self.l2 else 0
        
        return {'l1_removed': l1_count, 'l2_removed': l2_count}
    
    def get_stats(self) -> Dict:
        """Her iki cache'in istatistikleri"""
        return {
            'l1': self.l1.get_stats(),
            'l2': self.l2.get_stats() if self.l2 else None
        }


class CacheWarmingService:
    """
    Cache warming stratejileri.
    
    Sık kullanılan veriyi önceden cache'e al.
    """
    
    def __init__(self, cache: MultiLevelCache):
        self.cache = cache
        self.warming_jobs: Dict[str, Callable] = {}
        self.warming_history: List[Dict] = []
        
    def register_warming_job(self, name: str, fetch_fn: Callable, key_pattern: str) -> None:
        """Cache warming job'u kaydet"""
        self.warming_jobs[name] = {
            'fetch_fn': fetch_fn,
            'key_pattern': key_pattern
        }
        
    def warm_cache(self, job_name: str) -> Dict:
        """Cache warming job'u çalıştır"""
        if job_name not in self.warming_jobs:
            return {'error': 'Job not found'}
        
        job = self.warming_jobs[job_name]
        start_time = time.time()
        
        try:
            # Fetch data
            data = job['fetch_fn']()
            
            # Cache data
            if isinstance(data, dict):
                for key, value in data.items():
                    cache_key = f"{job['key_pattern']}:{key}"
                    self.cache.put(cache_key, value)
            elif isinstance(data, list):
                for i, item in enumerate(data):
                    cache_key = f"{job['key_pattern']}:{i}"
                    self.cache.put(cache_key, item)
            else:
                self.cache.put(job['key_pattern'], data)
            
            elapsed = time.time() - start_time
            
            record = {
                'job': job_name,
                'items_cached': len(data) if isinstance(data, (dict, list)) else 1,
                'duration_seconds': elapsed,
                'timestamp': datetime.now(timezone.utc)
            }
            self.warming_history.append(record)
            
            return record
            
        except Exception as e:
            logger.error(f"Cache warming error for {job_name}: {e}")
            return {'error': str(e)}
    
    def get_warming_history(self) -> List[Dict]:
        """Cache warming geçmişi"""
        return self.warming_history


class SmartCacheInvalidator:
    """
    Akıllı cache invalidation.
    
    Veri değişikliklerine göre ilgili cache'leri temizle.
    """
    
    def __init__(self, cache: MultiLevelCache):
        self.cache = cache
        self.dependency_graph: Dict[str, List[str]] = {}
        
    def register_dependency(self, source_key: str, dependent_keys: List[str]) -> None:
        """Cache dependency kaydet"""
        self.dependency_graph[source_key] = dependent_keys
        
    def invalidate_with_dependencies(self, key: str) -> int:
        """Dependency'leri de dahil ederek invalidation yap"""
        keys_to_invalidate = [key]
        
        # Find all dependent keys
        if key in self.dependency_graph:
            keys_to_invalidate.extend(self.dependency_graph[key])
        
        # Also find keys that depend on this key (reverse dependencies)
        for source, dependents in self.dependency_graph.items():
            if key in dependents:
                keys_to_invalidate.append(source)
        
        # Remove duplicates
        keys_to_invalidate = list(set(keys_to_invalidate))
        
        # Invalidate all
        total_removed = 0
        for k in keys_to_invalidate:
            result = self.cache.invalidate(k)
            total_removed += result.get('l1_removed', 0)
        
        return total_removed


class CachedDecorator:
    """
    Function result caching decorator.
    """
    
    def __init__(self, cache: MultiLevelCache, key_prefix: str = ""):
        self.cache = cache
        self.key_prefix = key_prefix
        
    def __call__(self, ttl: int = 300, key_fn: Optional[Callable] = None):
        """
        Decorator oluştur.
        
        Usage:
            @cached_decorator(ttl=600)
            def expensive_function(arg1, arg2):
                return result
        """
        def decorator(func: Callable) -> Callable:
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                # Generate cache key
                if key_fn:
                    cache_key = key_fn(*args, **kwargs)
                else:
                    # Default key from function name and arguments
                    key_parts = [
                        func.__name__,
                        str(args),
                        str(sorted(kwargs.items()))
                    ]
                    cache_key = hashlib.md5(
                        ':'.join(key_parts).encode()
                    ).hexdigest()
                
                full_key = f"{self.key_prefix}{cache_key}"
                
                # Try cache
                cached_value = self.cache.get(full_key)
                if cached_value is not None:
                    logger.debug(f"Cache hit for {func.__name__}")
                    return cached_value
                
                # Execute function
                result = func(*args, **kwargs)
                
                # Cache result
                self.cache.put(full_key, result, ttl)
                
                return result
            
            # Add invalidate method to function
            def invalidate(*args, **kwargs):
                if key_fn:
                    cache_key = key_fn(*args, **kwargs)
                else:
                    key_parts = [
                        func.__name__,
                        str(args),
                        str(sorted(kwargs.items()))
                    ]
                    cache_key = hashlib.md5(
                        ':'.join(key_parts).encode()
                    ).hexdigest()
                
                full_key = f"{self.key_prefix}{cache_key}"
                self.cache.invalidate(full_key)
            
            wrapper.invalidate = invalidate
            
            return wrapper
        return decorator


class CacheAnalytics:
    """
    Cache analytics ve reporting.
    """
    
    def __init__(self, cache: MultiLevelCache):
        self.cache = cache
        self.reports: List[Dict] = []
        
    def generate_report(self) -> Dict:
        """Kapsamlı cache raporu"""
        stats = self.cache.get_stats()
        
        report = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'l1_cache': stats['l1'],
            'l2_cache': stats['l2'],
            'combined_hit_rate': self._calculate_combined_hit_rate(stats),
            'recommendations': self._generate_recommendations(stats)
        }
        
        self.reports.append(report)
        return report
    
    def _calculate_combined_hit_rate(self, stats: Dict) -> float:
        """Combined hit rate hesapla"""
        l1_hits = stats['l1'].get('hits', 0)
        l1_misses = stats['l1'].get('misses', 0)
        
        if 'l2' in stats and stats['l2']:
            l2_hits = stats['l2'].get('hits', 0)
            l2_misses = stats['l2'].get('misses', 0)
            
            total_hits = l1_hits + l2_hits
            total_requests = l1_hits + l1_misses
            
            return (total_hits / total_requests * 100) if total_requests > 0 else 0
        
        return stats['l1'].get('hit_rate_percent', 0)
    
    def _generate_recommendations(self, stats: Dict) -> List[str]:
        """Cache optimizasyon önerileri"""
        recommendations = []
        
        l1_stats = stats['l1']
        
        # L1 cache size recommendation
        if l1_stats['current_size'] >= l1_stats['max_size'] * 0.9:
            recommendations.append(
                f"L1 cache boyutu artırılmalı (şu an {l1_stats['current_size']}/{l1_stats['max_size']})"
            )
        
        # Hit rate recommendations
        hit_rate = l1_stats.get('hit_rate_percent', 0)
        if hit_rate < 50:
            recommendations.append(
                "L1 cache hit rate çok düşük. TTL değerleri gözden geçirilmeli."
            )
        elif hit_rate < 70:
            recommendations.append(
                "L1 cache hit rate iyileştirilebilir. Cache warming önerilir."
            )
        
        # Eviction recommendations
        if l1_stats.get('evictions', 0) > l1_stats.get('hits', 0) * 0.1:
            recommendations.append(
                "Cache eviction oranı yüksek. Cache boyutu artırılmalı."
            )
        
        return recommendations


class CachingService:
    """
    Ana caching servisi.
    """
    
    def __init__(
        self,
        l1_max_size: int = 1000,
        redis_client: Optional[redis.Redis] = None,
        default_ttl: int = 300
    ):
        l1_cache = LRUCache(max_size=l1_max_size, default_ttl=default_ttl)
        l2_cache = DistributedCache(redis_client, default_ttl) if redis_client else None
        
        self.cache = MultiLevelCache(l1_cache, l2_cache)
        self.warming = CacheWarmingService(self.cache)
        self.invalidator = SmartCacheInvalidator(self.cache)
        self.analytics = CacheAnalytics(self.cache)
        self.decorator = CachedDecorator(self.cache)
        
    def get(self, key: str) -> Optional[Any]:
        """Cache'den al"""
        return self.cache.get(key)
    
    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Cache'e koy"""
        self.cache.put(key, value, ttl)
    
    def invalidate(self, pattern: Optional[str] = None) -> Dict[str, int]:
        """Cache'i temizle"""
        return self.cache.invalidate(pattern)
    
    def get_stats(self) -> Dict:
        """İstatistikleri al"""
        return self.cache.get_stats()
    
    def get_report(self) -> Dict:
        """Rapor al"""
        return self.analytics.generate_report()
    
    def cached(self, ttl: int = 300, key_fn: Optional[Callable] = None):
        """Decorator oluştur"""
        return self.decorator(ttl, key_fn)


# Global caching service (initialized in app startup)
cache_service: Optional[CachingService] = None
