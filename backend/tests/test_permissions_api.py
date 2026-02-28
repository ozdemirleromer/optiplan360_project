"""
Kapsamli izin testleri (Payment + Stock + Integration)
"""
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
import sys
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, get_db  # noqa: E402
from app.auth import get_current_user  # noqa: E402
from app.exceptions import AppError  # noqa: E402
from app.models import User, CRMAccount, StockCard  # noqa: E402
from app.routers import payment_router, stock_cards_router, integration_router  # noqa: E402


def _create_test_app():
    app = FastAPI()

    @app.exception_handler(AppError)
    async def _app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(payment_router.router)
    app.include_router(stock_cards_router.router)
    app.include_router(integration_router.router)
    return app


class BasePermissionApiTest(unittest.TestCase):
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
            admin_user = User(
                email="admin@test.local",
                username="admin_test",
                display_name="Admin Test",
                role="ADMIN",
                is_active=True,
            )
            operator_user = User(
                email="operator@test.local",
                username="operator_test",
                display_name="Operator Test",
                role="OPERATOR",
                is_active=True,
            )
            station_user = User(
                email="station@test.local",
                username="station_test",
                display_name="Station Test",
                role="STATION",
                is_active=True,
            )
            db.add_all([admin_user, operator_user, station_user])
            db.flush()

            self.admin_user_id = admin_user.id
            self.operator_user_id = operator_user.id
            self.station_user_id = station_user.id

            account = CRMAccount(
                id="acc_test_1",
                company_name="Test Firma",
                owner_id=self.admin_user_id,
            )
            db.add(account)
            self.account_id = account.id

            stock = StockCard(
                id="stk_test_1",
                stock_code="STK_TEST",
                stock_name="Test Stok",
                total_quantity=10,
                available_quantity=10,
                reserved_quantity=0,
                is_active=True,
            )
            db.add(stock)
            db.commit()
        finally:
            db.close()

        self.app = _create_test_app()

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def _set_user(self, user_id: int):
        def _get_user():
            db = self.SessionLocal()
            try:
                return db.query(User).filter(User.id == user_id).first()
            finally:
                db.close()

        self.app.dependency_overrides[get_current_user] = _get_user

    def _create_invoice(self) -> str:
        payload = {
            "account_id": self.account_id,
            "subtotal": 1000,
            "tax_rate": 20,
            "discount_amount": 0,
            "total_amount": 1200,
            "invoice_type": "SALES",
        }
        resp = self.client.post("/api/v1/payments/invoices", json=payload)
        self.assertEqual(resp.status_code, 200)
        return resp.json()["id"]

    def _create_payment(self, invoice_id: str) -> str:
        payload = {
            "invoice_id": invoice_id,
            "account_id": self.account_id,
            "payment_method": "CASH",
            "amount": 200,
        }
        resp = self.client.post("/api/v1/payments/payments", json=payload)
        self.assertEqual(resp.status_code, 200)
        return resp.json()["id"]


class TestPaymentPermissions(BasePermissionApiTest):
    def test_payment_list_operator_allowed(self):
        self._set_user(self.operator_user_id)
        resp = self.client.get("/api/v1/payments/invoices")
        self.assertEqual(resp.status_code, 200)

    def test_payment_list_station_denied(self):
        self._set_user(self.station_user_id)
        resp = self.client.get("/api/v1/payments/invoices")
        self.assertEqual(resp.status_code, 403)

    def test_payment_create_operator_allowed(self):
        self._set_user(self.operator_user_id)
        payload = {
            "account_id": self.account_id,
            "subtotal": 1000,
            "tax_rate": 20,
            "discount_amount": 0,
            "total_amount": 1200,
            "invoice_type": "SALES",
        }
        resp = self.client.post("/api/v1/payments/invoices", json=payload)
        self.assertEqual(resp.status_code, 200)

    def test_payment_create_station_denied(self):
        self._set_user(self.station_user_id)
        payload = {
            "account_id": self.account_id,
            "subtotal": 1000,
            "tax_rate": 20,
            "discount_amount": 0,
            "total_amount": 1200,
            "invoice_type": "SALES",
        }
        resp = self.client.post("/api/v1/payments/invoices", json=payload)
        self.assertEqual(resp.status_code, 403)

    def test_payment_cancel_station_denied(self):
        self._set_user(self.operator_user_id)
        invoice_id = self._create_invoice()
        payment_id = self._create_payment(invoice_id)

        self._set_user(self.station_user_id)
        resp = self.client.post(f"/api/v1/payments/payments/{payment_id}/cancel")
        self.assertEqual(resp.status_code, 403)

    def test_payment_promise_flow_operator_allowed(self):
        self._set_user(self.operator_user_id)
        invoice_id = self._create_invoice()

        payload = {
            "invoice_id": invoice_id,
            "account_id": self.account_id,
            "promised_amount": 500,
            "promise_date": "2026-02-16T12:00:00",
            "payment_method": "CASH",
        }
        resp = self.client.post("/api/v1/payments/promises", json=payload)
        self.assertEqual(resp.status_code, 200)


class TestStockPermissions(BasePermissionApiTest):
    def test_stock_list_operator_allowed(self):
        self._set_user(self.operator_user_id)
        resp = self.client.get("/api/v1/stock/stock-cards")
        self.assertEqual(resp.status_code, 200)

    def test_stock_list_station_denied(self):
        self._set_user(self.station_user_id)
        resp = self.client.get("/api/v1/stock/stock-cards")
        self.assertEqual(resp.status_code, 403)

    def test_stock_sync_operator_denied(self):
        self._set_user(self.operator_user_id)
        resp = self.client.post("/api/v1/stock/stock-cards/sync")
        self.assertEqual(resp.status_code, 403)


class TestIntegrationPermissions(BasePermissionApiTest):
    def test_integration_list_admin_allowed(self):
        self._set_user(self.admin_user_id)
        resp = self.client.get("/api/v1/integration/maps")
        self.assertEqual(resp.status_code, 200)

    def test_integration_list_operator_denied(self):
        self._set_user(self.operator_user_id)
        resp = self.client.get("/api/v1/integration/maps")
        self.assertEqual(resp.status_code, 403)

    def test_integration_create_map_operator_denied(self):
        self._set_user(self.operator_user_id)
        payload = {
            "entity_type": "account",
            "internal_id": "acc_test_1",
            "external_id": "mikro_1",
        }
        resp = self.client.post("/api/v1/integration/maps", json=payload)
        self.assertEqual(resp.status_code, 403)

    def test_integration_diagnostics_admin_allowed(self):
        self._set_user(self.admin_user_id)
        resp = self.client.get("/api/v1/integration/diagnostics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)
        self.assertIn("checks", data)

    def test_integration_diagnostics_operator_denied(self):
        self._set_user(self.operator_user_id)
        resp = self.client.get("/api/v1/integration/diagnostics")
        self.assertEqual(resp.status_code, 403)


if __name__ == "__main__":
    unittest.main()
