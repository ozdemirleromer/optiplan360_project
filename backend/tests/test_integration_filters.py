import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base  # noqa: E402
from app.features.integration.transport.http.router import (  # noqa: E402
    api_list_audit,
    api_list_errors,
    api_list_maps,
    api_list_outbox,
)
from app.models import (  # noqa: E402
    IntegrationAudit,
    IntegrationEntityMap,
    IntegrationError,
    IntegrationOutbox,
    SyncStatusEnum,
)
from app.services import integration_service  # noqa: E402


class TestIntegrationFilters(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.user = SimpleNamespace(id=1)

    def tearDown(self):
        self.engine.dispose()

    def _seed_entity_maps(self, db):
        records = [
            IntegrationEntityMap(
                id=str(uuid4()),
                entity_type="ACCOUNT",
                internal_id="account-1",
                external_id="CARI-001",
                external_system="MIKRO",
                is_active=True,
            ),
            IntegrationEntityMap(
                id=str(uuid4()),
                entity_type="ACCOUNT",
                internal_id="account-1",
                external_id="CRM-001",
                external_system="CRM",
                is_active=True,
            ),
            IntegrationEntityMap(
                id=str(uuid4()),
                entity_type="ORDER",
                internal_id="order-1",
                external_id="SIP-001",
                external_system="MIKRO",
                is_active=True,
            ),
        ]
        db.add_all(records)
        db.commit()
        return records

    def _seed_outbox(self, db):
        records = [
            IntegrationOutbox(
                id=str(uuid4()),
                entity_type="ACCOUNT",
                entity_id="account-1",
                operation="CREATE",
                payload=json.dumps({"name": "A"}),
                status=SyncStatusEnum.QUEUED,
                retry_count=0,
                max_retries=3,
            ),
            IntegrationOutbox(
                id=str(uuid4()),
                entity_type="ACCOUNT",
                entity_id="account-2",
                operation="UPDATE",
                payload=json.dumps({"name": "B"}),
                status=SyncStatusEnum.SUCCESS,
                retry_count=0,
                max_retries=3,
            ),
            IntegrationOutbox(
                id=str(uuid4()),
                entity_type="ORDER",
                entity_id="order-1",
                operation="CREATE",
                payload=json.dumps({"number": "S-1"}),
                status=SyncStatusEnum.QUEUED,
                retry_count=0,
                max_retries=3,
            ),
        ]
        db.add_all(records)
        db.commit()
        return records

    def _seed_errors(self, db):
        records = [
            IntegrationError(
                id=str(uuid4()),
                entity_type="ACCOUNT",
                entity_id="account-1",
                error_code="E001",
                error_message="account failure",
                is_resolved=False,
            ),
            IntegrationError(
                id=str(uuid4()),
                entity_type="ACCOUNT",
                entity_id="account-2",
                error_code="E002",
                error_message="resolved account failure",
                is_resolved=True,
            ),
            IntegrationError(
                id=str(uuid4()),
                entity_type="ORDER",
                entity_id="order-1",
                error_code="E003",
                error_message="order failure",
                is_resolved=False,
            ),
        ]
        db.add_all(records)
        db.commit()
        return records

    def _seed_audit(self, db):
        records = [
            IntegrationAudit(
                id=str(uuid4()),
                action="MAP_CREATE",
                entity_type="ACCOUNT",
                entity_id="account-1",
                direction="PUSH",
                detail="created account map",
            ),
            IntegrationAudit(
                id=str(uuid4()),
                action="SYNC_END",
                entity_type="ACCOUNT",
                entity_id="account-2",
                direction="PUSH",
                detail="synced other account",
            ),
            IntegrationAudit(
                id=str(uuid4()),
                action="SYNC_END",
                entity_type="ORDER",
                entity_id="order-1",
                direction="PUSH",
                detail="synced order",
            ),
        ]
        db.add_all(records)
        db.commit()
        return records

    def test_list_entity_maps_supports_internal_id_and_external_system_filters(self):
        db = self.SessionLocal()
        try:
            records = self._seed_entity_maps(db)

            items, total = integration_service.list_entity_maps(db, "ACCOUNT", 0, 50)
            self.assertEqual(total, 2)
            self.assertEqual({item.id for item in items}, {records[0].id, records[1].id})

            filtered_items, filtered_total = integration_service.list_entity_maps(
                db,
                entity_type="ACCOUNT",
                skip=0,
                limit=50,
                internal_id="account-1",
                external_system="MIKRO",
            )
            self.assertEqual(filtered_total, 1)
            self.assertEqual(filtered_items[0].id, records[0].id)

            response = api_list_maps(
                entity_type="ACCOUNT",
                internal_id="account-1",
                external_system="CRM",
                skip=0,
                limit=50,
                db=db,
                user=self.user,
            )
            self.assertEqual(response["total"], 1)
            self.assertEqual(response["data"][0].id, records[1].id)
            self.assertEqual(response["data"][0].external_system, "CRM")
        finally:
            db.close()

    def test_list_outbox_supports_entity_type_and_entity_id_filters(self):
        db = self.SessionLocal()
        try:
            records = self._seed_outbox(db)

            items, total = integration_service.list_outbox(db, None, 0, 50)
            self.assertEqual(total, 3)
            self.assertEqual({item.id for item in items}, {record.id for record in records})

            filtered_items, filtered_total = integration_service.list_outbox(
                db,
                status=SyncStatusEnum.QUEUED.value,
                skip=0,
                limit=50,
                entity_type="ACCOUNT",
                entity_id="account-1",
            )
            self.assertEqual(filtered_total, 1)
            self.assertEqual(filtered_items[0].id, records[0].id)

            response = api_list_outbox(
                status=None,
                entity_type="ORDER",
                entity_id="order-1",
                skip=0,
                limit=50,
                db=db,
                user=self.user,
            )
            self.assertEqual(response["total"], 1)
            self.assertEqual(response["data"][0].id, records[2].id)
        finally:
            db.close()

    def test_list_errors_supports_entity_filters_with_existing_resolved_filter(self):
        db = self.SessionLocal()
        try:
            records = self._seed_errors(db)

            items, total = integration_service.list_errors(db, False, 0, 50)
            self.assertEqual(total, 2)
            self.assertEqual({item.id for item in items}, {records[0].id, records[2].id})

            filtered_items, filtered_total = integration_service.list_errors(
                db,
                is_resolved=False,
                skip=0,
                limit=50,
                entity_type="ACCOUNT",
                entity_id="account-1",
            )
            self.assertEqual(filtered_total, 1)
            self.assertEqual(filtered_items[0].id, records[0].id)

            response = api_list_errors(
                is_resolved=True,
                entity_type="ACCOUNT",
                entity_id="account-2",
                skip=0,
                limit=50,
                db=db,
                user=self.user,
            )
            self.assertEqual(response["total"], 1)
            self.assertEqual(response["data"][0].id, records[1].id)
        finally:
            db.close()

    def test_list_audit_supports_entity_type_and_entity_id_filters(self):
        db = self.SessionLocal()
        try:
            records = self._seed_audit(db)

            items, total = integration_service.list_audit(db, 0, 50)
            self.assertEqual(total, 3)
            self.assertEqual({item.id for item in items}, {record.id for record in records})

            filtered_items, filtered_total = integration_service.list_audit(
                db,
                skip=0,
                limit=50,
                entity_type="ACCOUNT",
                entity_id="account-1",
            )
            self.assertEqual(filtered_total, 1)
            self.assertEqual(filtered_items[0].id, records[0].id)

            response = api_list_audit(
                entity_type="ORDER",
                entity_id="order-1",
                skip=0,
                limit=50,
                db=db,
                user=self.user,
            )
            self.assertEqual(response["total"], 1)
            self.assertEqual(response["data"][0].id, records[2].id)
        finally:
            db.close()
