"""
OptiPlan 360 - Database Optimization Service
Query optimizasyonu, index analizi ve connection pooling

Bu modül:
- Query plan analizi
- Index önerileri
- Connection pool yönetimi
- Query caching
- Batch operation optimizasyonu
"""

import time
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from collections import defaultdict
from datetime import datetime, timedelta
import hashlib
import functools

from sqlalchemy import text, Index, inspect
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import explain
import redis

logger = logging.getLogger(__name__)


@dataclass
class QueryPlan:
    """Query execution plan"""
    query: str
    plan: Dict[str, Any]
    execution_time_ms: float
    estimated_cost: float
    actual_rows: int
    index_usage: List[str]
    seq_scans: int
    index_scans: int
    timestamp: datetime


@dataclass
class IndexRecommendation:
    """Index önerisi"""
    table: str
    columns: List[str]
    index_type: str
    estimated_benefit: str
    query_patterns: List[str]
    priority: str  # 'high', 'medium', 'low'


class QueryPlanAnalyzer:
    """
    Query execution plan analizi.
    
    PostgreSQL EXPLAIN ile query performans analizi.
    """
    
    def __init__(self):
        self.plan_cache: Dict[str, QueryPlan] = {}
        self.cache_ttl = 300  # 5 minutes
        
    def analyze_query(self, session: Session, query: str, params: Optional[Dict] = None) -> QueryPlan:
        """
        Query execution plan analiz et.
        
        Args:
            session: SQLAlchemy session
            query: SQL query
            params: Query parameters
            
        Returns:
            QueryPlan with execution details
        """
        # Check cache
        cache_key = self._get_cache_key(query, params)
        if cache_key in self.plan_cache:
            cached = self.plan_cache[cache_key]
            if datetime.utcnow() - cached.timestamp < timedelta(seconds=self.cache_ttl):
                return cached
        
        try:
            # Get EXPLAIN ANALYZE output
            explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"
            result = session.execute(text(explain_query), params or {})
            plan_json = result.scalar()
            
            # Parse plan
            plan_data = plan_json[0] if isinstance(plan_json, list) else plan_json
            
            # Extract metrics
            execution_time = plan_data.get('Execution Time', 0)
            plan_root = plan_data.get('Plan', {})
            
            # Analyze index usage
            index_usage, seq_scans, index_scans = self._analyze_plan_nodes(plan_root)
            
            query_plan = QueryPlan(
                query=query[:200],
                plan=plan_data,
                execution_time_ms=execution_time,
                estimated_cost=plan_root.get('Total Cost', 0),
                actual_rows=plan_root.get('Actual Rows', 0),
                index_usage=index_usage,
                seq_scans=seq_scans,
                index_scans=index_scans,
                timestamp=datetime.utcnow()
            )
            
            # Cache result
            self.plan_cache[cache_key] = query_plan
            
            return query_plan
            
        except Exception as e:
            logger.error(f"Query plan analysis failed: {e}")
            return QueryPlan(
                query=query[:200],
                plan={},
                execution_time_ms=0,
                estimated_cost=0,
                actual_rows=0,
                index_usage=[],
                seq_scans=0,
                index_scans=0,
                timestamp=datetime.utcnow()
            )
    
    def _analyze_plan_nodes(self, node: Dict) -> Tuple[List[str], int, int]:
        """Recursively analyze plan nodes"""
        index_usage = []
        seq_scans = 0
        index_scans = 0
        
        if not node:
            return index_usage, seq_scans, index_scans
        
        node_type = node.get('Node Type', '')
        
        if 'Index' in node_type:
            index_name = node.get('Index Name', '')
            if index_name:
                index_usage.append(index_name)
            index_scans += 1
        elif 'Seq Scan' in node_type:
            seq_scans += 1
        
        # Recurse into child nodes
        for child in node.get('Plans', []):
            child_indexes, child_seq, child_idx = self._analyze_plan_nodes(child)
            index_usage.extend(child_indexes)
            seq_scans += child_seq
            index_scans += child_idx
        
        return index_usage, seq_scans, index_scans
    
    def _get_cache_key(self, query: str, params: Optional[Dict]) -> str:
        """Cache key oluştur"""
        key = query + str(params)
        return hashlib.md5(key.encode()).hexdigest()
    
    def identify_missing_indexes(self, session: Session, slow_queries: List[str]) -> List[IndexRecommendation]:
        """
        Eksik index'leri tespit et.
        
        Args:
            session: Database session
            slow_queries: Yavaş query'ler listesi
            
        Returns:
            Index önerileri listesi
        """
        recommendations = []
        
        for query in slow_queries:
            plan = self.analyze_query(session, query)
            
            # Check for sequential scans on large tables
            if plan.seq_scans > 0 and plan.execution_time_ms > 100:
                # Parse query to identify table and columns
                table, columns = self._extract_table_columns(query)
                
                if table and columns:
                    rec = IndexRecommendation(
                        table=table,
                        columns=columns,
                        index_type='btree',
                        estimated_benefit=f"~{plan.execution_time_ms * 0.7:.0f}ms reduction",
                        query_patterns=[query[:100]],
                        priority='high' if plan.execution_time_ms > 500 else 'medium'
                    )
                    recommendations.append(rec)
        
        return recommendations
    
    def _extract_table_columns(self, query: str) -> Tuple[Optional[str], List[str]]:
        """Query'den tablo ve kolonları çıkar (basit parser)"""
        import re
        
        # Simple pattern matching for WHERE clauses
        table_match = re.search(r'FROM\s+(\w+)', query, re.IGNORECASE)
        if not table_match:
            return None, []
        
        table = table_match.group(1)
        
        # Find columns in WHERE clause
        where_match = re.search(r'WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)', query, re.IGNORECASE)
        columns = []
        
        if where_match:
            where_clause = where_match.group(1)
            # Extract column names (simple approach)
            col_matches = re.findall(r'(\w+)\s*[=<>]', where_clause)
            columns = list(set(col_matches))
        
        return table, columns


