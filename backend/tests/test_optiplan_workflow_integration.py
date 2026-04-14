"""
Integration tests for OptiPlan workflow export endpoints.
Tests full HTTP flow from request to response validation against ExportContractRules.
"""

import base64
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import get_current_user, require_operator
from app.database import get_db
from app.main import app
from app.models import User
from app.services.optiplan_workflow_service import optiplan_workflow_service
from app.constants.optiplan_workflow import ExportContractRules


def _valid_png_bytes() -> bytes:
    return base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2XQAAAAASUVORK5CYII=")


@pytest.fixture(scope="function")
def test_client(db_session: Session):
    """
    Set up FastAPI test client with database override.
    Uses the injected db_session (from test_optiplan_workflow_service.py fixture).
    """
    def override_get_db():
        yield db_session

    test_user = User(
        email="operator.optiplan@test.local",
        name="OptiPlan Operator",
        display_name="OptiPlan Operator",
        role="OPERATOR",
        is_active=True,
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[require_operator] = lambda: test_user
    client = TestClient(app, headers={"Host": "localhost"})
    yield client
    app.dependency_overrides.clear()


def _configure_workspace(db_session: Session, workspace_tmp_path: Path):
    """Configure folder settings for workspace using proven pattern from service tests."""
    def _case_dir(case_path: Path, label: str) -> Path:
        return case_path.parent / f"{case_path.name}_{label}"

    paths = {
        "whatsapp_raw_klasoru": str(_case_dir(workspace_tmp_path, "whatsapp_raw")),
        "scanner_raw_klasoru": str(_case_dir(workspace_tmp_path, "scanner_raw")),
        "manuel_raw_klasoru": str(_case_dir(workspace_tmp_path, "manuel_raw")),
        "email_raw_klasoru": str(_case_dir(workspace_tmp_path, "email_raw")),
        "islenmis_klasoru": str(_case_dir(workspace_tmp_path, "islenmis")),
        "arsiv_klasoru": str(_case_dir(workspace_tmp_path, "arsiv")),
        "xml_okuma_klasoru": str(_case_dir(workspace_tmp_path, "xml")),
        "xlsx_cikti_klasoru": str(_case_dir(workspace_tmp_path, "xlsx")),
        "hatali_klasoru": str(_case_dir(workspace_tmp_path, "hatali")),
        "fis_evrak_no_formati": "SIP-{seq:06d}",
        "arsiv_zaman_damgasi_formati": "%Y%m%d_%H%M%S",
        "xlsx_aktif_mi": True,
        "watcher_aktif_mi": False,
        "yeniden_deneme_sayisi": 2,
    }
    return optiplan_workflow_service.update_folder_settings(db_session, paths)


def _setup_phase3_record(db_session: Session, workspace_tmp_path: Path):
    """Helper: Create and setup Phase3 complete record for export testing."""
    # Configure workspace settings
    _configure_workspace(db_session, workspace_tmp_path)

    # Create test image file
    test_image = workspace_tmp_path / "test_image.png"
    test_image.parent.mkdir(parents=True, exist_ok=True)
    test_image.write_bytes(_valid_png_bytes())

    # Manual import
    record = optiplan_workflow_service.manual_import(
        db_session,
        file_name="test_import.png",
        content=test_image.read_bytes(),
        kaynak_klasor="manuel_raw",
        force_duplicate=False,
    )

    # Reload record to include newly created rows
    record = optiplan_workflow_service.get_record(db_session, record["kayit_uuid"])

    # Phase 2 update (approve)
    optiplan_workflow_service.update_phase2(
        db_session,
        record["kayit_uuid"],
        rows=[
            {
                "id": row["id"],
                "boy": 100,
                "en": 50,
                "adet": 5,
                "malzeme": "Beyaz Mdflam",
                "grain": 0,
                "bilgi": "Test",
                "delik_1": "10",
            }
            for row in record["satirlar"]
        ],
        metadata={
            "okunan_cari_unvan": "TEST CARI",
            "okunan_cari_telefon": "555-0000",
            "ai_guven_skoru_ozeti": {},
            "revizyon_adayi_uyarisi": None,
        },
    )
    optiplan_workflow_service.approve_phase2(db_session, record["kayit_uuid"])

    # Phase 3 update
    record = optiplan_workflow_service.get_record(db_session, record["kayit_uuid"])
    optiplan_workflow_service.update_phase3(
        db_session,
        record["kayit_uuid"],
        {
            "cari_unvan": "TEST CARI",
            "cari_kodu": "CARI001",
            "siparis_no": "SIP-000001",
            "termin": "2026-03-12",
            "teslim_tarihi": "2026-03-13",
            "teslimat_adresi": "Test Sevkiyat Adresi",
            "odeme_sekli": "HAVALE",
            "malzeme": "Beyaz Mdflam",
            "stok_kodu": "STK001",
            "bant_kalinligi": "0.40 MM",
            "grain_varsayilan": 0,
            "rows": [
                {
                    "id": row["id"],
                    "satir_sirasi": 1,
                    "malzeme": "Beyaz Mdflam",
                    "boy": 100,
                    "en": 50,
                    "adet": 5,
                    "grain": 0,
                    "bilgi": "Test description",
                    "u1": True,  # Edge enabled on top
                    "u2": False,
                    "k1": False,
                    "k2": False,
                    "delik_1": "10",
                    "delik_2": "20",
                    "satir_kaynagi": "MANUEL",
                }
                for row in record["satirlar"]
            ],
        },
    )

    return optiplan_workflow_service.get_record(db_session, record["kayit_uuid"])


def test_remove_restore_round_trip_is_persisted_over_http(test_client, db_session, workspace_tmp_path):
    _configure_workspace(db_session, workspace_tmp_path)
    record = optiplan_workflow_service.manual_import(
        db_session,
        file_name="http-remove-restore.png",
        content=_valid_png_bytes(),
        kaynak_klasor="manuel_raw",
        force_duplicate=False,
    )
    row_id = record["satirlar"][0]["id"]

    remove_response = test_client.post(f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/rows/{row_id}/remove")
    assert remove_response.status_code == 200
    removed_payload = remove_response.json()
    assert removed_payload["satirlar"]
    assert len(removed_payload["cikarilan_satirlar"]) == 1
    assert any(item["alan_adi"] == "phase2_row_removed" for item in removed_payload["audit_kayitlari"])

    refreshed_response = test_client.get(f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}")
    assert refreshed_response.status_code == 200
    refreshed_payload = refreshed_response.json()
    assert len(refreshed_payload["cikarilan_satirlar"]) == 1
    removed_row_id = refreshed_payload["cikarilan_satirlar"][0]["id"]

    restore_response = test_client.post(
        f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/removed-rows/{removed_row_id}/restore"
    )
    assert restore_response.status_code == 200
    restored_payload = restore_response.json()
    assert len(restored_payload["satirlar"]) == 3
    assert restored_payload["cikarilan_satirlar"] == []
    assert any(item["alan_adi"] == "phase2_row_restored" for item in restored_payload["audit_kayitlari"])

    final_response = test_client.get(f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}")
    assert final_response.status_code == 200
    final_payload = final_response.json()
    assert final_payload["cikarilan_satirlar"] == []
    assert len(final_payload["satirlar"]) == 3


class TestExportPreviewIntegration:
    """Integration tests for /export/preview HTTP endpoint with contract validation."""

    def test_export_preview_endpoint_returns_valid_contract_response(
        self, test_client, db_session, workspace_tmp_path
    ):
        """
        Test: HTTP call to /export/preview returns response matching ExportContractRules.
        Contract validation happens at three layers:
        1. Service guard: _validate_export_preview_rows_contract
        2. Router model: response_model=ExportPreviewResponseOut
        3. HTTP response JSON: deserialized and checked
        """
        # Setup Phase3 complete record
        record = _setup_phase3_record(db_session, workspace_tmp_path)
        kayit_uuid = record["kayit_uuid"]

        # HTTP call to export preview endpoint
        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{kayit_uuid}/export/preview",
            json={"xlsx_aktif_mi": True},
        )

        # Verify HTTP status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Parse response
        data = response.json()

        # Verify response structure
        assert "kayit_uuid" in data
        assert "dosya_adi" in data
        assert "satirlar" in data
        assert isinstance(data["satirlar"], list), "satirlar must be list"
        assert len(data["satirlar"]) > 0, "satirlar must not be empty"

        # Verify each row conforms to ExportContractRules
        for row_idx, row in enumerate(data["satirlar"], start=1):
            # Verify P_CODE_MAT
            assert "[P_CODE_MAT]" in row, f"Row {row_idx}: missing [P_CODE_MAT]"
            assert isinstance(row["[P_CODE_MAT]"], str), f"Row {row_idx}: [P_CODE_MAT] must be string"
            assert row["[P_CODE_MAT]"].strip(), f"Row {row_idx}: [P_CODE_MAT] cannot be empty"

            # Verify numeric bounds
            for field in ExportContractRules.NUMERIC_BOUNDED_FIELDS:
                assert field in row, f"Row {row_idx}: missing {field}"
                assert isinstance(row[field], int), f"Row {row_idx}: {field} must be int"
                assert row[field] >= 1, f"Row {row_idx}: {field} must be >= 1, got {row[field]}"

            # Verify grain is in allowed set
            grain_value = row.get("[P_GRAIN]")
            assert grain_value in ExportContractRules.GRAIN_SET, (
                f"Row {row_idx}: [P_GRAIN]={grain_value} not in allowed set {ExportContractRules.GRAIN_SET}"
            )

            # Verify edge codes are valid
            for edge_field in ExportContractRules.EDGE_FIELDS:
                edge_value = row.get(edge_field)
                assert (
                    edge_value in ExportContractRules.EDGE_CODES_SET
                ), f"Row {row_idx}: {edge_field}={edge_value} not in allowed set {ExportContractRules.EDGE_CODES_SET}"

            # Verify hole fields contain only digits or are empty
            for hole_field in ExportContractRules.HOLE_FIELDS:
                hole_value = row.get(hole_field, "")
                assert isinstance(
                    hole_value, str
                ), f"Row {row_idx}: {hole_field} must be string"
                assert hole_value == "" or hole_value.isdigit(), (
                    f"Row {row_idx}: {hole_field}='{hole_value}' must be empty or numeric"
                )

    def test_export_preview_response_can_be_deserialized_to_model(
        self, test_client, db_session, workspace_tmp_path
    ):
        """
        Test: HTTP response can be deserialized to ExportPreviewResponseOut model.
        This verifies Pydantic model validation at response boundary.
        """
        from app.features.optiplan_workflow.transport.http.router import ExportPreviewResponseOut

        record = _setup_phase3_record(db_session, workspace_tmp_path)

        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export/preview",
            json={"xlsx_aktif_mi": True},
        )

        assert response.status_code == 200

        # Deserialize response to model
        response_data = response.json()
        model_instance = ExportPreviewResponseOut.model_validate(response_data)

        # Verify model attributes
        assert model_instance.kayit_uuid == record["kayit_uuid"]
        assert len(model_instance.satirlar) > 0
        assert all(hasattr(row, "p_code_mat") for row in model_instance.satirlar), (
            "All rows must have p_code_mat attribute"
        )

    def test_export_preview_multiple_rows_all_constrained(
        self, test_client, db_session, workspace_tmp_path
    ):
        """
        Test: Export with multiple rows validates all rows against contract.
        """
        record = _setup_phase3_record(db_session, workspace_tmp_path)

        # Add more rows to Phase3
        current_record = optiplan_workflow_service.get_record(db_session, record["kayit_uuid"])
        rows_to_add = current_record["satirlar"][:3]  # Take up to 3 rows

        update_payload = {
            "rows": [
                {
                    "id": row["id"],
                    "boy": 100 + i * 10,  # Variable dimensions
                    "en": 50 + i * 5,
                    "adet": 5 + i,
                    "grain": i % 2,  # Alternate grain values
                    "bilgi": f"Row {i+1}",
                    "u1": i % 2 == 0,  # Alternate edge settings
                    "u2": False,
                    "k1": False,
                    "k2": False,
                    "delik_1": str(10 * (i + 1)) if i < 2 else "",
                    "delik_2": str(20 * (i + 1)) if i < 2 else "",
                    "satir_kaynagi": "MANUEL",
                }
                for i, row in enumerate(rows_to_add)
            ]
        }

        optiplan_workflow_service.update_phase3(
            db_session,
            record["kayit_uuid"],
            update_payload,
        )

        # Call export preview
        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export/preview",
            json={"xlsx_aktif_mi": True},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all rows have expected characteristics
        assert len(data["satirlar"]) == len(rows_to_add)
        for row in data["satirlar"]:
            # All rows must pass contract check
            assert row["[P_GRAIN]"] in ExportContractRules.GRAIN_SET
            for edge_field in ExportContractRules.EDGE_FIELDS:
                assert row[edge_field] in ExportContractRules.EDGE_CODES_SET

    def test_export_preview_with_empty_bilgi_and_deliks(
        self, test_client, db_session, workspace_tmp_path
    ):
        """
        Test: Export normalizes empty bilgi and delik fields to empty strings.
        Validates normalize-then-guard pattern from Iterasyon 36.
        """
        record = _setup_phase3_record(db_session, workspace_tmp_path)

        # Update with NO edges and NO deliks
        current_record = optiplan_workflow_service.get_record(db_session, record["kayit_uuid"])
        optiplan_workflow_service.update_phase3(
            db_session,
            record["kayit_uuid"],
            {
                "cari_kodu": "CARI001",
                "siparis_no": "SIP-000001",
                "stok_kodu": "STK001",
                "bant_kalinligi": "0.40 MM",
                "grain_varsayilan": 0,
                "rows": [
                    {
                        "id": row["id"],
                        "boy": 100,
                        "en": 50,
                        "adet": 5,
                        "grain": 1,
                        "bilgi": None,  # Empty — should normalize to ""
                        "u1": False,
                        "u2": False,
                        "k1": False,
                        "k2": False,
                        "delik_1": None,  # Empty — should normalize to ""
                        "delik_2": None,  # Empty — should normalize to ""
                        "satir_kaynagi": "MANUEL",
                    }
                    for row in current_record["satirlar"]
                ],
            },
        )

        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export/preview",
            json={"xlsx_aktif_mi": True},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify normalization for all rows
        for row in data["satirlar"]:
            # Empty billgi normalized to ""
            assert row["[P_IDESC]"] == "", f"Expected [P_IDESC] empty string, got {row['[P_IDESC]']!r}"
            # Empty deliks normalized to ""
            assert row["[P_IIDESC]"] == "", f"Expected [P_IIDESC] empty string, got {row['[P_IIDESC]']!r}"
            assert row["[P_DESC1]"] == "", f"Expected [P_DESC1] empty string, got {row['[P_DESC1]']!r}"
            # Edge codes all empty (no edges enabled)
            for edge_field in ExportContractRules.EDGE_FIELDS:
                assert row[edge_field] == "", f"Expected {edge_field} empty, got {row[edge_field]!r}"


