import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.phase1 import Phase1Audit, Phase1Record
from app.models.phase1_enums import (
    ActorType,
    AuditEventType,
    MatchStatus,
    Phase1RecordStatus,
    SourceType,
)


def test_phase1_record_status_enum_matches_master_spec_v3():
    assert [item.value for item in Phase1RecordStatus] == [
        "RECEIVED",
        "DUPLICATE",
        "PROCESSING",
        "OCR_PROCESSING",
        "PHASE2_PENDING",
        "OCR_RETRY_PENDING",
        "FAULTY",
        "MANUAL_REVIEW_REQUIRED",
        "PHASE2_IN_PROGRESS",
        "PHASE3_PENDING",
        "PHASE3_IN_PROGRESS",
        "PHASE4_PENDING",
        "PHASE4_PREVIEW_READY",
        "PHASE4_EXPORT_RUNNING",
        "PHASE4_EXPORT_FAILED",
        "PHASE4_RETRY_PENDING",
        "COMPLETED",
    ]


def test_match_status_enum_matches_master_spec_v3():
    assert [item.value for item in MatchStatus] == [
        "UNMATCHED",
        "MATCHED",
        "MANUAL_MATCHED",
        "BLOCKED",
    ]


def test_audit_event_type_enum_matches_master_spec_v3():
    assert [item.value for item in AuditEventType] == [
        "FILE_DETECTED",
        "DUPLICATE_DETECTED",
        "FILE_LOCKED",
        "FILE_MOVED_TO_PROCESSING",
        "PREPROCESS_STARTED",
        "PREPROCESS_COMPLETED",
        "OCR_REQUEST_STARTED",
        "OCR_REQUEST_COMPLETED",
        "OCR_PARSE_FAILED",
        "OCR_RETRY_SCHEDULED",
        "STATUS_CHANGED",
        "CELL_APPROVED",
        "CELL_OVERRIDDEN",
        "FAULTY_MARKED",
        "PHASE3_MOVE_ATTEMPTED",
        "PHASE3_MOVE_SUCCEEDED",
        "PHASE3_MOVE_REJECTED",
        "ERP_CUSTOMER_MATCHED",
        "ERP_STOCK_MATCHED",
        "ROWS_MERGED",
        "SCRAP_NOTE_ADDED",
        "PHASE4_PREVIEW_CREATED",
        "PHASE4_EXPORT_STARTED",
        "PHASE4_EXPORT_SUCCEEDED",
        "PHASE4_EXPORT_FAILED",
        "MANIFEST_CREATED",
        "RETRY_DECISION_TAKEN",
    ]


def test_phase1_models_accept_phase4_statuses_and_audit_events(db_session):
    record = Phase1Record(
        record_id="rec_0401",
        file_name="phase4-export.png",
        source_type=SourceType.SCANNER_RAW,
        folder_type=SourceType.SCANNER_RAW.value,
        status=Phase1RecordStatus.PHASE4_EXPORT_FAILED,
        phase2_ready=False,
    )
    db_session.add(record)
    db_session.flush()

    audit = Phase1Audit(
        event_type=AuditEventType.MANIFEST_CREATED,
        record_id=record.record_id,
        actor_id="system",
        actor_type=ActorType.SYSTEM,
        note="manifest created after preview",
    )
    db_session.add(audit)
    db_session.commit()

    stored_record = db_session.query(Phase1Record).filter_by(record_id=record.record_id).one()
    stored_audit = db_session.query(Phase1Audit).filter_by(record_id=record.record_id).one()

    assert stored_record.status == Phase1RecordStatus.PHASE4_EXPORT_FAILED
    assert stored_audit.event_type == AuditEventType.MANIFEST_CREATED
