import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
import sys
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.auth import get_current_user  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.models import Customer, Order, User  # noqa: E402
from app.routers import orders_router  # noqa: E402


class TestValidateOrder(unittest.TestCase):
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
            db.refresh(order)
            self.order_id = str(order.id)
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

        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_validate_order_with_missing_crm_snapshot(self):
        db = self.SessionLocal()
        try:
            order = db.query(Order).filter(Order.id == self.order_id).first()
            order.crm_name_snapshot = None
            db.commit()
        finally:
            db.close()

        response = self.client.post(f"/api/v1/orders/{self.order_id}/validate")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["valid"])
        self.assertTrue(any(error["field"] == "crm_name_snapshot" for error in body["errors"]))

    def test_validate_order_with_empty_parts(self):
        response = self.client.post(f"/api/v1/orders/{self.order_id}/validate")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["valid"])
        self.assertTrue(any(error["field"] == "parts" for error in body["errors"]))


if __name__ == "__main__":
    unittest.main()
