
import unittest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
from datetime import datetime, timedelta

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.auth import get_current_user, require_operator, require_permissions, require_admin
from app.database import Base, get_db
from app.models import User, Invoice, Payment, PaymentPromise
from app.routers import payment_router, crm_router
from app.exceptions import AppError
from app.permissions import Permission
from fastapi.responses import JSONResponse

def _create_test_app():
    app = FastAPI()
    @app.exception_handler(AppError)
    async def app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())
    
    app.include_router(payment_router.router)
    app.include_router(crm_router.router) # Cari hesap oluşturmak için gerekli
    return app

class BaseFinanceTest(unittest.TestCase):
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
            self.user = User(
                email="finance@test.local",
                username="finance_tester",
                display_name="Finance Tester",
                role="ADMIN", # Full yetki
                is_active=True,
            )
            db.add(self.user)
            db.flush()
            self.user_id = self.user.id
        finally:
            db.commit()
            db.close()

        self.app = _create_test_app()
        
        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()
        
        def override_get_user():
            db = self.SessionLocal()
            try:
                return db.query(User).filter(User.id == self.user_id).first()
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db
        self.app.dependency_overrides[get_current_user] = override_get_user
        self.app.dependency_overrides[require_operator] = override_get_user
        # bypass permissions for simplicity in unit tests, assuming user is admin
        def bypass_permissions():
            return override_get_user()
        
        # Override specific permission dependencies if needed, or rely on ADMIN role logic in app
        # But since require_permissions returns a dependency, we need to override it properly if we want to bypass check
        # For this test execution, we mock the dependency to return the user directly.
        
        self.client = TestClient(self.app)

        # Create a test account
        resp = self.client.post("/api/v1/crm/accounts", json={"company_name": "Finans Test Müşteri A.Ş."})
        self.account_id = resp.json()["id"]

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

class TestInvoices(BaseFinanceTest):
    def test_create_invoice(self):
        payload = {
            "account_id": self.account_id,
            "subtotal": 1000,
            "tax_rate": 20,
            "total_amount": 1200,
            "due_date": (datetime.now() + timedelta(days=7)).isoformat()
        }
        resp = self.client.post("/api/v1/payments/invoices", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_amount"], 1200)
        self.assertEqual(data["remaining_amount"], 1200)
        self.assertEqual(data["status"], "PENDING")
        self.assertIsNotNone(data["invoice_number"])
        return data["id"]

    def test_list_invoices(self):
        self.test_create_invoice()
        resp = self.client.get("/api/v1/payments/invoices")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

class TestPayments(BaseFinanceTest):
    def setUp(self):
        super().setUp()
        # Create an invoice first
        payload = {
            "account_id": self.account_id,
            "subtotal": 1000,
            "tax_rate": 20,
            "total_amount": 1200,
            "invoice_type": "SALES"
        }
        resp = self.client.post("/api/v1/payments/invoices", json=payload)
        self.invoice_id = resp.json()["id"]

    def test_create_full_payment(self):
        payload = {
            "invoice_id": self.invoice_id,
            "account_id": self.account_id,
            "payment_method": "TRANSFER",
            "amount": 1200,
            "payment_date": datetime.now().isoformat()
        }
        resp = self.client.post("/api/v1/payments/payments", json=payload)
        self.assertEqual(resp.status_code, 200)
        
        # Verify invoice status
        inv_resp = self.client.get(f"/api/v1/payments/invoices/{self.invoice_id}")
        self.assertEqual(inv_resp.json()["status"], "PAID")
        self.assertEqual(inv_resp.json()["remaining_amount"], 0)

    def test_create_partial_payment(self):
        payload = {
            "invoice_id": self.invoice_id,
            "account_id": self.account_id,
            "payment_method": "CASH",
            "amount": 500,
            "payment_date": datetime.now().isoformat()
        }
        resp = self.client.post("/api/v1/payments/payments", json=payload)
        self.assertEqual(resp.status_code, 200)
        
        # Verify invoice remaining amount
        inv_resp = self.client.get(f"/api/v1/payments/invoices/{self.invoice_id}")
        self.assertEqual(inv_resp.json()["status"], "PARTIAL")
        self.assertEqual(inv_resp.json()["remaining_amount"], 700) # 1200 - 500

class TestPaymentPromises(BaseFinanceTest):
    def test_create_promise(self):
        payload = {
            "invoice_id": "inv_123_dummy", # Normally should be real, but service might not check relation strictly unless enforcing foreign key in sqlite
            "account_id": self.account_id,
            "promised_amount": 5000,
            "promise_date": (datetime.now() + timedelta(days=5)).isoformat(),
            "notes": "Haftaya ödeyecek"
        }
        # Note: Foreign key constraint might fail if invoice_id doesn't exist.
        # Let's create an invoice first to be safe.
        inv_payload = {
            "account_id": self.account_id,
            "subtotal": 5000,
            "total_amount": 5000
        }
        inv_resp = self.client.post("/api/v1/payments/invoices", json=inv_payload)
        invoice_id = inv_resp.json()["id"]
        
        payload["invoice_id"] = invoice_id
        
        resp = self.client.post("/api/v1/payments/promises", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["promised_amount"], 5000)

if __name__ == "__main__":
    unittest.main()
