"""\
OptiPlan 360 — Email (IMAP) → OCR Ingest Router
- IMAP inbox'tan okunmamış mailleri tarar, ekleri OCR job'a çevirir.
- Manuel tetikleme ve bağlantı test endpoint'leri.
"""

import email
import imaplib
import logging
from datetime import datetime, timezone
from email.message import Message
from typing import List, Optional
from uuid import uuid4

from app.auth import get_current_user
from app.database import get_db
from app.exceptions import BusinessRuleError
from app.models import AuditLog, EmailOCRConfig, OCRJob, User
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ocr/email", tags=["ocr-email"])


def _get_kv(db: Session, key: str, default: str = "") -> str:
    row = db.query(EmailOCRConfig).filter(EmailOCRConfig.key == key).first()
    return row.value if row else default


def _set_kv(db: Session, key: str, value: str):
    row = db.query(EmailOCRConfig).filter(EmailOCRConfig.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(EmailOCRConfig(key=key, value=value, updated_at=datetime.now(timezone.utc)))


def _is_configured(db: Session) -> bool:
    return bool(_get_kv(db, "imap_host") and _get_kv(db, "imap_user") and _get_kv(db, "imap_pass"))


class EmailConfigIn(BaseModel):
    imap_host: Optional[str] = None
    imap_port: Optional[int] = 993
    imap_user: Optional[str] = None
    imap_pass: Optional[str] = None
    imap_mailbox: Optional[str] = "INBOX"


class EmailConfigOut(BaseModel):
    configured: bool
    imap_host: str = ""
    imap_port: int = 993
    imap_user: str = ""
    imap_mailbox: str = "INBOX"


class EmailTestOut(BaseModel):
    success: bool
    message: str


class FetchResult(BaseModel):
    success: bool
    created_jobs: int
    job_ids: List[str] = []
    message: str = ""


@router.get("/config", response_model=EmailConfigOut)
def get_config(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return EmailConfigOut(
        configured=_is_configured(db),
        imap_host=_get_kv(db, "imap_host"),
        imap_port=int(_get_kv(db, "imap_port", "993") or 993),
        imap_user=_get_kv(db, "imap_user"),
        imap_mailbox=_get_kv(db, "imap_mailbox", "INBOX") or "INBOX",
    )


@router.put("/config", response_model=EmailConfigOut)
def update_config(
    body: EmailConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.imap_host is not None:
        _set_kv(db, "imap_host", body.imap_host)
    if body.imap_port is not None:
        _set_kv(db, "imap_port", str(body.imap_port))
    if body.imap_user is not None:
        _set_kv(db, "imap_user", body.imap_user)
    if body.imap_pass is not None:
        _set_kv(db, "imap_pass", body.imap_pass)
    if body.imap_mailbox is not None:
        _set_kv(db, "imap_mailbox", body.imap_mailbox)

    db.commit()

    db.add(
        AuditLog(
            id=str(uuid4()),
            user_id=current_user.id,
            action="EMAIL_OCR_CONFIG_UPDATE",
            detail="Email OCR config updated",
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return get_config(db=db, _user=current_user)


@router.post("/test", response_model=EmailTestOut)
def test_imap(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not _is_configured(db):
        raise BusinessRuleError("IMAP yapılandırması eksik")

    host = _get_kv(db, "imap_host")
    port = int(_get_kv(db, "imap_port", "993") or 993)
    user = _get_kv(db, "imap_user")
    pwd = _get_kv(db, "imap_pass")
    mailbox = _get_kv(db, "imap_mailbox", "INBOX") or "INBOX"

    try:
        conn = imaplib.IMAP4_SSL(host, port)
        conn.login(user, pwd)
        conn.select(mailbox)
        conn.logout()
        return EmailTestOut(success=True, message="IMAP bağlantısı başarılı")
    except Exception as e:
        return EmailTestOut(success=False, message=f"IMAP bağlantı hatası: {str(e)}")


def _extract_attachments(msg: Message) -> List[bytes]:
    allowed = {"image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"}
    files: List[bytes] = []

    for part in msg.walk():
        ctype = part.get_content_type()
        disp = str(part.get("Content-Disposition") or "").lower()
        if "attachment" in disp and ctype in allowed:
            payload = part.get_payload(decode=True)
            if payload:
                files.append(payload)

    return files


@router.post("/fetch-now", response_model=FetchResult)
def fetch_now(
    background_tasks: BackgroundTasks,
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mailbox'tan okunmamış mailleri tarar, ekleri OCR job'a çevirir."""
    if not _is_configured(db):
        raise BusinessRuleError("IMAP yapılandırması eksik")

    host = _get_kv(db, "imap_host")
    port = int(_get_kv(db, "imap_port", "993") or 993)
    user = _get_kv(db, "imap_user")
    pwd = _get_kv(db, "imap_pass")
    mailbox = _get_kv(db, "imap_mailbox", "INBOX") or "INBOX"

    job_ids: List[str] = []

    try:
        conn = imaplib.IMAP4_SSL(host, port)
        conn.login(user, pwd)
        conn.select(mailbox)

        typ, data = conn.search(None, "UNSEEN")
        if typ != "OK":
            raise Exception("UNSEEN search failed")

        ids = (data[0] or b"").split()[-limit:]

        for mid in ids:
            typ2, msg_data = conn.fetch(mid, "(RFC822)")
            if typ2 != "OK":
                continue

            raw = msg_data[0][1]
            parsed = email.message_from_bytes(raw)
            attachments = _extract_attachments(parsed)

            for idx, content in enumerate(attachments):
                job = OCRJob(
                    id=str(uuid4()),
                    status="PENDING",
                    original_filename=f"email_attachment_{mid.decode()}_{idx}",
                    content_type="application/octet-stream",
                    file_size=len(content),
                    image_data=content,
                    uploaded_by_id=current_user.id,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(job)
                db.commit()
                job_ids.append(job.id)

                from app.routers.ocr_router import _process_ocr_job

                job.status = "PROCESSING"
                db.commit()
                background_tasks.add_task(_process_ocr_job, job.id, db, "auto")

            # mail'i seen olarak işaretle
            conn.store(mid, "+FLAGS", "\\Seen")

        conn.logout()

        db.add(
            AuditLog(
                id=str(uuid4()),
                user_id=current_user.id,
                action="EMAIL_OCR_FETCH",
                detail=f"Created {len(job_ids)} OCR jobs from email attachments",
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()

        return FetchResult(
            success=True, created_jobs=len(job_ids), job_ids=job_ids, message="Fetch tamamlandı"
        )

    except Exception as e:
        logger.error(f"Email fetch error: {e}")
        return FetchResult(success=False, created_jobs=0, job_ids=[], message=str(e))
