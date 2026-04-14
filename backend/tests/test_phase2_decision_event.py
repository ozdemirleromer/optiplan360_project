"""
Phase 2 Decision Event Servisi — Birim Testleri

Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.4, 5.9
"""

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.services.phase2_decision_event_service import DecisionEventService
from app.models.optiplan_workflow import Phase2DecisionEvent
from app.database import Base


@pytest.fixture
def db_session():
    """In-memory SQLite test session — tüm tablolar create_all ile oluşturulur."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class TestDecisionEventService:
    """Karar event servisi testleri"""

    @pytest.fixture
    def decision_service(self, db_session):
        return DecisionEventService(db_session)

    # ────────────────────────────────────────
    # Event Kaydı
    # ────────────────────────────────────────

    def test_record_cell_decision_creates_event(self, decision_service, db_session):
        """Karar event'i kaydedilir"""
        event = decision_service.record_cell_decision(
            record_uuid="rec-123",
            row_id="row-1",
            field_type="adet",
            action="APPROVE",
            old_value=None,
            new_value=2,
            old_approval_status="PENDING",
            new_approval_status="APPROVED",
            user_id=1,
            user_name="ali",
            reason_code="OPERATOR_APPROVED",
        )

        assert event.id is not None
        assert event.kayit_uuid == "rec-123"
        assert event.satir_id == "row-1"
        assert event.alan_tipi == "adet"
        assert event.olay_tipi == "CELL_DECIDED"

    # ────────────────────────────────────────
    # Idempotency
    # ────────────────────────────────────────

    def test_idempotency_duplicate_request_returns_same_event(self, decision_service):
        """Aynı idempotency key → aynı event döner (duplicate prevention)"""
        idem_key = "idem-key-123"

        event1 = decision_service.record_cell_decision(
            record_uuid="rec-123",
            row_id="row-1",
            field_type="adet",
            action="APPROVE",
            new_approval_status="APPROVED",
            user_id=1,
            idempotency_key=idem_key,
        )

        event2 = decision_service.record_cell_decision(
            record_uuid="rec-123",
            row_id="row-1",
            field_type="adet",
            action="APPROVE",
            new_approval_status="APPROVED",
            user_id=1,
            idempotency_key=idem_key,
        )

        assert event1.id == event2.id
        assert event1.idempotency_key == event2.idempotency_key

    # ────────────────────────────────────────
    # Undo History
    # ────────────────────────────────────────

    def test_undo_history_recent_events(self, decision_service):
        """Undo history son 5 işlem döner"""
        record_uuid = "rec-456"

        # 5 event kaydedil
        for i in range(5):
            decision_service.record_cell_decision(
                record_uuid=record_uuid,
                row_id=f"row-{i}",
                field_type="boy",
                action="APPROVE",
                new_approval_status="APPROVED",
                user_id=1,
            )

        history = decision_service.get_undo_history(record_uuid, limit=5)
        assert len(history) == 5

    def test_undo_history_time_window(self, decision_service):
        """Undo history 5 dakika window'unda"""
        record_uuid = "rec-789"

        # Event kaydet
        event = decision_service.record_cell_decision(
            record_uuid=record_uuid,
            row_id="row-1",
            field_type="adet",
            action="APPROVE",
            new_approval_status="APPROVED",
            user_id=1,
        )

        # Event'in timestamp'ini kontrol et
        assert event.created_at is not None
        assert (datetime.now(timezone.utc).replace(tzinfo=None) - event.created_at) < timedelta(minutes=1)

    # ────────────────────────────────────────
    # Undo İşlemi
    # ────────────────────────────────────────

    def test_undo_decision_creates_reverse_event(self, decision_service):
        """Undo → reverse event oluşturur (eski/yeni değerleri ters çevirme)"""
        original_event = decision_service.record_cell_decision(
            record_uuid="rec-undo-1",
            row_id="row-1",
            field_type="adet",
            action="APPROVE",
            old_value=None,
            new_value=2,
            old_approval_status="PENDING",
            new_approval_status="APPROVED",
            user_id=1,
        )

        undo_event = decision_service.undo_decision(
            decision_event_id=original_event.id,
            user_id=1,
            user_name="ali",
        )

        assert undo_event.id != original_event.id
        assert undo_event.olay_tipi == "CELL_UNDONE"
        assert undo_event.eski_deger == original_event.yeni_deger  # Reverse
        assert undo_event.yeni_deger == original_event.eski_deger  # Reverse

    # ────────────────────────────────────────
    # Audit Trail
    # ────────────────────────────────────────

    def test_get_audit_trail_returns_events(self, decision_service):
        """Audit trail tüm event'leri döner"""
        record_uuid = "rec-audit"

        # 3 event kaydet
        for i in range(3):
            decision_service.record_cell_decision(
                record_uuid=record_uuid,
                row_id=f"row-{i}",
                field_type="boy",
                action="APPROVE",
                new_approval_status="APPROVED",
                user_id=1,
                operator_note=f"Note {i}",
            )

        trail = decision_service.get_audit_trail(record_uuid)
        assert trail["record_uuid"] == record_uuid
        assert trail["total_events"] == 3
        assert len(trail["events"]) == 3

    # ────────────────────────────────────────
    # Metrikleri Topla
    # ────────────────────────────────────────

    def test_aggregate_metrics_reason_distribution(self, decision_service):
        """Metrikleri topla — reason_code dağılımı"""
        record_uuid = "rec-metrics"

        # Farklı reason kodları ile event'ler
        for code in ["CONFIDENCE_LOW", "OCR_COMMON_ERROR", "CONFIDENCE_LOW"]:
            decision_service.record_cell_decision(
                record_uuid=record_uuid,
                row_id="row-1",
                field_type="boy",
                action="APPROVE",
                new_approval_status="APPROVED",
                user_id=1,
                reason_code=code,
            )

        metrics = decision_service.aggregate_metrics(record_uuid)
        assert metrics["total_decisions"] == 3
        assert metrics["reason_code_distribution"]["CONFIDENCE_LOW"] == 2
        assert metrics["reason_code_distribution"]["OCR_COMMON_ERROR"] == 1

    def test_aggregate_metrics_undo_frequency(self, decision_service):
        """Metrikleri topla — undo frequency hesabı"""
        record_uuid = "rec-undo-freq"

        # 4 event, 1 undo
        original = decision_service.record_cell_decision(
            record_uuid=record_uuid,
            row_id="row-1",
            field_type="adet",
            action="APPROVE",
            new_approval_status="APPROVED",
            user_id=1,
        )

        # 3 daha kaydet
        for i in range(3):
            decision_service.record_cell_decision(
                record_uuid=record_uuid,
                row_id=f"row-{i+2}",
                field_type="boy",
                action="APPROVE",
                new_approval_status="APPROVED",
                user_id=1,
            )

        # 1 undo yap
        decision_service.undo_decision(decision_event_id=original.id, user_id=1)

        metrics = decision_service.aggregate_metrics(record_uuid)
        assert metrics["total_undos"] == 1
        assert metrics["undo_frequency"] == pytest.approx(25.0, 1)  # 1/4 * 100
