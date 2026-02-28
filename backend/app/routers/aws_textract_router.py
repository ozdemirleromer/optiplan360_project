"""
AWS Textract OCR Router
AWS Textract entegrasyon endpoint'leri - Form ve tablo analizi
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from app.auth import get_current_user
from app.database import get_db
from app.exceptions import BusinessRuleError, ValidationError
from app.models import AuditLog, OCRJob, OCRLine, User
from app.services.aws_textract_service import (
    AWSTextractConfig,
    AWSTextractResult,
    AWSTextractService,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/ocr/aws", tags=["aws-textract"])


# ─── Schemas ───
class AWSTextractConfigIn(BaseModel):
    access_key_id: str = Field(..., min_length=16)
    secret_access_key: str = Field(..., min_length=32)
    region: str = Field(default="eu-west-1")
    enabled: bool = True


class AWSTextractConfigOut(BaseModel):
    configured: bool
    region: str = "eu-west-1"
    enabled: bool = True
    supported_features: List[str] = [
        "TEXT_DETECTION",
        "FORM_ANALYSIS",
        "TABLE_ANALYSIS",
        "SIGNATURE_DETECTION",
    ]


class AWSTextractProcessResponse(BaseModel):
    job_id: str
    status: str
    result: AWSTextractResult


# ═══════════════════════════════════════════════════
# YAPILANDIRMA ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.get("/config", response_model=AWSTextractConfigOut)
def get_aws_textract_config(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """AWS Textract yapılandırmasını görüntüle"""
    service = AWSTextractService(db)
    config = service.get_textract_config()

    return AWSTextractConfigOut(
        configured=config is not None,
        region=config.region if config else "eu-west-1",
        enabled=service._get_config("aws_textract_enabled") == "True",
    )


@router.put("/config")
def update_aws_textract_config(
    config: AWSTextractConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AWS Textract yapılandırmasını güncelle"""
    service = AWSTextractService(db)

    textract_config = AWSTextractConfig(
        access_key_id=config.access_key_id,
        secret_access_key=config.secret_access_key,
        region=config.region,
        enabled=config.enabled,
    )

    service.update_config(textract_config)

    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=current_user.id,
        action="AWS_TEXTRACT_CONFIG_UPDATE",
        detail=f"AWS Textract config updated by {current_user.id}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": "AWS Textract yapılandırması güncellendi"}


@router.post("/test")
async def test_aws_textract_connection(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """AWS Textract bağlantısını test et"""
    service = AWSTextractService(db)
    result = await service.test_connection()

    return {
        "success": result["success"],
        "message": result.get("message") or result.get("error"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ═══════════════════════════════════════════════════
# OCR İŞLEME ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.post("/process", response_model=AWSTextractProcessResponse, status_code=201)
async def process_with_aws_textract(
    file: UploadFile = File(...),
    customer_id: Optional[str] = Form(None),
    analyze_forms: bool = Form(False),
    analyze_tables: bool = Form(False),
    store_job: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AWS Textract ile belge işle
    Form ve tablo analizi opsiyonel
    """
    service = AWSTextractService(db)

    # Config kontrolü
    if not service.is_configured():
        raise BusinessRuleError("AWS Textract yapılandırılmamış")

    # Dosya kontrolü
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise ValidationError(f"Geçersiz dosya tipi: {file.content_type}")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise ValidationError("Dosya boyutu 10MB'dan büyük olamaz")

    # Gelişmiş analiz seçenekleri
    feature_types = []
    if analyze_forms:
        feature_types.append("FORMS")
    if analyze_tables:
        feature_types.append("TABLES")

    if feature_types:
        ocr_result = await service.analyze_document(contents, feature_types)
    else:
        ocr_result = await service.process_ocr(contents)

    if not ocr_result.success:
        raise HTTPException(500, f"AWS Textract hatası: {ocr_result.error}")

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
            created_at=datetime.now(timezone.utc),
        )

        # Satırları ekle
        for idx, line_data in enumerate(ocr_result.lines, 1):
            parsed = None
            text = line_data.get("text", "")

            # Ölçü parse et
            import re

            pattern = r"(\d+)\s*[xX*×]\s*(\d+)\s*[xX*×]\s*(\d+)"
            match = re.search(pattern, text)
            if match:
                parsed = {
                    "boy": int(match.group(1)),
                    "en": int(match.group(2)),
                    "adet": int(match.group(3)),
                }

            ocr_line = OCRLine(
                id=str(uuid4()),
                ocr_job_id=job.id,
                line_number=idx,
                text=text,
                confidence=line_data.get("confidence", 0.9),
                is_valid=parsed is not None,
                parsed_data=parsed,
                validation_error=None if parsed else "Geçersiz ölçü formatı",
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
            action="AWS_TEXTRACT_OCR_PROCESS",
            detail=f"File: {file.filename} | Forms: {analyze_forms} | Tables: {analyze_tables}",
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        db.commit()

    return AWSTextractProcessResponse(
        job_id=job_id or str(uuid4()), status="COMPLETED", result=ocr_result
    )


# ═══════════════════════════════════════════════════
# BELGE ANALİZİ
# ═══════════════════════════════════════════════════
@router.post("/analyze-document")
async def analyze_document_with_aws(
    file: UploadFile = File(...),
    features: List[str] = Form(["FORMS", "TABLES"]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AWS Textract ile gelişmiş belge analizi
    Form alanları, tablolar, imzalar
    """
    service = AWSTextractService(db)

    if not service.is_configured():
        raise BusinessRuleError("AWS Textract yapılandırılmamış")

    contents = await file.read()

    result = await service.analyze_document(contents, features)

    if not result.success:
        raise HTTPException(500, f"Analiz hatası: {result.error}")

    return {
        "success": True,
        "text": result.text,
        "confidence": result.confidence,
        "forms_detected": len(result.forms),
        "tables_detected": len(result.tables),
        "forms": result.forms[:5],  # İlk 5 form
        "tables": result.tables[:3],  # İlk 3 tablo
    }


# ═══════════════════════════════════════════════════
# İSTATİSTİKLER
# ═══════════════════════════════════════════════════
@router.get("/stats")
def get_aws_textract_stats(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """AWS Textract kullanım istatistikleri"""
    from datetime import timedelta

    from sqlalchemy import func

    # İstatistikler
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_jobs = (
        db.query(func.count(OCRJob.id)).filter(OCRJob.created_at >= month_ago).scalar() or 0
    )

    service = AWSTextractService(db)
    config = service.get_textract_config()

    return {
        "configured": service.is_configured(),
        "region": config.region if config else "eu-west-1",
        "jobs_this_month": recent_jobs,
        "features": {
            "text_detection": True,
            "form_analysis": True,
            "table_analysis": True,
            "signature_detection": True,
            "handwriting": True,
        },
        "supported_formats": ["JPEG", "PNG", "PDF", "TIFF"],
        "max_file_size": "10MB",
    }
