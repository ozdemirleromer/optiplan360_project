from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.models import DeviceOCRConfig, EmailOCRConfig, OCRJob, TelegramOCRConfig

MANUAL_UPLOAD_CHANNEL = "MANUAL_UPLOAD"
SCANNER_DEVICE_CHANNEL = "SCANNER_DEVICE"
EMAIL_CHANNEL = "EMAIL"
TELEGRAM_CHANNEL = "TELEGRAM"

OCR_CHANNEL_ORDER = (
    MANUAL_UPLOAD_CHANNEL,
    SCANNER_DEVICE_CHANNEL,
    EMAIL_CHANNEL,
    TELEGRAM_CHANNEL,
)

OCR_CHANNEL_LABELS = {
    MANUAL_UPLOAD_CHANNEL: "Manuel Upload",
    SCANNER_DEVICE_CHANNEL: "Scanner / Cihaz",
    EMAIL_CHANNEL: "Email OCR",
    TELEGRAM_CHANNEL: "Telegram OCR",
}

TELEMETRY_STALE_AFTER = timedelta(hours=24)

_CHANNEL_MARKER_PREFIX = "[ocr-channel:"
_CHANNEL_MARKER_SUFFIX = "]"

_CHANNEL_CONFIG_MODELS = {
    SCANNER_DEVICE_CHANNEL: DeviceOCRConfig,
    EMAIL_CHANNEL: EmailOCRConfig,
    TELEGRAM_CHANNEL: TelegramOCRConfig,
}

_CHANNEL_TELEMETRY_KEYS = {
    "last_attempted_at": "telemetry_last_attempted_at",
    "last_successful_at": "telemetry_last_successful_at",
    "last_failed_at": "telemetry_last_failed_at",
    "last_error_at": "telemetry_last_error_at",
    "last_ingested_at": "telemetry_last_ingested_at",
    "last_job_id": "telemetry_last_job_id",
    "last_event": "telemetry_last_event",
    "last_event_status": "telemetry_last_event_status",
    "last_error": "telemetry_last_error",
}


@dataclass(frozen=True)
class OCRChannelTelemetryState:
    last_attempted_at: datetime | None = None
    last_successful_at: datetime | None = None
    last_failed_at: datetime | None = None
    last_error_at: datetime | None = None
    last_ingested_at: datetime | None = None
    last_job_id: str | None = None
    last_event: str | None = None
    last_event_status: str | None = None
    last_error: str | None = None

    @property
    def available(self) -> bool:
        return any(
            (
                self.last_attempted_at,
                self.last_successful_at,
                self.last_failed_at,
                self.last_error_at,
                self.last_ingested_at,
                self.last_job_id,
                self.last_event,
                self.last_event_status,
                self.last_error,
            )
        )


def attach_channel_marker(notes: str | None, channel_id: str) -> str:
    clean_notes = strip_channel_marker(notes)
    marker = f"{_CHANNEL_MARKER_PREFIX}{channel_id}{_CHANNEL_MARKER_SUFFIX}"
    if clean_notes:
        return f"{clean_notes}\n{marker}"
    return marker


def strip_channel_marker(notes: str | None) -> str:
    if not notes:
        return ""
    lines = []
    for raw_line in notes.splitlines():
        line = raw_line.strip()
        if line.startswith(_CHANNEL_MARKER_PREFIX) and line.endswith(_CHANNEL_MARKER_SUFFIX):
            continue
        if line:
            lines.append(raw_line.rstrip())
    return "\n".join(lines).strip()


def extract_channel_marker(notes: str | None) -> str | None:
    if not notes:
        return None
    for raw_line in notes.splitlines():
        line = raw_line.strip()
        if line.startswith(_CHANNEL_MARKER_PREFIX) and line.endswith(_CHANNEL_MARKER_SUFFIX):
            channel_id = line[len(_CHANNEL_MARKER_PREFIX) : -len(_CHANNEL_MARKER_SUFFIX)].strip().upper()
            if channel_id in OCR_CHANNEL_LABELS:
                return channel_id
    return None


