import json
import sys
import unittest
from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base  # noqa: E402
from app.models import IntegrationOutbox, SyncStatusEnum  # noqa: E402
from app.services import integration_service  # noqa: E402


class TestIntegrationOutboxProcessing(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def tearDown(self):
        self.engine.dispose()

    def _create_outbox(self, db, entity_type: str, payload: dict) -> str:
        item_id = str(uuid4())
        item = IntegrationOutbox(
            id=item_id,
            entity_type=entity_type,
            entity_id="entity-1",
            operation="CREATE",
            payload=json.dumps(payload),
            status=SyncStatusEnum.QUEUED,
            retry_count=0,
            max_retries=2,
        )
        db.add(item)
        db.commit()
        return item_id

    def test_process_outbox_success_marks_success(self):
        class FakeSyncService:
            def sync_account_to_mikro(self, _entity_id, _payload):
                return {"success": True, "mikro_cari_kod": "CARI-1"}

        db = self.SessionLocal()
        try:
            item_id = self._create_outbox(db, "ACCOUNT", {"company_name": "Test Co"})
            original_factory = integration_service._get_mikro_sync_service
            integration_service._get_mikro_sync_service = lambda _db: FakeSyncService()
            try:
                result = integration_service.process_outbox_item(db, item_id)
            finally:
                integration_service._get_mikro_sync_service = original_factory

            self.assertTrue(result["ok"])
            updated = db.query(IntegrationOutbox).filter(IntegrationOutbox.id == item_id).first()
            self.assertEqual(updated.status, SyncStatusEnum.SUCCESS)
            self.assertIsNotNone(updated.processed_at)
        finally:
            db.close()

    def test_process_outbox_read_only_error_is_permanent(self):
        class FakeSyncService:
            def sync_account_to_mikro(self, _entity_id, _payload):
                return {
                    "success": False,
                    "error": "Mikro P1 read-only mod aktif",
                    "code": "E_MIKRO_READ_ONLY",
                }

        db = self.SessionLocal()
        try:
            item_id = self._create_outbox(db, "ACCOUNT", {"company_name": "Test Co"})
            original_factory = integration_service._get_mikro_sync_service
            integration_service._get_mikro_sync_service = lambda _db: FakeSyncService()
            try:
                result = integration_service.process_outbox_item(db, item_id)
            finally:
                integration_service._get_mikro_sync_service = original_factory

            self.assertFalse(result["ok"])
            self.assertFalse(result["retry"])
            updated = db.query(IntegrationOutbox).filter(IntegrationOutbox.id == item_id).first()
            self.assertEqual(updated.status, SyncStatusEnum.FAILED)
            self.assertEqual(updated.retry_count, 0)
        finally:
            db.close()

    def test_process_outbox_unsupported_entity_fails(self):
        db = self.SessionLocal()
        try:
            item_id = self._create_outbox(db, "UNKNOWN", {"foo": "bar"})
            result = integration_service.process_outbox_item(db, item_id)
            self.assertFalse(result["ok"])
            self.assertFalse(result["retry"])

            updated = db.query(IntegrationOutbox).filter(IntegrationOutbox.id == item_id).first()
            self.assertEqual(updated.status, SyncStatusEnum.FAILED)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
