"""
Integration servis audit log testleri.

Kapsam:
- create_entity_map → MAP_CREATE audit kaydı oluşturur
- delete_entity_map → MAP_DELETE audit kaydı oluşturur
- create_sync_job → SYNC_START audit kaydı oluşturur
- enqueue_outbox idempotency → mevcut QUEUED kaydı güncellenir, yeni kaydı oluşturulmaz
- list_audit → entity_type ve entity_id filtresi çalışır
"""
import json
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base  # noqa: E402
from app.models import IntegrationAudit, IntegrationEntityMap, IntegrationOutbox, SyncStatusEnum  # noqa: E402
from app.services import integration_service  # noqa: E402


# ─── Fixture ──────────────────────────────────────────────────────────────────

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


# ─── 1. create_entity_map → MAP_CREATE audit ─────────────────────────────────

class TestCreateEntityMapAudit:
    def test_map_create_audit_record_exists(self, db):
        """create_entity_map çağrısı MAP_CREATE audit kaydı oluşturur."""
        integration_service.create_entity_map(
            db,
            entity_type="ACCOUNT",
            internal_id="internal-1",
            external_id="MIKRO-CARI-1",
            user_id=42,
        )

        audits = db.query(IntegrationAudit).filter(IntegrationAudit.action == "MAP_CREATE").all()
        assert len(audits) == 1
        assert audits[0].entity_type == "ACCOUNT"
        assert audits[0].entity_id == "internal-1"

    def test_existing_map_update_does_not_create_new_audit(self, db):
        """Var olan eşleme güncellenirse yeni audit kaydı eklenmez."""
        # İlk oluşturma
        integration_service.create_entity_map(
            db, "ACCOUNT", "internal-1", "MIKRO-CARI-1", user_id=1
        )
        audit_count_before = db.query(IntegrationAudit).count()

        # Aynı id ile tekrar çağrı — güncelleme senaryosu
        integration_service.create_entity_map(
            db, "ACCOUNT", "internal-1", "MIKRO-CARI-2", user_id=1
        )
        audit_count_after = db.query(IntegrationAudit).count()

        assert audit_count_after == audit_count_before, (
            "Güncelleme sırasında ekstra audit kaydı oluşmamalı"
        )

    def test_audit_user_id_stored(self, db):
        """Audit kaydında user_id korunur."""
        integration_service.create_entity_map(
            db, "STOCK", "stk-1", "MIKRO-STK-1", user_id=99
        )
        audit = db.query(IntegrationAudit).filter(IntegrationAudit.action == "MAP_CREATE").first()
        assert audit.user_id == 99

    def test_entity_type_normalized_to_uppercase(self, db):
        """Küçük harf entity_type, büyük harfe normalize edilerek saklanır."""
        integration_service.create_entity_map(
            db, "account", "internal-2", "EXT-2", user_id=1
        )
        audit = db.query(IntegrationAudit).filter(IntegrationAudit.action == "MAP_CREATE").first()
        assert audit.entity_type == "ACCOUNT"


# ─── 2. delete_entity_map → MAP_DELETE audit ─────────────────────────────────

class TestDeleteEntityMapAudit:
    def test_map_delete_audit_record_exists(self, db):
        """delete_entity_map çağrısı MAP_DELETE audit kaydı oluşturur."""
        created = integration_service.create_entity_map(
            db, "ACCOUNT", "del-1", "MIKRO-DEL-1", user_id=1
        )

        result = integration_service.delete_entity_map(db, map_id=created.id, user_id=10)
        assert result is True

        audits = db.query(IntegrationAudit).filter(IntegrationAudit.action == "MAP_DELETE").all()
        assert len(audits) == 1

    def test_delete_nonexistent_map_returns_false(self, db):
        """Var olmayan map silme False döner, audit kaydı oluşmaz."""
        result = integration_service.delete_entity_map(db, "no-such-id", user_id=1)
        assert result is False
        audits = db.query(IntegrationAudit).filter(IntegrationAudit.action == "MAP_DELETE").all()
        assert len(audits) == 0


# ─── 3. create_sync_job → SYNC_START audit ───────────────────────────────────

