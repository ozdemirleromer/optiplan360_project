import unittest
from datetime import datetime, timedelta, timezone
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

from app.database import Base  # noqa: E402
from app.models import Station, StatusLog, User  # noqa: E402
from app.routers import stations_router  # noqa: E402
from app.auth import get_current_user  # noqa: E402


class StationScanRulesTest(unittest.TestCase):
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
            db.add_all([
                Station(name="HAZIRLIK", description="Hazirlik"),
                Station(name="EBATLAMA", description="Ebatlama"),
            ])
            # Test için kullanıcı oluştur
            from app.auth import hash_password
            user = User(
                username="testop",
                email="testop@test.com",
                password_hash=hash_password("Test1234!"),
                role="OPERATOR",
                is_active=True,
            )
            db.add(user)
            db.commit()
            self.user_id = user.id
        finally:
            db.close()

        app = FastAPI()
        app.include_router(stations_router.router, prefix="/api/v1")

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        user_id = self.user_id
        session_local = self.SessionLocal

        def override_get_current_user():
            db = session_local()
            try:
                return db.get(User, user_id)
            finally:
                db.close()

        app.dependency_overrides[stations_router.get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    @unittest.skip("Endpoint /api/v1/stations/scan henuz implemente edilmedi")
    def test_second_scan_before_30_minutes_is_rejected(self):
        db = self.SessionLocal()
        try:
            hazirlik = db.query(Station).filter(Station.name == "HAZIRLIK").first()
            ebatlama = db.query(Station).filter(Station.name == "EBATLAMA").first()
            db.add(
                StatusLog(
                    part_id=10,
                    station_id=hazirlik.id,
                    status="IN_PROGRESS",
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=10),
                )
            )
            db.commit()
            ebatlama_id = ebatlama.id
        finally:
            db.close()

        response = self.client.post(
            "/api/v1/stations/scan",
            json={"order_id": "ORD-1", "part_id": 10, "station_id": ebatlama_id},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("minimum 30 minutes", response.json()["detail"])

    @unittest.skip("Endpoint /api/v1/stations/scan henuz implemente edilmedi")
    def test_second_scan_after_30_minutes_is_allowed(self):
        db = self.SessionLocal()
        try:
            hazirlik = db.query(Station).filter(Station.name == "HAZIRLIK").first()
            ebatlama = db.query(Station).filter(Station.name == "EBATLAMA").first()
            db.add(
                StatusLog(
                    part_id=11,
                    station_id=hazirlik.id,
                    status="IN_PROGRESS",
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=31),
                )
            )
            db.commit()
            ebatlama_id = ebatlama.id
        finally:
            db.close()

        response = self.client.post(
            "/api/v1/stations/scan",
            json={"order_id": "ORD-2", "part_id": 11, "station_id": ebatlama_id},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["message"], "Scan processed")


if __name__ == "__main__":
    unittest.main()
