"""
Phase 3 (Siparis Kontrol) HTTP router — master spec v3.
Prefix: /api/phase3
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import require_operator
from app.database import get_db
from app.features.phase1.schemas import (
    Phase1QueueListResponse,
    Phase3CustomerMatchRequest,
    Phase3CustomerMatchResponse,
    Phase3MergeRowsRequest,
    Phase3MergeRowsResponse,
    Phase3MovePhase4Request,
    Phase3MovePhase4Response,
    Phase3RecordDetailDto,
    Phase3ScrapNoteRequest,
    Phase3ScrapNoteResponse,
    Phase3StockMatchRequest,
    Phase3StockMatchResponse,
)
from app.models import User
from app.services.phase1_service import phase1_service

router = APIRouter(prefix="/api/phase3", tags=["phase3"])


@router.get("/queue", response_model=Phase1QueueListResponse)
def get_phase3_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 3 siparis kontrol kuyruğu — PHASE3_PENDING ve PHASE3_IN_PROGRESS kayıtları."""
    return phase1_service.get_phase3_queue(db, page=page, page_size=page_size)


@router.get("/records/{record_id}", response_model=Phase3RecordDetailDto)
def get_phase3_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Phase 3 tam kayıt detayı — header + plate groups + lines + summary."""
    result = phase1_service.get_phase3_record(db, record_id)
    result.header.operator_name = (
        getattr(current_user, "display_name", None)
        or getattr(current_user, "name", None)
        or getattr(current_user, "username", None)
        or getattr(current_user, "email", None)
    )
    return result


@router.post("/customer-match", response_model=Phase3CustomerMatchResponse)
def match_customer(
    body: Phase3CustomerMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Cari eşleştirme aksiyonu."""
    return phase1_service.match_customer(
        db,
        record_id=body.record_id,
        customer_code=body.customer_code,
        actor_id=str(current_user.id),
    )


@router.post("/stock-match", response_model=Phase3StockMatchResponse)
def match_stock(
    body: Phase3StockMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Satır bazında stok eşleştirme aksiyonu."""
    return phase1_service.match_stock(
        db,
        record_id=body.record_id,
        row_index=body.row_index,
        stock_code=body.stock_code,
        actor_id=str(current_user.id),
    )


@router.post("/merge-rows", response_model=Phase3MergeRowsResponse)
def merge_rows(
    body: Phase3MergeRowsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Satır birleştirme aksiyonu."""
    return phase1_service.merge_rows(
        db,
        record_id=body.record_id,
        row_indexes=body.row_indexes,
        actor_id=str(current_user.id),
    )


@router.post("/scrap-note", response_model=Phase3ScrapNoteResponse)
def add_scrap_note(
    body: Phase3ScrapNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Fire açıklaması ekleme aksiyonu."""
    return phase1_service.add_scrap_note(
        db,
        record_id=body.record_id,
        note=body.note,
        actor_id=str(current_user.id),
    )


@router.post("/move-phase4", response_model=Phase3MovePhase4Response)
def move_to_phase4(
    body: Phase3MovePhase4Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Blocker kalmadığında kaydı Phase 4'e geçir."""
    return phase1_service.move_to_phase4(
        db,
        record_id=body.record_id,
        actor_id=str(current_user.id),
    )
