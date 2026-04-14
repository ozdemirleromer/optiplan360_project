from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker

from app.auth import require_operator
from app.database import get_db
from app.exceptions import AppError, BusinessRuleError, NotFoundError
from app.features.system_backbone.transport.http.router import router as system_backbone_router
from app.models.core import User
from app.models.optiplan_workflow import OptiPlanFolderSetting, OptiPlanWorkflowKayit
from app.models.system_backbone import SystemBackboneFlow, SystemBackboneFlowAudit
from app.services.system_backbone_service import SystemBackboneService


SQLALCHEMY_DATABASE_URL = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

FLOW_CONTEXT = {
    "external_id": "ext-001",
    "company_id": 1,
    "branch_id": 0,
    "fiscal_year": 2026,
}


def _build_db() -> Session:
    User.__table__.create(bind=engine, checkfirst=True)
    SystemBackboneFlow.__table__.create(bind=engine, checkfirst=True)
    SystemBackboneFlowAudit.__table__.create(bind=engine, checkfirst=True)
    OptiPlanFolderSetting.__table__.create(bind=engine, checkfirst=True)
    OptiPlanWorkflowKayit.__table__.create(bind=engine, checkfirst=True)

    db = TestingSessionLocal()
    db.query(SystemBackboneFlowAudit).delete()
    db.query(SystemBackboneFlow).delete()
    db.query(OptiPlanWorkflowKayit).delete()
    db.query(OptiPlanFolderSetting).delete()
    db.commit()

    if not db.query(User).filter(User.id == 1).first():
        db.add(
            User(
                id=1,
                username="admin",
                email="admin@test.local",
                role="ADMIN",
                is_active=True,
            )
        )
        db.commit()
    return db


def _build_test_client(db: Session) -> TestClient:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def app_error_handler(_request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(system_backbone_router)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    def override_require_operator():
        return db.query(User).filter(User.id == 1).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_operator] = override_require_operator
    return TestClient(app)


def test_system_backbone_service_create_and_advance_flow() -> None:
    db = _build_db()

    created = SystemBackboneService.create_flow(
        db,
        flow_name="core-working-structure",
        entity_type="order",
        entity_id="foundation-001",
        external_id=FLOW_CONTEXT["external_id"],
        company_id=FLOW_CONTEXT["company_id"],
        branch_id=FLOW_CONTEXT["branch_id"],
        fiscal_year=FLOW_CONTEXT["fiscal_year"],
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={"phase": "foundation"},
        created_by=1,
    )

    assert created.status == "PENDING"
    assert created.stage == "foundation"

    audits = db.query(SystemBackboneFlowAudit).filter(SystemBackboneFlowAudit.flow_id == created.id).all()
    assert len(audits) == 1

    advanced = SystemBackboneService.advance_flow(
        db,
        flow_id=created.id,
        next_stage="stabilization",
        next_status="IN_PROGRESS",
        note="foundation tamamlandı",
        updated_by=1,
        retry_increment=True,
    )

    assert advanced.stage == "stabilization"
    assert advanced.status == "IN_PROGRESS"
    assert advanced.retry_count == 1


def test_system_backbone_service_retry_limit() -> None:
    db = _build_db()

    flow = SystemBackboneService.create_flow(
        db,
        flow_name="retry-check",
        entity_type="order",
        entity_id="retry-001",
        external_id="ext-retry-001",
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={},
        created_by=1,
    )

    flow.max_retries = 1
    db.commit()

    SystemBackboneService.advance_flow(
        db,
        flow_id=flow.id,
        next_stage="stabilization",
        next_status="RETRYING",
        note="ilk retry",
        updated_by=1,
        retry_increment=True,
    )

    try:
        SystemBackboneService.advance_flow(
            db,
            flow_id=flow.id,
            next_stage="stabilization",
            next_status="RETRYING",
            note="ikinci retry",
            updated_by=1,
            retry_increment=True,
        )
        assert False, "Retry limiti hatası bekleniyordu"
    except BusinessRuleError as exc:
        assert "Retry limiti" in exc.message


