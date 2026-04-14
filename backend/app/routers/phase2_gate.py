"""
Phase 2 OCR Kontrol — API Endpointleri

Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.5
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas_phase2 import (
    ValidateCellRequest,
    ValidateCellResponse,
    CellDecideRequest,
    CellDecideResponse,
    Phase3GateStatusResponse,
    AuditTrailResponse,
    UndoRequest,
    UndoResponse,
    BatchApproveDryRunRequest,
    BatchApproveDryRunResponse,
    BatchApproveCommitRequest,
    BatchApproveCommitResponse,
)
from ..services.phase2_validation_service import Phase2ValidationService, GateStatusService
from ..services.phase2_decision_event_service import DecisionEventService
from ..models.optiplan_workflow import (
    OptiPlanWorkflowKayit,
    OptiPlanWorkflowSatir,
    Phase2DecisionEvent,
)


router = APIRouter(prefix="/api/v1/workflow/phase2", tags=["Phase2 OCR Kontrol"])


FIELD_TO_STATUS_ATTR = {
    "boy": "boy_onay",
    "en": "en_onay",
    "adet": "adet_onay",
}

FIELD_TO_VALUE_ATTR = {
    "boy": "boy",
    "en": "en",
    "adet": "adet",
}

FIELD_TO_OPERATOR_VALUE_ATTR = {
    "boy": "boy_operator_degeri",
    "en": "en_operator_degeri",
    "adet": "adet_operator_degeri",
}


def _normalize_approval_status(value: str | None) -> str:
    normalized = str(value or "PENDING").strip().upper()
    mapping = {
        "BEKLEMEDE": "PENDING",
        "ONAYLANDI": "APPROVED",
        "REDDEDILDI": "REJECTED",
        "DUZELTILDI": "OVERRIDE",
    }
    return mapping.get(normalized, normalized)


def _extract_confidence(row: OptiPlanWorkflowSatir, field_type: str) -> float:
    if not isinstance(row.hucre_guven_skorlari, dict):
        return 0.0
    raw_score = row.hucre_guven_skorlari.get(field_type)
    try:
        return float(raw_score)
    except (TypeError, ValueError):
        return 0.0


def _to_gate_row(row: OptiPlanWorkflowSatir) -> dict:
    return {
        "row_id": row.id,
        "adet_onay": _normalize_approval_status(row.adet_onay),
        "adet_guven": _extract_confidence(row, "adet"),
        "boy_onay": _normalize_approval_status(row.boy_onay),
        "boy_guven": _extract_confidence(row, "boy"),
        "en_onay": _normalize_approval_status(row.en_onay),
        "en_guven": _extract_confidence(row, "en"),
    }


def _apply_cell_decision_to_row(
    row: OptiPlanWorkflowSatir,
    field_type: str,
    action: str,
    value: int | None,
) -> tuple[int | None, int | None, str, str]:
    status_attr = FIELD_TO_STATUS_ATTR[field_type]
    value_attr = FIELD_TO_VALUE_ATTR[field_type]
    operator_value_attr = FIELD_TO_OPERATOR_VALUE_ATTR[field_type]

    old_value = getattr(row, value_attr)
    old_status = _normalize_approval_status(getattr(row, status_attr))
    new_value = old_value
    new_status = old_status

    if action == "APPROVE":
        new_status = "APPROVED"
    elif action in {"OVERRIDE_WITH_VALUE", "APPLY_SUGGESTION"}:
        new_status = "OVERRIDE"
        if value is not None:
            setattr(row, value_attr, value)
            setattr(row, operator_value_attr, value)
            new_value = value
    elif action == "MARK_ERROR":
        new_status = "REJECTED"

    setattr(row, status_attr, new_status)
    return old_value, new_value, old_status, new_status


def _is_confidence_in_range(
    confidence: float,
    confidence_range: tuple[float, float] | None,
) -> bool:
    if confidence_range is None:
        return True
    min_conf, max_conf = confidence_range
    return min_conf <= confidence <= max_conf


# ────────────────────────────────────────────────────────────
# 1. HÜCRE DOĞRULAMA (Bir kere çağrılır, blocker tanısı)
# ────────────────────────────────────────────────────────────

@router.post(
    "/validate-cell",
    response_model=ValidateCellResponse,
    summary="Hücre Doğrulama",
    description="[DOKUMAN] Bölüm 5.5 — Hücre değerini doğrula, blocker tanısını döndür",
)
async def validate_cell(
    request: ValidateCellRequest,
    db: Session = Depends(get_db),
) -> ValidateCellResponse:
    """
    Doğrulama kurallarını uygula:
    1. Tip kontrolü (sayı mı?)
    2. Aralık kontrolü (min/max)
    3. Güven skoru (alan eşiği)
    4. Sık OCR hataları (öneriler)
    
    [DOKUMAN] Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.1
    """
    service = Phase2ValidationService(db)

    response = service.validate_cell(request)

    # Sık OCR hatası önerileri
    if request.original_ocr_value:
        ocr_suggestions = service.detect_common_ocr_errors(request.original_ocr_value)
        if ocr_suggestions and not response.blockers:
            response.proposed_value = ocr_suggestions[0].get("likely")

    return response


# ────────────────────────────────────────────────────────────
# 2. HÜCRE KARAR KAYIT (Operatör kararı: onay, override, error)
# ────────────────────────────────────────────────────────────

@router.post(
    "/cell-decide",
    response_model=CellDecideResponse,
    summary="Hücre Karar Kayıt",
    description="""[DOKUMAN] Bölüm 5.5 — Hücre karar alındı.
    
