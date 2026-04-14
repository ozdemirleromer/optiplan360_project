"""
Phase 1 (OCR Havuzu) HTTP router — v2 spec.
Prefix: /api/phase1
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import require_operator
from app.database import get_db
from app.exceptions import NotFoundError
from app.models import User
from app.models.phase1 import Phase1Record
from app.features.phase1.schemas import (
    Phase1ErrorListResponse,
    Phase1FolderHealthListResponse,
    Phase1ManualRescanRequestDto,
    Phase1ManualRescanResponseDto,
    Phase1ManualRetryRequestDto,
    Phase1ManualRetryResponseDto,
    Phase1QueueDetailDto,
    Phase1QueueListResponse,
    Phase1StatusSummaryDto,
    Phase2ApproveRequest,
    Phase2ApproveResponse,
    Phase2MarkFaultyRequest,
    Phase2MovePhase3Response,
    Phase2OverrideRequest,
    Phase2OverrideResponse,
    Phase2RecordDetailDto,
)
from app.services.phase1_service import phase1_service

router = APIRouter(prefix="/api/phase1", tags=["phase1"])


# ---------------------------------------------------------------------------
# Phase 1 — Queue
# ---------------------------------------------------------------------------

@router.get("/queue", response_model=Phase1QueueListResponse)
def get_phase1_queue(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    folder_type: Optional[str] = Query(None),
    duplicate: Optional[bool] = Query(None),
    retry_only: bool = Query(False),
    phase2_ready: Optional[bool] = Query(None),
    manual_review_only: bool = Query(False),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 1 kuyruk listesi — tüm filtreler desteklenir."""
    return phase1_service.get_queue(
        db,
        search=search,
        status=status,
        source_type=source_type,
        folder_type=folder_type,
        duplicate=duplicate,
        retry_only=retry_only,
        phase2_ready=phase2_ready,
        manual_review_only=manual_review_only,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get("/queue/{record_id}", response_model=Phase1QueueDetailDto)
def get_phase1_record_detail(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Tek kayıt detayı — folder health + lifecycle dahil."""
    return phase1_service.get_record_detail(db, record_id)


@router.get("/records/{record_id}/image")
def get_record_image(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Kayda ait orijinal görsel dosyayı döndür."""
    record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
    if not record:
        raise NotFoundError("Phase1Record", record_id)
    if not record.image_path or not os.path.exists(record.image_path):
        raise NotFoundError("Image", record_id)

    return FileResponse(record.image_path)


# ---------------------------------------------------------------------------
# Phase 1 — Status Summary
# ---------------------------------------------------------------------------

@router.get("/status-summary", response_model=Phase1StatusSummaryDto)
def get_status_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Dashboard KPI özeti."""
    return phase1_service.get_status_summary(db)


# ---------------------------------------------------------------------------
# Phase 1 — Errors
# ---------------------------------------------------------------------------

@router.get("/errors", response_model=Phase1ErrorListResponse)
def get_errors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Hata / retry bekleyen kayıtlar."""
    items = phase1_service.get_errors(db)
    return Phase1ErrorListResponse(items=items)


# ---------------------------------------------------------------------------
# Phase 1 — Folder Health
# ---------------------------------------------------------------------------

@router.get("/folder-health", response_model=Phase1FolderHealthListResponse)
def get_folder_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Tüm kaynak klasörlerin sağlık durumu."""
    items = phase1_service.get_folder_health(db)
    return Phase1FolderHealthListResponse(items=items)


# ---------------------------------------------------------------------------
# Phase 1 — Actions
# ---------------------------------------------------------------------------

@router.post("/manual-retry", response_model=Phase1ManualRetryResponseDto)
def manual_retry(
    body: Phase1ManualRetryRequestDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Belirtilen kaydı yeniden OCR işlemine al."""
    return phase1_service.manual_retry(db, body.record_id)


@router.post("/manual-rescan", response_model=Phase1ManualRescanResponseDto)
def manual_rescan(
    body: Phase1ManualRescanRequestDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Belirtilen klasörü manuel tara."""
    return phase1_service.manual_rescan(db, body.folder_type)


# ---------------------------------------------------------------------------
# Phase 2 — Queue
# ---------------------------------------------------------------------------

@router.get("/phase2/queue", response_model=Phase1QueueListResponse)
def get_phase2_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 2 onay kuyruğu — PHASE2_PENDING ve PHASE2_IN_PROGRESS kayıtları."""
    return phase1_service.get_phase2_queue(db, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Phase 2 — Record Detail
# ---------------------------------------------------------------------------

@router.get("/phase2/records/{record_id}", response_model=Phase2RecordDetailDto)
def get_phase2_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 2 split-screen için tam kayıt detayı (satırlar + confidence + bbox)."""
    return phase1_service.get_phase2_record(db, record_id)


# ---------------------------------------------------------------------------
# Phase 2 — Cell Actions
# ---------------------------------------------------------------------------

@router.patch("/phase2/records/{record_id}/cells/approve", response_model=Phase2ApproveResponse)
def approve_cell(
    record_id: str,
    body: Phase2ApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Tek hücreyi APPROVE_AS_IS olarak onayla."""
    return phase1_service.approve_cell(
        db, record_id, body.row_index, body.field_name, actor_id=str(current_user.id)
    )


@router.patch("/phase2/records/{record_id}/cells/override", response_model=Phase2OverrideResponse)
def override_cell(
    record_id: str,
    body: Phase2OverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Tek hücreyi operatör değeriyle override et."""
    return phase1_service.override_cell(
        db, record_id, body.row_index, body.field_name, body.override_value,
        actor_id=str(current_user.id),
    )


@router.post("/phase2/records/{record_id}/mark-faulty")
def mark_faulty(
    record_id: str,
    body: Optional[Phase2MarkFaultyRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Kaydı FAULTY olarak işaretle."""
    note = body.note if body else None
    return phase1_service.mark_faulty(db, record_id, note=note, actor_id=str(current_user.id))


@router.post("/phase2/records/{record_id}/move-phase3", response_model=Phase2MovePhase3Response)
def move_to_phase3(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Blocker yoksa Phase 3'e geçir."""
    return phase1_service.move_to_phase3(db, record_id, actor_id=str(current_user.id))
