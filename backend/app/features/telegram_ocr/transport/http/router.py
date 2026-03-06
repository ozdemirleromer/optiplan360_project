"""\
OptiPlan 360 — Telegram → OCR Ingest Router
- Telegram Bot üzerinden gelen fotoğraf/dosya ile OCR job oluşturur.
- Webhook endpoint'i auth'suzdur; secret token ile korunur.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import httpx
from app.auth import get_current_user
from app.database import get_db
from app.exceptions import AuthenticationError, AuthorizationError, BusinessRuleError
from app.models import AuditLog, OCRJob, TelegramOCRConfig, User
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ocr/telegram", tags=["ocr-telegram"])


def _get_kv(db: Session, key: str, default: str = "") -> str:
    row = db.query(TelegramOCRConfig).filter(TelegramOCRConfig.key == key).first()
    return row.value if row else default


def _set_kv(db: Session, key: str, value: str):
    row = db.query(TelegramOCRConfig).filter(TelegramOCRConfig.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(TelegramOCRConfig(key=key, value=value, updated_at=datetime.now(timezone.utc)))


def _is_configured(db: Session) -> bool:
    return bool(_get_kv(db, "bot_token") and _get_kv(db, "webhook_secret"))


class TelegramConfigIn(BaseModel):
    bot_token: Optional[str] = None
    webhook_secret: Optional[str] = None
    allowed_chat_id: Optional[str] = None


class TelegramConfigOut(BaseModel):
    configured: bool
    allowed_chat_id: str = ""


class TelegramTestOut(BaseModel):
    success: bool
    message: str


@router.get("/config", response_model=TelegramConfigOut)
def get_config(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return TelegramConfigOut(
        configured=_is_configured(db),
        allowed_chat_id=_get_kv(db, "allowed_chat_id"),
    )


@router.put("/config", response_model=TelegramConfigOut)
def update_config(
    body: TelegramConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.bot_token:
        _set_kv(db, "bot_token", body.bot_token)
    if body.webhook_secret:
        _set_kv(db, "webhook_secret", body.webhook_secret)
    if body.allowed_chat_id is not None:
        _set_kv(db, "allowed_chat_id", body.allowed_chat_id)

    db.commit()

    db.add(
        AuditLog(
            id=str(uuid4()),
            user_id=current_user.id,
            action="TELEGRAM_OCR_CONFIG_UPDATE",
            detail="Telegram OCR config updated",
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return TelegramConfigOut(
        configured=_is_configured(db),
        allowed_chat_id=_get_kv(db, "allowed_chat_id"),
    )


@router.post("/test", response_model=TelegramTestOut)
async def test_telegram(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not _get_kv(db, "bot_token"):
        raise BusinessRuleError("Telegram bot_token tanımlı değil")

    token = _get_kv(db, "bot_token")
    url = f"https://api.telegram.org/bot{token}/getMe"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        if resp.status_code != 200:
            raise BusinessRuleError(f"Telegram API test başarısız: {resp.text[:200]}")
        data = resp.json()

    ok = bool(data.get("ok"))
    return TelegramTestOut(
        success=ok,
        message="Telegram bağlantısı başarılı" if ok else "Telegram bağlantısı başarısız",
    )


async def _download_telegram_file(token: str, file_id: str) -> bytes:
    # 1) getFile
    get_url = f"https://api.telegram.org/bot{token}/getFile"
    async with httpx.AsyncClient() as client:
        r = await client.get(get_url, params={"file_id": file_id}, timeout=10)
        r.raise_for_status()
        file_path = r.json().get("result", {}).get("file_path")
        if not file_path:
            raise BusinessRuleError("Telegram file_path alınamadı")

        # 2) download
        dl_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        dl = await client.get(dl_url, timeout=30)
        dl.raise_for_status()
        return dl.content


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Telegram webhook. Header: X-Telegram-Secret (webhook_secret ile eşleşmeli)."""
    secret = request.headers.get("X-Telegram-Secret", "")
    expected = _get_kv(db, "webhook_secret")
    if not expected or secret != expected:
        raise AuthenticationError("Webhook secret doğrulanamadı")

    payload: Dict[str, Any] = await request.json()

    msg = payload.get("message") or payload.get("edited_message") or {}
    chat_id = str((msg.get("chat") or {}).get("id") or "")
    allowed = _get_kv(db, "allowed_chat_id")
    if allowed and chat_id and allowed != chat_id:
        raise AuthorizationError("Bu chat_id yetkili değil")

    token = _get_kv(db, "bot_token")
    if not token:
        raise BusinessRuleError("Telegram bot_token tanımlı değil")

    # Fotoğraf veya doküman
    file_id = None
    if msg.get("photo"):
        # en yüksek çözünürlük
        file_id = msg["photo"][-1].get("file_id")
    elif msg.get("document"):
        file_id = (msg.get("document") or {}).get("file_id")

    if not file_id:
        return {"ok": True, "ignored": True, "reason": "no photo/document"}

    image_data = await _download_telegram_file(token, file_id)

    # OCR Job oluştur
    job = OCRJob(
        id=str(uuid4()),
        status="PENDING",
        original_filename="telegram_upload",
        content_type="application/octet-stream",
        file_size=len(image_data),
        image_data=image_data,
        created_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()

    # OCR işle
    from app.routers.ocr_router import _process_ocr_job

    job.status = "PROCESSING"
    db.commit()
    background_tasks.add_task(_process_ocr_job, job.id, db, "auto")

    return {"ok": True, "job_id": job.id}
