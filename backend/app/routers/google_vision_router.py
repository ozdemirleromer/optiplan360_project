"""
Google Cloud Vision OCR Router
Google Vision API entegrasyon endpoint'leri
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from app.exceptions import BusinessRuleError, ValidationError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OCRJob, OCRLine, Customer, AuditLog, User
from app.auth import get_current_user
from app.services.google_vision_service import (
    GoogleVisionService, GoogleVisionConfig, GoogleVisionOCRResult
)

router = APIRouter(prefix="/api/v1/ocr/google", tags=["google-vision"])


# ─── Schemas ───
class GoogleVisionConfigIn(BaseModel):
    api_key: str = Field(..., min_length=10)
    project_id: Optional[str] = None
    location: str = Field(default="us")
    enabled: bool = True


class GoogleVisionConfigOut(BaseModel):
    configured: bool
    project_id: Optional[str] = None
    location: str = "us"
    enabled: bool = True
    last_test: Optional[str] = None


class GoogleVisionProcessResponse(BaseModel):
    job_id: str
    status: str
    result: GoogleVisionOCRResult


# ═══════════════════════════════════════════════════
# YAPILANDIRMA ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.get("/config", response_model=GoogleVisionConfigOut)
def get_google_vision_config(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Google Vision yapılandırmasını görüntüle"""
    service = GoogleVisionService(db)
    config = service.get_vision_config()
    
    return GoogleVisionConfigOut(
        configured=config is not None,
        project_id=config.project_id if config else None,
        location=config.location if config else "us",
        enabled=service._get_config("google_vision_enabled") == "True"
    )


@router.put("/config")
def update_google_vision_config(
    config: GoogleVisionConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Google Vision yapılandırmasını güncelle"""
    service = GoogleVisionService(db)
    
    vision_config = GoogleVisionConfig(
        api_key=config.api_key,
        project_id=config.project_id,
        location=config.location,
        enabled=config.enabled
    )
    
    service.update_config(vision_config)
    
    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=current_user.id,
        action="GOOGLE_VISION_CONFIG_UPDATE",
        detail=f"Google Vision config updated by {current_user.id}",
        created_at=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()
    
    return {"success": True, "message": "Google Vision yapılandırması güncellendi"}


@router.post("/test")
async def test_google_vision_connection(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Google Vision API bağlantısını test et"""
    service = GoogleVisionService(db)
    result = await service.test_connection()
    
    return {
        "success": result["success"],
        "message": result.get("message") or result.get("error"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ═══════════════════════════════════════════════════
# OCR İŞLEME ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.post("/process", response_model=GoogleVisionProcessResponse, status_code=201)
async def process_with_google_vision(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    customer_id: Optional[str] = Form(None),
    store_job: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Google Cloud Vision OCR ile fotoğraf işle
    """
    service = GoogleVisionService(db)
    
    # Config kontrolü
    if not service.is_configured():
        raise BusinessRuleError("Google Vision yapılandırılmamış")
    
    # Dosya kontrolü
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise ValidationError(f"Geçersiz dosya tipi: {file.content_type}")
    
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise ValidationError("Dosya boyutu 20MB'dan büyük olamaz")
    
    # Google Vision OCR işle
    ocr_result = await service.process_ocr(contents)
    
    if not ocr_result.success:
        raise HTTPException(500, f"Google Vision OCR hatası: {ocr_result.error}")
    
    job_id = None
    
    # Job kaydet
    if store_job:
        job = OCRJob(
            id=str(uuid4()),
            status="COMPLETED",
            original_filename=file.filename,
            content_type=file.content_type,
            file_size=len(contents),
            extracted_text=ocr_result.text,
            confidence=ocr_result.confidence / 100,
            customer_id=customer_id,
            uploaded_by_id=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        
        # Satırları ekle
        for idx, line_data in enumerate(ocr_result.lines, 1):
            parsed = None
            text = line_data.get("text", "")
            
            # Ölçü parse et
            import re
            pattern = r'(\d+)\s*[xX*×]\s*(\d+)\s*[xX*×]\s*(\d+)'
            match = re.search(pattern, text)
            if match:
                parsed = {
                    "boy": int(match.group(1)),
                    "en": int(match.group(2)),
                    "adet": int(match.group(3))
                }
            
            ocr_line = OCRLine(
                id=str(uuid4()),
                ocr_job_id=job.id,
                line_number=idx,
                text=text,
                confidence=line_data.get("confidence", 0.9),
                is_valid=parsed is not None,
                parsed_data=parsed,
                validation_error=None if parsed else "Geçersiz ölçü formatı"
            )
            db.add(ocr_line)
        
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id
        
        # Audit log
        log = AuditLog(
            id=str(uuid4()),
            user_id=current_user.id,
            action="GOOGLE_VISION_OCR_PROCESS",
            detail=f"File: {file.filename} | Confidence: {ocr_result.confidence}%",
            created_at=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()
    
    return GoogleVisionProcessResponse(
        job_id=job_id or str(uuid4()),
        status="COMPLETED",
        result=ocr_result
    )


@router.post("/process-url")
async def process_google_vision_url(
    image_url: str = Form(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """URL'deki görüntüyü Google Vision OCR ile işle"""
    service = GoogleVisionService(db)
    
    if not service.is_configured():
        raise BusinessRuleError("Google Vision yapılandırılmamış")
    
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, timeout=30)
            if response.status_code != 200:
                raise BusinessRuleError(f"Görüntü indirilemedi: {response.status_code}")
            
            image_data = response.content
    except Exception as e:
        raise BusinessRuleError(f"Görüntü indirme hatası: {str(e)}")
    
    ocr_result = await service.process_ocr(image_data)
    return ocr_result


# ═══════════════════════════════════════════════════
# İSTATİSTİKLER
# ═══════════════════════════════════════════════════
@router.get("/stats")
def get_google_vision_stats(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Google Vision kullanım istatistikleri"""
    from sqlalchemy import func
    
    # Vision OCR'ları say
    total_jobs = db.query(func.count(OCRJob.id)).filter(
        OCRJob.extracted_text.isnot(None)
    ).scalar() or 0
    
    # Son 30 gün
    from datetime import timedelta
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_jobs = db.query(func.count(OCRJob.id)).filter(
        OCRJob.created_at >= month_ago
    ).scalar() or 0
    
    service = GoogleVisionService(db)
    
    return {
        "configured": service.is_configured(),
        "total_jobs_processed": total_jobs,
        "jobs_this_month": recent_jobs,
        "avg_confidence": "95.5%",  # Simülasyon
        "supported_languages": ["Türkçe", "İngilizce", "200+ dil"],
        "features": [
            "DOCUMENT_TEXT_DETECTION",
            "TEXT_DETECTION",
            "HANDWRITING_RECOGNITION"
        ]
    }
