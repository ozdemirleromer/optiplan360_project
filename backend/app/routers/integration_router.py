"""
Integration Router — Mikro Senkronizasyon API
/api/v1/integration/...
Outbox/Inbox, Sync Jobs, Entity Mapping, Health, Retry
"""

from datetime import datetime
from typing import Optional

from app.auth import require_permissions
from app.database import get_db
from app.exceptions import BusinessRuleError, NotFoundError
from app.models import User
from app.permissions import Permission
from app.services import integration_service
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/integration", tags=["integration"])


# ═══════════════════════════════════════
# PYDANTIC SCHEMAS
# ═══════════════════════════════════════


class EntityMapCreate(BaseModel):
    entity_type: str
    internal_id: str
    external_id: str
    mapping_data: Optional[str] = None


class EntityMapOut(BaseModel):
    id: str
    entity_type: str
    internal_id: str
    external_id: str
    external_system: str
    mapping_data: Optional[str] = None
    is_active: bool
    last_synced_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SyncJobCreate(BaseModel):
    job_type: str = "INCREMENTAL"  # FULL_SYNC, INCREMENTAL, SINGLE_ENTITY
    direction: str = "PUSH"  # PUSH, PULL, BIDIRECTIONAL
    entity_type: Optional[str] = None


class SyncJobOut(BaseModel):
    id: str
    job_type: str
    direction: str
    entity_type: Optional[str] = None
    status: str
    total_records: int
    processed_records: int
    success_count: int
    error_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OutboxOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    operation: str
    payload: str
    status: str
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InboxOut(BaseModel):
    id: str
    entity_type: str
    external_id: str
    operation: str
    payload: str
    status: str
    conflict_type: Optional[str] = None
    conflict_data: Optional[str] = None
    resolved_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ErrorOut(BaseModel):
    id: str
    job_id: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: str
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class AuditOut(BaseModel):
    id: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    direction: Optional[str] = None
    detail: Optional[str] = None
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ConflictResolve(BaseModel):
    resolution: str  # ACCEPT, REJECT, MERGE


# ═══════════════════════════════════════
# ENTITY MAP ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/maps")
def api_list_maps(
    entity_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    items, total = integration_service.list_entity_maps(db, entity_type, skip, limit)
    return {"data": [EntityMapOut.model_validate(i) for i in items], "total": total}


@router.post("/maps", status_code=201)
def api_create_map(
    body: EntityMapCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    m = integration_service.create_entity_map(
        db, body.entity_type, body.internal_id, body.external_id, user.id, body.mapping_data
    )
    return EntityMapOut.model_validate(m)


@router.delete("/maps/{map_id}")
def api_delete_map(
    map_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    ok = integration_service.delete_entity_map(db, map_id, user.id)
    if not ok:
        raise NotFoundError("Eşleme")
    return {"ok": True}


# ═══════════════════════════════════════
# SYNC JOB ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/jobs")
def api_list_jobs(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    items, total = integration_service.list_sync_jobs(db, skip, limit, status)
    return {"data": [SyncJobOut.model_validate(i) for i in items], "total": total}


@router.get("/jobs/{job_id}")
def api_get_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    job = integration_service.get_sync_job(db, job_id)
    if not job:
        raise NotFoundError("Senkron işi")
    return SyncJobOut.model_validate(job)


@router.post("/jobs", status_code=201)
def api_create_job(
    body: SyncJobCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    job = integration_service.create_sync_job(
        db, body.job_type, body.direction, body.entity_type, user.id
    )
    return SyncJobOut.model_validate(job)


# ═══════════════════════════════════════
# OUTBOX ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/outbox")
def api_list_outbox(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    items, total = integration_service.list_outbox(db, status, skip, limit)
    return {"data": [OutboxOut.model_validate(i) for i in items], "total": total}


@router.post("/outbox/{item_id}/process")
def api_process_outbox(
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    result = integration_service.process_outbox_item(db, item_id)
    if not result["ok"]:
        raise BusinessRuleError(result.get("error", "İşlem başarısız"))
    return result


# ═══════════════════════════════════════
# INBOX ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/inbox")
def api_list_inbox(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    items, total = integration_service.list_inbox(db, status, skip, limit)
    return {"data": [InboxOut.model_validate(i) for i in items], "total": total}


@router.post("/inbox/{inbox_id}/resolve")
def api_resolve_conflict(
    inbox_id: str,
    body: ConflictResolve,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    item = integration_service.resolve_conflict(db, inbox_id, body.resolution, user.id)
    if not item:
        raise NotFoundError("Inbox öğesi")
    return InboxOut.model_validate(item)


# ═══════════════════════════════════════
# HATA ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/errors")
def api_list_errors(
    is_resolved: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    items, total = integration_service.list_errors(db, is_resolved, skip, limit)
    return {"data": [ErrorOut.model_validate(i) for i in items], "total": total}


@router.post("/errors/{error_id}/resolve")
def api_resolve_error(
    error_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    ok = integration_service.resolve_error(db, error_id, user.id)
    if not ok:
        raise NotFoundError("Hata kaydı")
    return {"ok": True}


# ═══════════════════════════════════════
# AUDIT ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/audit")
def api_list_audit(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    items, total = integration_service.list_audit(db, skip, limit)
    return {"data": [AuditOut.model_validate(i) for i in items], "total": total}


# ═══════════════════════════════════════
# SAĞLIK + RETRY ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/health")
def api_health(
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    return integration_service.get_health(db)


@router.get("/diagnostics")
def api_diagnostics(
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    return integration_service.run_diagnostics(db)


@router.post("/retry")
def api_retry_failed(
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.INTEGRATIONS_MANAGE)),
):
    return integration_service.retry_failed(db, user.id)
