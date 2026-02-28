import io
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
import sys
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.auth import get_current_user, require_operator  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.models import AuditLog, Customer, Order, User  # noqa: E402
from app.routers import orders_router  # noqa: E402


class OrdersImportXlsxTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        db = self.SessionLocal()
        try:
            user = User(
                email="operator@test.local",
                name="Operator Test",
                display_name="Operator Test",
                role="OPERATOR",
                is_active=True,
            )
            customer = Customer(
                name="Test Customer",
                phone="5551234567",
            )
            db.add(user)
            db.add(customer)
            db.flush()

            order = Order(
                customer_id=customer.id,
                status="NEW",
                crm_name_snapshot=customer.name,
                ts_code="20260212_000000",
            )
            db.add(order)
            db.commit()
            db.refresh(user)
            db.refresh(order)
            self.test_user = user
            self.order_id = str(order.id)
        finally:
            db.close()

        app = FastAPI()
        app.include_router(orders_router.router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.test_user
        app.dependency_overrides[require_operator] = lambda: self.test_user

        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def _build_workbook_bytes(self) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.append(["Boy", "En", "Adet", "Grain", "U1", "U2", "K1", "K2", "Aciklama", "Delik1", "Delik2"])
        ws.append([500, 300, 2, "1-Material", "1MM", "", None, 0, "row-1", "", ""])
        ws.append([550, 350, 1, "1-Material", "0.40mm", "", None, 0, "row-2", "", ""])
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def test_import_xlsx_arkalik_enforces_band_rule_and_writes_audit(self):
        payload = self._build_workbook_bytes()
        res = self.client.post(
            f"/api/v1/orders/{self.order_id}/import/xlsx",
            data={"part_group": "ARKALIK"},
            files={
                "file": (
                    "import.xlsx",
                    payload,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body["imported_rows"], 2)
        self.assertEqual(len(body["parts"]), 2)
        self.assertGreaterEqual(len(body["warnings"]), 1)

        for part in body["parts"]:
            self.assertFalse(part["u1"])
            self.assertFalse(part["u2"])
            self.assertFalse(part["k1"])
            self.assertFalse(part["k2"])

        db = self.SessionLocal()
        try:
            log = (
                db.query(AuditLog)
                .filter(AuditLog.order_id == self.order_id, AuditLog.action == "IMPORT_XLSX")
                .first()
            )
            self.assertIsNotNone(log)
        finally:
            db.close()

    def test_import_xlsx_govde_treats_non_empty_edge_cells_as_selected(self):
        payload = self._build_workbook_bytes()
        res = self.client.post(
            f"/api/v1/orders/{self.order_id}/import/xlsx",
            data={"part_group": "GOVDE"},
            files={
                "file": (
                    "import.xlsx",
                    payload,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body["imported_rows"], 2)
        self.assertEqual(len(body["parts"]), 2)
        self.assertTrue(body["parts"][0]["u1"])
        self.assertTrue(body["parts"][1]["u1"])
        self.assertFalse(body["parts"][0]["u2"])
        self.assertFalse(body["parts"][1]["u2"])

        db = self.SessionLocal()
        try:
            log = (
                db.query(AuditLog)
                .filter(AuditLog.order_id == self.order_id, AuditLog.action == "IMPORT_XLSX")
                .first()
            )
            self.assertIsNotNone(log)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
