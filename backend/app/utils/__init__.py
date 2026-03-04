from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.models import AuditLog
from sqlalchemy.orm import Session

from .text_normalize import (
    normalize_material_name,
    normalize_phone,
    normalize_text,
    normalize_turkish,
    sanitize_filename,
)


def create_audit_log(
    db: Session,
    user_id: str,
    action: str,
    detail: Optional[str] = None,
    order_id: Optional[str] = None,
):
    """Create a centralized audit log entry."""

    log = AuditLog(
        id=str(uuid4()),
        user_id=user_id,
        action=action,
        order_id=order_id,
        detail=detail,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)


__all__ = [
    "create_audit_log",
    "normalize_material_name",
    "normalize_phone",
    "normalize_text",
    "normalize_turkish",
    "sanitize_filename",
]
