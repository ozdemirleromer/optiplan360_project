"""\
OptiPlan 360 — Harici Tarayıcı Cihazı (Scanner) → OCR Ingest Router
- Harici cihazlar (network scanner, MFP, mobil tarayıcı) buraya dosya POST eder.
- JWT gerektirmez; cihaz API key ile doğrulanır.
- Upload -> OCRJob oluşturur -> OCR pipeline'a gönderir.

Header:
- X-Device-Api-Key: <key>
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.auth import require_admin
from app.database import get_db
from app.exceptions import AuthenticationError, ValidationError
from app.models import AuditLog, DeviceOCRConfig, OCRJob
from fastapi import APIRouter, BackgroundTasks, Depends, File, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ocr/device", tags=["ocr-device"])


def _get_kv(db: Session, key: str, default: str = "") -> str:
    row = db.query(DeviceOCRConfig).filter(DeviceOCRConfig.key == key).first()
    return row.value if row else default


def _set_kv(db: Session, key: str, value: str):
    row = db.query(DeviceOCRConfig).filter(DeviceOCRConfig.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(DeviceOCRConfig(key=key, value=value, updated_at=datetime.now(timezone.utc)))


def _require_device_key(request: Request, db: Session):
    provided = request.headers.get("X-Device-Api-Key", "")
    expected = _get_kv(db, "device_api_key")
    if not expected or provided != expected:
        raise AuthenticationError("Cihaz API key geçersiz")


class DeviceConfigIn(BaseModel):
    device_api_key: Optional[str] = None
    device_name: Optional[str] = None


class DeviceConfigOut(BaseModel):
    configured: bool
    device_name: str = ""


@router.get("/config", response_model=DeviceConfigOut)
def get_config(db: Session = Depends(get_db), _=Depends(require_admin)):
    return DeviceConfigOut(
        configured=bool(_get_kv(db, "device_api_key")),
        device_name=_get_kv(db, "device_name"),
    )


@router.put("/config", response_model=DeviceConfigOut)
def update_config(body: DeviceConfigIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    if body.device_api_key:
        _set_kv(db, "device_api_key", body.device_api_key)
    if body.device_name is not None:
        _set_kv(db, "device_name", body.device_name)
    db.commit()
    return get_config(db=db)


@router.post("/ingest", status_code=201)
async def ingest_from_device(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Cihazdan gelen dosyayı OCR'a al"""
    _require_device_key(request, db)

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise ValidationError(f"Geçersiz dosya tipi: {file.content_type}")

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise ValidationError("Dosya boyutu 25MB'dan büyük olamaz")

    job = OCRJob(
        id=str(uuid4()),
        status="PENDING",
        original_filename=file.filename,
        content_type=file.content_type,
        file_size=len(content),
        image_data=content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()

    from app.routers.ocr_router import _process_ocr_job

    job.status = "PROCESSING"
    db.commit()
    background_tasks.add_task(_process_ocr_job, job.id, db, "auto")

    db.add(
        AuditLog(
            id=str(uuid4()),
            user_id=None,
            action="DEVICE_OCR_INGEST",
            detail=f"Device ingest: {file.filename} -> job {job.id}",
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return {"success": True, "job_id": job.id}