def get_channel_label(channel_id: str) -> str:
    return OCR_CHANNEL_LABELS.get(channel_id, channel_id)


def read_channel_telemetry(db: Session, channel_id: str) -> OCRChannelTelemetryState:
    model = _CHANNEL_CONFIG_MODELS.get(channel_id)
    if model is None:
        return OCRChannelTelemetryState()

    keys = tuple(_CHANNEL_TELEMETRY_KEYS.values())
    rows = db.query(model).filter(model.key.in_(keys)).all()
    values = {row.key: (row.value or "").strip() for row in rows}
    return OCRChannelTelemetryState(
        last_attempted_at=_parse_dt(values.get(_CHANNEL_TELEMETRY_KEYS["last_attempted_at"])),
        last_successful_at=_parse_dt(values.get(_CHANNEL_TELEMETRY_KEYS["last_successful_at"])),
        last_failed_at=_parse_dt(values.get(_CHANNEL_TELEMETRY_KEYS["last_failed_at"])),
        last_error_at=_parse_dt(values.get(_CHANNEL_TELEMETRY_KEYS["last_error_at"])),
        last_ingested_at=_parse_dt(values.get(_CHANNEL_TELEMETRY_KEYS["last_ingested_at"])),
        last_job_id=values.get(_CHANNEL_TELEMETRY_KEYS["last_job_id"]) or None,
        last_event=values.get(_CHANNEL_TELEMETRY_KEYS["last_event"]) or None,
        last_event_status=values.get(_CHANNEL_TELEMETRY_KEYS["last_event_status"]) or None,
        last_error=values.get(_CHANNEL_TELEMETRY_KEYS["last_error"]) or None,
    )


def clear_channel_telemetry(db: Session, channel_id: str) -> list[str]:
    model = _CHANNEL_CONFIG_MODELS.get(channel_id)
    if model is None:
        return []

    rows = db.query(model).filter(model.key.in_(tuple(_CHANNEL_TELEMETRY_KEYS.values()))).all()
    cleared_keys: list[str] = []
    for row in rows:
        cleared_keys.append(row.key)
        db.delete(row)
    return cleared_keys


def record_channel_event(
    db: Session,
    channel_id: str,
    *,
    event: str,
    status: str,
    when: datetime | None = None,
    job_id: str | None = None,
    error: str | None = None,
) -> None:
    model = _CHANNEL_CONFIG_MODELS.get(channel_id)
    if model is None:
        return

    occurred_at = _normalize_dt(when or datetime.now(timezone.utc))
    normalized_status = (status or "").strip().upper() or "SUCCESS"
    updates = {
        _CHANNEL_TELEMETRY_KEYS["last_attempted_at"]: occurred_at.isoformat(),
        _CHANNEL_TELEMETRY_KEYS["last_event"]: event.strip(),
        _CHANNEL_TELEMETRY_KEYS["last_event_status"]: normalized_status,
    }
    if normalized_status == "SUCCESS":
        updates[_CHANNEL_TELEMETRY_KEYS["last_successful_at"]] = occurred_at.isoformat()
        if job_id:
            updates[_CHANNEL_TELEMETRY_KEYS["last_job_id"]] = job_id
            updates[_CHANNEL_TELEMETRY_KEYS["last_ingested_at"]] = occurred_at.isoformat()
    elif normalized_status == "FAILED":
        updates[_CHANNEL_TELEMETRY_KEYS["last_failed_at"]] = occurred_at.isoformat()
        updates[_CHANNEL_TELEMETRY_KEYS["last_error_at"]] = occurred_at.isoformat()
        if error is not None:
            updates[_CHANNEL_TELEMETRY_KEYS["last_error"]] = str(error).strip()

    for key, value in updates.items():
        _set_channel_kv(db, model, key, value)


