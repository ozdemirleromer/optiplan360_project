from datetime import datetime, timedelta, timezone

import pytest

from app.services import optiplan_worker_service as worker_module


@pytest.fixture(autouse=True)
def reset_circuit_breaker_state(monkeypatch):
    monkeypatch.setattr(worker_module, "_consecutive_failures", 0)
    monkeypatch.setattr(worker_module, "_circuit_state", worker_module.CIRCUIT_STATE_CLOSED)
    monkeypatch.setattr(worker_module, "_circuit_opened_at", None)
    monkeypatch.setattr(worker_module, "_half_open_probe_in_progress", False)
    monkeypatch.setattr(worker_module, "_last_run_at", None)
    monkeypatch.setattr(worker_module, "_last_error", None)


def test_failure_threshold_opens_circuit():
    worker_module._record_failure("boom-1")
    worker_module._record_failure("boom-2")
    worker_module._record_failure("boom-3")

    snapshot = worker_module._get_circuit_snapshot()

    assert snapshot["circuit_state"] == worker_module.CIRCUIT_STATE_OPEN
    assert snapshot["circuit_open"] is True
    assert snapshot["consecutive_failures"] == worker_module.MAX_CONSECUTIVE_FAILURES
    assert snapshot["opened_at"] is not None


def test_open_circuit_moves_to_half_open_after_cooldown(monkeypatch):
    monkeypatch.setattr(worker_module, "_circuit_state", worker_module.CIRCUIT_STATE_OPEN)
    monkeypatch.setattr(worker_module, "_consecutive_failures", worker_module.MAX_CONSECUTIVE_FAILURES)
    monkeypatch.setattr(
        worker_module,
        "_circuit_opened_at",
        datetime.now(tz=timezone.utc)
        - timedelta(seconds=worker_module.CIRCUIT_OPEN_COOLDOWN_S + 1),
    )

    state = worker_module._transition_circuit_if_ready(datetime.now(tz=timezone.utc))
    snapshot = worker_module._get_circuit_snapshot()

    assert state == worker_module.CIRCUIT_STATE_HALF_OPEN
    assert snapshot["circuit_state"] == worker_module.CIRCUIT_STATE_HALF_OPEN
    assert snapshot["cooldown_remaining_seconds"] == 0


def test_success_closes_half_open_and_clears_error(monkeypatch):
    monkeypatch.setattr(worker_module, "_circuit_state", worker_module.CIRCUIT_STATE_HALF_OPEN)
    monkeypatch.setattr(worker_module, "_consecutive_failures", worker_module.MAX_CONSECUTIVE_FAILURES)
    monkeypatch.setattr(worker_module, "_half_open_probe_in_progress", True)
    monkeypatch.setattr(worker_module, "_circuit_opened_at", datetime.now(tz=timezone.utc))
    monkeypatch.setattr(worker_module, "_last_error", "previous failure")

    worker_module._record_success()
    snapshot = worker_module._get_circuit_snapshot()

    assert snapshot["circuit_state"] == worker_module.CIRCUIT_STATE_CLOSED
    assert snapshot["circuit_open"] is False
    assert snapshot["consecutive_failures"] == 0
    assert snapshot["half_open_probe_in_progress"] is False
    assert worker_module._last_error is None


def test_reset_circuit_breaker_returns_closed_state(monkeypatch):
    monkeypatch.setattr(worker_module, "_circuit_state", worker_module.CIRCUIT_STATE_OPEN)
    monkeypatch.setattr(worker_module, "_consecutive_failures", worker_module.MAX_CONSECUTIVE_FAILURES)
    monkeypatch.setattr(worker_module, "_half_open_probe_in_progress", True)
    monkeypatch.setattr(worker_module, "_last_error", "stuck")

    worker_module.reset_circuit_breaker()
    snapshot = worker_module._get_circuit_snapshot()

    assert snapshot["circuit_state"] == worker_module.CIRCUIT_STATE_CLOSED
    assert snapshot["consecutive_failures"] == 0
    assert snapshot["half_open_probe_in_progress"] is False
    assert worker_module._last_error is None
