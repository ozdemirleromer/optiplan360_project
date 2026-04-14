from datetime import datetime, timezone
from uuid import uuid4

from app.features.ocr.channel_telemetry import (
    EMAIL_CHANNEL,
    MANUAL_UPLOAD_CHANNEL,
    SCANNER_DEVICE_CHANNEL,
    TELEGRAM_CHANNEL,
    attach_channel_marker,
    build_channel_breakdown,
    infer_job_channel,
    strip_channel_marker,
)
from app.models.integrations import DeviceOCRConfig, EmailOCRConfig, OCRJob, TelegramOCRConfig


def test_attach_channel_marker_replaces_previous_marker() -> None:
    notes = attach_channel_marker("operator note", EMAIL_CHANNEL)
    assert notes.endswith("[ocr-channel:EMAIL]")
    assert strip_channel_marker(notes) == "operator note"

    updated = attach_channel_marker(notes, TELEGRAM_CHANNEL)
    assert updated.endswith("[ocr-channel:TELEGRAM]")
    assert updated.count("[ocr-channel:") == 1
    assert strip_channel_marker(updated) == "operator note"


def test_infer_job_channel_prefers_explicit_marker() -> None:
    job = OCRJob(
        id=str(uuid4()),
        status="PENDING",
        original_filename="telegram_upload",
        notes=attach_channel_marker(None, SCANNER_DEVICE_CHANNEL),
    )

    assert infer_job_channel(job) == SCANNER_DEVICE_CHANNEL


def test_build_channel_breakdown_uses_configured_flags_and_job_health(db_session) -> None:
    now = datetime(2026, 3, 13, 9, 0, tzinfo=timezone.utc)
    db_session.add_all(
        [
            DeviceOCRConfig(key="device_api_key", value="scanner-key"),
            EmailOCRConfig(key="imap_host", value="imap.example.com"),
            EmailOCRConfig(key="imap_user", value="ocr@example.com"),
            EmailOCRConfig(key="imap_pass", value="secret"),
            OCRJob(
                id=str(uuid4()),
                status="COMPLETED",
                created_at=now,
                uploaded_by_id=1,
            ),
            OCRJob(
                id=str(uuid4()),
                status="FAILED",
                created_at=now,
                error_message="scanner offline",
                notes=attach_channel_marker(None, SCANNER_DEVICE_CHANNEL),
            ),
            OCRJob(
                id=str(uuid4()),
                status="COMPLETED",
                created_at=now,
                notes=attach_channel_marker(None, EMAIL_CHANNEL),
            ),
        ]
    )
    db_session.commit()

    breakdown = build_channel_breakdown(db_session, db_session.query(OCRJob).all(), now=now)
    channel_map = {item["channelId"]: item for item in breakdown}

    assert channel_map[MANUAL_UPLOAD_CHANNEL]["status"] == "READY"
    assert channel_map[MANUAL_UPLOAD_CHANNEL]["totalJobs"] == 1
    assert channel_map[SCANNER_DEVICE_CHANNEL]["configured"] is True
    assert channel_map[SCANNER_DEVICE_CHANNEL]["failedJobs"] == 1
    assert channel_map[SCANNER_DEVICE_CHANNEL]["status"] == "ATTENTION"
    assert channel_map[SCANNER_DEVICE_CHANNEL]["riskLevel"] == "HIGH"
    assert channel_map[EMAIL_CHANNEL]["configured"] is True
    assert channel_map[EMAIL_CHANNEL]["status"] == "READY"
    assert channel_map[TELEGRAM_CHANNEL]["configured"] is False
    assert channel_map[TELEGRAM_CHANNEL]["status"] == "DISABLED"
