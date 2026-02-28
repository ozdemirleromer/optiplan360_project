from sqlalchemy.orm import Session
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
from app.models import AuditLog

def create_audit_log(
    db: Session,
    user_id: str,
    action: str,
    detail: Optional[str] = None,
    order_id: Optional[str] = None,
):
    """
    Merkezi Audit Log oluşturma fonksiyonu.
    
    Args:
        db: Veritabanı oturumu
        user_id: İşlemi yapan kullanıcı ID
        action: İşlem türü (örn: "CREATE_ORDER", "DELETE_USER")
        detail: İşlem detayı veya açıklama
        order_id: İlgili sipariş ID (varsa)
    """
    log = AuditLog(
        id=str(uuid4()),
        user_id=user_id,
        action=action,
        order_id=order_id,
        detail=detail,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    # Not: db.commit() çağrısı transaction bütünlüğü için çağıran fonksiyona bırakılabilir.
    # Ancak logların bağımsız olması istenirse burada commit denenebilir.
    # Şimdilik session'a ekleyip bırakıyoruz.
