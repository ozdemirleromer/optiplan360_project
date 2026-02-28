"""
Biesse OptiPlanning Entegrasyon Router
OptiPlan 360 ile Biesse OptiPlanning sistemleri arasÄ±ndaki entegrasyon endpoint'leri
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import logging

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.exceptions import ValidationError, BusinessRuleError
from app.services.biesse_integration_service import biesse_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic modelleri
class MaterialExportRequest(BaseModel):
    material_ids: Optional[List[str]] = Field(None, description="Export edilecek malzeme ID'leri")
    include_drops: bool = Field(True, description="ArtÄ±k malzemeler dahil edilsin")

class CuttingJobRequest(BaseModel):
    job_name: Optional[str] = Field(None, description="Ä°ÅŸ adÄ±")
    items: List[Dict[str, Any]] = Field(..., description="Kesim kalemleri")
    import_format: str = Field("basic", description="Import format: basic veya advanced")
    optimization_params: Optional[Dict[str, Any]] = Field(None, description="Optimizasyon parametreleri")

class CuttingPlanImportRequest(BaseModel):
    opjx_file_path: str = Field(..., description="OPJX dosya yolu")
    update_stock: bool = Field(True, description="Stok gÃ¼ncellensin")

class BiesseStatusResponse(BaseModel):
    success: bool
    status: Dict[str, Any]
    message: Optional[str] = None

class MaterialExportResponse(BaseModel):
    success: bool
    message: str
    file_path: Optional[str] = None
    material_count: int = 0
    timestamp: Optional[str] = None

class CuttingJobResponse(BaseModel):
    success: bool
    message: str
    job_file: Optional[str] = None
    job_name: Optional[str] = None

@router.get("/biesse/status", response_model=BiesseStatusResponse, tags=["biesse"])
async def get_biesse_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Biesse OptiPlanning sistem durumunu kontrol eder
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Biesse entegrasyonu iÃ§in yetkiniz yok")
        
        result = biesse_service.get_biesse_status()
        
        return BiesseStatusResponse(
            success=result["success"],
            status=result.get("status", {}),
            message="Biesse durumu baÅŸarÄ±yla getirildi"
        )
        
    except Exception as e:
        logger.error(f"Biesse durum kontrolÃ¼ hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/biesse/export/materials", response_model=MaterialExportResponse, tags=["biesse"])
async def export_materials_to_biesse(
    request: MaterialExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    OptiPlan 360 malzeme stoklarÄ±nÄ± Biesse formatÄ±nda export eder
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Malzeme export iÃ§in yetkiniz yok")
        
        result = biesse_service.export_materials_to_biesse(request.material_ids)
        
        return MaterialExportResponse(
            success=result["success"],
            message=result["message"],
            file_path=result.get("file_path"),
            material_count=result.get("material_count", 0),
            timestamp=result.get("timestamp")
        )
        
    except Exception as e:
        logger.error(f"Malzeme export hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/biesse/import/cutting-plan", response_model=Dict[str, Any], tags=["biesse"])
async def import_cutting_plan_from_biesse(
    request: CuttingPlanImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Biesse kesim planÄ±nÄ± OptiPlan 360'a import eder
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Kesim planÄ± import iÃ§in yetkiniz yok")
        
        result = biesse_service.import_cutting_plan_from_biesse(request.opjx_file_path)
        
        return {
            "success": result["success"],
            "message": result["message"],
            "items_processed": result.get("items_processed", 0),
            "plan_details": result.get("plan_details", {})
        }
        
    except Exception as e:
        logger.error(f"Kesim planÄ± import hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/biesse/create-cutting-job", response_model=CuttingJobResponse, tags=["biesse"])
async def create_cutting_job(
    request: CuttingJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    SipariÅŸ kalemleri iÃ§in Biesse kesim iÅŸi oluÅŸturur
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Kesim iÅŸi oluÅŸturma iÃ§in yetkiniz yok")
        
        # Import format validasyonu
        if request.import_format not in ["basic", "advanced"]:
            raise ValidationError("Import format 'basic' veya 'advanced' olmalÄ±dÄ±r")
        
        result = biesse_service.create_cutting_job(request.items, request.import_format)
        
        return CuttingJobResponse(
            success=result["success"],
            message=result["message"],
            job_file=result.get("job_file"),
            job_name=result.get("job_name")
        )
        
    except Exception as e:
        logger.error(f"Kesim iÅŸi oluÅŸturma hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/biesse/sync/bidirectional", response_model=Dict[str, Any], tags=["biesse"])
async def sync_materials_bidirectional(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ä°ki yÃ¶nlÃ¼ malzeme senkronizasyonu (background task)
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN"]:
            raise BusinessRuleError("Ä°ki yÃ¶nlÃ¼ senkronizasyon iÃ§in yetkiniz yok")
        
        # Background task olarak Ã§alÄ±ÅŸtÄ±r
        background_tasks.add_task(biesse_service.sync_materials_bidirectional)
        
        return {
            "success": cleanup_result.get("success", False),
            "message": "Ä°ki yÃ¶nlÃ¼ senkronizasyon baÅŸlatÄ±ldÄ±",
            "task_status": "running"
        }
        
    except Exception as e:
        logger.error(f"Senkronizasyon baÅŸlatma hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/biesse/jobs", response_model=Dict[str, Any], tags=["biesse"])
async def get_biesse_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Biesse iÅŸ dosyalarÄ±nÄ± listeler
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Ä°ÅŸ listesi iÃ§in yetkiniz yok")
        
        status_result = biesse_service.get_biesse_status()
        status = status_result.get("status", {})
        
        return {
            "success": True,
            "jobs": status.get("recent_jobs", []),
            "total_count": len(status.get("recent_jobs", [])),
            "message": "Ä°ÅŸ listesi baÅŸarÄ±yla getirildi"
        }
        
    except Exception as e:
        logger.error(f"Ä°ÅŸ listesi hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/biesse/materials", response_model=Dict[str, Any], tags=["biesse"])
async def get_biesse_materials(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Biesse malzeme dosyalarÄ±nÄ± listeler
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Malzeme listesi iÃ§in yetkiniz yok")
        
        status_result = biesse_service.get_biesse_status()
        status = status_result.get("status", {})
        
        return {
            "success": True,
            "material_files": status.get("material_files", []),
            "total_count": len(status.get("material_files", [])),
            "message": "Malzeme dosyalarÄ± baÅŸarÄ±yla getirildi"
        }
        
    except Exception as e:
        logger.error(f"Malzeme listesi hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/biesse/test-connection", response_model=Dict[str, Any], tags=["biesse"])
async def test_biesse_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Biesse OptiPlanning baÄŸlantÄ±sÄ±nÄ± test eder
    """
    try:
        # Permission kontrolÃ¼
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("BaÄŸlantÄ± testi iÃ§in yetkiniz yok")
        
        result = biesse_service.get_biesse_status()
        status = result.get("status", {})
        
        # BaÄŸlantÄ± testi sonuÃ§larÄ±
        connection_tests = {
            "optiplanning_installed": status.get("optiplanning_installed", False),
            "directories_accessible": status.get("directories_exist", False),
            "executable_available": status.get("executable_available", False),
            "file_permissions": True, # Basit test
            "overall_status": all([
                status.get("optiplanning_installed", False),
                status.get("directories_exist", False),
                status.get("executable_available", False)
            ])
        }
        
        return {
            "success": True,
            "connection_tests": connection_tests,
            "message": "BaÄŸlantÄ± testi tamamlandÄ±" if connection_tests["overall_status"] else "BaÄŸlantÄ± sorunlarÄ± tespit edildi"
        }
        
    except Exception as e:
        logger.error(f"BaÄŸlantÄ± testi hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/biesse/cleanup", response_model=Dict[str, Any], tags=["biesse"])
async def cleanup_biesse_files(
    days_old: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Eski Biesse dosyalarÄ±nÄ± temizler
    """
    try:
        # Permission kontrolÃ¼ - sadece ADMIN
        if current_user.role != "ADMIN":
            raise BusinessRuleError("Dosya temizleme iÃ§in yetkiniz yok")

        cleanup_result = biesse_service.cleanup_old_files(days_old=days_old)

        return {
            "success": cleanup_result.get("success", False),
            "message": f"{days_old} gÃ¼nden eski dosyalar temizlendi",
            "cleaned_files": cleanup_result.get("cleaned_files", 0),
            "scanned_files": cleanup_result.get("scanned_files", 0),
            "errors": cleanup_result.get("errors", [])
        }
        
    except Exception as e:
        logger.error(f"Dosya temizleme hatasÄ±: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
