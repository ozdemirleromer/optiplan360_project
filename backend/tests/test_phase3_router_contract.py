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
from app.features.phase3.transport.http.router import router as phase3_router
from app.models.phase1 import Phase1Record, Phase1RowField
from app.models.phase1_enums import (
    ApprovalStatus,
    MatchStatus,
    Phase1RecordStatus,
    SourceType,
)


def _build_client(db_session) -> TestClient:
    app = FastAPI()
    app.include_router(phase3_router)

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_operator] = lambda: SimpleNamespace(
        id=7,
        role="OPERATOR",
        username="operator-test",
    )
    return TestClient(app)


def _seed_phase3_record(
    db_session,
    *,
    record_id: str,
    customer_match_status: MatchStatus = MatchStatus.UNMATCHED,
    stock_match_status: MatchStatus = MatchStatus.UNMATCHED,
    merge_candidate: bool = False,
    scrap_note_required: bool = False,
    scrap_note: str | None = None,
    fire_aciklamasi: str | None = None,
    merge_candidate_rows: set[int] | None = None,
    scrap_note_required_rows: set[int] | None = None,
):
    record = Phase1Record(
        record_id=record_id,
        file_name=f"{record_id}.png",
        source_type=SourceType.SCANNER_RAW,
        folder_type=SourceType.SCANNER_RAW.value,
        status=Phase1RecordStatus.PHASE3_PENDING,
        phase2_ready=True,
        phase3_ready=True,
        customer_match_status=customer_match_status,
    )
    record.okunan_cari_telefon = "05321234567"
    record.fire_aciklamasi = fire_aciklamasi
    db_session.add(record)

    for row_index, boy, en, adet in ((0, "2800", "600", "4"), (1, "1800", "450", "3")):
        row_merge_candidate = (
            merge_candidate if merge_candidate_rows is None else row_index in merge_candidate_rows
        )
        row_scrap_note_required = (
            scrap_note_required if scrap_note_required_rows is None else row_index in scrap_note_required_rows
        )
        for field_name, normalized_value in (("BOY", boy), ("EN", en), ("ADET", adet)):
            db_session.add(
                Phase1RowField(
                    record_id=record_id,
                    row_index=row_index,
                    field_name=field_name,
                    raw_value=normalized_value,
                    normalized_value=normalized_value,
                    approval_status=ApprovalStatus.APPROVED_AS_IS,
                    plate_id="p1",
                    material_text="MDF-18MM",
                    stock_match_status=stock_match_status,
                    stock_code="STK-001" if stock_match_status == MatchStatus.MATCHED else None,
                    yon="D",
                    aciklama="Kapak",
                    bant_ust="1.00 PVC",
                    bant_alt="1.00 PVC",
                    bant_sol="1.00 PVC",
                    bant_sag="1.00 PVC",
                    ilave_aciklama="",
                    aciklama1="",
                    merge_candidate=row_merge_candidate,
                    scrap_note_required=row_scrap_note_required,
                    scrap_note=scrap_note if row_scrap_note_required else None,
                )
            )

    db_session.commit()
    return record


def test_phase3_record_endpoint_returns_canonical_payload(db_session):
    _seed_phase3_record(
        db_session,
        record_id="rec_phase3_view",
        customer_match_status=MatchStatus.UNMATCHED,
        stock_match_status=MatchStatus.UNMATCHED,
        merge_candidate=True,
    )
    client = _build_client(db_session)

    response = client.get("/api/phase3/records/rec_phase3_view")

    assert response.status_code == 200
    payload = response.json()
    assert payload["header"]["record_id"] == "rec_phase3_view"
    assert payload["header"]["customer_match_status"] == "UNMATCHED"
    assert "customer_phone" in payload["header"]
    assert payload["header"]["customer_phone"] is None
    assert payload["header"]["source_type"] == "scanner"
    assert payload["header"]["operator_name"] == "operator-test"
    assert payload["header"]["fire_aciklamasi"] is None
    assert payload["plate_groups"][0]["line_count"] == 2
    assert payload["lines"][0]["stock_match_status"] == "UNMATCHED"
    assert payload["lines"][0]["status"] == "BLOCKED"
    assert payload["summary"]["customer_blocker"] is True
    assert payload["summary"]["stock_blocker_count"] == 2
    assert payload["summary"]["merge_pending_count"] == 2
    assert payload["summary"]["phase4_ready"] is False


def test_phase3_customer_and_stock_match_enable_move_phase4(db_session):
    _seed_phase3_record(
        db_session,
        record_id="rec_phase3_move",
        customer_match_status=MatchStatus.UNMATCHED,
        stock_match_status=MatchStatus.UNMATCHED,
    )
    client = _build_client(db_session)

    customer_response = client.post(
        "/api/phase3/customer-match",
        json={"record_id": "rec_phase3_move", "customer_code": "CARI-001"},
    )
    assert customer_response.status_code == 200
    assert customer_response.json()["customer_code"] == "CARI-001"
    assert customer_response.json()["customer_match_status"] in {"MATCHED", "MANUAL_MATCHED"}

    stock_response = client.post(
        "/api/phase3/stock-match",
        json={"record_id": "rec_phase3_move", "row_index": 0, "stock_code": "STK-001"},
    )
    assert stock_response.status_code == 200
    assert stock_response.json()["unmatched_count"] == 1

    stock_response = client.post(
        "/api/phase3/stock-match",
        json={"record_id": "rec_phase3_move", "row_index": 1, "stock_code": "STK-002"},
    )
    assert stock_response.status_code == 200
    assert stock_response.json()["unmatched_count"] == 0

    move_response = client.post("/api/phase3/move-phase4", json={"record_id": "rec_phase3_move"})
    assert move_response.status_code == 200
    assert move_response.json() == {
        "ok": True,
        "record_id": "rec_phase3_move",
        "status": "PHASE4_PENDING",
        "error_code": None,
        "message": None,
    }


