"""
Phase 4 (Export / Manifest / Retry) HTTP router — master spec v3.
Prefix: /api/phase4
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_operator
from app.database import get_db
from app.features.phase1.schemas import (
    Phase4ExportResponse,
    Phase4FolderHealthListResponse,
    Phase4ManifestListResponse,
    Phase4PreviewResponse,
    Phase4QueueListResponse,
    Phase4RecordActionRequest,
    Phase4RecordDetailDto,
    Phase4RetryRequest,
)
from app.models import User
from app.services.phase1_service import phase1_service

router = APIRouter(prefix="/api/phase4", tags=["phase4"])


@router.get("/queue", response_model=Phase4QueueListResponse)
def get_phase4_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 4 queue listesi."""
    return phase1_service.get_phase4_queue(db)


@router.get("/records/{record_id}", response_model=Phase4RecordDetailDto)
def get_phase4_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 4 kayıt detay yüzeyi."""
    return phase1_service.get_phase4_record(db, record_id)


@router.get("/manifests", response_model=Phase4ManifestListResponse)
def get_phase4_manifests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Manifest geçmişi listesi."""
    return phase1_service.get_phase4_manifests(db)


@router.post("/preview", response_model=Phase4PreviewResponse)
def create_phase4_preview(
    body: Phase4RecordActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Preview oluşturma aksiyonu."""
    return phase1_service.create_phase4_preview(db, body.record_id, actor_id=str(current_user.id))


@router.post("/export", response_model=Phase4ExportResponse)
def export_phase4(
    body: Phase4RecordActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Export çalıştırma aksiyonu."""
    return phase1_service.export_phase4(db, body.record_id, actor_id=str(current_user.id))


@router.post("/retry", response_model=Phase4ExportResponse)
def retry_phase4(
    body: Phase4RetryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Retry kararı aksiyonu."""
    return phase1_service.retry_phase4(
        db,
        body.record_id,
        decision=body.decision,
        actor_id=str(current_user.id),
    )


@router.get("/folder-health", response_model=Phase4FolderHealthListResponse)
def get_phase4_folder_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 4 klasör sağlık özeti."""
    return phase1_service.get_phase4_folder_health(db)
