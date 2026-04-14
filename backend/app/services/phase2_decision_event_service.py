"""
Phase 2 Decision Event Servisi — Audit Trail, Undo, Idempotency

Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.4 & 5.6
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ..models.optiplan_workflow import Phase2DecisionEvent, OptiPlanWorkflowSatir
from ..models.enums import Phase2DecisionEventTypeEnum
from ..schemas_phase2 import DecisionEventResponse


class DecisionEventService:
    """
    [DOKUMAN] Karar Event Log — Append-Only Audit Trail
    
    Zaman serileri: Kim, ne zaman, ne karar verdi, neden?
    Undo mekanizması, idempotency support.
    """

    # Undo konfigürasyonu
    UNDO_WINDOW_MINUTES = 5
    UNDO_MAX_COUNT = 5

    def __init__(self, session: Session):
        self.session = session

    def record_cell_decision(
        self,
        record_uuid: str,
        row_id: str,
        field_type: str,
        action: str,  # APPROVE, OVERRIDE_WITH_VALUE, MARK_ERROR
        old_value: Optional[int] = None,
        new_value: Optional[int] = None,
        old_approval_status: Optional[str] = None,
        new_approval_status: Optional[str] = None,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        user_role: Optional[str] = None,
        reason_code: Optional[str] = None,
        error_category: Optional[str] = None,
        operator_note: Optional[str] = None,
        suggested_value: Optional[int] = None,
        ocr_original_value: Optional[str] = None,
        confidence_before: Optional[float] = None,
        idempotency_key: Optional[str] = None,
    ) -> Phase2DecisionEvent:
        """
        Karar event'i kaydet (append-only)
        [DOKUMAN] Bölüm 5.4
        """

        # Idempotency check
        if idempotency_key:
            existing = self.session.query(Phase2DecisionEvent).filter_by(
                idempotency_key=idempotency_key
            ).first()
            if existing:
                return existing

        # Event tipi belirle
        if action == "APPROVE":
            event_type = Phase2DecisionEventTypeEnum.CELL_DECIDED
        elif action == "OVERRIDE_WITH_VALUE":
            event_type = Phase2DecisionEventTypeEnum.CELL_DECIDED
        elif action == "MARK_ERROR":
            event_type = Phase2DecisionEventTypeEnum.ERROR_MARKED
        else:
            event_type = Phase2DecisionEventTypeEnum.CELL_DECIDED

        # Event oluştur
        event = Phase2DecisionEvent(
            id=str(uuid.uuid4()),
            kayit_uuid=record_uuid,
            satir_id=row_id,
            alan_tipi=field_type,
            olay_tipi=event_type.value,
            eski_deger=old_value,
            yeni_deger=new_value,
            eski_onay_durumu=old_approval_status,
            yeni_onay_durumu=new_approval_status,
            user_id=user_id,
            user_adi=user_name,
            user_rolu=user_role,
            blocker_sebebi=reason_code,
            hatali_isleme_kategorisi=error_category,
            operator_notu=operator_note,
            onerilen_deger=suggested_value,
            ocr_orjinal_deger=ocr_original_value,
            karar_oncesi_guven=str(confidence_before) if confidence_before else None,
            idempotency_key=idempotency_key,
        )

        self.session.add(event)
        self.session.commit()

        return event

    def get_undo_history(self, record_uuid: str, limit: int = 5) -> List[Phase2DecisionEvent]:
        """
        Undo historiesi — son N işlem (time window içinde)
        [DOKUMAN] Bölüm 5.4 — Undo Penceresi (Kısa-Süreli)
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=self.UNDO_WINDOW_MINUTES)

        events = (
            self.session.query(Phase2DecisionEvent)
            .filter(
                Phase2DecisionEvent.kayit_uuid == record_uuid,
                Phase2DecisionEvent.created_at >= cutoff_time,
                Phase2DecisionEvent.olay_tipi.in_(
                    [
                        Phase2DecisionEventTypeEnum.CELL_DECIDED.value,
                        Phase2DecisionEventTypeEnum.ERROR_MARKED.value,
                    ]
                ),
            )
            .order_by(Phase2DecisionEvent.created_at.desc())
            .limit(limit)
            .all()
        )

        return events

    def undo_decision(
        self,
        decision_event_id: str,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Phase2DecisionEvent:
        """
        Geri al — reverse event ekle
        [DOKUMAN] Bölüm 5.4
        """

        # Idempotency check
        if idempotency_key:
            existing_undo = self.session.query(Phase2DecisionEvent).filter(
                Phase2DecisionEvent.blocker_sebebi == "UNDO",
                Phase2DecisionEvent.olay_tipi == Phase2DecisionEventTypeEnum.CELL_UNDONE.value,
                Phase2DecisionEvent.idempotency_key == idempotency_key,
            ).first()
            if existing_undo:
                return existing_undo

        # Original event oku
        original = self.session.query(Phase2DecisionEvent).filter_by(id=decision_event_id).first()
        if not original:
            raise ValueError(f"Event not found: {decision_event_id}")

        # Reverse event oluştur (eski/yeni değerleri ters çevir)
        undo_event = Phase2DecisionEvent(
            id=str(uuid.uuid4()),
            kayit_uuid=original.kayit_uuid,
            satir_id=original.satir_id,
            alan_tipi=original.alan_tipi,
            olay_tipi=Phase2DecisionEventTypeEnum.CELL_UNDONE.value,
            eski_deger=original.yeni_deger,  # Reverse
            yeni_deger=original.eski_deger,  # Reverse
            eski_onay_durumu=original.yeni_onay_durumu,  # Reverse
            yeni_onay_durumu=original.eski_onay_durumu,  # Reverse
            user_id=user_id,
            user_adi=user_name,
            user_rolu=None,
            blocker_sebebi="UNDO",
            operator_notu=f"Geri al: {original.id}",
            idempotency_key=idempotency_key,
        )

        self.session.add(undo_event)
        self.session.commit()

        return undo_event

    def get_audit_trail(
        self,
        record_uuid: str,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict:
        """
        Event log sorgula — audit trail
        [DOKUMAN] Bölüm 5.4
        """
        events = (
            self.session.query(Phase2DecisionEvent)
            .filter_by(kayit_uuid=record_uuid)
            .order_by(Phase2DecisionEvent.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        total_count = self.session.query(Phase2DecisionEvent).filter_by(
            kayit_uuid=record_uuid
        ).count()

        return {
            "record_uuid": record_uuid,
            "total_events": total_count,
            "events": [self._to_response(e) for e in events],
        }

    def _to_response(self, event: Phase2DecisionEvent) -> DecisionEventResponse:
        """Event'i response şemasına dönüştür"""
        return DecisionEventResponse(
            id=event.id,
            created_at=event.created_at,
            record_uuid=event.kayit_uuid,
            row_id=event.satir_id,
            field_type=event.alan_tipi,
            event_type=event.olay_tipi,
            old_value=event.eski_deger,
            new_value=event.yeni_deger,
            actor_user_id=event.user_id,
            actor_user_name=event.user_adi,
            decision_reason=event.blocker_sebebi,
            operator_note=event.operator_notu,
        )

    def get_recent_events(
        self,
        record_uuid: str,
        hours: int = 24,
    ) -> List[Phase2DecisionEvent]:
        """
        Son N saat içindeki event'ler (telemetri için)
        [DOKUMAN] Bölüm 5.10 — Ölçümleme
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        events = (
            self.session.query(Phase2DecisionEvent)
            .filter(
                Phase2DecisionEvent.kayit_uuid == record_uuid,
                Phase2DecisionEvent.created_at >= cutoff_time,
            )
            .order_by(Phase2DecisionEvent.created_at.asc())
            .all()
        )

        return events

    def aggregate_metrics(
        self,
        record_uuid: str,
    ) -> Dict:
        """
        Metrikleri topla — KPI hesaplaması için
        [DOKUMAN] Bölüm 5.10
        """
        events = self.get_recent_events(record_uuid, hours=24)

        total_decisions = len([e for e in events if e.olay_tipi == Phase2DecisionEventTypeEnum.CELL_DECIDED.value])
        total_undos = len([e for e in events if e.olay_tipi == Phase2DecisionEventTypeEnum.CELL_UNDONE.value])
        error_marked = len([e for e in events if e.olay_tipi == Phase2DecisionEventTypeEnum.ERROR_MARKED.value])

        # Reason code dağılımı
        reason_distribution = {}
        for event in events:
            if event.blocker_sebebi:
                reason_distribution[event.blocker_sebebi] = reason_distribution.get(event.blocker_sebebi, 0) + 1

        return {
            "record_uuid": record_uuid,
            "total_decisions": total_decisions,
            "total_undos": total_undos,
            "error_marked_count": error_marked,
            "undo_frequency": (total_undos / total_decisions * 100) if total_decisions > 0 else 0,
            "reason_code_distribution": reason_distribution,
        }
