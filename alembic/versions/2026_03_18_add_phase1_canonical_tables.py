"""add phase1 canonical tables

Revision ID: phase1_canonical_v2
Revises: 2026_03_17_phase1_phase2_cols
Create Date: 2026-03-18 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "phase1_canonical_v2"
down_revision = "2026_03_17_phase1_phase2_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # phase1_records
    op.create_table(
        "phase1_records",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("record_id", sa.String(64), unique=True, nullable=False),
        sa.Column("uuid", sa.String(36), unique=True, nullable=False),
        # Dosya bilgileri
        sa.Column("file_name", sa.String(512), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("checksum", sa.String(128), nullable=True),
        sa.Column("image_path", sa.Text, nullable=True),
        # Kaynak
        sa.Column(
            "source_type",
            sa.Enum(
                "whatsapp_raw", "scanner_raw", "manuel_raw", "email_raw",
                name="sourcetype",
            ),
            nullable=False,
        ),
        sa.Column("folder_type", sa.String(64), nullable=False),
        # Durum (tam liste — tüm Phase1-4 durumları)
        sa.Column(
            "status",
            sa.Enum(
                "RECEIVED", "DUPLICATE", "PROCESSING", "OCR_PROCESSING",
                "PHASE2_PENDING", "OCR_RETRY_PENDING", "FAULTY",
                "MANUAL_REVIEW_REQUIRED", "PHASE2_IN_PROGRESS",
                "PHASE3_PENDING", "PHASE3_IN_PROGRESS",
                "PHASE4_PENDING", "PHASE4_PREVIEW_READY",
                "PHASE4_EXPORT_RUNNING", "PHASE4_EXPORT_FAILED",
                "PHASE4_RETRY_PENDING", "COMPLETED",
                name="phase1recordstatus",
            ),
            nullable=False,
            server_default="RECEIVED",
        ),
        # Duplicate
        sa.Column("duplicate_flag", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("duplicate_reason", sa.Text, nullable=True),
        # Retry
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_error_message", sa.Text, nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        # Hata
        sa.Column(
            "error_severity",
            sa.Enum("INFO", "WARNING", "RETRYABLE", "FATAL", name="errorseverity"),
            nullable=True,
        ),
        sa.Column("error_type", sa.String(128), nullable=True),
        # Phase geçiş flag'leri
        sa.Column("phase2_ready", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("phase3_ready", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("phase4_ready", sa.Boolean, nullable=False, server_default="false"),
        # Phase 3 — Müşteri eşleştirme
        sa.Column(
            "customer_match_status",
            sa.Enum("UNMATCHED", "MATCHED", "MANUAL_MATCHED", "BLOCKED", name="matchstatus"),
            nullable=False,
            server_default="UNMATCHED",
        ),
        sa.Column("customer_code", sa.String(128), nullable=True),
        sa.Column("customer_name", sa.String(512), nullable=True),
        # Phase 4 — Export bilgileri
        sa.Column("export_path", sa.Text, nullable=True),
        sa.Column("manifest_path", sa.Text, nullable=True),
        sa.Column("export_attempt_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_export_at", sa.DateTime(timezone=True), nullable=True),
        # Zaman damgaları
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_phase1_records_record_id", "phase1_records", ["record_id"])
    op.create_index("ix_phase1_records_status", "phase1_records", ["status"])
    op.create_index("ix_phase1_records_checksum", "phase1_records", ["checksum"])
    op.create_index("ix_phase1_records_source_type", "phase1_records", ["source_type"])
    op.create_index("ix_phase1_records_customer_code", "phase1_records", ["customer_code"])

    # phase1_row_fields
    op.create_table(
        "phase1_row_fields",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "record_id",
            sa.String(64),
            sa.ForeignKey("phase1_records.record_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("row_index", sa.Integer, nullable=False),
        sa.Column("field_name", sa.String(32), nullable=False),
        # OCR çıktısı
        sa.Column("raw_value", sa.String(256), nullable=True),
        sa.Column("normalized_value", sa.String(256), nullable=True),
        sa.Column("confidence_score", sa.Integer, nullable=True),
        sa.Column("bbox", sa.JSON, nullable=True),
        # Phase 2 — Operatör onay
        sa.Column(
            "approval_status",
            sa.Enum(
                "UNREVIEWED", "LOW_CONFIDENCE", "APPROVED_AS_IS", "OVERRIDDEN", "READ_ONLY",
                name="approvalstatus",
            ),
            nullable=False,
            server_default="UNREVIEWED",
        ),
        sa.Column("override_value", sa.String(256), nullable=True),
        sa.Column("approved_by", sa.String(128), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        # Phase 3 — Sipariş satır alanları
        sa.Column("plate_id", sa.String(64), nullable=True),
        sa.Column("material_text", sa.String(256), nullable=True),
        sa.Column(
            "stock_match_status",
            sa.Enum("UNMATCHED", "MATCHED", "MANUAL_MATCHED", "BLOCKED", name="matchstatus"),
            nullable=True,
        ),
        sa.Column("stock_code", sa.String(128), nullable=True),
        sa.Column("yon", sa.String(8), nullable=True),
        sa.Column("aciklama", sa.String(512), nullable=True),
        sa.Column("bant_ust", sa.String(32), nullable=True),
        sa.Column("bant_alt", sa.String(32), nullable=True),
        sa.Column("bant_sol", sa.String(32), nullable=True),
        sa.Column("bant_sag", sa.String(32), nullable=True),
        sa.Column("ilave_aciklama", sa.String(512), nullable=True),
        sa.Column("aciklama1", sa.String(512), nullable=True),
        sa.Column("merge_candidate", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("scrap_note_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("scrap_note", sa.Text, nullable=True),
        sa.UniqueConstraint("record_id", "row_index", "field_name", name="uq_phase1_row_field"),
    )
    op.create_index("ix_phase1_row_fields_record_id", "phase1_row_fields", ["record_id"])

    # phase1_folder_health
    op.create_table(
        "phase1_folder_health",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("folder_type", sa.String(64), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "health_status",
            sa.Enum("HEALTHY", "WARNING", "OFFLINE", "ERROR", name="folderhealthstatus"),
            nullable=False,
            server_default="HEALTHY",
        ),
        sa.Column("physical_path", sa.Text, nullable=True),
        sa.Column("last_scan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_file_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("record_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # phase1_audit
    op.create_table(
        "phase1_audit",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.String(64), unique=True, nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                # Phase 1 events
                "FILE_DETECTED", "DUPLICATE_DETECTED", "FILE_LOCKED",
                "FILE_MOVED_TO_PROCESSING", "PREPROCESS_STARTED",
                "PREPROCESS_COMPLETED", "OCR_REQUEST_STARTED",
                "OCR_REQUEST_COMPLETED", "OCR_PARSE_FAILED",
                "OCR_RETRY_SCHEDULED",
                # General
                "STATUS_CHANGED",
                # Phase 2 events
                "CELL_APPROVED", "CELL_OVERRIDDEN", "FAULTY_MARKED",
                # Phase 3 events
                "PHASE3_MOVE_ATTEMPTED", "PHASE3_MOVE_SUCCEEDED", "PHASE3_MOVE_REJECTED",
                "ERP_CUSTOMER_MATCHED", "ERP_STOCK_MATCHED",
                "ROWS_MERGED", "SCRAP_NOTE_ADDED",
                # Phase 4 events
                "PHASE4_PREVIEW_CREATED", "PHASE4_EXPORT_STARTED",
                "PHASE4_EXPORT_SUCCEEDED", "PHASE4_EXPORT_FAILED",
                "MANIFEST_CREATED", "RETRY_DECISION_TAKEN",
                name="auditeventtype",
            ),
            nullable=False,
        ),
        sa.Column(
            "record_id",
            sa.String(64),
            sa.ForeignKey("phase1_records.record_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("row_index", sa.Integer, nullable=True),
        sa.Column("field_name", sa.String(32), nullable=True),
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("actor_id", sa.String(128), nullable=False, server_default="system"),
        sa.Column(
            "actor_type",
            sa.Enum("human", "system", name="actortype"),
            nullable=False,
            server_default="system",
        ),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_phase1_audit_record_id", "phase1_audit", ["record_id"])
    op.create_index("ix_phase1_audit_event_type", "phase1_audit", ["event_type"])


def downgrade() -> None:
    op.drop_table("phase1_audit")
    op.drop_table("phase1_folder_health")
    op.drop_table("phase1_row_fields")
    op.drop_table("phase1_records")
    for enum_name in [
        "phase1recordstatus", "approvalstatus", "folderhealthstatus",
        "auditeventtype", "errorseverity", "sourcetype", "actortype",
        "matchstatus",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
