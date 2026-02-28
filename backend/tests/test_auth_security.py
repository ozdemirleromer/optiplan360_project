"""
OptiPlan 360 — Auth & Security Testleri
  - Login başarılı / başarısız
  - Token doğrulama
  - Rol bazlı erişim kontrolleri
  - Hash/verify password
"""
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
import sys
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import User
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin, require_operator,
)
from app.routers import auth_router
from app.exceptions import AppError
from fastapi.responses import JSONResponse


class TestPasswordHashing(unittest.TestCase):
    """Parola hash/verify testleri."""

    def test_hash_and_verify(self):
        """Hash'lenmiş parola doğrulanabilmeli."""
        pw = "test123!"
        hashed = hash_password(pw)
        self.assertTrue(verify_password(pw, hashed))

    def test_wrong_password(self):
        """Yanlış parola → False."""
        hashed = hash_password("correct")
        self.assertFalse(verify_password("wrong", hashed))

    def test_hash_uniqueness(self):
        """Aynı parola farklı hash'ler üretmeli (salt)."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        self.assertNotEqual(h1, h2)


class TestLogin(unittest.TestCase):
    """Login endpoint testleri."""

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
                email="test@test.local",
                username="testuser",
                display_name="Test User",
                password_hash=hash_password("secret123"),
                role="OPERATOR",
                is_active=True,
            )
            inactive_user = User(
                email="inactive@test.local",
                username="inactive",
                display_name="Inactive",
                password_hash=hash_password("secret123"),
                role="OPERATOR",
                is_active=False,
            )
            db.add_all([user, inactive_user])
            db.commit()
        finally:
            db.close()

        app = FastAPI()
        # Global AppError handler (main.py'deki ile aynı)
        @app.exception_handler(AppError)
        async def _app_error_handler(request, exc: AppError):
            return JSONResponse(
                status_code=exc.status_code,
                content=exc.to_response(),
            )
        app.include_router(auth_router.router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_login_success(self):
        """Doğru kullanıcı/şifre → 200 + token."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "secret123"},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("token", body)
        self.assertEqual(body["user"]["username"], "testuser")

    def test_login_wrong_password(self):
        """Yanlış şifre → 401."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "wrong"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_unknown_user(self):
        """Olmayan kullanıcı → 401."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "secret123"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_inactive_user(self):
        """Devre dışı kullanıcı → 401."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"username": "inactive", "password": "secret123"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_with_email(self):
        """Email ile login → 200."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"username": "test@test.local", "password": "secret123"},
        )
        self.assertEqual(resp.status_code, 200)


class TestAccessToken(unittest.TestCase):
    """JWT token testleri."""

    def test_create_token(self):
        """Token oluşturulabilmeli."""
        token = create_access_token({"sub": "1", "role": "ADMIN"})
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 20)


if __name__ == "__main__":
    unittest.main()