def test_system_backbone_service_create_flow_invalid_stage() -> None:
    db = _build_db()

    try:
        SystemBackboneService.create_flow(
            db,
            flow_name="invalid-stage",
            entity_type="order",
            entity_id="invalid-001",
            external_id="ext-invalid-001",
            company_id=1,
            branch_id=0,
            fiscal_year=2026,
            source_system="optiplan360",
            target_system="mikro",
            stage="invalid",
            metadata={},
            created_by=1,
        )
        assert False, "Geçersiz stage için hata bekleniyordu"
    except BusinessRuleError as exc:
        assert "Geçersiz stage" in exc.message


def test_system_backbone_service_advance_not_found() -> None:
    db = _build_db()

    try:
        SystemBackboneService.advance_flow(
            db,
            flow_id="missing-flow-id",
            next_stage="stabilization",
            next_status="IN_PROGRESS",
            note="missing",
            updated_by=1,
        )
        assert False, "Kayıt bulunamadı hatası bekleniyordu"
    except NotFoundError as exc:
        assert "bulunamadı" in exc.message.lower()


def test_system_backbone_service_advance_adds_audit_and_error_message() -> None:
    db = _build_db()

    created = SystemBackboneService.create_flow(
        db,
        flow_name="error-path",
        entity_type="order",
        entity_id="error-001",
        external_id="ext-error-001",
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={},
        created_by=1,
    )

    SystemBackboneService.advance_flow(
        db,
        flow_id=created.id,
        next_stage="stabilization",
        next_status="FAILED",
        note="hata kaydı",
        updated_by=1,
        retry_increment=False,
        error_message="bağlantı hatası",
    )

    refreshed = db.query(SystemBackboneFlow).filter(SystemBackboneFlow.id == created.id).first()
    assert refreshed is not None
    assert refreshed.last_error == "bağlantı hatası"

    audits = (
        db.query(SystemBackboneFlowAudit)
        .filter(SystemBackboneFlowAudit.flow_id == created.id)
        .order_by(SystemBackboneFlowAudit.created_at.asc())
        .all()
    )
    assert len(audits) == 2
    assert audits[0].event_type == "FLOW_CREATED"
    assert audits[1].event_type == "FLOW_ADVANCED"


def test_system_backbone_router_end_to_end() -> None:
    db = _build_db()
    client = _build_test_client(db)

    create_response = client.post(
        "/api/v1/system-backbone/flows",
        json={
            "flow_name": "api-flow",
            "entity_type": "order",
            "entity_id": "api-001",
            "external_id": "ext-api-001",
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
            "stage": "foundation",
            "metadata": {"source": "test"},
        },
    )
    assert create_response.status_code == 201
    flow_id = create_response.json()["id"]

    list_response = client.get("/api/v1/system-backbone/flows?company_id=1&branch_id=0&fiscal_year=2026")
    assert list_response.status_code == 200
    assert list_response.json()["total"] >= 1

    advance_response = client.post(
        f"/api/v1/system-backbone/flows/{flow_id}/advance",
        json={
            "next_stage": "stabilization",
            "next_status": "IN_PROGRESS",
            "note": "api advance",
            "retry_increment": False,
        },
    )
    assert advance_response.status_code == 200
    assert advance_response.json()["stage"] == "stabilization"

    overview_response = client.get("/api/v1/system-backbone/overview?company_id=1&branch_id=0&fiscal_year=2026")
    assert overview_response.status_code == 200
    assert overview_response.json()["total_flows"] >= 1


def test_system_backbone_service_idempotent_create_by_external_context() -> None:
    db = _build_db()

    first = SystemBackboneService.create_flow(
        db,
        flow_name="idem-flow",
        entity_type="order",
        entity_id="idem-001",
        external_id="ext-idem-001",
        company_id=1,
        branch_id=10,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={"run": 1},
        created_by=1,
    )

    second = SystemBackboneService.create_flow(
        db,
        flow_name="idem-flow",
        entity_type="order",
        entity_id="idem-001",
        external_id="ext-idem-001",
        company_id=1,
        branch_id=10,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={"run": 2},
        created_by=1,
    )

    assert first.id == second.id
    assert db.query(SystemBackboneFlow).filter(SystemBackboneFlow.external_id == "ext-idem-001").count() == 1


