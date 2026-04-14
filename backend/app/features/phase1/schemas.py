"""
Phase 1-3 Pydantic DTO'ları — v2 spec sözleşmesi.
Tüm request / response şemaları burada tanımlanır.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.phase1_enums import (
    ApprovalStatus, AuditEventType, ErrorSeverity,
    FolderHealthStatus, MatchStatus, Phase1RecordStatus, SourceType,
)


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class OkResponse(BaseModel):
    ok: bool
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    ok: bool = False
    error_code: str
    message: str
    severity: ErrorSeverity = ErrorSeverity.WARNING
    details: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Phase 1 — Queue Record DTOs
# ---------------------------------------------------------------------------

class Phase1QueueRecordDto(BaseModel):
    """Kuyruk listesinde bir kayıt (özet)."""
    record_id: str
    uuid: str
    file_name: str
    source_type: str
    folder_type: str
    status: Phase1RecordStatus
    duplicate_flag: bool
    duplicate_reason: Optional[str] = None
    retry_count: int
    last_error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    next_retry_at: Optional[datetime] = None
    phase2_ready: bool

    model_config = ConfigDict(from_attributes=True)


class Phase1LifecycleEventDto(BaseModel):
    """Bir kayıt için yaşam döngüsü olayı."""
    from_status: Optional[str] = None
    to_status: str
    triggered_at: datetime
    triggered_by: str
    note: Optional[str] = None


class Phase1FolderHealthDto(BaseModel):
    """Bir klasörün sağlık durumu."""
    folder_type: str
    is_active: bool
    health_status: FolderHealthStatus
    last_scan_at: Optional[datetime] = None
    last_file_at: Optional[datetime] = None
    record_count: int = 0
    physical_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Phase1QueueDetailDto(BaseModel):
    """Tek kayıt detayı (detail drawer için)."""
    record: Phase1QueueRecordDto
    folder_health: Optional[Phase1FolderHealthDto] = None
    lifecycle: list[Phase1LifecycleEventDto] = Field(default_factory=list)


class Phase1QueueListResponse(BaseModel):
    """Kuyruk listesi paginated response."""
    items: list[Phase1QueueRecordDto]
    page: int
    page_size: int
    total: int


# ---------------------------------------------------------------------------
# Phase 1 — Error Records
# ---------------------------------------------------------------------------

class Phase1ErrorRecordDto(BaseModel):
    """Hata/retry bekleyen kayıt."""
    record_id: str
    file_name: str
    status: Phase1RecordStatus
    error_severity: Optional[ErrorSeverity] = None
    error_type: Optional[str] = None
    last_error_message: Optional[str] = None
    retry_count: int
    last_attempt_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Phase1ErrorListResponse(BaseModel):
    items: list[Phase1ErrorRecordDto]


# ---------------------------------------------------------------------------
# Phase 1 — Status Summary
# ---------------------------------------------------------------------------

class Phase1StatusSummaryDto(BaseModel):
    """Dashboard özeti — KPI kartlar için."""
    total_count: int
    duplicate_count: int
    retry_count: int
    error_count: int
    phase2_ready_count: int
    manual_review_count: int
    active_folder_count: int


# ---------------------------------------------------------------------------
# Phase 1 — Actions
# ---------------------------------------------------------------------------

class Phase1ManualRetryRequestDto(BaseModel):
    record_id: str


class Phase1ManualRetryResponseDto(BaseModel):
    ok: bool
    record_id: str
    status: Phase1RecordStatus
    message: str


class Phase1ManualRescanRequestDto(BaseModel):
    folder_type: str


class Phase1ManualRescanResponseDto(BaseModel):
    ok: bool
    folder_type: str
    message: str


# ---------------------------------------------------------------------------
# Phase 1 — Folder Health
# ---------------------------------------------------------------------------

class Phase1FolderHealthListResponse(BaseModel):
    items: list[Phase1FolderHealthDto]


# ---------------------------------------------------------------------------
# Phase 2 — Cell / Row DTOs
# ---------------------------------------------------------------------------

class BboxDto(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Phase2FieldDto(BaseModel):
    """Tek bir BOY/EN/ADET alanı."""
    field_name: str
    raw_value: Optional[str] = None
    normalized_value: Optional[str] = None
    confidence_score: Optional[int] = None
    bbox: Optional[BboxDto] = None
    approval_status: ApprovalStatus
    override_value: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Phase2RowDto(BaseModel):
    row_index: int
    fields: list[Phase2FieldDto]


class Phase2RecordDetailDto(BaseModel):
    """Phase 2 split-screen için tam kayıt detayı."""
    record_id: str
    status: Phase1RecordStatus
    source_type: str
    image_url: Optional[str] = None
    created_at: datetime
    blocker_count: int
    rows: list[Phase2RowDto]


# Phase 2 Actions
class Phase2ApproveRequest(BaseModel):
    row_index: int
    field_name: str
    mode: str = "APPROVE_AS_IS"  # APPROVE_AS_IS


class Phase2ApproveResponse(BaseModel):
    ok: bool
    row_index: int
    field_name: str
    approval_status: ApprovalStatus
    blocker_count: int


class Phase2OverrideRequest(BaseModel):
    row_index: int
    field_name: str
    override_value: str


class Phase2OverrideResponse(BaseModel):
    ok: bool
    row_index: int
    field_name: str
    approval_status: ApprovalStatus
    normalized_value: str
    blocker_count: int


class Phase2MarkFaultyRequest(BaseModel):
    note: Optional[str] = None


class Phase2MovePhase3Response(BaseModel):
    ok: bool
    record_id: str
    status: Optional[Phase1RecordStatus] = None
    error_code: Optional[str] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Phase 3 — Sipariş Kontrol DTOs
# ---------------------------------------------------------------------------

class Phase3OrderHeaderDto(BaseModel):
    """Phase 3 kayıt başlığı — müşteri ve kaynak bilgileri."""
    record_id: str
    customer_match_status: str
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    fire_aciklamasi: Optional[str] = None
    source_type: str
    operator_name: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Phase3OrderLineDto(BaseModel):
    """Phase 3 tek satır — stok eşleşme + ölçüler + fire durumu."""
    row_index: int
    plate_id: Optional[str] = None
    material_text: Optional[str] = None
    stock_match_status: str = "UNMATCHED"
    stock_code: Optional[str] = None
    boy: Optional[str] = None
    en: Optional[str] = None
    adet: Optional[int] = None
    yon: Optional[str] = None
    aciklama: Optional[str] = None
    bant_ust: Optional[str] = None
    bant_alt: Optional[str] = None
    bant_sol: Optional[str] = None
    bant_sag: Optional[str] = None
    ilave_aciklama: Optional[str] = None
    aciklama1: Optional[str] = None
    merge_candidate: bool = False
    scrap_note_required: bool = False
    scrap_note: Optional[str] = None
    status: str = "PENDING"

    model_config = ConfigDict(from_attributes=True)


class Phase3PlateGroupDto(BaseModel):
    """Plaka grubu özeti."""
    plate_id: str
    label: str
    line_count: int
    blocker_count: int
    active: bool = True


class Phase3SummaryDto(BaseModel):
    """Phase 3 blocker özeti — Phase 4 geçiş kararı için."""
    customer_blocker: bool
    stock_blocker_count: int
    merge_pending_count: int
    scrap_note_missing_count: int
    phase4_ready: bool


class Phase3RecordDetailDto(BaseModel):
    """Phase 3 tam kayıt detayı (spec §12)."""
    header: Phase3OrderHeaderDto
    plate_groups: list[Phase3PlateGroupDto]
    lines: list[Phase3OrderLineDto]
    summary: Phase3SummaryDto


# Phase 3 Actions
class Phase3CustomerMatchRequest(BaseModel):
    record_id: str
    customer_code: str


class Phase3StockMatchRequest(BaseModel):
    record_id: str
    row_index: int
    stock_code: str


class Phase3MergeRowsRequest(BaseModel):
    record_id: str
    row_indexes: list[int]


class Phase3ScrapNoteRequest(BaseModel):
    record_id: str
    note: str = Field(..., min_length=1)

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class Phase3CustomerMatchResponse(BaseModel):
    ok: bool
    record_id: str
    customer_code: str
    customer_name: Optional[str] = None
    customer_match_status: MatchStatus


class Phase3StockMatchResponse(BaseModel):
    ok: bool
    record_id: str
    row_index: int
    stock_code: str
    stock_match_status: MatchStatus
    unmatched_count: int


class Phase3MergeRowsResponse(BaseModel):
    ok: bool
    record_id: str
    target_row_index: int
    merged_row_indexes: list[int]
    total_adet: int


class Phase3ScrapNoteResponse(BaseModel):
    ok: bool
    record_id: str
    note: str
    affected_row_count: int
    scrap_note_required: bool = True


class Phase3MovePhase4Request(BaseModel):
    record_id: str


class Phase3MovePhase4Response(BaseModel):
    ok: bool
    record_id: str
    status: Optional[Phase1RecordStatus] = None
    error_code: Optional[str] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Phase 4 — Export DTOs
# ---------------------------------------------------------------------------

class Phase4PreviewResponse(BaseModel):
    ok: bool
    record_id: str
    status: Optional[Phase1RecordStatus] = None
    preview_data: Optional[dict[str, Any]] = None
    error_code: Optional[str] = None
    message: Optional[str] = None


class Phase4ExportResponse(BaseModel):
    ok: bool
    record_id: str
    status: Optional[Phase1RecordStatus] = None
    export_path: Optional[str] = None
    manifest_path: Optional[str] = None
    manifest_id: Optional[str] = None
    output_file_name: Optional[str] = None
    error_code: Optional[str] = None
    message: Optional[str] = None


class Phase4QueueItemDto(BaseModel):
    record_id: str
    status: Phase1RecordStatus
    customer_code: Optional[str] = None
    document_name: str
    export_type: Literal["XLSX"] = "XLSX"
    manifest_id: Optional[str] = None
    retry_count: int
    last_error_message: Optional[str] = None
    fire_required: bool
    updated_at: datetime


class Phase4QueueListResponse(BaseModel):
    items: list[Phase4QueueItemDto]


class Phase4RecordDto(BaseModel):
    record_id: str
    status: Phase1RecordStatus
    customer_code: Optional[str] = None
    export_type: Literal["XLSX"] = "XLSX"
    output_file_name: Optional[str] = None
    preview_ready: bool
    manifest_id: Optional[str] = None
    retry_count: int
    last_error_message: Optional[str] = None
    fire_required: bool
    phase4_ready: bool


class Phase4MappingSummaryDto(BaseModel):
    locked: bool = True
    profile_name: str


class Phase4FolderHealthSummaryDto(BaseModel):
    output_folder_status: FolderHealthStatus
    preview_folder_status: FolderHealthStatus
    manifest_archive_status: FolderHealthStatus
    last_write_at: Optional[datetime] = None


class Phase4RecordDetailDto(BaseModel):
    record: Phase4RecordDto
    mapping_summary: Phase4MappingSummaryDto
    folder_health: Phase4FolderHealthSummaryDto


class Phase4ManifestItemDto(BaseModel):
    manifest_id: str
    record_id: str
    export_type: Literal["XLSX"] = "XLSX"
    file_name: str
    created_at: datetime
    status: Literal["CREATED"] = "CREATED"


class Phase4ManifestListResponse(BaseModel):
    items: list[Phase4ManifestItemDto]


class Phase4FolderHealthItemDto(BaseModel):
    folder_type: str
    health_status: FolderHealthStatus
    last_write_at: Optional[datetime] = None


class Phase4FolderHealthListResponse(BaseModel):
    items: list[Phase4FolderHealthItemDto]


class Phase4RecordActionRequest(BaseModel):
    record_id: str


class Phase4RetryRequest(BaseModel):
    record_id: str
    decision: Literal["RETRY_NOW"]
