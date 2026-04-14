"""
Phase 2 OCR Control: Database Connection Pooling Service
PostgreSQL connection pooling monitoring ve optimizasyon
"""

import logging
import time
from typing import Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

logger = logging.getLogger(__name__)


class DatabaseConnectionPoolService:
    """Phase 2 OCR Control için database connection pooling servisi"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = None
        self.session_factory = None
        self._setup_engine()
    
    def _setup_engine(self):
        """Database engine ve connection pooling kurulumu"""
        if self.database_url.startswith("sqlite"):
            # SQLite için basit kurulum
            self.engine = create_engine(
                self.database_url,
                connect_args={"check_same_thread": False},
                echo=False
            )
        else:
            # PostgreSQL için production connection pooling
            self.engine = create_engine(
                self.database_url,
                poolclass=QueuePool,
                pool_pre_ping=True,  # Bağlantı sağlığını kontrol et
                pool_size=10,  # Sabit bağlantı sayısı
                max_overflow=20,  # Ekstra bağlantı limiti
                pool_timeout=30,  # Bağlantı bekleme süresi (saniye)
                pool_recycle=3600,  # Bağlantı yenileme süresi (1 saat)
                pool_use_lifo=True,  # Son kullanılan bağlantıyı tekrar kullan
                echo=False
            )
        
        self.session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
    
    def get_connection_pool_stats(self) -> Dict[str, Any]:
        """
        Connection pool istatistiklerini döndür
        
        Returns:
            Dict: Pool istatistikleri
        """
        if not hasattr(self.engine, 'pool'):
            return {"type": "sqlite", "pool_stats": None}
        
        pool = self.engine.pool
        return {
            "type": "postgresql",
            "pool_stats": {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "invalid": pool.invalid(),
                "pool_size_limit": pool.size(),
                "max_overflow_limit": pool.max_overflow,
                "total_connections": pool.checkedin() + pool.checkedout(),
                "available_connections": pool.checkedin(),
                "active_connections": pool.checkedout()
            }
        }
    
    def check_database_health(self) -> Dict[str, Any]:
        """
        Database health kontrolü
        
        Returns:
            Dict: Health durumu
        """
        health_status = {
            "healthy": False,
            "response_time_ms": 0,
            "error": None,
            "timestamp": time.time()
        }
        
        try:
            start_time = time.time()
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            end_time = time.time()
            
            health_status["healthy"] = True
            health_status["response_time_ms"] = int((end_time - start_time) * 1000)
            
        except Exception as e:
            health_status["error"] = str(e)
            logger.error(f"Database health check failed: {e}")
        
        return health_status
    
    def get_pool_recommendations(self) -> Dict[str, Any]:
        """
        Connection pool optimizasyon önerileri
        
        Returns:
            Dict: Optimizasyon önerileri
        """
        stats = self.get_connection_pool_stats()
        
        if stats["type"] == "sqlite":
            return {
                "type": "sqlite",
                "recommendations": [
                    "SQLite development için uygun",
                    "Production için PostgreSQL kullanın"
                ]
            }
        
        pool_stats = stats["pool_stats"]
        recommendations = []
        
        # Connection utilization kontrolü
        total_connections = pool_stats["total_connections"]
        pool_limit = pool_stats["pool_size_limit"] + pool_stats["max_overflow_limit"]
        utilization = (total_connections / pool_limit) * 100 if pool_limit > 0 else 0
        
        if utilization > 80:
            recommendations.append(f"Yüksek connection utilization ({utilization:.1f}%). pool_size artırın.")
        
        if pool_stats["overflow"] > 0:
            recommendations.append(f"Overflow kullanılıyor ({pool_stats['overflow']}). max_overflow artırın.")
        
        if pool_stats["invalid"] > 0:
            recommendations.append(f"Invalid bağlantılar var ({pool_stats['invalid']}). pool_recycle süresini azaltın.")
        
        # Response time kontrolü
        health = self.check_database_health()
        if health["response_time_ms"] > 100:
            recommendations.append(f"Yavaş yanıt ({health['response_time_ms']}ms). Connection pooling optimize edin.")
        
        return {
            "type": "postgresql",
            "utilization_percent": utilization,
            "recommendations": recommendations,
            "current_config": {
                "pool_size": pool_stats["pool_size_limit"],
                "max_overflow": pool_stats["max_overflow_limit"],
                "pool_timeout": 30,
                "pool_recycle": 3600
            }
        }
    
    def get_phase_2_database_status(self) -> Dict[str, Any]:
        """
        Phase 2 OCR Control için complete database status
        
        Returns:
            Dict: Database durumu
        """
        health = self.check_database_health()
        pool_stats = self.get_connection_pool_stats()
        recommendations = self.get_pool_recommendations()
        
        return {
            "phase_2_ready": health["healthy"],
            "database_type": pool_stats["type"],
            "health": health,
            "connection_pool": pool_stats,
            "optimization_recommendations": recommendations,
            "production_ready": (
                health["healthy"] and 
                pool_stats["type"] == "postgresql" and
                len(recommendations.get("recommendations", [])) == 0
            )
        }
    
    def create_session(self):
        """Database session oluştur"""
        return self.session_factory()
    
    def close_all_connections(self):
        """Tüm bağlantıları kapat"""
        if self.engine:
            self.engine.dispose()


# Global instance
database_pool_service = None


def get_database_pool_service(database_url: str = None) -> DatabaseConnectionPoolService:
    """Database pool servisi dependency"""
    global database_pool_service
    
    if database_pool_service is None:
        import os
        db_url = database_url or os.getenv("DATABASE_URL", "sqlite:///./optiplan.db")
        database_pool_service = DatabaseConnectionPoolService(db_url)
    
    return database_pool_service