def test_system_backbone_service_list_flows_context_filter() -> None:
    db = _build_db()

    SystemBackboneService.create_flow(
        db,
        flow_name="ctx-a",
        entity_type="order",
        entity_id="ctx-a-001",
        external_id="ext-ctx-a",
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={},
        created_by=1,
    )
    SystemBackboneService.create_flow(
        db,
        flow_name="ctx-b",
        entity_type="order",
        entity_id="ctx-b-001",
        external_id="ext-ctx-b",
        company_id=2,
        branch_id=1,
        fiscal_year=2027,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={},
        created_by=1,
    )

    rows, total = SystemBackboneService.list_flows(
        db,
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
    )
    assert total == 1
    assert len(rows) == 1
    assert rows[0].company_id == 1
    assert rows[0].branch_id == 0
    assert rows[0].fiscal_year == 2026


def test_system_backbone_service_create_flow_invalid_company_id() -> None:
    db = _build_db()

    try:
        SystemBackboneService.create_flow(
            db,
            flow_name="invalid-company",
            entity_type="order",
            entity_id="invalid-company-001",
            external_id="ext-invalid-company",
            company_id=0,
            branch_id=0,
            fiscal_year=2026,
            source_system="optiplan360",
            target_system="mikro",
            stage="foundation",
            metadata={},
            created_by=1,
        )
        assert False, "company_id için hata bekleniyordu"
    except BusinessRuleError as exc:
        assert "company_id" in exc.message


def test_system_backbone_service_create_flow_invalid_branch_id() -> None:
    db = _build_db()

    try:
        SystemBackboneService.create_flow(
            db,
            flow_name="invalid-branch",
            entity_type="order",
            entity_id="invalid-branch-001",
            external_id="ext-invalid-branch",
            company_id=1,
            branch_id=-1,
            fiscal_year=2026,
            source_system="optiplan360",
            target_system="mikro",
            stage="foundation",
            metadata={},
            created_by=1,
        )
        assert False, "branch_id için hata bekleniyordu"
    except BusinessRuleError as exc:
        assert "branch_id" in exc.message


def test_system_backbone_service_advance_retry_cooldown_blocks_immediate_retry() -> None:
    db = _build_db()

    flow = SystemBackboneService.create_flow(
        db,
        flow_name="retry-cooldown",
        entity_type="order",
        entity_id="retry-cooldown-001",
        external_id="ext-retry-cooldown",
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={},
        created_by=1,
    )
    flow.retry_cooldown_seconds = 300
    db.commit()

    SystemBackboneService.advance_flow(
        db,
        flow_id=flow.id,
        next_stage="stabilization",
        next_status="RETRYING",
        note="ilk retry",
        updated_by=1,
        retry_increment=True,
    )

    try:
        SystemBackboneService.advance_flow(
            db,
            flow_id=flow.id,
            next_stage="stabilization",
            next_status="RETRYING",
            note="ikinci retry",
            updated_by=1,
            retry_increment=True,
        )
        assert False, "Retry cooldown hatası bekleniyordu"
    except BusinessRuleError as exc:
        assert "cooldown" in exc.message.lower()


def test_system_backbone_router_returns_app_error_shape_for_missing_flow() -> None:
    db = _build_db()
    client = _build_test_client(db)

    response = client.post(
        "/api/v1/system-backbone/flows/missing-flow/advance",
        json={
            "next_stage": "stabilization",
            "next_status": "IN_PROGRESS",
            "note": "missing flow advance",
        },
    )

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "NOT_FOUND"
    assert "bulunamadı" in payload["error"]["message"].lower()


def test_system_backbone_router_returns_app_error_shape_for_invalid_status_filter() -> None:
    db = _build_db()
    client = _build_test_client(db)

    response = client.get("/api/v1/system-backbone/flows?status=UNKNOWN_STATUS")

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["code"] == "BUSINESS_RULE_ERROR"
    assert "status" in payload["error"]["message"].lower()


