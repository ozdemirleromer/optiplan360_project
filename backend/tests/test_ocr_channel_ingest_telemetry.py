from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks
from starlette.requests import Request

from app.exceptions import AuthenticationError
from app.features.email_ocr.transport.http import router as email_router
from app.features.scanner_device.transport.http import router as scanner_router
from app.models.integrations import DeviceOCRConfig, EmailOCRConfig


class _FakeImapConnection:
    def login(self, _user: str, _pwd: str):
        return "OK"

    def select(self, _mailbox: str):
        return "OK", []

    def logout(self):
        return "BYE", []


def test_email_imap_probe_persists_success_telemetry(db_session, monkeypatch) -> None:
    db_session.add_all(
        [
            EmailOCRConfig(key="imap_host", value="imap.test.local"),
            EmailOCRConfig(key="imap_port", value="993"),
            EmailOCRConfig(key="imap_user", value="ocr@test.local"),
            EmailOCRConfig(key="imap_pass", value="secret"),
            EmailOCRConfig(key="imap_mailbox", value="INBOX"),
        ]
    )
    db_session.commit()
    monkeypatch.setattr(email_router.imaplib, "IMAP4_SSL", lambda *_args, **_kwargs: _FakeImapConnection())

    result = email_router.test_imap(db=db_session, _user=SimpleNamespace(id=1))

    telemetry = {
        row.key: row.value
        for row in db_session.query(EmailOCRConfig).filter(EmailOCRConfig.key.like("telemetry_%")).all()
    }
    assert result.success is True
    assert telemetry["telemetry_last_event"] == "IMAP_TEST"
    assert telemetry["telemetry_last_event_status"] == "SUCCESS"
    assert telemetry["telemetry_last_attempted_at"] == telemetry["telemetry_last_successful_at"]


def test_email_fetch_failure_persists_failed_channel_event(db_session, monkeypatch) -> None:
    db_session.add_all(
        [
            EmailOCRConfig(key="imap_host", value="imap.test.local"),
            EmailOCRConfig(key="imap_port", value="993"),
            EmailOCRConfig(key="imap_user", value="ocr@test.local"),
            EmailOCRConfig(key="imap_pass", value="secret"),
            EmailOCRConfig(key="imap_mailbox", value="INBOX"),
        ]
    )
    db_session.commit()

    def _raise_connection_error(*_args, **_kwargs):
        raise RuntimeError("socket down")

    monkeypatch.setattr(email_router.imaplib, "IMAP4_SSL", _raise_connection_error)

    result = email_router.fetch_now(
        background_tasks=BackgroundTasks(),
        limit=5,
        db=db_session,
        current_user=SimpleNamespace(id=1),
    )

    telemetry = {
        row.key: row.value
        for row in db_session.query(EmailOCRConfig).filter(EmailOCRConfig.key.like("telemetry_%")).all()
    }
    assert result.success is False
    assert telemetry["telemetry_last_event"] == "EMAIL_FETCH_NOW"
    assert telemetry["telemetry_last_event_status"] == "FAILED"
    assert telemetry["telemetry_last_error"] == "socket down"


def test_device_key_failure_persists_failed_ingest_telemetry(db_session) -> None:
    attempted_at = datetime.now(timezone.utc)
    db_session.add(DeviceOCRConfig(key="device_api_key", value="expected-secret"))
    db_session.commit()

    request = Request(
        {
            "type": "http",
            "headers": [(b"x-device-api-key", b"wrong-secret")],
        }
    )

    with pytest.raises(AuthenticationError):
        scanner_router._require_device_key(request, db_session, attempted_at)

    telemetry = {
        row.key: row.value
        for row in db_session.query(DeviceOCRConfig).filter(DeviceOCRConfig.key.like("telemetry_%")).all()
    }
    assert telemetry["telemetry_last_event"] == "DEVICE_INGEST"
    assert telemetry["telemetry_last_event_status"] == "FAILED"
    assert telemetry["telemetry_last_failed_at"] == attempted_at.astimezone(timezone.utc).isoformat()
    assert telemetry["telemetry_last_error"] == "Cihaz API key geçersiz"
