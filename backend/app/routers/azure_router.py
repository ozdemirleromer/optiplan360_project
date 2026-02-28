"""
Azure Router - Azure entegrasyon endpoint'leri
OCR ve Blob Storage yönetimi
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.auth import get_current_user
from app.database import get_db
from app.exceptions import BusinessRuleError, ValidationError
from app.models import AuditLog, OCRJob, User
from app.services.azure_service import (
    AzureBlobConfig,
    AzureConfigOut,
    AzureOCRConfig,
    AzureOCRResult,
    AzureService,
)
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/azure", tags=["azure"])


# ─── Schemas ───
class AzureOCRConfigIn(BaseModel):
    subscription_key: str = Field(..., min_length=32)
    endpoint: str = Field(..., description="https://<name>.cognitiveservices.azure.com")
    region: str = Field(default="westeurope")
    enabled: bool = True


class AzureBlobConfigIn(BaseModel):
    connection_string: str = Field(..., min_length=20)
    container_name: str = Field(default="optiplan360-ocr")
    enabled: bool = True


class AzureConfigUpdate(BaseModel):
    ocr: Optional[AzureOCRConfigIn] = None
    blob: Optional[AzureBlobConfigIn] = None


class AzureTestResult(BaseModel):
    success: bool
    message: str
    timestamp: str


class AzureOCRJobResponse(BaseModel):
    job_id: str
    status: str
    azure_ocr_result: AzureOCRResult
    blob_url: Optional[str] = None


class AzureBlobListItem(BaseModel):
    name: str
    size: int
    content_type: Optional[str]
    created_at: Optional[str]
    url: str


# ═══════════════════════════════════════════════════
# YAPILANDIRMA ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.get("/config", response_model=AzureConfigOut)
def get_azure_config(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Azure yapılandırmasını görüntüle (sensitif bilgiler gizli)"""
    service = AzureService(db)
    return AzureConfigOut(
        configured=service.is_configured()["ocr"] or service.is_configured()["blob"],
        ocr_configured=service.is_configured()["ocr"],
        blob_configured=service.is_configured()["blob"],
        ocr_endpoint=service._get_config("azure_ocr_endpoint"),
        ocr_region=service._get_config("azure_ocr_region") or "westeurope",
        blob_container=service._get_config("azure_blob_container") or "optiplan360-ocr",
    )