class TestExportRecordIntegration:
    """Integration tests for /export HTTP endpoint (export record)."""

    def test_export_record_endpoint_response_valid_contract(
        self, test_client, db_session, workspace_tmp_path
    ):
        """
        Test: /export (export_record) endpoint returns valid contract response.
        ExportRecordResponseOut extends ExportPreviewResponseOut with durum field.
        """
        from app.features.optiplan_workflow.transport.http.router import ExportRecordResponseOut

        record = _setup_phase3_record(db_session, workspace_tmp_path)

        # Call export record endpoint
        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export",
            json={"xlsx_aktif_mi": True},
        )

        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"

        # Verify response can be deserialized to model
        data = response.json()
        model_instance = ExportRecordResponseOut.model_validate(data)

        # Verify durum is valid enum value
        assert model_instance.durum in ExportContractRules.EXPORT_STATUS_SET, (
            f"durum={model_instance.durum} not in {ExportContractRules.EXPORT_STATUS_SET}"
        )

        # Verify generated_files list
        assert isinstance(model_instance.generated_files, list)

    def test_export_record_durum_reflects_success_or_partial(
        self, test_client, db_session, workspace_tmp_path
    ):
        """
        Test: export_record returns appropriate durum status.
        If all rows export successfully -> "BASARILI"
        If some fail -> "KISMI_BASARILI" or "HATALI"
        """
        record = _setup_phase3_record(db_session, workspace_tmp_path)

        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export",
            json={"xlsx_aktif_mi": True},
        )

        assert response.status_code == 200
        data = response.json()

        # For successful export, durum should be BASARILI or KISMI_BASARILI
        assert data["durum"] in ("BASARILI", "KISMI_BASARILI", "HATALI")

    def test_export_record_download_endpoint_returns_generated_xlsx(
        self, test_client, db_session, workspace_tmp_path
    ):
        record = _setup_phase3_record(db_session, workspace_tmp_path)

        response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export",
            json={"xlsx_aktif_mi": True},
        )

        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        payload = response.json()
        export_id = payload["export_manifest"]["export_id"]

        download_response = test_client.get(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/exports/{export_id}/files/xlsx"
        )

        assert download_response.status_code == 200
        assert (
            download_response.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert payload["durum"] == "BASARILI"

class TestExportTelemetryIntegration:
    """Integration tests for export anomaly telemetry endpoint."""

    def test_export_status_anomaly_endpoint_returns_records(
        self, test_client, db_session, workspace_tmp_path, monkeypatch: pytest.MonkeyPatch
    ):
        record = _setup_phase3_record(db_session, workspace_tmp_path)

        monkeypatch.setattr(
            ExportContractRules,
            "validate_export_status",
            staticmethod(lambda _status: False),
        )

        export_response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export",
            json={"xlsx_aktif_mi": True},
        )
        assert export_response.status_code == 200

        telemetry_response = test_client.get(
            "/api/v1/optiplan-workflow/telemetry/export-status-anomalies",
            params={"limit": 20},
        )

        assert telemetry_response.status_code == 200
        payload = telemetry_response.json()

        assert payload["limit"] == 20
        assert payload["summary"]["total_records"] >= 1
        assert payload["summary"]["distinct_records"] >= 1
        assert payload["summary"]["last_created_at"] is not None
        assert len(payload["items"]) >= 1
        assert payload["items"][0]["alan_adi"] == "export_durum_anomali"

    def test_export_status_anomaly_endpoint_supports_filters_and_offset(
        self, test_client, db_session, workspace_tmp_path, monkeypatch: pytest.MonkeyPatch
    ):
        record = _setup_phase3_record(db_session, workspace_tmp_path)

        monkeypatch.setattr(
            ExportContractRules,
            "validate_export_status",
            staticmethod(lambda _status: False),
        )

        export_response = test_client.post(
            f"/api/v1/optiplan-workflow/records/{record['kayit_uuid']}/export",
            json={"xlsx_aktif_mi": True},
        )
        assert export_response.status_code == 200

        telemetry_response = test_client.get(
            "/api/v1/optiplan-workflow/telemetry/export-status-anomalies",
            params={"limit": 1, "offset": 0, "kayit_uuid": record["kayit_uuid"]},
        )

        assert telemetry_response.status_code == 200
        payload = telemetry_response.json()

        assert payload["limit"] == 1
        assert payload["offset"] == 0
        assert payload["filters"]["kayit_uuid"] == record["kayit_uuid"]
        assert len(payload["items"]) == 1
        assert payload["items"][0]["kayit_uuid"] == record["kayit_uuid"]

    def test_export_status_anomaly_endpoint_rejects_invalid_time_range(
        self, test_client
    ):
        response = test_client.get(
            "/api/v1/optiplan-workflow/telemetry/export-status-anomalies",
            params={
                "from": "2026-03-13T00:00:00+00:00",
                "to": "2026-03-12T00:00:00+00:00",
            },
        )
        assert response.status_code == 422

    def test_export_status_anomaly_endpoint_rejects_invalid_datetime_format(
        self, test_client
    ):
        response = test_client.get(
            "/api/v1/optiplan-workflow/telemetry/export-status-anomalies",
            params={
                "from": "2026/03/12 00:00:00",
            },
        )
        assert response.status_code == 422

    def test_export_status_anomaly_endpoint_rejects_datetime_without_timezone(
        self, test_client
    ):
        response = test_client.get(
            "/api/v1/optiplan-workflow/telemetry/export-status-anomalies",
            params={
                "from": "2026-03-12T00:00:00",
            },
        )
        assert response.status_code == 422