class ConnectionPoolOptimizer:
    """
    Connection pool optimizasyonu.
    """
    
    def __init__(self, engine):
        self.engine = engine
        self.stats_history: List[Dict] = []
        
    def get_pool_stats(self) -> Dict:
        """Connection pool istatistiklerini al"""
        pool = self.engine.pool
        
        stats = {
            'timestamp': datetime.utcnow().isoformat(),
            'size': pool.size(),
            'checked_in': pool.checkedin(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow(),
            'overflow_count': 0  # Will track if available
        }
        
        self.stats_history.append(stats)
        
        # Keep last 1000 records
        if len(self.stats_history) > 1000:
            self.stats_history = self.stats_history[-1000:]
        
        return stats
    
    def recommend_pool_size(self) -> Dict:
        """Optimal pool size öner"""
        if len(self.stats_history) < 10:
            return {'message': 'Insufficient data'}
        
        recent = self.stats_history[-100:]
        
        avg_checked_out = sum(s['checked_out'] for s in recent) / len(recent)
        max_checked_out = max(s['checked_out'] for s in recent)
        overflow_count = sum(1 for s in recent if s['overflow'] > 0)
        
        recommendations = {
            'current_size': self.engine.pool.size(),
            'avg_active_connections': avg_checked_out,
            'max_active_connections': max_checked_out,
            'overflow_percentage': (overflow_count / len(recent)) * 100,
            'recommendations': []
        }
        
        # Recommendations
        if overflow_count > len(recent) * 0.1:  # > 10% overflow
            recommendations['recommendations'].append(
                f"Pool size {int(max_checked_out * 1.5)} olarak artırılmalı (overflow tespit edildi)"
            )
        elif avg_checked_out < self.engine.pool.size() * 0.3:
            recommendations['recommendations'].append(
                f"Pool size {int(avg_checked_out * 1.2)} olarak azaltılabilir (düşük kullanım)"
            )
        
        return recommendations


class QueryCache:
    """
    Query result caching with Redis.
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.local_cache: Dict[str, Tuple[Any, datetime]] = {}
        self.default_ttl = 300  # 5 minutes
        self.max_local_size = 1000
        
    def _get_key(self, query: str, params: Tuple) -> str:
        """Cache key oluştur"""
        key = f"query:{hashlib.md5((query + str(params)).encode()).hexdigest()}"
        return key
    
    def get(self, query: str, params: Tuple = ()) -> Optional[Any]:
        """Cache'den sonuç al"""
        key = self._get_key(query, params)
        
        # Check local cache first
        if key in self.local_cache:
            result, timestamp = self.local_cache[key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.default_ttl):
                return result
            else:
                del self.local_cache[key]
        
        # Check Redis
        if self.redis:
            try:
                cached = self.redis.get(key)
                if cached:
                    import json
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis cache error: {e}")
        
        return None
    
    def set(self, query: str, params: Tuple, result: Any, ttl: Optional[int] = None) -> None:
        """Sonucu cache'e koy"""
        key = self._get_key(query, params)
        ttl = ttl or self.default_ttl
        
        # Local cache
        self.local_cache[key] = (result, datetime.utcnow())
        
        # Trim local cache
        if len(self.local_cache) > self.max_local_size:
            oldest = min(self.local_cache.items(), key=lambda x: x[1][1])
            del self.local_cache[oldest[0]]
        
        # Redis cache
        if self.redis:
            try:
                import json
                self.redis.setex(key, ttl, json.dumps(result, default=str))
            except Exception as e:
                logger.error(f"Redis cache error: {e}")
    
    def invalidate(self, pattern: str = "*") -> int:
        """Cache'i temizle"""
        # Clear local cache
        if pattern == "*":
            count = len(self.local_cache)
            self.local_cache.clear()
        else:
            keys_to_delete = [k for k in self.local_cache if pattern in k]
            for k in keys_to_delete:
                del self.local_cache[k]
            count = len(keys_to_delete)
        
        # Clear Redis
        if self.redis and pattern == "*":
            try:
                redis_keys = self.redis.keys("query:*")
                if redis_keys:
                    self.redis.delete(*redis_keys)
            except Exception as e:
                logger.error(f"Redis cache invalidation error: {e}")
        
        return count
    
    def get_stats(self) -> Dict:
        """Cache istatistikleri"""
        return {
            'local_cache_size': len(self.local_cache),
            'local_cache_max': self.max_local_size,
            'default_ttl': self.default_ttl,
            'redis_connected': self.redis is not None
        }


def cached_query(ttl: int = 300, cache: Optional[QueryCache] = None):
    """
    Decorator for caching query results.
    
    Usage:
        @cached_query(ttl=600)
        def get_user_by_id(session, user_id):
            return session.query(User).filter_by(id=user_id).first()
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Try to get from cache
            if cache:
                cached_result = cache.get(cache_key, ())
                if cached_result is not None:
                    logger.debug(f"Cache hit for {func.__name__}")
                    return cached_result
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            if cache:
                cache.set(cache_key, (), result, ttl)
            
            return result
        
        return wrapper
    return decorator


class BatchOperationOptimizer:
    """
    Batch operation optimizasyonu.
    
    Bulk insert/update/delete operations.
    """
    
    @staticmethod
    def bulk_insert(
        session: Session,
        model_class,
        data: List[Dict],
        batch_size: int = 1000
    ) -> int:
        """
        Verimli bulk insert.
        
        Args:
            session: SQLAlchemy session
            model_class: Model sınıfı
            data: Insert edilecek veri
            batch_size: Batch boyutu
            
        Returns:
            Insert edilen kayıt sayısı
        """
        from sqlalchemy.dialects.postgresql import insert
        
        total_inserted = 0
        
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            
            try:
                # Use PostgreSQL COPY for large batches
                if len(batch) > 100:
                    # Bulk insert with ON CONFLICT handling
                    stmt = insert(model_class).values(batch)
                    session.execute(stmt)
                else:
                    # Regular insert for smaller batches
                    for item in batch:
                        obj = model_class(**item)
                        session.add(obj)
                
                session.commit()
                total_inserted += len(batch)
                
            except Exception as e:
                session.rollback()
                logger.error(f"Batch insert error: {e}")
                raise
        
        return total_inserted
    
    @staticmethod
    def bulk_update(
        session: Session,
        model_class,
        updates: List[Dict],
        id_column: str = 'id',
        batch_size: int = 500
    ) -> int:
        """
        Verimli bulk update.
        
        Args:
            session: SQLAlchemy session
            model_class: Model sınıfı
            updates: Update edilecek veriler (id + fields)
            id_column: ID kolonu adı
            batch_size: Batch boyutu
            
        Returns:
            Update edilen kayıt sayısı
        """
        from sqlalchemy import update
        
        total_updated = 0
        
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            
            try:
                for item in batch:
                    obj_id = item.pop(id_column)
                    stmt = (
                        update(model_class)
                        .where(getattr(model_class, id_column) == obj_id)
                        .values(**item)
                    )
                    session.execute(stmt)
                
                session.commit()
                total_updated += len(batch)
                
            except Exception as e:
                session.rollback()
                logger.error(f"Batch update error: {e}")
                raise
        
        return total_updated
    
    @staticmethod
    def bulk_delete(
        session: Session,
        model_class,
        ids: List[int],
        batch_size: int = 1000
    ) -> int:
        """
        Verimli bulk delete.
        
        Args:
            session: SQLAlchemy session
            model_class: Model sınıfı
            ids: Silinecek ID'ler
            batch_size: Batch boyutu
            
        Returns:
            Silinen kayıt sayısı
        """
        from sqlalchemy import delete
        
        total_deleted = 0
        id_column = 'id'  # Assuming 'id' is the primary key
        
        for i in range(0, len(ids), batch_size):
            batch = ids[i:i + batch_size]
            
            try:
                stmt = delete(model_class).where(
                    getattr(model_class, id_column).in_(batch)
                )
                result = session.execute(stmt)
                session.commit()
                total_deleted += result.rowcount
                
            except Exception as e:
                session.rollback()
                logger.error(f"Batch delete error: {e}")
                raise
        
        return total_deleted


class DatabaseOptimizationService:
    """
    Database optimizasyon ana servisi.
    """
    
    def __init__(self, engine, redis_client: Optional[redis.Redis] = None):
        self.engine = engine
        self.plan_analyzer = QueryPlanAnalyzer()
        self.pool_optimizer = ConnectionPoolOptimizer(engine)
        self.query_cache = QueryCache(redis_client)
        
    def analyze_table_indexes(self, table_name: str) -> List[Dict]:
        """Tablo index'lerini analiz et"""
        inspector = inspect(self.engine)
        indexes = inspector.get_indexes(table_name)
        
        return [
            {
                'name': idx['name'],
                'columns': idx['column_names'],
                'unique': idx['unique']
            }
            for idx in indexes
        ]
    
    def suggest_optimizations(self, session: Session) -> List[Dict]:
        """Optimizasyon önerileri oluştur"""
        suggestions = []
        
        # Check for missing primary keys
        inspector = inspect(self.engine)
        
        for table_name in inspector.get_table_names():
            pk = inspector.get_pk_constraint(table_name)
            if not pk['constrained_columns']:
                suggestions.append({
                    'type': 'missing_primary_key',
                    'table': table_name,
                    'severity': 'high',
                    'recommendation': f'Add primary key to {table_name}'
                })
        
        # Connection pool recommendations
        pool_recs = self.pool_optimizer.recommend_pool_size()
        if pool_recs.get('recommendations'):
            suggestions.extend([
                {
                    'type': 'connection_pool',
                    'severity': 'medium',
                    'recommendation': rec
                }
                for rec in pool_recs['recommendations']
            ])
        
        return suggestions
    
    def get_performance_report(self) -> Dict:
        """Performans raporu oluştur"""
        return {
            'pool_stats': self.pool_optimizer.get_pool_stats(),
            'pool_recommendations': self.pool_optimizer.recommend_pool_size(),
            'cache_stats': self.query_cache.get_stats(),
            'timestamp': datetime.utcnow().isoformat()
        }


# Global database optimization service (initialized in app startup)
db_optimizer: Optional[DatabaseOptimizationService] = None