class TestCreateSyncJobAudit:
    def test_sync_start_audit_record_created(self, db):
        """create_sync_job çağrısı SYNC_START audit kaydı oluşturur."""
        integration_service.create_sync_job(
            db,
            job_type="FULL_SYNC",
            direction="PUSH",
            entity_type="ORDER",
            user_id=7,
        )

        audits = db.query(IntegrationAudit).filter(IntegrationAudit.action == "SYNC_START").all()
        assert len(audits) == 1
        assert audits[0].entity_type == "ORDER"

    def test_multiple_sync_jobs_each_create_audit(self, db):
        """Her sync job ayrı bir audit kaydı oluşturur."""
        for _ in range(3):
            integration_service.create_sync_job(
                db, "INCREMENTAL", "PUSH", "ACCOUNT", user_id=1
            )

        count = db.query(IntegrationAudit).filter(IntegrationAudit.action == "SYNC_START").count()
        assert count == 3


# ─── 4. enqueue_outbox idempotency ───────────────────────────────────────────

class TestEnqueueOutboxIdempotency:
    def test_second_enqueue_updates_not_creates(self, db):
        """Aynı entity için ikinci enqueue, yeni kayıt değil güncelleme yapar."""
        integration_service.enqueue_outbox(
            db, "ACCOUNT", "ent-1", "CREATE", {"company_name": "İlk"}
        )
        count_after_first = db.query(IntegrationOutbox).count()

        integration_service.enqueue_outbox(
            db, "ACCOUNT", "ent-1", "UPDATE", {"company_name": "Güncellendi"}
        )
        count_after_second = db.query(IntegrationOutbox).count()

        assert count_after_first == count_after_second == 1

    def test_second_enqueue_updates_payload(self, db):
        """İkinci enqueue payload'ı günceller."""
        integration_service.enqueue_outbox(
            db, "ACCOUNT", "ent-2", "CREATE", {"company_name": "Eski"}
        )
        integration_service.enqueue_outbox(
            db, "ACCOUNT", "ent-2", "UPDATE", {"company_name": "Yeni"}
        )

        item = db.query(IntegrationOutbox).filter(IntegrationOutbox.entity_id == "ent-2").first()
        payload = json.loads(item.payload)
        assert payload["company_name"] == "Yeni"
        assert item.operation == "UPDATE"

    def test_different_entities_create_separate_records(self, db):
        """Farklı entity_id'ler için ayrı kayıtlar oluşur."""
        integration_service.enqueue_outbox(db, "ACCOUNT", "ent-A", "CREATE", {})
        integration_service.enqueue_outbox(db, "ACCOUNT", "ent-B", "CREATE", {})

        count = db.query(IntegrationOutbox).count()
        assert count == 2


# ─── 5. list_audit filtreleme ─────────────────────────────────────────────────

class TestListAuditFiltering:
    def test_filter_by_entity_type(self, db):
        """entity_type filtresi sadece ilgili kayıtları döner."""
        integration_service.create_entity_map(db, "ACCOUNT", "a-1", "EXT-A", user_id=1)
        integration_service.create_entity_map(db, "STOCK", "s-1", "EXT-S", user_id=1)

        items, total = integration_service.list_audit(db, entity_type="ACCOUNT")
        assert total == 1
        assert items[0].entity_type == "ACCOUNT"

    def test_filter_by_entity_id(self, db):
        """entity_id filtresi sadece ilgili entity'nin audit kayıtlarını döner."""
        integration_service.create_entity_map(db, "ACCOUNT", "target-id", "EXT-1", user_id=1)
        integration_service.create_entity_map(db, "ACCOUNT", "other-id", "EXT-2", user_id=2)

        items, total = integration_service.list_audit(db, entity_id="target-id")
        assert total == 1
        assert items[0].entity_id == "target-id"

    def test_no_filter_returns_all(self, db):
        """Filtre verilmezse tüm audit kayıtları döner."""
        integration_service.create_entity_map(db, "ACCOUNT", "x-1", "EXT-X1", user_id=1)
        integration_service.create_entity_map(db, "STOCK", "x-2", "EXT-X2", user_id=1)

        _, total = integration_service.list_audit(db)
        assert total == 2

    def test_pagination_skip_limit(self, db):
        """skip/limit parametreleri doğru çalışır."""
        for i in range(5):
            integration_service.create_entity_map(db, "ACCOUNT", f"pag-{i}", f"EXT-{i}", user_id=1)

        items, total = integration_service.list_audit(db, skip=2, limit=2)
        assert total == 5
        assert len(items) == 2