@router.put("/config", response_model=AzureConfigOut)
def update_azure_config(
    config: AzureConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Azure yapılandırmasını güncelle"""
    service = AzureService(db)

    ocr_config = None
    if config.ocr:
        ocr_config = AzureOCRConfig(
            subscription_key=config.ocr.subscription_key,
            endpoint=config.ocr.endpoint,
            region=config.ocr.region,
            enabled=config.ocr.enabled,
        )

    blob_config = None
    if config.blob:
        blob_config = AzureBlobConfig(
            connection_string=config.blob.connection_string,
            container_name=config.blob.container_name,
            enabled=config.blob.enabled,
        )

    result = service.update_config(ocr_config=ocr_config, blob_config=blob_config)

    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=current_user.id,
        action="AZURE_CONFIG_UPDATE",
        detail=f"OCR: {config.ocr is not None}, Blob: {config.blob is not None}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return result


@router.post("/test-ocr", response_model=AzureTestResult)
async def test_azure_ocr(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Azure OCR bağlantısını test et"""
    service = AzureService(db)
    result = await service.test_ocr_connection()

    # Test sonucunu kaydet
    service._set_config("azure_ocr_last_test", datetime.now(timezone.utc).isoformat())
    service._set_config("azure_ocr_test_status", "success" if result["success"] else "failed")

    return AzureTestResult(
        success=result["success"],
        message=result.get("message", result.get("error", "Bilinmeyen durum")),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ═══════════════════════════════════════════════════
# OCR ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.post("/ocr/upload", response_model=AzureOCRJobResponse, status_code=201)
async def azure_ocr_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    store_in_blob: bool = Form(True),
    customer_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Azure OCR ile fotoğraf işle
    1. Blob Storage'a kaydet (opsiyonel)
    2. Azure Computer Vision OCR ile işle
    3. Sonuçları döndür
    """
    service = AzureService(db)

    # Config kontrolü
    if not service.is_configured()["ocr"]:
        raise BusinessRuleError("Azure OCR yapılandırılmamış")

    # Dosya kontrolü
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise ValidationError(f"Geçersiz dosya tipi: {file.content_type}")

    # Dosyayı oku
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:  # 20MB limit
        raise ValidationError("Dosya boyutu 20MB'dan büyük olamaz")

    blob_url = None
    blob_name = None

    # 1. Blob Storage'a yükle (eğer yapılandırılmışsa)
    if store_in_blob and service.is_configured()["blob"]:
        upload_result = await service.upload_to_blob(contents, file.filename, file.content_type)
        if upload_result.success:
            blob_url = upload_result.blob_url
            blob_name = upload_result.blob_name

    # 2. Azure OCR ile işle
    ocr_result = await service.process_ocr(contents)

    if not ocr_result.success:
        raise HTTPException(500, f"Azure OCR işleme hatası: {ocr_result.error}")

    # 3. OCR Job kaydet
    job = OCRJob(
        id=str(uuid4()),
        status="COMPLETED",
        original_filename=file.filename,
        content_type=file.content_type,
        file_size=len(contents),
        extracted_text=ocr_result.text,
        confidence=ocr_result.confidence / 100,  # 0-1 aralığına normalize et
        customer_id=customer_id,
        uploaded_by_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )

    # Satırları ekle
    for idx, line_data in enumerate(ocr_result.lines, 1):
        from app.models import OCRLine

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
            confidence=(
                line_data.get("words", [{}])[0].get("confidence", 0.8)
                if line_data.get("words")
                else 0.8
            ),
            is_valid=parsed is not None,
            parsed_data=parsed,
            validation_error=None if parsed else "Geçersiz ölçü formatı",
        )
        db.add(ocr_line)

    db.add(job)

    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=current_user.id,
        action="AZURE_OCR_PROCESS",
        detail=f"File: {file.filename} | Confidence: {ocr_result.confidence}% | Lines: {len(ocr_result.lines)}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return AzureOCRJobResponse(
        job_id=job.id, status=job.status, azure_ocr_result=ocr_result, blob_url=blob_url
    )


@router.post("/ocr/process-url")
async def azure_ocr_process_url(
    image_url: str = Form(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """URL'deki görüntüyü Azure OCR ile işle"""
    service = AzureService(db)

    if not service.is_configured()["ocr"]:
        raise BusinessRuleError("Azure OCR yapılandırılmamış")

    try:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, timeout=30)
            if response.status_code != 200:
                raise BusinessRuleError(f"Görüntü indirilemedi: {response.status_code}")

            image_data = response.content
    except Exception as e:
        raise BusinessRuleError(f"Görüntü indirme hatası: {str(e)}")

    # Azure OCR ile işle
    ocr_result = await service.process_ocr(image_data)

    return ocr_result


# ═══════════════════════════════════════════════════
# BLOB STORAGE ENDPOINT'LERİ
# ═══════════════════════════════════════════════════
@router.post("/blob/upload")
async def azure_blob_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dosyayı Azure Blob Storage'a yükle"""
    service = AzureService(db)

    if not service.is_configured()["blob"]:
        raise BusinessRuleError("Azure Blob Storage yapılandırılmamış")

    contents = await file.read()

    result = await service.upload_to_blob(contents, file.filename, file.content_type)

    if not result.success:
        raise HTTPException(500, f"Yükleme hatası: {result.error}")

    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=current_user.id,
        action="AZURE_BLOB_UPLOAD",
        detail=f"File: {result.blob_name} | Size: {result.size_bytes} bytes",
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "blob_url": result.blob_url,
        "blob_name": result.blob_name,
        "size_bytes": result.size_bytes,
    }


@router.delete("/blob/{blob_name}")
async def azure_blob_delete(
    blob_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Azure Blob'dan dosya sil"""
    service = AzureService(db)

    if not service.is_configured()["blob"]:
        raise BusinessRuleError("Azure Blob Storage yapılandırılmamış")

    success = await service.delete_from_blob(blob_name)

    if not success:
        raise HTTPException(500, "Dosya silinemedi")

    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=current_user.id,
        action="AZURE_BLOB_DELETE",
        detail=f"Deleted: {blob_name}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": f"{blob_name} silindi"}


# ═══════════════════════════════════════════════════
# İSTATİSTİKLER
# ═══════════════════════════════════════════════════
@router.get("/stats")
def get_azure_stats(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Azure kullanım istatistikleri"""
    service = AzureService(db)

    # OCR job istatistikleri
    from sqlalchemy import func

    total_ocr = (
        db.query(func.count(OCRJob.id))
        .filter(OCRJob.created_at >= datetime.now(timezone.utc).replace(day=1))
        .scalar()
        or 0
    )

    # Azure OCR'lar (metin içeriğinden tahmin)
    # Not: Gerçek implementasyonda Azure OCR'ları işaretlemek için ayrı bir flag eklenebilir

    config_status = service.is_configured()

    return {
        "configured": config_status,
        "ocr_jobs_this_month": total_ocr,
        "blob_container": service._get_config("azure_blob_container") or "optiplan360-ocr",
        "ocr_endpoint": service._get_config("azure_ocr_endpoint"),
        "ocr_region": service._get_config("azure_ocr_region") or "westeurope",
        "last_test": service._get_config("azure_ocr_last_test"),
        "test_status": service._get_config("azure_ocr_test_status"),
    }
