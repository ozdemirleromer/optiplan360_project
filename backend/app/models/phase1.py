"""
Phase 1-4 ORM modelleri — canonical.
Tablolar mevcut optiplan_workflow_kayitlari ile çakışmaz; yeni canonical şema.
"""
import uuid as _uuid

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Enum as SAEnum,
    ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.phase1_enums import (
    ActorType, ApprovalStatus, AuditEventType,
    ErrorSeverity, FolderHealthStatus, MatchStatus,
    Phase1RecordStatus, SourceType,
)


def _new_uuid() -> str:
    return str(_uuid.uuid4())


class Phase1Record(Base):
    """Bir workflow kaydının tüm yaşam döngüsünü tutar (Phase 1-4)."""
    __tablename__ = "phase1_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(String(64), unique=True, nullable=False, index=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_new_uuid, index=True)

    # Dosya bilgileri
    file_name = Column(String(512), nullable=False, index=True)
    file_size = Column(Integer, nullable=True)
    checksum = Column(String(128), nullable=True, index=True)
    image_path = Column(Text, nullable=True)

    # Kaynak
    source_type = Column(SAEnum(SourceType), nullable=False, index=True)
    folder_type = Column(String(64), nullable=False, index=True)

    # Durum
    status = Column(
        SAEnum(Phase1RecordStatus),
        nullable=False,
        default=Phase1RecordStatus.RECEIVED,
        index=True,
    )

    # Duplicate
    duplicate_flag = Column(Boolean, nullable=False, default=False)
    duplicate_reason = Column(Text, nullable=True)

    # Retry
    retry_count = Column(Integer, nullable=False, default=0)
    last_error_message = Column(Text, nullable=True)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # Hata
    error_severity = Column(SAEnum(ErrorSeverity), nullable=True)
    error_type = Column(String(128), nullable=True)

    # Phase geçiş flag'leri
    phase2_ready = Column(Boolean, nullable=False, default=False)
    phase3_ready = Column(Boolean, nullable=False, default=False)
    phase4_ready = Column(Boolean, nullable=False, default=False)

    # Phase 3 — Müşteri eşleştirme
    customer_match_status = Column(
        SAEnum(MatchStatus),
        nullable=False,
        default=MatchStatus.UNMATCHED,
    )
    customer_code = Column(String(128), nullable=True, index=True)
    customer_name = Column(String(512), nullable=True)
    fire_aciklamasi = Column(Text, nullable=True)

    # Phase 4 — Export
    export_path = Column(Text, nullable=True)
    manifest_path = Column(Text, nullable=True)
    export_attempt_count = Column(Integer, nullable=False, default=0)
    last_export_at = Column(DateTime(timezone=True), nullable=True)

    # Zaman damgaları
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # İlişkiler
    row_fields = relationship(
        "Phase1RowField",
        back_populates="record",
        cascade="all, delete-orphan",
        order_by="Phase1RowField.row_index",
    )
    audits = relationship(
        "Phase1Audit",
        back_populates="record_rel",
        cascade="all, delete-orphan",
        order_by="Phase1Audit.created_at",
    )


class Phase1RowField(Base):
    """Phase 2-3 için satır + alan çifti."""
    __tablename__ = "phase1_row_fields"
    __table_args__ = (
        UniqueConstraint("record_id", "row_index", "field_name", name="uq_phase1_row_field"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(
        String(64), ForeignKey("phase1_records.record_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    row_index = Column(Integer, nullable=False)
    field_name = Column(String(32), nullable=False)  # BOY | EN | ADET

    # OCR çıktısı
    raw_value = Column(String(256), nullable=True)
    normalized_value = Column(String(256), nullable=True)
    confidence_score = Column(Integer, nullable=True)  # 0-100
    bbox = Column(JSON, nullable=True)  # {x, y, w, h}

    # Phase 2 — Operatör onay
    approval_status = Column(
        SAEnum(ApprovalStatus),
        nullable=False,
        default=ApprovalStatus.UNREVIEWED,
    )
    override_value = Column(String(256), nullable=True)
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Phase 3 — Sipariş satır alanları
    plate_id = Column(String(64), nullable=True)
    material_text = Column(String(256), nullable=True)
    stock_match_status = Column(SAEnum(MatchStatus), nullable=True, default=MatchStatus.UNMATCHED)
    stock_code = Column(String(128), nullable=True)
    yon = Column(String(8), nullable=True)
    aciklama = Column(String(512), nullable=True)
    bant_ust = Column(String(32), nullable=True)
    bant_alt = Column(String(32), nullable=True)
    bant_sol = Column(String(32), nullable=True)
    bant_sag = Column(String(32), nullable=True)
    ilave_aciklama = Column(String(512), nullable=True)
    aciklama1 = Column(String(512), nullable=True)
    merge_candidate = Column(Boolean, nullable=False, default=False)
    scrap_note_required = Column(Boolean, nullable=False, default=False)
    scrap_note = Column(Text, nullable=True)

    # İlişki
    record = relationship("Phase1Record", back_populates="row_fields")


class Phase1FolderHealth(Base):
    """Her kaynak klasörün sağlık durumu."""
    __tablename__ = "phase1_folder_health"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folder_type = Column(String(64), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    health_status = Column(
        SAEnum(FolderHealthStatus),
        nullable=False,
        default=FolderHealthStatus.HEALTHY,
    )
    physical_path = Column(Text, nullable=True)
    last_scan_at = Column(DateTime(timezone=True), nullable=True)
    last_file_at = Column(DateTime(timezone=True), nullable=True)
    record_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Phase1Audit(Base):
    """Tüm Phase 1-4 aksiyonlarının değişmez audit kaydı."""
    __tablename__ = "phase1_audit"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(64), unique=True, nullable=False, default=_new_uuid, index=True)
    event_type = Column(SAEnum(AuditEventType), nullable=False, index=True)

    record_id = Column(
        String(64),
        ForeignKey("phase1_records.record_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    row_index = Column(Integer, nullable=True)
    field_name = Column(String(32), nullable=True)

    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    actor_id = Column(String(128), nullable=False, default="system")
    actor_type = Column(SAEnum(ActorType), nullable=False, default=ActorType.SYSTEM)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    record_rel = relationship("Phase1Record", back_populates="audits", foreign_keys=[record_id])
