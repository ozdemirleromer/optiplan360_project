"""
Phase 2 OCR Control: Database Monitoring API
Connection pooling monitoring ve health check
"""

from fastapi import APIRouter, Depends, HTTPException
from app.services.database_pool_service import get_database_pool_service, DatabaseConnectionPoolService
from app.rate_limit import limiter
from fastapi import Request

router = APIRouter(prefix="/system/database", tags=["database"])


@router.get("/health")
@limiter.limit("20/minute")
def get_database_health(
    request: Request,
    db_service: DatabaseConnectionPoolService = Depends(get_database_pool_service)
):
    """
    Phase 2 OCR Control: Database health check
    
    Veritabanı bağlantı durumunu kontrol eder
    """
    try:
        health_status = db_service.check_database_health()
        return {
            "database_health": health_status,
            "timestamp": health_status["timestamp"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database health check failed: {str(e)}")


@router.get("/pool-stats")
@limiter.limit("10/minute")
def get_connection_pool_stats(
    request: Request,
    db_service: DatabaseConnectionPoolService = Depends(get_database_pool_service)
):
    """
    Phase 2 OCR Control: Connection pool statistics
    
    Connection pool istatistiklerini döndürür
    """
    try:
        pool_stats = db_service.get_connection_pool_stats()
        return {
            "connection_pool": pool_stats,
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pool stats failed: {str(e)}")


@router.get("/optimization-recommendations")
@limiter.limit("5/minute")
def get_optimization_recommendations(
    request: Request,
    db_service: DatabaseConnectionPoolService = Depends(get_database_pool_service)
):
    """
    Phase 2 OCR Control: Database optimization recommendations
    
    Connection pooling optimizasyon önerileri
    """
    try:
        recommendations = db_service.get_pool_recommendations()
        return {
            "optimization": recommendations,
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization check failed: {str(e)}")


@router.get("/phase-2-status")
@limiter.limit("10/minute")
def get_phase_2_database_status(
    request: Request,
    db_service: DatabaseConnectionPoolService = Depends(get_database_pool_service)
):
    """
    Phase 2 OCR Control: Complete Phase 2 database status
    
    OCR kontrol için database readiness durumunu kontrol eder
    """
    try:
        phase_status = db_service.get_phase_2_database_status()
        return {
            "phase_2_database_status": phase_status,
            "ocr_control_ready": phase_status["phase_2_ready"],
            "production_ready": phase_status["production_ready"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Phase 2 status check failed: {str(e)}")


@router.post("/test-connection")
@limiter.limit("5/minute")
def test_database_connection(
    request: Request,
    db_service: DatabaseConnectionPoolService = Depends(get_database_pool_service)
):
    """
    Phase 2 OCR Control: Database connection test
    
    Veritabanı bağlantısını test eder
    """
    try:
        health = db_service.check_database_health()
        
        return {
            "test_result": {
                "success": health["healthy"],
                "response_time_ms": health["response_time_ms"],
                "error": health.get("error"),
                "timestamp": health["timestamp"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")
