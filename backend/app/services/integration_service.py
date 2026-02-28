"""
Integration Service — Mikro Muhasebe Senkronizasyon İş Mantığı
Outbox/Inbox Pattern — Job tabanlı senkron — Exponential Backoff Retry
"""
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import os
import json
import traceback
import logging

from app.models import (
    IntegrationEntityMap, IntegrationSyncJob, IntegrationOutbox,
    IntegrationInbox, IntegrationError, IntegrationAudit,
    SyncStatusEnum, SyncDirectionEnum,
    CRMAccount, Order,
)
from app.utils import create_audit_log

logger = logging.getLogger("integration")


# ═══════════════════════════════════════
# ENTITY MAP İŞLEMLERİ
# ═══════════════════════════════════════

def list_entity_maps(db: Session, entity_type: Optional[str] = None, skip: int = 0, limit: int = 50):
    q = db.query(IntegrationEntityMap)
    if entity_type:
        q = q.filter(IntegrationEntityMap.entity_type == entity_type)
    total = q.count()
    items = q.order_by(IntegrationEntityMap.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def create_entity_map(db: Session, entity_type: str, internal_id: str, external_id: str, user_id: int, mapping_data: Optional[str] = None) -> IntegrationEntityMap:
    existing = db.query(IntegrationEntityMap).filter(
        IntegrationEntityMap.entity_type == entity_type,
        IntegrationEntityMap.internal_id == internal_id,
        IntegrationEntityMap.external_system == "MIKRO",
    ).first()
    if existing:
        existing.external_id = external_id
        existing.mapping_data = mapping_data
        existing.last_synced_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    m = IntegrationEntityMap(
        id=str(uuid4()),
        entity_type=entity_type,
        internal_id=internal_id,
        external_id=external_id,
        external_system="MIKRO",
        mapping_data=mapping_data,
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(m)
    _audit(db, "MAP_CREATE", entity_type, internal_id, f"Eşleme oluşturuldu: {internal_id} ↔ {external_id}", user_id)
    db.commit()
    db.refresh(m)
    return m


def delete_entity_map(db: Session, map_id: str, user_id: int) -> bool:
    m = db.query(IntegrationEntityMap).filter(IntegrationEntityMap.id == map_id).first()
    if not m:
        return False
    m.is_active = False
    _audit(db, "MAP_DELETE", m.entity_type, m.internal_id, f"Eşleme pasifleştirildi: {m.internal_id} ↔ {m.external_id}", user_id)
    db.commit()
    return True


# ═══════════════════════════════════════
# SYNC JOB İŞLEMLERİ
# ═══════════════════════════════════════

def list_sync_jobs(db: Session, skip: int = 0, limit: int = 20, status: Optional[str] = None):
    q = db.query(IntegrationSyncJob)
    if status:
        q = q.filter(IntegrationSyncJob.status == status)
    total = q.count()
    items = q.order_by(IntegrationSyncJob.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def get_sync_job(db: Session, job_id: str):
    return db.query(IntegrationSyncJob).filter(IntegrationSyncJob.id == job_id).first()


def create_sync_job(db: Session, job_type: str, direction: str, entity_type: Optional[str], user_id: int) -> IntegrationSyncJob:
    job = IntegrationSyncJob(
        id=str(uuid4()),
        job_type=job_type,
        direction=SyncDirectionEnum(direction),
        entity_type=entity_type,
        status=SyncStatusEnum.QUEUED,
        triggered_by_id=user_id,
    )
    db.add(job)
    _audit(db, "SYNC_START", entity_type, job.id, f"Senkron işi başlatıldı: {job_type} / {direction}", user_id)
    db.commit()
    db.refresh(job)
    return job


def update_job_status(db: Session, job_id: str, status: str, error_message: Optional[str] = None, stats: Optional[dict] = None):
    job = db.query(IntegrationSyncJob).filter(IntegrationSyncJob.id == job_id).first()
    if not job:
        return None
    job.status = SyncStatusEnum(status)
    if status == "RUNNING":
        job.started_at = datetime.now(timezone.utc)
    if status in ("SUCCESS", "FAILED", "PARTIAL"):
        job.completed_at = datetime.now(timezone.utc)
    if error_message:
        job.error_message = error_message
    if stats:
        job.total_records = stats.get("total", job.total_records)
        job.processed_records = stats.get("processed", job.processed_records)
        job.success_count = stats.get("success", job.success_count)
        job.error_count = stats.get("errors", job.error_count)
    db.commit()
    db.refresh(job)
    return job


# ═══════════════════════════════════════
# OUTBOX İŞLEMLERİ (OptiPlan → Mikro)
# ═══════════════════════════════════════

def enqueue_outbox(db: Session, entity_type: str, entity_id: str, operation: str, payload: dict) -> IntegrationOutbox:
    """Giden kuyruğuna mesaj ekle (idempotent — aynı entity+operation için bekleyen varsa güncelle)"""
    existing = db.query(IntegrationOutbox).filter(
        IntegrationOutbox.entity_type == entity_type,
        IntegrationOutbox.entity_id == entity_id,
        IntegrationOutbox.status == SyncStatusEnum.QUEUED,
    ).first()
    if existing:
        existing.payload = json.dumps(payload, ensure_ascii=False, default=str)
        existing.operation = operation
        db.commit()
        db.refresh(existing)
        return existing

    item = IntegrationOutbox(
        id=str(uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        operation=operation,
        payload=json.dumps(payload, ensure_ascii=False, default=str),
        status=SyncStatusEnum.QUEUED,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_outbox(db: Session, status: Optional[str] = None, skip: int = 0, limit: int = 50):
    q = db.query(IntegrationOutbox)
    if status:
        q = q.filter(IntegrationOutbox.status == status)
    total = q.count()
    items = q.order_by(IntegrationOutbox.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def _get_mikro_sync_service(db: Session):
    from app.services.mikro_sync_service import MikroSyncService
    return MikroSyncService(db)


def _parse_outbox_payload(payload_text: str) -> Dict[str, Any]:
    if not payload_text:
        return {}
    try:
        parsed = json.loads(payload_text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _is_permanent_outbox_error(code: Optional[str], message: str) -> bool:
    normalized_code = (code or "").upper()
    normalized_msg = (message or "").lower()
    if normalized_code == "E_MIKRO_READ_ONLY":
        return True
    if "unsupported entity_type" in normalized_msg:
        return True
    return False


def _dispatch_outbox_push(db: Session, item: IntegrationOutbox, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Outbox item'ini ilgili Mikro sync handler'ina route eder.
    Payload sozlesmesi:
    - ACCOUNT/CUSTOMER: account_data veya payload root
    - INVOICE: invoice_data + invoice_lines
    - QUOTE: quote_data + quote_lines
    - ORDER: order_data + order_items
    """
    entity_type = (item.entity_type or "").strip().upper()
    entity_id = str(item.entity_id)

    if entity_type in {"ACCOUNT", "CUSTOMER"}:
        sync_service = _get_mikro_sync_service(db)
        account_data = payload.get("account_data", payload)
        return sync_service.sync_account_to_mikro(entity_id, account_data)

    if entity_type == "INVOICE":
        sync_service = _get_mikro_sync_service(db)
        invoice_data = payload.get("invoice_data", payload)
        invoice_lines = payload.get("invoice_lines") or payload.get("lines") or []
        if not isinstance(invoice_lines, list):
            invoice_lines = []
        return sync_service.sync_invoice_to_mikro(entity_id, invoice_data, invoice_lines)

    if entity_type == "QUOTE":
        sync_service = _get_mikro_sync_service(db)
        quote_data = payload.get("quote_data", payload)
        quote_lines = payload.get("quote_lines") or payload.get("lines") or []
        if not isinstance(quote_lines, list):
            quote_lines = []
        return sync_service.sync_quote_to_mikro(entity_id, quote_data, quote_lines)

    if entity_type == "ORDER":
        sync_service = _get_mikro_sync_service(db)
        order_data = payload.get("order_data", payload)
        order_items = payload.get("order_items") or payload.get("items") or []
        if not isinstance(order_items, list):
            order_items = []
        return sync_service.sync_order_to_mikro(entity_id, order_data, order_items)

    return {
        "success": False,
        "error": f"Unsupported entity_type for outbox push: {entity_type or 'UNKNOWN'}",
        "code": "E_OUTBOX_UNSUPPORTED_ENTITY",
    }


def process_outbox_item(db: Session, item_id: str) -> dict:
    """Tek outbox öğesini işle — retry ile"""
    item = db.query(IntegrationOutbox).filter(IntegrationOutbox.id == item_id).first()
    if not item:
        return {"ok": False, "error": "Outbox öğesi bulunamadı"}

    if item.status not in (SyncStatusEnum.QUEUED, SyncStatusEnum.FAILED):
        return {"ok": False, "error": "Bu öğe zaten işleniyor veya tamamlanmış"}

    item.status = SyncStatusEnum.RUNNING
    db.commit()

    try:
        payload = _parse_outbox_payload(item.payload)
        result = _dispatch_outbox_push(db, item, payload)
        success = bool(result.get("success"))

        if success:
            logger.info("Outbox item basarili: %s/%s", item.entity_type, item.entity_id)
            item.status = SyncStatusEnum.SUCCESS
            item.processed_at = datetime.now(timezone.utc)
            item.error_message = None
            db.commit()
            return {"ok": True, "message": "İşlem başarılı", "result": result}

        error_code = result.get("code")
        error_message = result.get("error") or "Outbox işleme başarısız"
        permanent = _is_permanent_outbox_error(error_code, error_message)
        if permanent:
            item.status = SyncStatusEnum.FAILED
            item.error_message = error_message
            _log_error(
                db,
                None,
                item.entity_type,
                item.entity_id,
                error_code or "OUTBOX_PERMANENT_ERROR",
                error_message,
            )
            db.commit()
            return {"ok": False, "error": error_message, "code": error_code, "retry": False}

        raise RuntimeError(error_message)

    except Exception as e:
        item.retry_count += 1
        if item.retry_count >= item.max_retries:
            item.status = SyncStatusEnum.FAILED
            item.error_message = str(e)
        else:
            item.status = SyncStatusEnum.QUEUED
            # Exponential backoff: 2^retry * 30 saniye
            delay = (2 ** item.retry_count) * 30
            item.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
            item.error_message = f"Retry {item.retry_count}/{item.max_retries}: {str(e)}"

        _log_error(db, None, item.entity_type, item.entity_id, "OUTBOX_ERROR", str(e), traceback.format_exc())
        db.commit()
        return {"ok": False, "error": str(e), "retry": item.retry_count < item.max_retries}


# ═══════════════════════════════════════
# INBOX İŞLEMLERİ (Mikro → OptiPlan)
# ═══════════════════════════════════════

def list_inbox(db: Session, status: Optional[str] = None, skip: int = 0, limit: int = 50):
    q = db.query(IntegrationInbox)
    if status:
        q = q.filter(IntegrationInbox.status == status)
    total = q.count()
    items = q.order_by(IntegrationInbox.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def resolve_conflict(db: Session, inbox_id: str, resolution: str, user_id: int) -> Optional[IntegrationInbox]:
    """Çakışma çözme — ACCEPT, REJECT, MERGE"""
    item = db.query(IntegrationInbox).filter(IntegrationInbox.id == inbox_id).first()
    if not item:
        return None

    if resolution == "ACCEPT":
        item.status = SyncStatusEnum.SUCCESS
        # Apply incoming data - payload içindeki veriyi uygula
        _apply_incoming_data(db, item)
    elif resolution == "REJECT":
        item.status = SyncStatusEnum.FAILED
    elif resolution == "MERGE":
        item.status = SyncStatusEnum.SUCCESS
        # Merge logic - mevcut veri ile incoming veriyi birleştir
        _merge_incoming_data(db, item)

    item.resolved_at = datetime.now(timezone.utc)
    item.resolved_by_id = user_id
    _audit(db, "CONFLICT_RESOLVE", item.entity_type, item.external_id, f"Çakışma çözüldü: {resolution}", user_id)
    db.commit()
    db.refresh(item)
    return item


def _apply_incoming_data(db: Session, item: IntegrationInbox):
    """Inbox öğesindeki gelen veriyi uygula (ACCEPT resolution)"""
    try:
        payload = json.loads(item.payload) if item.payload else {}
        # Entity tipine göre ilgili tabloyu güncelle
        if item.entity_type == "ORDER":
            order = db.query(Order).filter(Order.id == item.external_id).first()
            if order:
                # Gelen veriyi siparişe uygula
                for key, value in payload.items():
                    if hasattr(order, key) and key not in ['id', 'created_at']:
                        setattr(order, key, value)
        elif item.entity_type == "CUSTOMER":
            from app.models import Customer
            customer = db.query(Customer).filter(Customer.id == item.external_id).first()
            if customer:
                for key, value in payload.items():
                    if hasattr(customer, key) and key not in ['id', 'created_at']:
                        setattr(customer, key, value)
        db.commit()
    except Exception as e:
        logger.error(f"Error applying incoming data for {item.entity_type}/{item.external_id}: {e}")


def _merge_incoming_data(db: Session, item: IntegrationInbox):
    """Inbox öğesindeki gelen veriyi mevcut veri ile birleştir (MERGE resolution)"""
    try:
        payload = json.loads(item.payload) if item.payload else {}
        conflict_data = json.loads(item.conflict_data) if item.conflict_data else {}
        
        # Mevcut veri ile gelen veriyi birleştir
        merged = {**conflict_data, **payload}
        
        # Birleştirilmiş veriyi uygula
        if item.entity_type == "ORDER":
            order = db.query(Order).filter(Order.id == item.external_id).first()
            if order:
                for key, value in merged.items():
                    if hasattr(order, key) and key not in ['id', 'created_at']:
                        setattr(order, key, value)
        elif item.entity_type == "CUSTOMER":
            from app.models import Customer
            customer = db.query(Customer).filter(Customer.id == item.external_id).first()
            if customer:
                for key, value in merged.items():
                    if hasattr(customer, key) and key not in ['id', 'created_at']:
                        setattr(customer, key, value)
        db.commit()
    except Exception as e:
        logger.error(f"Error merging incoming data for {item.entity_type}/{item.external_id}: {e}")


# ═══════════════════════════════════════
# HATA YÖNETİMİ
# ═══════════════════════════════════════

def _log_error(db: Session, job_id: Optional[str], entity_type: Optional[str], entity_id: Optional[str], error_code: str, message: str, stack: Optional[str] = None):
    err = IntegrationError(
        id=str(uuid4()),
        job_id=job_id,
        entity_type=entity_type,
        entity_id=entity_id,
        error_code=error_code,
        error_message=message,
        stack_trace=stack,
    )
    db.add(err)


def list_errors(db: Session, is_resolved: Optional[bool] = None, skip: int = 0, limit: int = 50):
    q = db.query(IntegrationError)
    if is_resolved is not None:
        q = q.filter(IntegrationError.is_resolved == is_resolved)
    total = q.count()
    items = q.order_by(IntegrationError.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def resolve_error(db: Session, error_id: str, user_id: int) -> bool:
    err = db.query(IntegrationError).filter(IntegrationError.id == error_id).first()
    if not err:
        return False
    err.is_resolved = True
    err.resolved_at = datetime.now(timezone.utc)
    err.resolved_by_id = user_id
    db.commit()
    return True


# ═══════════════════════════════════════
# AUDIT + SAĞLIK
# ═══════════════════════════════════════

def _audit(db: Session, action: str, entity_type: Optional[str], entity_id: Optional[str], detail: Optional[str], user_id: Optional[int] = None):
    a = IntegrationAudit(
        id=str(uuid4()),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
        user_id=user_id,
    )
    db.add(a)


def list_audit(db: Session, skip: int = 0, limit: int = 50):
    q = db.query(IntegrationAudit)
    total = q.count()
    items = q.order_by(IntegrationAudit.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def _to_bool(value, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _resolve_mikro_connection() -> tuple[bool, Optional[str]]:
    """Mikro baglanti testini guvenli sekilde calistir."""
    try:
        from app.mikro_db import test_connection
        result = test_connection()
    except Exception as exc:
        return False, str(exc)

    if isinstance(result, tuple):
        ok = bool(result[0]) if len(result) > 0 else False
        msg = str(result[1]) if len(result) > 1 else None
        return ok, msg

    if isinstance(result, dict):
        ok = bool(result.get("success", False))
        msg = result.get("error") or result.get("message")
        return ok, msg

    return bool(result), None


def _resolve_mikro_read_only_flags() -> dict:
    """Mikro read-only kaynaklarini tek yerde normalize et."""
    cfg_read_only = True
    env_value = os.environ.get("MIKRO_READ_ONLY_MODE")
    env_read_only = None

    try:
        from app.mikro_db import get_config
        cfg = get_config() or {}
        if "read_only" in cfg:
            cfg_read_only = _to_bool(cfg.get("read_only"), default=True)
    except Exception:
        pass

    if env_value is not None:
        env_read_only = _to_bool(env_value, default=True)

    effective_read_only = env_read_only if env_read_only is not None else cfg_read_only
    return {
        "config_read_only": cfg_read_only,
        "env_override_value": env_value,
        "env_read_only": env_read_only,
        "effective_read_only": effective_read_only,
    }


def get_health(db: Session) -> dict:
    """Senkronizasyon sağlık durumu"""
    outbox_queued = db.query(sa_func.count(IntegrationOutbox.id)).filter(IntegrationOutbox.status == SyncStatusEnum.QUEUED).scalar() or 0
    outbox_failed = db.query(sa_func.count(IntegrationOutbox.id)).filter(IntegrationOutbox.status == SyncStatusEnum.FAILED).scalar() or 0
    inbox_queued = db.query(sa_func.count(IntegrationInbox.id)).filter(IntegrationInbox.status == SyncStatusEnum.QUEUED).scalar() or 0
    inbox_conflicts = db.query(sa_func.count(IntegrationInbox.id)).filter(IntegrationInbox.conflict_type.isnot(None), IntegrationInbox.resolved_at.is_(None)).scalar() or 0
    unresolved_errors = db.query(sa_func.count(IntegrationError.id)).filter(IntegrationError.is_resolved == False).scalar() or 0
    active_maps = db.query(sa_func.count(IntegrationEntityMap.id)).filter(IntegrationEntityMap.is_active == True).scalar() or 0

    last_job = db.query(IntegrationSyncJob).order_by(IntegrationSyncJob.created_at.desc()).first()
    last_sync_status = last_job.status.value if last_job else None
    last_sync_at = last_job.completed_at.isoformat() if last_job and last_job.completed_at else None

    # Mikro bağlantı kontrolü
    mikro_connected, mikro_error = _resolve_mikro_connection()
    read_only = _resolve_mikro_read_only_flags()

    health_status = "HEALTHY"
    if outbox_failed > 5 or unresolved_errors > 10:
        health_status = "DEGRADED"
    if not mikro_connected:
        health_status = "DISCONNECTED"
    elif not read_only["effective_read_only"]:
        health_status = "DEGRADED"

    return {
        "status": health_status,
        "mikro_connected": mikro_connected,
        "mikro_error": mikro_error,
        "mikro_read_only": read_only["effective_read_only"],
        "mikro_read_only_sources": read_only,
        "outbox_queued": outbox_queued,
        "outbox_failed": outbox_failed,
        "inbox_queued": inbox_queued,
        "inbox_conflicts": inbox_conflicts,
        "unresolved_errors": unresolved_errors,
        "active_maps": active_maps,
        "last_sync_status": last_sync_status,
        "last_sync_at": last_sync_at,
    }


def run_diagnostics(db: Session) -> dict:
    """
    Operasyonel entegrasyon kontrol listesi.
    Sonuclar PASS/WARN/FAIL olarak normalize edilir.
    """
    health = get_health(db)
    checks = []

    def add_check(name: str, status: str, detail: str, recommendation: Optional[str] = None):
        checks.append(
            {
                "name": name,
                "status": status,
                "detail": detail,
                "recommendation": recommendation,
            }
        )

    if health.get("mikro_connected"):
        add_check("mikro_connection", "PASS", "Mikro baglantisi basarili.")
    else:
        add_check(
            "mikro_connection",
            "FAIL",
            f"Mikro baglantisi basarisiz: {health.get('mikro_error') or 'bilinmeyen hata'}",
            "Mikro host/database/credential ve ag erisimini kontrol edin.",
        )

    if health.get("mikro_read_only"):
        add_check("mikro_read_only", "PASS", "Mikro P1 read-only zorunlulugu aktif.")
    else:
        add_check(
            "mikro_read_only",
            "FAIL",
            "Mikro read-only devre disi gorunuyor.",
            "MIKRO_READ_ONLY_MODE ve mikro_connection.json read_only degerini true yapin.",
        )

    outbox_failed = int(health.get("outbox_failed", 0) or 0)
    if outbox_failed == 0:
        add_check("outbox_failed", "PASS", "Basarisiz outbox kaydi yok.")
    elif outbox_failed <= 5:
        add_check("outbox_failed", "WARN", f"Basarisiz outbox sayisi: {outbox_failed}", "Hata kuyrugunu inceleyin.")
    else:
        add_check(
            "outbox_failed",
            "FAIL",
            f"Basarisiz outbox sayisi kritik seviyede: {outbox_failed}",
            "Retry ve entegrasyon hata kayitlarini acilen temizleyin.",
        )

    unresolved_errors = int(health.get("unresolved_errors", 0) or 0)
    if unresolved_errors <= 3:
        add_check("unresolved_errors", "PASS", f"Acik hata kaydi: {unresolved_errors}")
    elif unresolved_errors <= 10:
        add_check(
            "unresolved_errors",
            "WARN",
            f"Acik hata kaydi artiyor: {unresolved_errors}",
            "Entegrasyon error kayitlarini resolve edin.",
        )
    else:
        add_check(
            "unresolved_errors",
            "FAIL",
            f"Acik hata kaydi kritik seviyede: {unresolved_errors}",
            "Error backlog acilen temizlenmeli.",
        )

    outbox_queued = int(health.get("outbox_queued", 0) or 0)
    inbox_queued = int(health.get("inbox_queued", 0) or 0)
    if outbox_queued <= 50 and inbox_queued <= 50:
        add_check(
            "queue_backlog",
            "PASS",
            f"Kuyruk seviyeleri normal (outbox={outbox_queued}, inbox={inbox_queued}).",
        )
    else:
        add_check(
            "queue_backlog",
            "WARN",
            f"Kuyruk birikimi yuksek (outbox={outbox_queued}, inbox={inbox_queued}).",
            "Outbox/inbox process joblarini ve source sistem akislarini kontrol edin.",
        )

    last_sync_at = health.get("last_sync_at")
    if not last_sync_at:
        add_check(
            "last_sync_recency",
            "WARN",
            "Son senkron zamani bulunamadi.",
            "En az bir basarili sync jobu calistirip kayit olusturun.",
        )
    else:
        add_check("last_sync_recency", "PASS", f"Son senkron zamani: {last_sync_at}")

    if any(c["status"] == "FAIL" for c in checks):
        overall = "FAIL"
    elif any(c["status"] == "WARN" for c in checks):
        overall = "WARN"
    else:
        overall = "PASS"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "health_snapshot": health,
        "checks": checks,
    }


def retry_failed(db: Session, user_id: int) -> dict:
    """Tüm başarısız outbox öğelerini yeniden kuyruğa al"""
    failed_items = db.query(IntegrationOutbox).filter(
        IntegrationOutbox.status == SyncStatusEnum.FAILED,
        IntegrationOutbox.retry_count < IntegrationOutbox.max_retries,
    ).all()

    reset_count = 0
    for item in failed_items:
        item.status = SyncStatusEnum.QUEUED
        item.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        reset_count += 1

    _audit(db, "RETRY_ALL", None, None, f"{reset_count} başarısız öğe yeniden kuyruğa alındı", user_id)
    db.commit()
    return {"ok": True, "reset_count": reset_count}
