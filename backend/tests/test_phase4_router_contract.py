from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import require_operator
from app.database import get_db
from app.features.phase4.transport.http.router import router as phase4_router
from app.models.phase1 import Phase1Record, Phase1RowField
from app.models.phase1_enums import ApprovalStatus, MatchStatus, Phase1RecordStatus, SourceType


def _build_client(db_session) -> TestClient:
    app = FastAPI()
    app.include_router(phase4_router)

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_operator] = lambda: SimpleNamespace(id=11, role="OPERATOR")
    return TestClient(app)


def _seed_phase4_record(
    db_session,
    *,
    record_id: str,
    status: Phase1RecordStatus,
    phase4_ready: bool = True,
    customer_code: str = "CARI-001",
    export_attempt_count: int = 0,
    export_path: str | None = None,
    manifest_path: str | None = None,
    last_error_message: str | None = None,
    fire_required: bool = False,
):
    record = Phase1Record(
        record_id=record_id,
        file_name=f"{record_id}.pdf",
        source_type=SourceType.SCANNER_RAW,
        folder_type=SourceType.SCANNER_RAW.value,
        status=status,
        customer_match_status=MatchStatus.MATCHED,
        customer_code=customer_code,
        customer_name="Ornek Cari",
        phase4_ready=phase4_ready,
        export_attempt_count=export_attempt_count,
        export_path=export_path,
        manifest_path=manifest_path,
        last_error_message=last_error_message,
    )
    db_session.add(record)

    for row_index, adet in ((0, "4"), (1, "2")):
        for field_name, normalized_value in (("BOY", "2800"), ("EN", "600"), ("ADET", adet)):
            db_session.add(
                Phase1RowField(
                    record_id=record_id,
                    row_index=row_index,
                    field_name=field_name,
                    raw_value=normalized_value,
                    normalized_value=normalized_value,
                    approval_status=ApprovalStatus.APPROVED_AS_IS,
                    stock_match_status=MatchStatus.MATCHED,
                    stock_code="STK-001",
                    scrap_note_required=fire_required,
                )
            )

    db_session.commit()
    return record


def test_phase4_queue_and_record_detail_contract(db_session, monkeypatch, workspace_tmp_path):
    output_dir = workspace_tmp_path / "phase4_output"
    preview_dir = workspace_tmp_path / "phase4_preview"
    manifest_dir = workspace_tmp_path / "phase4_manifests"
    output_dir.mkdir(parents=True)
    preview_dir.mkdir(parents=True)
    manifest_dir.mkdir(parents=True)
    monkeypatch.setenv("PHASE4_OUTPUT_DIR", str(output_dir))
    monkeypatch.setenv("PHASE4_PREVIEW_DIR", str(preview_dir))
    monkeypatch.setenv("PHASE4_MANIFEST_DIR", str(manifest_dir))

    _seed_phase4_record(
        db_session,
        record_id="rec_phase4_pending",
        status=Phase1RecordStatus.PHASE4_PENDING,
        fire_required=True,
    )
    client = _build_client(db_session)

    queue_response = client.get("/api/phase4/queue")
    assert queue_response.status_code == 200
    queue_payload = queue_response.json()
    assert queue_payload["items"][0]["record_id"] == "rec_phase4_pending"
    assert queue_payload["items"][0]["status"] == "PHASE4_PENDING"
    assert queue_payload["items"][0]["export_type"] == "XLSX"
    assert queue_payload["items"][0]["fire_required"] is True

    detail_response = client.get("/api/phase4/records/rec_phase4_pending")
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["record"]["record_id"] == "rec_phase4_pending"
    assert detail_payload["record"]["preview_ready"] is False
    assert detail_payload["record"]["phase4_ready"] is True
    assert detail_payload["mapping_summary"] == {
        "locked": True,
        "profile_name": "Optiplanning Default Mapping",
    }
    assert detail_payload["folder_health"]["output_folder_status"] == "HEALTHY"
    assert detail_payload["folder_health"]["preview_folder_status"] == "HEALTHY"
    assert detail_payload["folder_health"]["manifest_archive_status"] == "HEALTHY"