def infer_job_channel(job: OCRJob) -> str:
    explicit_marker = extract_channel_marker(job.notes)
    if explicit_marker:
        return explicit_marker

    original_filename = (job.original_filename or "").strip().lower()
    if original_filename.startswith("email_attachment_"):
        return EMAIL_CHANNEL
    if original_filename == "telegram_upload":
        return TELEGRAM_CHANNEL
    if job.uploaded_by_id is None:
        return SCANNER_DEVICE_CHANNEL
    return MANUAL_UPLOAD_CHANNEL


def build_channel_breakdown(
    db: Session,
    jobs: Iterable[OCRJob],
    *,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    reference_now = now or datetime.now(timezone.utc)
    last_24h_since = reference_now - timedelta(hours=24)
    jobs_by_channel: dict[str, list[OCRJob]] = {channel_id: [] for channel_id in OCR_CHANNEL_ORDER}

    for job in jobs:
        channel_id = infer_job_channel(job)
        jobs_by_channel.setdefault(channel_id, []).append(job)

    breakdown: list[dict[str, Any]] = []
    for channel_id in OCR_CHANNEL_ORDER:
        channel_jobs = sorted(
            jobs_by_channel.get(channel_id, []),
            key=lambda job: job.created_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        total_jobs = len(channel_jobs)
        successful_jobs = sum(1 for job in channel_jobs if job.status in {"COMPLETED", "ORDER_CREATED"})
        failed_jobs = sum(1 for job in channel_jobs if job.status == "FAILED")
        processed_jobs = successful_jobs + failed_jobs
        channel_telemetry = read_channel_telemetry(db, channel_id)
        last_24h_jobs = sum(
            1
            for job in channel_jobs
            if job.created_at and _normalize_dt(job.created_at) >= last_24h_since
        )
        last_ingested_job = next((job for job in channel_jobs if job.created_at is not None), None)
        last_failed_job = next(
            (job for job in channel_jobs if job.status == "FAILED" and (job.error_message or "").strip()),
            None,
        )
        last_successful_job = next(
            (job for job in channel_jobs if job.created_at is not None and job.status in {"COMPLETED", "ORDER_CREATED"}),
            None,
        )
        last_job_created_at = (
            _normalize_dt(last_ingested_job.created_at)
            if last_ingested_job and last_ingested_job.created_at
            else None
        )
        last_successful_job_at = (
            _normalize_dt(last_successful_job.created_at)
            if last_successful_job and last_successful_job.created_at
            else None
        )
        last_failed_job_at = (
            _normalize_dt(last_failed_job.created_at)
            if last_failed_job and last_failed_job.created_at
            else None
        )
        merged_last_error, merged_last_error_at = _resolve_last_error(
            channel_error=channel_telemetry.last_error,
            channel_error_at=channel_telemetry.last_error_at or channel_telemetry.last_failed_at,
            job_error=last_failed_job.error_message if last_failed_job else None,
            job_error_at=last_failed_job_at,
        )
        last_attempted_at = _max_dt(channel_telemetry.last_attempted_at, last_job_created_at)
        last_successful_at = _max_dt(
            channel_telemetry.last_successful_at,
            channel_telemetry.last_ingested_at,
            last_successful_job_at,
        )
        last_failed_at = _max_dt(channel_telemetry.last_failed_at, last_failed_job_at)
        last_ingested_at = _max_dt(channel_telemetry.last_ingested_at, last_job_created_at)
        configured = _is_channel_configured(db, channel_id)
        ready = True if channel_id == MANUAL_UPLOAD_CHANNEL else configured
        telemetry_available = total_jobs > 0 or channel_telemetry.available
        success_rate = round((successful_jobs / processed_jobs) * 100, 2) if processed_jobs > 0 else None
        last_signal_at = _max_dt(
            last_attempted_at,
            last_successful_at,
            last_failed_at,
            last_ingested_at,
            merged_last_error_at,
        )
        telemetry_stale = _is_channel_telemetry_stale(
            channel_id=channel_id,
            configured=configured,
            last_signal_at=last_signal_at,
            now=reference_now,
        )
        status = _resolve_channel_status(
            channel_id=channel_id,
            configured=configured,
            telemetry_available=telemetry_available,
            telemetry_stale=telemetry_stale,
            total_jobs=total_jobs,
            failed_jobs=failed_jobs,
            success_rate=success_rate,
            last_failed_at=last_failed_at,
            last_successful_at=last_successful_at,
        )
        risk_reason = _resolve_channel_risk_reason(
            channel_id=channel_id,
            configured=configured,
            telemetry_available=telemetry_available,
            telemetry_stale=telemetry_stale,
            total_jobs=total_jobs,
            failed_jobs=failed_jobs,
            success_rate=success_rate,
            last_failed_at=last_failed_at,
            last_successful_at=last_successful_at,
        )
        breakdown.append(
            {
                "channelId": channel_id,
                "label": get_channel_label(channel_id),
                "external": channel_id != MANUAL_UPLOAD_CHANNEL,
                "configured": configured,
                "ready": ready,
                "telemetryAvailable": telemetry_available,
                "totalJobs": total_jobs,
                "successfulJobs": successful_jobs,
                "failedJobs": failed_jobs,
                "last24hJobs": last_24h_jobs,
                "successRate": success_rate,
                "lastAttemptedAt": last_attempted_at.isoformat() if last_attempted_at else None,
                "lastSuccessfulAt": last_successful_at.isoformat() if last_successful_at else None,
                "lastFailedAt": last_failed_at.isoformat() if last_failed_at else None,
                "lastErrorAt": merged_last_error_at.isoformat() if merged_last_error_at else None,
                "lastIngestedAt": last_ingested_at.isoformat() if last_ingested_at else None,
                "lastSignalAt": last_signal_at.isoformat() if last_signal_at else None,
                "lastJobId": channel_telemetry.last_job_id or (last_ingested_job.id if last_ingested_job else None),
                "lastEvent": channel_telemetry.last_event,
                "lastEventStatus": channel_telemetry.last_event_status,
                "lastError": merged_last_error,
                "telemetryStale": telemetry_stale,
                "telemetryAgeHours": _calculate_telemetry_age_hours(last_signal_at, reference_now),
                "riskLevel": _resolve_channel_risk_level(risk_reason),
                "riskReason": risk_reason,
                "status": status,
            }
        )

    return breakdown


def _is_channel_configured(db: Session, channel_id: str) -> bool:
    if channel_id == MANUAL_UPLOAD_CHANNEL:
        return True
    if channel_id == SCANNER_DEVICE_CHANNEL:
        return _has_non_empty_config(db, DeviceOCRConfig, ("device_api_key",))
    if channel_id == EMAIL_CHANNEL:
        return _has_non_empty_config(db, EmailOCRConfig, ("imap_host", "imap_user", "imap_pass"))
    if channel_id == TELEGRAM_CHANNEL:
        return _has_non_empty_config(db, TelegramOCRConfig, ("bot_token", "webhook_secret"))
    return False


def _has_non_empty_config(db: Session, model: type, keys: tuple[str, ...]) -> bool:
    rows = (
        db.query(model)
        .filter(model.key.in_(keys))
        .all()
    )
    values = {row.key: (row.value or "").strip() for row in rows}
    return all(values.get(key) for key in keys)


def _resolve_channel_status(
    *,
    channel_id: str,
    configured: bool,
    telemetry_available: bool,
    telemetry_stale: bool,
    total_jobs: int,
    failed_jobs: int,
    success_rate: float | None,
    last_failed_at: datetime | None = None,
    last_successful_at: datetime | None = None,
) -> str:
    if channel_id != MANUAL_UPLOAD_CHANNEL and not configured and not telemetry_available:
        return "DISABLED"
    if channel_id != MANUAL_UPLOAD_CHANNEL and not configured:
        return "ATTENTION"
    if not telemetry_available:
        return "ATTENTION" if channel_id != MANUAL_UPLOAD_CHANNEL else "READY"
    if telemetry_stale:
        return "ATTENTION"
    if channel_id != MANUAL_UPLOAD_CHANNEL and total_jobs == 0 and last_successful_at is not None:
        return "ATTENTION"
    if last_failed_at and (last_successful_at is None or last_failed_at >= last_successful_at):
        return "ATTENTION"
    if failed_jobs > 0 and (success_rate is None or success_rate < 80):
        return "ATTENTION"
    return "READY"


def _resolve_channel_risk_level(risk_reason: str) -> str:
    if risk_reason in {
        "CONFIG_MISSING",
        "TELEMETRY_MISSING",
        "TELEMETRY_STALE",
        "LAST_EVENT_FAILED",
        "LOW_SUCCESS_RATE",
    }:
        return "HIGH"
    if risk_reason == "PROBE_ONLY":
        return "MEDIUM"
    return "LOW"


def _resolve_channel_risk_reason(
    *,
    channel_id: str,
    configured: bool,
    telemetry_available: bool,
    telemetry_stale: bool,
    total_jobs: int,
    failed_jobs: int,
    success_rate: float | None,
    last_failed_at: datetime | None,
    last_successful_at: datetime | None,
) -> str:
    if channel_id == MANUAL_UPLOAD_CHANNEL:
        return "WORKFLOW_INTERNAL"
    if not configured and not telemetry_available:
        return "OUT_OF_SCOPE"
    if not configured:
        return "CONFIG_MISSING"
    if not telemetry_available:
        return "TELEMETRY_MISSING"
    if telemetry_stale:
        return "TELEMETRY_STALE"
    if total_jobs == 0 and last_successful_at is not None:
        return "PROBE_ONLY"
    if last_failed_at and (last_successful_at is None or last_failed_at >= last_successful_at):
        return "LAST_EVENT_FAILED"
    if failed_jobs > 0 and (success_rate is None or success_rate < 80):
        return "LOW_SUCCESS_RATE"
    return "HEALTHY"


def _is_channel_telemetry_stale(
    *,
    channel_id: str,
    configured: bool,
    last_signal_at: datetime | None,
    now: datetime,
) -> bool:
    if channel_id == MANUAL_UPLOAD_CHANNEL or not configured or last_signal_at is None:
        return False
    return (now - last_signal_at) > TELEMETRY_STALE_AFTER


def _calculate_telemetry_age_hours(last_signal_at: datetime | None, now: datetime) -> float | None:
    if last_signal_at is None:
        return None
    delta = now - last_signal_at
    if delta.total_seconds() < 0:
        return 0.0
    return round(delta.total_seconds() / 3600, 1)


def _normalize_dt(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return _normalize_dt(datetime.fromisoformat(value))
    except ValueError:
        return None


def _set_channel_kv(db: Session, model: type, key: str, value: str) -> None:
    row = db.query(model).filter(model.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.now(timezone.utc)
        return
    db.add(model(key=key, value=value, updated_at=datetime.now(timezone.utc)))


def _max_dt(*values: datetime | None) -> datetime | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return max(present)


def _resolve_last_error(
    *,
    channel_error: str | None,
    channel_error_at: datetime | None,
    job_error: str | None,
    job_error_at: datetime | None,
) -> tuple[str | None, datetime | None]:
    candidates: list[tuple[datetime, str]] = []
    if channel_error_at and channel_error:
        candidates.append((channel_error_at, channel_error))
    if job_error_at and job_error:
        candidates.append((job_error_at, job_error))
    if not candidates:
        return None, None
    latest_at, latest_error = max(candidates, key=lambda item: item[0])
    return latest_error, latest_at
