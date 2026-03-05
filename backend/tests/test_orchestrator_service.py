from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.exceptions import ValidationError
from app.models import Customer, OptiAuditEvent, OptiJob, OptiJobStateEnum, OptiModeEnum, Order, User
from app.models.enums import JobErrorCode
from app.services import orchestrator_service as orchestrator_module
from app.services.orchestrator_service import OrchestratorService


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _create_user(db):
    user = User(
        email=f"operator-{uuid4().hex[:8]}@test.local",
        username=f"operator_{uuid4().hex[:8]}",
        name="Operator Test",
        display_name="Operator Test",
        role="OPERATOR",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_customer(db):
    customer = Customer(
        name="Test Customer",
        phone=f"+90532{uuid4().int % 10_000_000:07d}",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def _create_order(db):
    user = _create_user(db)
    customer = _create_customer(db)
    order = Order(
        order_no=int(uuid4().int % 100000),
        customer_id=customer.id,
        crm_name_snapshot="Test Customer",
        ts_code=f"TS-{uuid4().hex[:10]}",
        tracking_token=str(uuid4()),
        phone_norm=customer.phone,
        thickness_mm=18,
        plate_w_mm=2800,
        plate_h_mm=2070,
        color="Beyaz",
        material_name="MDFLAM Beyaz",
        band_mm=1,
        created_by=user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order, user, customer


def _create_job_in_state(db, state, *, error_code=None):
    order, user, _ = _create_order(db)
    job = OptiJob(
        id=str(uuid4()),
        order_id=order.id,
        state=state,
        opti_mode=OptiModeEnum.C,
        error_code=error_code,
        created_by=user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


class TestOrchestratorService:
    def test_create_job_returns_new_state(self, db, monkeypatch):
        monkeypatch.setattr(
            orchestrator_module,
            "_call_orchestrator",
            lambda method, path, json_body=None: {"job": {"state": "NEW"}},
        )
        order, _, customer = _create_order(db)
        svc = OrchestratorService(db)

        job = svc.create_job(
            order_id=order.id,
            customer_phone=customer.phone,
            parts=[{"boy_mm": 700, "en_mm": 400, "adet": 2, "part_group": "GOVDE"}],
            opti_mode="C",
            plate_width_mm=2800,
            plate_height_mm=2070,
        )

        assert job.state == OptiJobStateEnum.NEW

    def test_concurrent_opti_running_blocked(self, db):
        _create_job_in_state(db, OptiJobStateEnum.OPTI_RUNNING)
        job2 = _create_job_in_state(db, OptiJobStateEnum.NEW)
        svc = OrchestratorService(db)

        with pytest.raises(ValidationError, match="OPTI_RUNNING"):
            svc._trigger_optiplan_exe(job2, ["dummy.xlsx"])

    def test_retry_permanent_error_blocked(self, db):
        job = _create_job_in_state(db, OptiJobStateEnum.FAILED, error_code=JobErrorCode.CRM_NO_MATCH)
        svc = OrchestratorService(db)

        with pytest.raises(ValidationError, match="Kalici hata"):
            svc.retry_job(job.id)

    def test_update_job_state_persists_transition_and_audit(self, db):
        job = _create_job_in_state(db, OptiJobStateEnum.NEW)
        svc = OrchestratorService(db)

        updated = svc.update_job_state(
            job,
            OptiJobStateEnum.HOLD,
            audit_event_type="STATE_HOLD",
            audit_message="Manual hold",
            audit_details={"source": "test"},
            error_code=JobErrorCode.CRM_NO_MATCH,
            error_message="CRM esitlenemedi",
        )

        assert updated.state == OptiJobStateEnum.HOLD
        assert updated.error_code == JobErrorCode.CRM_NO_MATCH
        assert updated.error_message == "CRM esitlenemedi"

        audit = (
            db.query(OptiAuditEvent)
            .filter(OptiAuditEvent.job_id == job.id, OptiAuditEvent.event_type == "STATE_HOLD")
            .one()
        )
        assert audit.message == "Manual hold"

    def test_get_job_status_returns_state_snapshot(self, db):
        job = _create_job_in_state(db, OptiJobStateEnum.OPTI_DONE, error_code=JobErrorCode.XML_INVALID)
        svc = OrchestratorService(db)

        status = svc.get_job_status(job.id)

        assert status["job_id"] == job.id
        assert status["state"] == OptiJobStateEnum.OPTI_DONE.value
        assert status["error_code"] == JobErrorCode.XML_INVALID

    def test_sync_job_state_accepts_nested_node_payload(self, db, monkeypatch):
        monkeypatch.setattr(
            orchestrator_module,
            "_call_orchestrator",
            lambda *args, **kwargs: {
                "job": {
                    "id": "node-job",
                    "state": "FAILED",
                    "error_code": JobErrorCode.XML_INVALID.value,
                    "error_message": "xml parse bozuk",
                }
            },
        )
        job = _create_job_in_state(db, OptiJobStateEnum.OPTI_RUNNING)
        svc = OrchestratorService(db)

        synced = svc.sync_job_state(job.id)

        assert synced.state == OptiJobStateEnum.FAILED
        assert synced.error_code == JobErrorCode.XML_INVALID
        assert synced.error_message == "xml parse bozuk"

    def test_cancel_sets_failed_state(self, db, monkeypatch):
        monkeypatch.setattr(orchestrator_module, "_call_orchestrator", lambda *args, **kwargs: None)
        job = _create_job_in_state(db, OptiJobStateEnum.OPTI_RUNNING)
        svc = OrchestratorService(db)

        cancelled = svc.cancel_job(job.id, user_id=1)

        assert cancelled.state == OptiJobStateEnum.FAILED
        assert cancelled.error_code == JobErrorCode.CANCELLED


def test_worker_and_collector_delegate_state_writes_to_orchestrator_service():
    services_dir = Path(__file__).resolve().parents[1] / "app" / "services"

    for service_file in ("optiplan_worker_service.py", "xml_collector_service.py"):
        source = (services_dir / service_file).read_text(encoding="utf-8")
        assert "job.state =" not in source
        assert "update_job_state(" in source
