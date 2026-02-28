
import unittest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.auth import get_current_user, require_operator, require_admin
from app.database import Base, get_db
from app.models import User, CRMAccount, CRMOpportunity, CRMContact
from app.routers import crm_router
from app.exceptions import AppError
from fastapi.responses import JSONResponse

def _create_test_app():
    app = FastAPI()
    @app.exception_handler(AppError)
    async def app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())
    
    app.include_router(crm_router.router)
    return app

class BaseCRMTest(unittest.TestCase):
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
                email="test@crm.local",
                username="crm_tester",
                display_name="CRM Tester",
                role="OPERATOR",
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
        
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

class TestCRMAccounts(BaseCRMTest):
    def test_create_account(self):
        payload = {
            "company_name": "Test Şirketi A.Ş.",
            "account_type": "CORPORATE",
            "email": "info@test.com",
            "phone": "02125554433",
            "tax_id": "1234567890",
            "tax_office": "Maslak"
        }
        resp = self.client.post("/api/v1/crm/accounts", json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["company_name"], "Test Şirketi A.Ş.")
        self.assertIsNotNone(data["id"])

    def test_list_accounts(self):
        # Create dummy account
        self.client.post("/api/v1/crm/accounts", json={"company_name": "Şirket 1"})
        self.client.post("/api/v1/crm/accounts", json={"company_name": "Şirket 2"})
        
        resp = self.client.get("/api/v1/crm/accounts")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 2)

    def test_get_account_detail(self):
        create_resp = self.client.post("/api/v1/crm/accounts", json={"company_name": "Detay Test"})
        account_id = create_resp.json()["id"]
        
        resp = self.client.get(f"/api/v1/crm/accounts/{account_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["company_name"], "Detay Test")

class TestCRMOpportunities(BaseCRMTest):
    def setUp(self):
        super().setUp()
        # Create a parent account for opportunities
        resp = self.client.post("/api/v1/crm/accounts", json={"company_name": "Fırsat Sahibi A.Ş."})
        self.account_id = resp.json()["id"]

    def test_create_opportunity(self):
        payload = {
            "account_id": self.account_id,
            "title": "Büyük Mobilya Siparişi",
            "stage": "LEAD",
            "amount": 50000,
            "probability": 20
        }
        resp = self.client.post("/api/v1/crm/opportunities", json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["title"], "Büyük Mobilya Siparişi")
        self.assertEqual(data["account_id"], self.account_id)

    def test_update_stage(self):
        # Create
        payload = {"account_id": self.account_id, "title": "Test Fırsat", "stage": "LEAD"}
        create_resp = self.client.post("/api/v1/crm/opportunities", json=payload)
        opp_id = create_resp.json()["id"]
        
        # Update fields (PUT)
        put_payload = {"amount": 10000}
        resp = self.client.put(f"/api/v1/crm/opportunities/{opp_id}", json=put_payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["amount"], 10000)

        # Transition Stage (POST)
        transition_payload = {"new_stage": "NEGOTIATION"}
        resp = self.client.post(f"/api/v1/crm/opportunities/{opp_id}/transition", json=transition_payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["stage"], "NEGOTIATION")

if __name__ == "__main__":
    unittest.main()
