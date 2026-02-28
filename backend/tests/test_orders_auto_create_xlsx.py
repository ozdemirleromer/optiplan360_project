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
from app.models import Order, OrderPart, User  # noqa: E402
from app.routers import orders_router  # noqa: E402


class OrdersAutoCreateFromXlsxTest(unittest.TestCase):
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
                email="operator.auto@test.local",
                name="Operator Auto",
                display_name="Operator Auto",
                role="OPERATOR",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            self.test_user = user
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

    def _build_template_workbook_bytes(self) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.append(
            [
                "[P_CODE_MAT]",
                "[P_LENGTH]",
                "[P_WIDTH]",
                "[P_MINQ]",
                "[P_GRAIN]",
                "[P_IDESC]",
                "[P_EDGE_MAT_UP]",
                "[P_EGDE_MAT_LO]",
                "[P_EDGE_MAT_SX]",
                "[P_EDGE_MAT_DX]",
                "[P_IIDESC]",
                "[P_DESC1]",
            ]
        )
        ws.append(
            [
                "Material",
                "Length",
                "Width",
                "Min Q.",
                "GrainI",
                "Description",
                "Upper strip mat.",
                "Lower strip mat.",
                "Left strip mat.",
                "Right strip mat.",
                "II Description",
                "Description 1",
            ]
        )
        ws.append(["18MM 210*280", 722, 580, 4, "3-Material", "Parca-1", "1MM", None, "0.40mm", None, "", ""])
        ws.append(["18MM 210*280", 600, 495, 2, "1-Material", "Parca-2", None, None, None, None, "", ""])
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def test_auto_create_from_xlsx_creates_order_and_imports_parts(self):
        payload = self._build_template_workbook_bytes()
        res = self.client.post(
            "/api/v1/orders/auto-create-from-xlsx",
            data={
                "list_name": "BEYAZ18",
                "customer_phone": "05550000000",
                "part_group": "GOVDE",
            },
            files={
                "file": (
                    "BEYAZ18.xlsx",
                    payload,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        self.assertEqual(res.status_code, 201, res.text)
        body = res.json()
        self.assertEqual(body["list_name"], "BEYAZ18")
        self.assertEqual(body["status"], "NEW")
        self.assertEqual(body["imported_rows"], 2)
        self.assertTrue(body["order_id"])

        db = self.SessionLocal()
        try:
            order = db.query(Order).filter(Order.id == int(body["order_id"])).first()
            self.assertIsNotNone(order)
            self.assertEqual(order.crm_name_snapshot, "BEYAZ18")
            self.assertEqual(order.status.value if hasattr(order.status, "value") else str(order.status), "NEW")

            parts = db.query(OrderPart).filter(OrderPart.order_id == order.id).all()
            self.assertEqual(len(parts), 2)
            self.assertTrue(parts[0].u1)
            self.assertTrue(parts[0].k1)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