def test_phase4_preview_export_and_manifest_listing(db_session):
    _seed_phase4_record(
        db_session,
        record_id="rec_phase4_export",
        status=Phase1RecordStatus.PHASE4_PENDING,
    )
    client = _build_client(db_session)

    preview_response = client.post("/api/phase4/preview", json={"record_id": "rec_phase4_export"})
    assert preview_response.status_code == 200
    assert preview_response.json()["ok"] is True
    assert preview_response.json()["status"] == "PHASE4_PREVIEW_READY"

    export_response = client.post("/api/phase4/export", json={"record_id": "rec_phase4_export"})
    assert export_response.status_code == 200
    export_payload = export_response.json()
    assert export_payload["ok"] is True
    assert export_payload["status"] == "COMPLETED"
    assert export_payload["output_file_name"] == "rec_phase4_export_export.xlsx"
    assert export_payload["manifest_id"] == "rec_phase4_export_manifest"

    manifests_response = client.get("/api/phase4/manifests")
    assert manifests_response.status_code == 200
    manifests_payload = manifests_response.json()
    assert manifests_payload["items"][0]["record_id"] == "rec_phase4_export"
    assert manifests_payload["items"][0]["manifest_id"] == "rec_phase4_export_manifest"
    assert manifests_payload["items"][0]["status"] == "CREATED"


def test_phase4_export_and_retry_blocker_contract(db_session):
    _seed_phase4_record(
        db_session,
        record_id="rec_phase4_blocked",
        status=Phase1RecordStatus.PHASE4_PENDING,
    )
    _seed_phase4_record(
        db_session,
        record_id="rec_phase4_failed",
        status=Phase1RecordStatus.PHASE4_EXPORT_FAILED,
        export_attempt_count=1,
        last_error_message="Disk write failed",
    )
    client = _build_client(db_session)

    blocked_export = client.post("/api/phase4/export", json={"record_id": "rec_phase4_blocked"})
    assert blocked_export.status_code == 200
    assert blocked_export.json() == {
        "ok": False,
        "record_id": "rec_phase4_blocked",
        "status": "PHASE4_PENDING",
        "export_path": None,
        "manifest_path": None,
        "manifest_id": None,
        "output_file_name": None,
        "error_code": "PHASE4_EXPORT_BLOCKED",
        "message": "Record is not export-ready",
    }

    retry_response = client.post(
        "/api/phase4/retry",
        json={"record_id": "rec_phase4_failed", "decision": "RETRY_NOW"},
    )
    assert retry_response.status_code == 200
    retry_payload = retry_response.json()
    assert retry_payload["ok"] is True
    assert retry_payload["status"] == "COMPLETED"
    assert retry_payload["manifest_id"] == "rec_phase4_failed_manifest"


def test_phase4_folder_health_endpoint_returns_canonical_items(
    db_session,
    monkeypatch,
    workspace_tmp_path,
):
    output_dir = workspace_tmp_path / "phase4_output"
    preview_dir = workspace_tmp_path / "phase4_preview"
    manifest_dir = workspace_tmp_path / "phase4_manifests"
    output_dir.mkdir(parents=True)
    preview_dir.mkdir(parents=True)
    manifest_dir.mkdir(parents=True)
    monkeypatch.setenv("PHASE4_OUTPUT_DIR", str(output_dir))
    monkeypatch.setenv("PHASE4_PREVIEW_DIR", str(preview_dir))
    monkeypatch.setenv("PHASE4_MANIFEST_DIR", str(manifest_dir))

    _seed_phase4_record(
        db_session,
        record_id="rec_phase4_health",
        status=Phase1RecordStatus.COMPLETED,
        export_attempt_count=1,
        export_path="exports/rec_phase4_health_export.xlsx",
        manifest_path="exports/rec_phase4_health_manifest.json",
    )
    client = _build_client(db_session)

    response = client.get("/api/phase4/folder-health")

    assert response.status_code == 200
    payload = response.json()
    assert [item["folder_type"] for item in payload["items"]] == [
        "phase4_output",
        "phase4_preview",
        "phase4_manifest_archive",
    ]
    assert all(item["health_status"] == "HEALTHY" for item in payload["items"])