Actions:
- APPROVE: Değeri onayla
- APPLY_SUGGESTION: Önerileri uygula
- OVERRIDE_WITH_VALUE: Operatör değer girdi
- MARK_ERROR: Satır hatalı işaretlendi

Idempotency: aynı isteğin 2× çalıştırılması double insert üretmez.
""",
)
async def cell_decide(
    request: CellDecideRequest,
    db: Session = Depends(get_db),
) -> CellDecideResponse:
    """Hücre karar event'i kaydet ve gate durumu güncelle"""

    # Record ve row kontrol
    record = db.query(OptiPlanWorkflowKayit).filter_by(kayit_uuid=request.record_uuid).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found: {request.record_uuid}")

    row = db.query(OptiPlanWorkflowSatir).filter_by(id=request.row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Row not found: {request.row_id}")

    if request.field_type not in FIELD_TO_STATUS_ATTR:
        raise HTTPException(status_code=422, detail=f"Invalid field_type: {request.field_type}")

    decision_service = DecisionEventService(db)
    existing_event = None
    if request.idempotency_key:
        existing_event = db.query(Phase2DecisionEvent).filter_by(idempotency_key=request.idempotency_key).first()

    if existing_event:
        event = existing_event
        cached = True
    else:
        old_value, new_value, old_status, new_status = _apply_cell_decision_to_row(
            row=row,
            field_type=request.field_type,
            action=request.action,
            value=request.value,
        )
        db.commit()
        db.refresh(row)

        event = decision_service.record_cell_decision(
            record_uuid=request.record_uuid,
            row_id=request.row_id,
            field_type=request.field_type,
            action=request.action,
            old_value=old_value,
            new_value=new_value,
            old_approval_status=old_status,
            new_approval_status=new_status,
            user_id=None,
            user_name=None,
            reason_code=request.reason.value if request.reason else None,
            error_category=request.error_category.value if request.error_category else None,
            operator_note=request.operator_note,
            idempotency_key=request.idempotency_key,
        )
        cached = False

    # Gate durumunu kontrol et
    gate_service = GateStatusService()
    all_rows = db.query(OptiPlanWorkflowSatir).filter_by(kayit_uuid=request.record_uuid).all()
    rows_dict = [_to_gate_row(r) for r in all_rows]

    gate_result = gate_service.check_phase3_gate(request.record_uuid, rows_dict)

    # Undo history
    undo_history = decision_service.get_undo_history(request.record_uuid)
    next_undo = undo_history[0] if undo_history else None

    next_blocking_cell = None
    blocker_reasons = gate_result.get("blocker_reasons", [])
    if blocker_reasons:
        first_blocker = blocker_reasons[0]
        next_blocking_cell = {
            "row_id": first_blocker.get("row_id"),
            "field_type": first_blocker.get("field_type"),
        }

    return CellDecideResponse(
        success=True,
        message=f"Hücre {request.field_type.upper()} karar kaydedildi",
        idempotency_id=event.idempotency_key,
        cached=cached,
        cell_state={
            "row_id": request.row_id,
            "field_type": request.field_type,
            "approved": _normalize_approval_status(
                getattr(row, FIELD_TO_STATUS_ATTR[request.field_type])
            ) in {"APPROVED", "OVERRIDE"},
        },
        next_blocking_cell=next_blocking_cell,
        gate_status="READY" if gate_result.get("can_proceed") else "BLOCKED",
    )


# ────────────────────────────────────────────────────────────
# 3. PHASE 3 GATE DURUMU (Blocker özeti)
# ────────────────────────────────────────────────────────────

@router.get(
    "/{record_uuid}/phase3-gate-status",
    response_model=Phase3GateStatusResponse,
    summary="Phase 3 Gate Durumu",
    description="""[DOKUMAN] Bölüm 5.5 — Phase 3'e geçiş engelleri listele.
    
Blocker tihi: CONFIDENCE_LOW, RANGE_OUT_OF_BOUNDS, TYPE_INVALID, etc.
Her blocker için: neden, operatör mesajı, önerilen action.
""",
)
async def get_phase3_gate_status(
    record_uuid: str,
    db: Session = Depends(get_db),
) -> Phase3GateStatusResponse:
    """Gate durumunu kontrol et — hangi hücreler bloke ediyor?"""

    record = db.query(OptiPlanWorkflowKayit).filter_by(kayit_uuid=record_uuid).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found: {record_uuid}")

    rows = db.query(OptiPlanWorkflowSatir).filter_by(kayit_uuid=record_uuid).all()
    rows_dict = [_to_gate_row(r) for r in rows]

    gate_service = GateStatusService()
    gate_result = gate_service.check_phase3_gate(record_uuid, rows_dict)

    return Phase3GateStatusResponse(
        can_proceed=gate_result.get("can_proceed", False),
        message=gate_result.get("message", ""),
        blocker_reasons=[
            {
                "row_id": b["row_id"],
                "field_type": b["field_type"],
                "reason_code": b["reason_code"],
                "operator_message": b["operator_message"],
                "suggested_action": b.get("suggested_action"),
                "confidence_score": b["confidence_score"],
                "severity": b["severity"],
            }
            for b in gate_result.get("blocker_reasons", [])
        ],
        summary=gate_result.get("summary", {}),
        gate_check_time=datetime.utcnow(),
    )


# ────────────────────────────────────────────────────────────
# 4. UNDO (Kararı geri al)
# ────────────────────────────────────────────────────────────

@router.post(
    "/undo",
    response_model=UndoResponse,
    summary="Karar Geri Al (Undo)",
    description="""[DOKUMAN] Bölüm 5.4 — Son işlemi geri al.

Undo time window: 5 dakika
Undo limit: 5 işlem
""",
)
async def undo_decision(
    request: UndoRequest,
    db: Session = Depends(get_db),
) -> UndoResponse:
    """Bir karar event'ini reverse et"""

    decision_service = DecisionEventService(db)

    try:
        undo_event = decision_service.undo_decision(
            decision_event_id=request.decision_event_id,
            idempotency_key=request.idempotency_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if undo_event.satir_id and undo_event.alan_tipi in FIELD_TO_STATUS_ATTR:
        row = db.query(OptiPlanWorkflowSatir).filter_by(id=undo_event.satir_id).first()
        if row and row.kayit_uuid == request.record_uuid:
            status_attr = FIELD_TO_STATUS_ATTR[undo_event.alan_tipi]
            value_attr = FIELD_TO_VALUE_ATTR[undo_event.alan_tipi]
            operator_value_attr = FIELD_TO_OPERATOR_VALUE_ATTR[undo_event.alan_tipi]
            if undo_event.yeni_onay_durumu:
                setattr(row, status_attr, _normalize_approval_status(undo_event.yeni_onay_durumu))
            if undo_event.yeni_deger is not None:
                setattr(row, value_attr, undo_event.yeni_deger)
                setattr(row, operator_value_attr, undo_event.yeni_deger)
            db.commit()

    # Gate durumunu yeniden kontrol et
    gate_service = GateStatusService()
    all_rows = db.query(OptiPlanWorkflowSatir).filter_by(
        kayit_uuid=request.record_uuid
    ).all()
    rows_dict = [_to_gate_row(r) for r in all_rows]
    gate_result = gate_service.check_phase3_gate(request.record_uuid, rows_dict)

    return UndoResponse(
        success=True,
        message="Karar geri alındı",
        reverted_event_id=undo_event.id,
        gate_status="READY" if gate_result.get("can_proceed") else "BLOCKED",
    )


# ────────────────────────────────────────────────────────────
# 5. AUDIT TRAIL (Tüm kararlar log'u)
# ────────────────────────────────────────────────────────────

@router.get(
    "/{record_uuid}/audit-trail",
    response_model=AuditTrailResponse,
    summary="Audit Trail (Kararlar Log'u)",
    description="""[DOKUMAN] Bölüm 5.4 — Tüm karar event'leri.

Kim, ne zaman, ne karar verdi, neden?
""",
)
async def get_audit_trail(
    record_uuid: str,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> AuditTrailResponse:
    """Audit trail sorgusu"""

    decision_service = DecisionEventService(db)
    result = decision_service.get_audit_trail(record_uuid, limit=limit, offset=offset)

    return AuditTrailResponse(
        record_uuid=result["record_uuid"],
        total_events=result["total_events"],
        events=result["events"],
    )


# ────────────────────────────────────────────────────────────
# 6. BATCH ONAY (Toplu onay operasyonları)
# ────────────────────────────────────────────────────────────

@router.post(
    "/batch-approve-dry-run",
    response_model=BatchApproveDryRunResponse,
    summary="Toplu Onay (Dry-Run)",
    description="""[DOKUMAN] Bölüm 5.2 — Kaç hücre etkilenecek?

Query: field_type, confidence_range, reason
""",
)
async def batch_approve_dry_run(
    request: BatchApproveDryRunRequest,
    db: Session = Depends(get_db),
) -> BatchApproveDryRunResponse:
    """Toplu onay etkileri preview eth"""

    record = db.query(OptiPlanWorkflowKayit).filter_by(
        kayit_uuid=request.record_uuid
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found")

    rows = db.query(OptiPlanWorkflowSatir).filter_by(kayit_uuid=request.record_uuid).all()

    target_fields = [request.query.field_type] if request.query.field_type else ["boy", "en", "adet"]

    affected_cells = []
    for row in rows:
        for field_type in target_fields:
            status_attr = FIELD_TO_STATUS_ATTR[field_type]
            status_value = _normalize_approval_status(getattr(row, status_attr))
            if status_value in {"APPROVED", "OVERRIDE"}:
                continue

            confidence = _extract_confidence(row, field_type)
            if not _is_confidence_in_range(confidence, request.query.confidence_range):
                continue

            affected_cells.append(
                {
                    "row_id": row.id,
                    "field_type": field_type,
                    "old_confidence": confidence,
                    "new_approval_status": "APPROVED",
                }
            )

    projected_rows = [_to_gate_row(r).copy() for r in rows]
    projected_lookup = {item["row_id"]: item for item in projected_rows}
    for item in affected_cells:
        projected = projected_lookup.get(item["row_id"])
        if projected:
            projected[f"{item['field_type']}_onay"] = "APPROVED"

    gate_service = GateStatusService()
    projected_gate = gate_service.check_phase3_gate(request.record_uuid, projected_rows)

    return BatchApproveDryRunResponse(
        dry_run_id="dry-" + str(request.record_uuid)[:8],
        affected_count=len(affected_cells),
        affected_cells=affected_cells,
        estimated_impact={
            "blockers_remaining": projected_gate.get("summary", {}).get("total_blockers", 0),
            "gate_status_after": "READY" if projected_gate.get("can_proceed") else "BLOCKED",
        },
    )


@router.post(
    "/batch-approve-commit",
    response_model=BatchApproveCommitResponse,
    summary="Toplu Onay (Commit)",
    description="[DOKUMAN] Bölüm 5.2 — Dry-run onaylandı, gerçek işlem",
)
async def batch_approve_commit(
    request: BatchApproveCommitRequest,
    db: Session = Depends(get_db),
) -> BatchApproveCommitResponse:
    """Toplu onayı gerçekleştir"""

    # Idempotency check
    decision_service = DecisionEventService(db)

    record = db.query(OptiPlanWorkflowKayit).filter_by(
        kayit_uuid=request.record_uuid
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    rows = db.query(OptiPlanWorkflowSatir).filter_by(kayit_uuid=request.record_uuid).all()

    target_fields = [request.query.field_type] if request.query.field_type else ["boy", "en", "adet"]

    applied_count = 0
    for row in rows:
        for field_type in target_fields:
            status_attr = FIELD_TO_STATUS_ATTR[field_type]
            status_value = _normalize_approval_status(getattr(row, status_attr))
            if status_value in {"APPROVED", "OVERRIDE"}:
                continue

            confidence = _extract_confidence(row, field_type)
            if not _is_confidence_in_range(confidence, request.query.confidence_range):
                continue

            setattr(row, status_attr, "APPROVED")
            applied_count += 1

    db.commit()

    # Gate kontrol
    gate_service = GateStatusService()
    db.refresh(record)
    refreshed_rows = db.query(OptiPlanWorkflowSatir).filter_by(kayit_uuid=request.record_uuid).all()
    rows_dict = [_to_gate_row(r) for r in refreshed_rows]
    gate_result = gate_service.check_phase3_gate(request.record_uuid, rows_dict)

    return BatchApproveCommitResponse(
        success=True,
        applied_count=applied_count,
        message=f"{applied_count} hücre onaylandı",
        gate_status="READY" if gate_result.get("can_proceed") else "BLOCKED",
    )