def test_system_backbone_service_list_audits_returns_latest_first() -> None:
    db = _build_db()

    flow = SystemBackboneService.create_flow(
        db,
        flow_name="audit-flow",
        entity_type="order",
        entity_id="audit-001",
        external_id="ext-audit-001",
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        stage="foundation",
        metadata={},
        created_by=1,
    )
    SystemBackboneService.advance_flow(
        db,
        flow_id=flow.id,
        next_stage="stabilization",
        next_status="IN_PROGRESS",
        note="audit advance",
        updated_by=1,
    )

    audits = SystemBackboneService.list_audits(db, flow_id=flow.id, limit=10)
    assert len(audits) == 2
    assert audits[0].event_type == "FLOW_ADVANCED"
    assert audits[1].event_type == "FLOW_CREATED"


def test_system_backbone_router_lists_audits() -> None:
    db = _build_db()
    client = _build_test_client(db)

    create_response = client.post(
        "/api/v1/system-backbone/flows",
        json={
            "flow_name": "audit-api-flow",
            "entity_type": "order",
            "entity_id": "audit-api-001",
            "external_id": "ext-audit-api-001",
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
            "stage": "foundation",
            "metadata": {"source": "test"},
        },
    )
    flow_id = create_response.json()["id"]

    client.post(
        f"/api/v1/system-backbone/flows/{flow_id}/advance",
        json={
            "next_stage": "stabilization",
            "next_status": "IN_PROGRESS",
            "note": "audit api advance",
        },
    )

    response = client.get(f"/api/v1/system-backbone/flows/{flow_id}/audits?limit=10")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]) == 2
    assert payload["data"][0]["event_type"] == "FLOW_ADVANCED"


def test_system_backbone_service_bootstrap_core_structure() -> None:
    db = _build_db()

    result = SystemBackboneService.bootstrap_core_structure(
        db,
        company_id=1,
        branch_id=0,
        fiscal_year=2026,
        source_system="optiplan360",
        target_system="mikro",
        created_by=1,
    )

    assert result["phase"] == "core"
    assert result["summary"]["total"] == 5
    assert result["summary"]["created"] == 5
    assert len(result["todos"]) == 4


def test_system_backbone_service_apply_hardening_requires_core() -> None:
    db = _build_db()

    try:
        SystemBackboneService.apply_hardening(
            db,
            company_id=1,
            branch_id=0,
            fiscal_year=2026,
            updated_by=1,
        )
        assert False, "Core bootstrap ön koşulu bekleniyordu"
    except BusinessRuleError as exc:
        assert "core bootstrap" in exc.message.lower()


def test_system_backbone_router_phase_endpoints() -> None:
    db = _build_db()
    client = _build_test_client(db)

    bootstrap_response = client.post(
        "/api/v1/system-backbone/phases/core/bootstrap",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert bootstrap_response.status_code == 200
    assert bootstrap_response.json()["phase"] == "core"

    hardening_response = client.post(
        "/api/v1/system-backbone/phases/hardening/apply",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
        },
    )
    assert hardening_response.status_code == 200
    assert hardening_response.json()["phase"] == "hardening"

    todo_response = client.get("/api/v1/system-backbone/phases/hardening/todo?company_id=1&branch_id=0&fiscal_year=2026")
    assert todo_response.status_code == 200
    payload = todo_response.json()
    assert payload["phase"] == "hardening"
    assert len(payload["todos"]) >= 1


