from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import get_db
from app.exceptions import AppError
from app.features.ocr.channel_telemetry import EMAIL_CHANNEL, SCANNER_DEVICE_CHANNEL, TELEGRAM_CHANNEL, attach_channel_marker
from app.features.aws_textract.transport.http.router import router as aws_router
from app.features.azure.transport.http.router import router as azure_router
from app.features.google_vision.transport.http.router import router as google_router
from app.features.ocr.transport.http.router import router as ocr_router
from app.models.core import User
from app.models.integrations import DeviceOCRConfig, EmailOCRConfig, OCRJob, TelegramOCRConfig


def _build_test_client(db_session) -> TestClient:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def _app_error_handler(_request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(ocr_router)
    app.include_router(azure_router)
    app.include_router(google_router)
    app.include_router(aws_router)

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return User(
            id=1,
            username="admin",
            email="admin@test.local",
            role="ADMIN",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


def test_ocr_summary_returns_canonical_management_contract(db_session) -> None:
    now = datetime.now(timezone.utc)
    recent_job = OCRJob(
        id=str(uuid4()),
        status="COMPLETED",
        extracted_text="tamam",
        confidence=0.91,
        created_at=now,
        uploaded_by_id=1,
    )
    failed_job = OCRJob(
        id=str(uuid4()),
        status="FAILED",
        confidence=0.40,
        created_at=now - timedelta(days=2),
        error_message="provider timeout",
        notes=attach_channel_marker(None, EMAIL_CHANNEL),
    )
    db_session.add_all([recent_job, failed_job])
    db_session.commit()

    client = _build_test_client(db_session)
    response = client.get("/api/v1/ocr/summary")

    assert response.status_code == 200
    payload = response.json()

    assert payload["totalJobs"] == 2
    assert payload["successfulJobs"] == 1
    assert payload["failedJobs"] == 1
    assert payload["averageConfidence"] == 65.5
    assert payload["totalPagesProcessed"] is None
    assert payload["last24hJobs"] == 1
    assert payload["topLanguages"] == []
    assert payload["engineBreakdown"] == []
    assert payload["ordersCreated"] == 0
    assert payload["conversionRate"] == 0
    assert len(payload["recentJobs"]) == 2
    assert payload["recentJobs"][0]["source_channel"] == "MANUAL_UPLOAD"
    assert payload["recentJobs"][0]["source_label"] == "Manuel Upload"
    channel_map = {item["channelId"]: item for item in payload["channelBreakdown"]}
    assert channel_map["MANUAL_UPLOAD"]["totalJobs"] == 1
    assert channel_map["MANUAL_UPLOAD"]["status"] == "READY"
    assert channel_map["MANUAL_UPLOAD"]["lastAttemptedAt"] is not None
    assert channel_map["MANUAL_UPLOAD"]["telemetryStale"] is False
    assert channel_map["MANUAL_UPLOAD"]["riskReason"] == "WORKFLOW_INTERNAL"
    assert channel_map["EMAIL"]["failedJobs"] == 1
    assert channel_map["EMAIL"]["status"] == "ATTENTION"
    assert channel_map["EMAIL"]["telemetryAvailable"] is True
    assert channel_map["EMAIL"]["lastFailedAt"] is not None
    assert channel_map["EMAIL"]["riskReason"] == "CONFIG_MISSING"
    assert channel_map["SCANNER_DEVICE"]["configured"] is False
    assert channel_map["SCANNER_DEVICE"]["status"] == "DISABLED"
    assert channel_map["SCANNER_DEVICE"]["riskReason"] == "OUT_OF_SCOPE"
    assert channel_map["TELEGRAM"]["status"] == "DISABLED"


def test_ocr_summary_channel_breakdown_marks_external_channels_ready_when_configured(db_session) -> None:
    now = datetime.now(timezone.utc)
    db_session.add_all(
        [
            OCRJob(
                id=str(uuid4()),
                status="COMPLETED",
                created_at=now,
                confidence=0.88,
                notes=attach_channel_marker(None, SCANNER_DEVICE_CHANNEL),
            ),
            OCRJob(
                id=str(uuid4()),
                status="COMPLETED",
                created_at=now,
                confidence=0.77,
                notes=attach_channel_marker(None, TELEGRAM_CHANNEL),
            ),
            DeviceOCRConfig(key="device_api_key", value="scanner-secret"),
            TelegramOCRConfig(key="bot_token", value="token-1"),
            TelegramOCRConfig(key="webhook_secret", value="secret-1"),
        ]
    )
    db_session.commit()

    client = _build_test_client(db_session)
    payload = client.get("/api/v1/ocr/summary").json()
    channel_map = {item["channelId"]: item for item in payload["channelBreakdown"]}

    assert channel_map["SCANNER_DEVICE"]["configured"] is True
    assert channel_map["SCANNER_DEVICE"]["ready"] is True
    assert channel_map["SCANNER_DEVICE"]["status"] == "READY"
    assert channel_map["TELEGRAM"]["configured"] is True
    assert channel_map["TELEGRAM"]["status"] == "READY"


def test_ocr_summary_surfaces_persisted_channel_event_telemetry_even_without_jobs(db_session) -> None:
    now = datetime.now(timezone.utc)
    db_session.add_all(
        [
            EmailOCRConfig(key="imap_host", value="imap.test.local"),
            EmailOCRConfig(key="imap_user", value="ocr@test.local"),
            EmailOCRConfig(key="imap_pass", value="secret"),
            EmailOCRConfig(key="telemetry_last_attempted_at", value=now.isoformat()),
            EmailOCRConfig(key="telemetry_last_failed_at", value=now.isoformat()),
            EmailOCRConfig(key="telemetry_last_error_at", value=now.isoformat()),
            EmailOCRConfig(key="telemetry_last_error", value="imap auth failed"),
            EmailOCRConfig(key="telemetry_last_event", value="EMAIL_FETCH_NOW"),
            EmailOCRConfig(key="telemetry_last_event_status", value="FAILED"),
        ]
    )
    db_session.commit()

    client = _build_test_client(db_session)
    payload = client.get("/api/v1/ocr/summary").json()
    email_channel = {item["channelId"]: item for item in payload["channelBreakdown"]}["EMAIL"]

    assert email_channel["configured"] is True
    assert email_channel["telemetryAvailable"] is True
    assert email_channel["status"] == "ATTENTION"
    assert email_channel["lastAttemptedAt"] == now.isoformat()
    assert email_channel["lastFailedAt"] == now.isoformat()
    assert email_channel["lastErrorAt"] == now.isoformat()
    assert email_channel["lastEvent"] == "EMAIL_FETCH_NOW"
    assert email_channel["lastEventStatus"] == "FAILED"
    assert email_channel["lastError"] == "imap auth failed"
    assert email_channel["telemetryStale"] is False
    assert email_channel["riskReason"] == "LAST_EVENT_FAILED"


def test_ocr_summary_marks_probe_only_external_channel_as_attention_and_stale(db_session) -> None:
    now = datetime.now(timezone.utc)
    stale_probe = now - timedelta(days=2)
    db_session.add_all(
        [
            TelegramOCRConfig(key="bot_token", value="token-1"),
            TelegramOCRConfig(key="webhook_secret", value="secret-1"),
            TelegramOCRConfig(key="telemetry_last_attempted_at", value=stale_probe.isoformat()),
            TelegramOCRConfig(key="telemetry_last_successful_at", value=stale_probe.isoformat()),
            TelegramOCRConfig(key="telemetry_last_event", value="TELEGRAM_TEST"),
            TelegramOCRConfig(key="telemetry_last_event_status", value="SUCCESS"),
        ]
    )
    db_session.commit()

    client = _build_test_client(db_session)
    payload = client.get("/api/v1/ocr/summary").json()
    telegram_channel = {item["channelId"]: item for item in payload["channelBreakdown"]}["TELEGRAM"]

    assert telegram_channel["configured"] is True
    assert telegram_channel["status"] == "ATTENTION"
    assert telegram_channel["telemetryStale"] is True
    assert telegram_channel["telemetryAgeHours"] >= 48
    assert telegram_channel["riskLevel"] == "HIGH"
    assert telegram_channel["riskReason"] == "TELEMETRY_STALE"


def test_ocr_channel_telemetry_reset_clears_persisted_probe_keys_and_returns_channel_state(db_session) -> None:
    now = datetime.now(timezone.utc)
    db_session.add_all(
        [
            EmailOCRConfig(key="imap_host", value="imap.test.local"),
            EmailOCRConfig(key="imap_user", value="ocr@test.local"),
            EmailOCRConfig(key="imap_pass", value="secret"),
            EmailOCRConfig(key="telemetry_last_attempted_at", value=now.isoformat()),
            EmailOCRConfig(key="telemetry_last_successful_at", value=now.isoformat()),
            EmailOCRConfig(key="telemetry_last_event", value="IMAP_TEST"),
            EmailOCRConfig(key="telemetry_last_event_status", value="SUCCESS"),
        ]
    )
    db_session.commit()

    client = _build_test_client(db_session)
    response = client.post("/api/v1/ocr/summary/channels/EMAIL/reset-telemetry")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["channelId"] == "EMAIL"
    assert sorted(payload["clearedKeys"]) == [
        "telemetry_last_attempted_at",
        "telemetry_last_event",
        "telemetry_last_event_status",
        "telemetry_last_successful_at",
    ]
    assert payload["remainingJobEvidence"] is False
    assert payload["channel"]["telemetryAvailable"] is False
    assert payload["channel"]["lastEvent"] is None
    assert payload["channel"]["riskReason"] == "TELEMETRY_MISSING"
    assert payload["channel"]["status"] == "ATTENTION"

    remaining = (
        db_session.query(EmailOCRConfig)
        .filter(EmailOCRConfig.key.like("telemetry_%"))
        .all()
    )
    assert remaining == []


def test_provider_stats_routes_share_common_contract_and_do_not_fake_telemetry(db_session) -> None:
    client = _build_test_client(db_session)

    responses = {
        "azure": client.get("/api/v1/azure/stats"),
        "google": client.get("/api/v1/ocr/google/stats"),
        "aws": client.get("/api/v1/ocr/aws/stats"),
    }

    for service_id, response in responses.items():
        assert response.status_code == 200
        payload = response.json()
        assert payload["serviceId"] == service_id
        assert isinstance(payload["configured"], bool)
        assert payload["totalJobs"] is None
        assert payload["jobsThisMonth"] is None
        assert payload["successRate"] is None
        assert payload["avgConfidence"] is None
        assert "lastUsed" in payload
        assert payload["telemetryAvailable"] is False
        assert isinstance(payload["details"], dict)
