"""
Phase 2 OCR Kontrol — Pydantic Request/Response Şemaları

Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.5 (API Sözleşmesi)
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .models.enums import (
    BlockerReasonCodeEnum,
    ErrorReasonCategoryEnum,
    CellApprovalStatusEnum,
    Phase2DecisionEventTypeEnum,
)


# ── Blocker ve Doğrulama Şemaları ──

class CellBlockerResponse(BaseModel):
    """
    [DOKUMAN] Hücre doğrulama sonucu — blocker var mı, neden?
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.1
    """

    reason_code: BlockerReasonCodeEnum
    operator_message: str  # Türkçe, okunabilir ("Adet algılama güveni %65, eşik %85")
    is_blocker: bool  # Gate'ye etki ediyor mu
    severity: str  # "critical" | "warning"
    confidence_score: float
    suggested_value: Optional[int] = None


class ValidateCellRequest(BaseModel):
    """Hücre doğrulama isteği"""

    field_type: str = Field(..., description="'boy' | 'en' | 'adet'")
    value: float = Field(...)
    original_ocr_value: Optional[str] = None
    current_confidence: Optional[float] = None


class ValidateCellResponse(BaseModel):
    """Hücre doğrulama sonucu"""

    is_valid: bool
    blockers: List[CellBlockerResponse] = []
    message: str
    proposed_value: Optional[int] = None


# ── Karar Şemaları (Decision Events) ──

class CellDecideRequest(BaseModel):
    """
    Hücre karar isteği
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.5
    """

    record_uuid: str
    row_id: str
    field_type: str = Field(..., description="'boy' | 'en' | 'adet'")
    action: str = Field(..., description="'APPROVE' | 'APPLY_SUGGESTION' | 'OVERRIDE_WITH_VALUE' | 'MARK_ERROR'")
    
    # Değer (action=OVERRIDE_WITH_VALUE için)
    value: Optional[int] = None
    
    # Karar sebebi (audit için)
    reason: Optional[BlockerReasonCodeEnum] = None
    error_category: Optional[ErrorReasonCategoryEnum] = None
    operator_note: Optional[str] = Field(None, max_length=200)
    
    # Idempotency
    idempotency_key: Optional[str] = None


class CellDecideResponse(BaseModel):
    """Hücre karar sonucu"""

    success: bool
    message: str
    idempotency_id: Optional[str] = None
    cached: bool = False
    
    # Güncel hücre durumu
    cell_state: dict = {}
    
    # Gate etkileri
    next_blocking_cell: Optional[dict] = None  # {"row_id": "...", "field_type": "..."}
    gate_status: str = Field(..., description="'BLOCKED' | 'READY'")


# ── Batch Onay Şemaları ──

class BatchApproveQuery(BaseModel):
    """Toplu onay sorgusu"""

    field_type: Optional[str] = Field(None, description="'boy' | 'en' | 'adet' (seçmeli)")
    confidence_range: Optional[tuple[float, float]] = Field(
        None, description="[min, max] confidence bandı (seçmeli)"
    )
    reason: Optional[BlockerReasonCodeEnum] = None


class BatchApproveDryRunRequest(BaseModel):
    """Toplu onay dry-run isteği"""

    record_uuid: str
    query: BatchApproveQuery


class AffectedCellItem(BaseModel):
    """Etkilenecek hücre detayı"""

    row_id: str
    field_type: str
    old_confidence: float
    new_approval_status: str


class BatchApproveDryRunResponse(BaseModel):
    """Toplu onay dry-run sonucu"""

    dry_run_id: str
    affected_count: int
    affected_cells: List[AffectedCellItem] = []
    estimated_impact: dict = {
        "blockers_remaining": 0,
        "gate_status_after": "BLOCKED",
    }


class BatchApproveCommitRequest(BaseModel):
    """Toplu onay commit isteği"""

    record_uuid: str
    query: BatchApproveQuery
    dry_run_id: Optional[str] = None
    idempotency_key: Optional[str] = None


class BatchApproveCommitResponse(BaseModel):
    """Toplu onay commit sonucu"""

    success: bool
    applied_count: int
    message: str
    gate_status: str = Field(..., description="'BLOCKED' | 'READY'")


# ── Gate Status Şemaları ──

class BlockerReasonDetail(BaseModel):
    """Gate blocker detayı"""

    row_id: str
    field_type: str
    reason_code: BlockerReasonCodeEnum
    operator_message: str
    suggested_action: Optional[str] = None
    confidence_score: float
    severity: str = Field(..., description="'critical' | 'warning'")


class Phase3GateStatusResponse(BaseModel):
    """
    Phase 3'e geçiş durumu — detailed
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.2
    """

    can_proceed: bool
    message: str
    blocker_reasons: List[BlockerReasonDetail] = []
    summary: dict = {
        "total_blockers": 0,
        "critical_count": 0,
        "warning_count": 0,
    }
    gate_check_time: datetime


# ── Undo Şemaları ──

class UndoRecord(BaseModel):
    """Undo history item"""

    timestamp: datetime
    action: Phase2DecisionEventTypeEnum
    old_state: dict
    new_state: dict
    user_name: str


class UndoRequest(BaseModel):
    """Geri al isteği"""

    record_uuid: str
    decision_event_id: str
    idempotency_key: Optional[str] = None


class UndoResponse(BaseModel):
    """Geri al sonucu"""

    success: bool
    message: str
    reverted_event_id: str
    gate_status: str = Field(..., description="'BLOCKED' | 'READY'")


# ── Audit Trail ──

class DecisionEventResponse(BaseModel):
    """Decision event — audit log item"""

    id: str
    created_at: datetime
    record_uuid: str
    row_id: str
    field_type: str
    event_type: str
    old_value: Optional[int] = None
    new_value: Optional[int] = None
    actor_user_id: Optional[int] = None
    actor_user_name: Optional[str] = None
    decision_reason: Optional[str] = None
    operator_note: Optional[str] = None


class AuditTrailResponse(BaseModel):
    """Audit trail query sonucu"""

    record_uuid: str
    total_events: int
    events: List[DecisionEventResponse] = []


# ── Configuration ──

class CellValidationConfig(BaseModel):
    """Alan bazlı doğrulama konfigürasyonu"""

    field_type: str
    min_value: int
    max_value: int
    confidence_threshold: int
    min_error_message: str
    max_error_message: str
    confidence_error_message: str
    is_active: bool
    updated_at: datetime


class Phase2ConfigResponse(BaseModel):
    """Phase 2 global konfigürasyon"""

    validation_configs: List[CellValidationConfig] = []
    reason_codes: List[str] = []
    error_categories: List[str] = []