def test_system_backbone_router_roadmap_endpoint() -> None:
    db = _build_db()
    client = _build_test_client(db)

    bootstrap_response = client.post(
        "/api/v1/system-backbone/phases/core/bootstrap",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert bootstrap_response.status_code == 200

    response = client.get("/api/v1/system-backbone/roadmap?company_id=1&branch_id=0&fiscal_year=2026")
    assert response.status_code == 200
    payload = response.json()
    assert "ana_yapi_eksikleri" in payload
    assert "sertlestirme_test_eksikleri" in payload


def test_system_backbone_router_package_status_endpoint() -> None:
    db = _build_db()
    client = _build_test_client(db)

    foundation_response = client.post(
        "/api/v1/system-backbone/packages/foundation/run",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert foundation_response.status_code == 200

    response = client.get("/api/v1/system-backbone/packages/status?company_id=1&branch_id=0&fiscal_year=2026")
    assert response.status_code == 200
    payload = response.json()
    assert payload["company_id"] == 1
    assert "generated_at" in payload
    assert "last_package_run" in payload
    assert "phase_counts" in payload
    assert "status_counts" in payload
    assert "roadmap" in payload
    assert payload["last_package_run"]["company_id"] == 1
    assert payload["last_package_run"]["branch_id"] == 0
    assert payload["last_package_run"]["fiscal_year"] == 2026
    assert "flow_count" in payload
    assert "workflow_record_count" in payload


def test_system_backbone_router_foundation_package_endpoint() -> None:
    db = _build_db()
    client = _build_test_client(db)

    response = client.post(
        "/api/v1/system-backbone/packages/foundation/run",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["package"] == "foundation"
    assert "generated_at" in payload
    assert payload["watcher_enabled"] is True
    assert payload["warnings"] == []
    assert payload["flow_count"] >= 5
    assert payload["workflow_record_count"] >= 0
    assert "last_package_run" in payload
    assert "core_bootstrap" in payload
    assert "workflow_scan" in payload
    assert "roadmap" in payload


def test_system_backbone_router_foundation_package_watcher_disabled_mode() -> None:
    db = _build_db()
    settings = OptiPlanFolderSetting(
        id=1,
        whatsapp_raw_klasoru="/tmp/whatsapp",
        scanner_raw_klasoru="/tmp/scanner",
        manuel_raw_klasoru="/tmp/manual",
        email_raw_klasoru="/tmp/email",
        islenmis_klasoru="/tmp/processed",
        arsiv_klasoru="/tmp/archive",
        xml_okuma_klasoru="/tmp/xml",
        xlsx_cikti_klasoru="/tmp/xlsx",
        hatali_klasoru="/tmp/error",
        watcher_aktif_mi=False,
    )
    db.add(settings)
    db.commit()

    client = _build_test_client(db)
    response = client.post(
        "/api/v1/system-backbone/packages/foundation/run",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["watcher_enabled"] is False
    assert len(payload["warnings"]) >= 1
    assert payload["workflow_scan"]["mode"] == "WATCHER_DISABLED"


def test_system_backbone_router_stabilization_package_endpoint() -> None:
    db = _build_db()
    client = _build_test_client(db)

    foundation_response = client.post(
        "/api/v1/system-backbone/packages/foundation/run",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert foundation_response.status_code == 200

    stabilization_response = client.post(
        "/api/v1/system-backbone/packages/stabilization/run",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
        },
    )
    assert stabilization_response.status_code == 200
    payload = stabilization_response.json()
    assert payload["package"] == "stabilization"
    assert payload["watcher_enabled"] is True
    assert payload["warnings"] == []
    assert payload["flow_count"] >= 5
    assert payload["workflow_record_count"] >= 0
    assert "hardening" in payload
    assert "roadmap" in payload
    assert payload["last_package_run"]["package"] == "stabilization"
    assert payload["last_package_run"]["user_id"] == 1
    assert payload["last_package_run"]["company_id"] == 1


def test_system_backbone_router_chain_package_endpoint() -> None:
    db = _build_db()
    client = _build_test_client(db)

    response = client.post(
        "/api/v1/system-backbone/packages/chain/run",
        json={
            "company_id": 1,
            "branch_id": 0,
            "fiscal_year": 2026,
            "source_system": "optiplan360",
            "target_system": "mikro",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["package"] == "chain"
    assert payload["chain_id"]
    assert "chain_steps" in payload
    assert len(payload["chain_steps"]) == 2
    assert payload["chain_steps"][0]["duration_ms"] >= 0
    assert payload["chain_steps"][1]["duration_ms"] >= 0
    assert payload["total_duration_ms"] >= 0
    assert payload["failed_step"] is None
    assert payload["last_package_run"]["package"] == "stabilization"

    flow_ids = payload["hardening"]["flow_ids"]
    chain_audits = (
        db.query(SystemBackboneFlowAudit)
        .filter(SystemBackboneFlowAudit.flow_id.in_(flow_ids))
        .filter(SystemBackboneFlowAudit.event_type == "CHAIN_RUN_COMPLETED")
        .all()
    )
    assert len(chain_audits) >= 1
