import sys
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.auth import get_current_user  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.exceptions import AppError  # noqa: E402
from app.models import Customer, Order, User  # noqa: E402
from app.routers import orders_router  # noqa: E402


def _create_test_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def _app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(orders_router.router)
    return app


class TestOrdersRouterPermissions(unittest.TestCase):
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
                email="admin@orders.local",
                username="admin_orders",
                display_name="Admin Orders",
                role="ADMIN",
                is_active=True,
            )
            operator_user = User(
                email="operator@orders.local",
                username="operator_orders",
                display_name="Operator Orders",
                role="OPERATOR",
                is_active=True,
            )
            viewer_user = User(
                email="viewer@orders.local",
                username="viewer_orders",
                display_name="Viewer Orders",
                role="VIEWER",
                is_active=True,
            )
            station_user = User(
                email="station@orders.local",
                username="station_orders",
                display_name="Station Orders",
                role="STATION",
                is_active=True,
            )
            kiosk_user = User(
                email="kiosk@orders.local",
                username="kiosk_orders",
                display_name="Kiosk Orders",
                role="KIOSK",
                is_active=True,
            )
            customer = Customer(name="Test Customer", phone="5551234567")

            db.add_all([admin_user, operator_user, viewer_user, station_user, kiosk_user, customer])
            db.flush()

            self.admin_user_id = admin_user.id
            self.operator_user_id = operator_user.id
            self.viewer_user_id = viewer_user.id
            self.station_user_id = station_user.id
            self.kiosk_user_id = kiosk_user.id
            self.customer_id = customer.id
            order = Order(
                customer_id=customer.id,
                status="NEW",
                crm_name_snapshot=customer.name,
                material_name="MDF",
                phone_norm=customer.phone,
                ts_code="20260312_000001",
            )
            db.add(order)
            db.commit()
        finally:
            db.close()

        self.current_user_id = self.operator_user_id
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
                return db.query(User).filter(User.id == self.current_user_id).first()
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db
        self.app.dependency_overrides[get_current_user] = override_get_user
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def _order_payload(self) -> dict:
        return {
            "customer_id": self.customer_id,
            "phone_norm": "5551234567",
            "thickness_mm": 18,
            "plate_w_mm": 2100,
            "plate_h_mm": 2800,
            "color": "Beyaz",
            "material_name": "MDF",
            "priority": "normal",
            "parts": [
                {
                    "part_group": "GOVDE",
                    "boy_mm": 700,
                    "en_mm": 400,
                    "adet": 2,
                }
            ],
        }

    def test_viewer_can_list_orders(self):
        self.current_user_id = self.viewer_user_id

        response = self.client.get("/api/v1/orders")

        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.json())

    def test_station_cannot_list_orders(self):
        self.current_user_id = self.kiosk_user_id

        response = self.client.get("/api/v1/orders")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["message"], "Yetersiz yetki")

    def test_station_cannot_create_order(self):
        self.current_user_id = self.station_user_id

        response = self.client.post("/api/v1/orders", json=self._order_payload())

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["error"]["message"],
            "Bu işlem için Operator veya Admin yetkisi gerekli",
        )

    def test_operator_can_create_order(self):
        self.current_user_id = self.operator_user_id

        response = self.client.post("/api/v1/orders", json=self._order_payload())

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["customer_id"], self.customer_id)
        self.assertEqual(response.json()["material_name"], "MDF")


if __name__ == "__main__":
    unittest.main()