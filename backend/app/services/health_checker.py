"""
OptiPlan 360 - Health Check Service
Readiness ve liveness probe endpoint'leri

Bu modül:
- Health check endpoints
- Readiness probe
- Liveness probe
- Startup probe
- Dependency health checks
- Health metrics
"""

import logging
import time
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import asyncio

from sqlalchemy import text
from sqlalchemy.orm import Session
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Health check status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class HealthCheckResult:
    """Health check sonucu"""
    component: str
    status: HealthStatus
    response_time_ms: float
    timestamp: datetime
    message: Optional[str] = None
    details: Optional[Dict] = None


class HealthChecker:
    """
    Health check orchestrator.
    """
    
    def __init__(self):
        self.checks: Dict[str, Callable] = {}
        self.results: Dict[str, HealthCheckResult] = {}
        self.last_check: Optional[datetime] = None
        
    def register_check(self, name: str, check_fn: Callable) -> None:
        """
        Health check fonksiyonu kaydet.
        
        Args:
            name: Check adı
            check_fn: async function returning HealthCheckResult
        """
        self.checks[name] = check_fn
        
    async def run_check(self, name: str) -> HealthCheckResult:
        """Tek bir check çalıştır"""
        if name not in self.checks:
            return HealthCheckResult(
                component=name,
                status=HealthStatus.UNKNOWN,
                response_time_ms=0,
                timestamp=datetime.utcnow(),
                message="Check not registered"
            )
        
        start_time = time.time()
        
        try:
            result = await self.checks[name]()
            result.response_time_ms = (time.time() - start_time) * 1000
            self.results[name] = result
            return result
            
        except Exception as e:
            logger.error(f"Health check {name} failed: {e}")
            result = HealthCheckResult(
                component=name,
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow(),
                message=str(e)
            )
            self.results[name] = result
            return result
    
    async def run_all_checks(self) -> Dict[str, HealthCheckResult]:
        """Tüm check'leri çalıştır"""
        tasks = [self.run_check(name) for name in self.checks.keys()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for name, result in zip(self.checks.keys(), results):
            if isinstance(result, Exception):
                self.results[name] = HealthCheckResult(
                    component=name,
                    status=HealthStatus.UNHEALTHY,
                    response_time_ms=0,
                    timestamp=datetime.utcnow(),
                    message=str(result)
                )
            else:
                self.results[name] = result
        
        self.last_check = datetime.utcnow()
        return self.results
    
    def get_overall_status(self) -> HealthStatus:
        """Genel health status'ü hesapla"""
        if not self.results:
            return HealthStatus.UNKNOWN
        
        statuses = [r.status for r in self.results.values()]
        
        if any(s == HealthStatus.UNHEALTHY for s in statuses):
            return HealthStatus.UNHEALTHY
        
        if any(s == HealthStatus.DEGRADED for s in statuses):
            return HealthStatus.DEGRADED
        
        if all(s == HealthStatus.HEALTHY for s in statuses):
            return HealthStatus.HEALTHY
        
        return HealthStatus.UNKNOWN
    
    def generate_report(self) -> Dict:
        """Health raporu oluştur"""
        return {
            'status': self.get_overall_status().value,
            'timestamp': self.last_check.isoformat() if self.last_check else None,
            'checks': {
                name: {
                    'status': result.status.value,
                    'response_time_ms': result.response_time_ms,
                    'message': result.message,
                    'details': result.details
                }
                for name, result in self.results.items()
            }
        }


# Individual health check functions

async def check_database_health(db_session: Session) -> HealthCheckResult:
    """Database health check"""
    start_time = time.time()
    
    try:
        # Simple query to check database connectivity
        result = db_session.execute(text("SELECT 1"))
        result.scalar()
        
        # Check connection pool status
        pool = db_session.bind.pool
        pool_info = {
            'size': pool.size(),
            'checked_in': pool.checkedin(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow()
        }
        
        return HealthCheckResult(
            component="database",
            status=HealthStatus.HEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message="Database connection OK",
            details=pool_info
        )
        
    except Exception as e:
        return HealthCheckResult(
            component="database",
            status=HealthStatus.UNHEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Database error: {str(e)}"
        )


async def check_redis_health(redis_client: aioredis.Redis) -> HealthCheckResult:
    """Redis health check"""
    start_time = time.time()
    
    try:
        # Ping Redis
        await redis_client.ping()
        
        # Get Redis info
        info = await redis_client.info()
        
        return HealthCheckResult(
            component="redis",
            status=HealthStatus.HEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message="Redis connection OK",
            details={
                'used_memory': info.get('used_memory_human'),
                'connected_clients': info.get('connected_clients'),
                'uptime_in_seconds': info.get('uptime_in_seconds')
            }
        )
        
    except Exception as e:
        return HealthCheckResult(
            component="redis",
            status=HealthStatus.UNHEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Redis error: {str(e)}"
        )


async def check_disk_space(threshold_percent: float = 90.0) -> HealthCheckResult:
    """Disk space health check"""
    import shutil
    
    start_time = time.time()
    
    try:
        # Check root partition
        total, used, free = shutil.disk_usage("/")
        used_percent = (used / total) * 100
        
        status = HealthStatus.HEALTHY if used_percent < threshold_percent else HealthStatus.UNHEALTHY
        
        return HealthCheckResult(
            component="disk_space",
            status=status,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Disk usage: {used_percent:.1f}%",
            details={
                'total_gb': total / (1024**3),
                'used_gb': used / (1024**3),
                'free_gb': free / (1024**3),
                'used_percent': used_percent
            }
        )
        
    except Exception as e:
        return HealthCheckResult(
            component="disk_space",
            status=HealthStatus.UNHEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Disk check error: {str(e)}"
        )


async def check_memory_usage(threshold_percent: float = 90.0) -> HealthCheckResult:
    """Memory usage health check"""
    import psutil
    
    start_time = time.time()
    
    try:
        memory = psutil.virtual_memory()
        
        status = HealthStatus.HEALTHY if memory.percent < threshold_percent else HealthStatus.UNHEALTHY
        
        return HealthCheckResult(
            component="memory",
            status=status,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Memory usage: {memory.percent}%",
            details={
                'total_gb': memory.total / (1024**3),
                'available_gb': memory.available / (1024**3),
                'used_percent': memory.percent
            }
        )
        
    except Exception as e:
        return HealthCheckResult(
            component="memory",
            status=HealthStatus.UNHEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Memory check error: {str(e)}"
        )


async def check_ai_models(model_cache_dir: str) -> HealthCheckResult:
    """AI model health check"""
    import os
    from pathlib import Path
    
    start_time = time.time()
    
    try:
        models_path = Path(model_cache_dir)
        
        if not models_path.exists():
            return HealthCheckResult(
                component="ai_models",
                status=HealthStatus.DEGRADED,
                response_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow(),
                message="Model cache directory does not exist",
                details={'cache_dir': model_cache_dir}
            )
        
        # List available models
        models = list(models_path.glob("*.pt")) + list(models_path.glob("*.pth")) + list(models_path.glob("*.onnx"))
        
        return HealthCheckResult(
            component="ai_models",
            status=HealthStatus.HEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"Found {len(models)} models",
            details={'model_count': len(models), 'cache_dir': str(models_path)}
        )
        
    except Exception as e:
        return HealthCheckResult(
            component="ai_models",
            status=HealthStatus.UNHEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"AI models check error: {str(e)}"
        )


async def check_external_service(url: str, timeout: float = 5.0) -> HealthCheckResult:
    """External service health check"""
    import aiohttp
    
    start_time = time.time()
    
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
            async with session.get(url) as response:
                status = HealthStatus.HEALTHY if response.status < 500 else HealthStatus.UNHEALTHY
                
                return HealthCheckResult(
                    component=f"external:{url}",
                    status=status,
                    response_time_ms=(time.time() - start_time) * 1000,
                    timestamp=datetime.utcnow(),
                    message=f"HTTP {response.status}",
                    details={'status_code': response.status}
                )
                
    except Exception as e:
        return HealthCheckResult(
            component=f"external:{url}",
            status=HealthStatus.UNHEALTHY,
            response_time_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.utcnow(),
            message=f"External service error: {str(e)}"
        )


class ReadinessChecker:
    """
    Kubernetes readiness probe için checker.
    
    Pod'un trafik almaya hazır olup olmadığını kontrol eder.
    """
    
    def __init__(self, health_checker: HealthChecker):
        self.health_checker = health_checker
        
    async def is_ready(self) -> bool:
        """Pod ready mi?"""
        # Check critical dependencies
        critical_checks = ['database', 'redis']
        
        for check_name in critical_checks:
            if check_name not in self.health_checker.checks:
                continue
                
            result = await self.health_checker.run_check(check_name)
            
            if result.status == HealthStatus.UNHEALTHY:
                return False
        
        return True


class LivenessChecker:
    """
    Kubernetes liveness probe için checker.
    
    Pod'un çalışıp çalışmadığını kontrol eder.
    """
    
    def __init__(self, health_checker: HealthChecker):
        self.health_checker = health_checker
        self.failure_count = 0
        self.max_failures = 3
        
    async def is_alive(self) -> bool:
        """Pod alive mı?"""
        # Run basic checks
        await self.health_checker.run_all_checks()
        
        overall_status = self.health_checker.get_overall_status()
        
        if overall_status == HealthStatus.UNHEALTHY:
            self.failure_count += 1
        else:
            self.failure_count = 0
        
        # Only report unhealthy after consecutive failures
        return self.failure_count < self.max_failures


class StartupChecker:
    """
    Kubernetes startup probe için checker.
    
    Pod'un başlatma işlemini tamamlayıp tamamlamadığını kontrol eder.
    """
    
    def __init__(self, health_checker: HealthChecker):
        self.health_checker = health_checker
        self.startup_complete = False
        
    async def check_startup(self) -> bool:
        """Startup tamamlandı mı?"""
        if self.startup_complete:
            return True
        
        # Run all checks
        await self.health_checker.run_all_checks()
        
        overall_status = self.health_checker.get_overall_status()
        
        if overall_status == HealthStatus.HEALTHY:
            self.startup_complete = True
            logger.info("Startup complete - all systems healthy")
            return True
        
        return False


# FastAPI endpoint helpers

def create_health_endpoints(app, health_checker: HealthChecker):
    """
    FastAPI app'e health endpoint'leri ekle.
    """
    from fastapi import APIRouter, Response
    
    router = APIRouter(prefix="/api/v1/health", tags=["health"])
    
    @router.get("")
    async def health_check():
        """General health check"""
        results = await health_checker.run_all_checks()
        status = health_checker.get_overall_status()
        
        return {
            'status': status.value,
            'timestamp': datetime.utcnow().isoformat(),
            'checks': {
                name: {
                    'status': result.status.value,
                    'response_time_ms': result.response_time_ms,
                    'message': result.message
                }
                for name, result in results.items()
            }
        }
    
    @router.get("/ready")
    async def readiness_check(response: Response):
        """Kubernetes readiness probe"""
        readiness = ReadinessChecker(health_checker)
        is_ready = await readiness.is_ready()
        
        if not is_ready:
            response.status_code = 503
        
        return {
            'ready': is_ready,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @router.get("/live")
    async def liveness_check(response: Response):
        """Kubernetes liveness probe"""
        liveness = LivenessChecker(health_checker)
        is_alive = await liveness.is_alive()
        
        if not is_alive:
            response.status_code = 503
        
        return {
            'alive': is_alive,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @router.get("/startup")
    async def startup_check(response: Response):
        """Kubernetes startup probe"""
        startup = StartupChecker(health_checker)
        startup_complete = await startup.check_startup()
        
        if not startup_complete:
            response.status_code = 503
        
        return {
            'startup_complete': startup_complete,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    app.include_router(router)


# Global health checker
health_checker: Optional[HealthChecker] = None

def init_health_checker(
    db_session_factory: Callable,
    redis_client: aioredis.Redis,
    model_cache_dir: str
) -> HealthChecker:
    """Initialize global health checker with default checks"""
    global health_checker
    
    health_checker = HealthChecker()
    
    # Register default checks
    health_checker.register_check(
        "database",
        lambda: check_database_health(db_session_factory())
    )
    
    health_checker.register_check(
        "redis",
        lambda: check_redis_health(redis_client)
    )
    
    health_checker.register_check(
        "disk_space",
        check_disk_space
    )
    
    health_checker.register_check(
        "memory",
        check_memory_usage
    )
    
    health_checker.register_check(
        "ai_models",
        lambda: check_ai_models(model_cache_dir)
    )
    
    logger.info("Health checker initialized with default checks")
    return health_checker

def get_health_checker() -> HealthChecker:
    """Get global health checker"""
    if health_checker is None:
        raise RuntimeError("Health checker not initialized")
    return health_checker