def test_phase3_move_phase4_rejects_until_scrap_note_is_added(db_session):
    _seed_phase3_record(
        db_session,
        record_id="rec_phase3_scrap",
        customer_match_status=MatchStatus.MANUAL_MATCHED,
        stock_match_status=MatchStatus.MATCHED,
        scrap_note_required_rows={0, 1},
        scrap_note=None,
    )
    client = _build_client(db_session)

    blocked = client.post("/api/phase3/move-phase4", json={"record_id": "rec_phase3_scrap"})
    assert blocked.status_code == 200
    assert blocked.json()["ok"] is False
    assert blocked.json()["error_code"] == "PHASE3_BLOCKER_ACTIVE"

    note_response = client.post(
        "/api/phase3/scrap-note",
        json={
            "record_id": "rec_phase3_scrap",
            "note": "Fire nedeni: damar yonu nedeniyle kesim disi",
        },
    )
    assert note_response.status_code == 200
    assert note_response.json()["scrap_note_required"] is True
    assert note_response.json()["affected_row_count"] == 2

    detail_response = client.get("/api/phase3/records/rec_phase3_scrap")
    assert detail_response.status_code == 200
    assert detail_response.json()["header"]["fire_aciklamasi"] == "Fire nedeni: damar yonu nedeniyle kesim disi"

    saved_rows = (
        db_session.query(Phase1RowField)
        .filter_by(record_id="rec_phase3_scrap")
        .all()
    )
    required_rows = [row for row in saved_rows if row.scrap_note_required]
    assert all(row.scrap_note == "Fire nedeni: damar yonu nedeniyle kesim disi" for row in required_rows)

    ready = client.post("/api/phase3/move-phase4", json={"record_id": "rec_phase3_scrap"})
    assert ready.status_code == 200
    assert ready.json()["ok"] is True
    assert ready.json()["status"] == "PHASE4_PENDING"


def test_phase3_scrap_note_persists_on_record_even_without_required_rows(db_session):
    _seed_phase3_record(
        db_session,
        record_id="rec_phase3_general_fire",
        customer_match_status=MatchStatus.MATCHED,
        stock_match_status=MatchStatus.MATCHED,
        scrap_note_required_rows=set(),
    )
    client = _build_client(db_session)

    note_response = client.post(
        "/api/phase3/scrap-note",
        json={
            "record_id": "rec_phase3_general_fire",
            "note": "Genel fire açıklaması: ilk kesim toleransı",
        },
    )
    assert note_response.status_code == 200
    assert note_response.json()["affected_row_count"] == 0

    detail_response = client.get("/api/phase3/records/rec_phase3_general_fire")
    assert detail_response.status_code == 200
    assert detail_response.json()["header"]["fire_aciklamasi"] == "Genel fire açıklaması: ilk kesim toleransı"


def test_phase3_scrap_note_rejects_blank_input(db_session):
    _seed_phase3_record(
        db_session,
        record_id="rec_phase3_blank_fire",
        customer_match_status=MatchStatus.MATCHED,
        stock_match_status=MatchStatus.MATCHED,
    )
    client = _build_client(db_session)

    response = client.post(
        "/api/phase3/scrap-note",
        json={
            "record_id": "rec_phase3_blank_fire",
            "note": "   ",
        },
    )

    assert response.status_code == 422

    detail_response = client.get("/api/phase3/records/rec_phase3_blank_fire")
    assert detail_response.status_code == 200
    assert detail_response.json()["header"]["fire_aciklamasi"] is None


def test_phase3_merge_rows_aggregates_quantity_and_clears_merge_blockers(db_session):
    _seed_phase3_record(
        db_session,
        record_id="rec_phase3_merge",
        customer_match_status=MatchStatus.MANUAL_MATCHED,
        stock_match_status=MatchStatus.MATCHED,
        merge_candidate=True,
    )
    client = _build_client(db_session)

    response = client.post(
        "/api/phase3/merge-rows",
        json={"record_id": "rec_phase3_merge", "row_indexes": [0, 1]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "record_id": "rec_phase3_merge",
        "target_row_index": 0,
        "merged_row_indexes": [1],
        "total_adet": 7,
    }

    adet_field = (
        db_session.query(Phase1RowField)
        .filter_by(record_id="rec_phase3_merge", row_index=0, field_name="ADET")
        .one()
    )
    assert adet_field.normalized_value == "7"

    merge_flags = (
        db_session.query(Phase1RowField)
        .filter_by(record_id="rec_phase3_merge")
        .all()
    )
    assert all(not row.merge_candidate for row in merge_flags)
