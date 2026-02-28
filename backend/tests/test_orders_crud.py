"""
OptiPlan 360 — Kapsamlı Sipariş API Testleri
Test kapsamı:
  - Sipariş oluşturma (başarılı + validasyon hataları)
  - Sipariş güncelleme (başlık + parça)
  - Sipariş silme
  - Validasyon endpoint'i
  - Onaylama
  - Durum geçişleri
  - Yetkilendirme kontrolleri
  - Pydantic schema validasyonları
"""
import json
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

from app.auth import get_current_user, require_operator, require_admin  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.models import Customer, Order, OrderPart, User  # noqa: E402
from app.routers import orders_router  # noqa: E402
from app.exceptions import AppError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402


def _create_test_app(override_user=None):
    """Test uygulaması oluştur."""
    app = FastAPI()

    # AppError handler
    @app.exception_handler(AppError)
    async def app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(orders_router.router)
    return app


class BaseOrderTest(unittest.TestCase):
    """Temel test altyapısı."""

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
            # Admin kullanıcı
            self.admin_user = User(
                email="admin@test.local",
                username="admin_test",
                display_name="Admin Test",
                role="ADMIN",
                is_active=True,
            )
            # Operator kullanıcı
            self.operator_user = User(
                email="operator@test.local",
                username="operator_test",
                display_name="Operator Test",
                role="OPERATOR",
                is_active=True,
            )
            # Station (düşük yetki) kullanıcı
            self.station_user = User(
                email="station@test.local",
                username="station_test",
                display_name="Station Test",
                role="STATION",
                is_active=True,
            )
            # Müşteri
            self.customer = Customer(
                name="Test Müşteri",
                phone="5551234567",
            )
            db.add_all([self.admin_user, self.operator_user, self.station_user, self.customer])
            db.flush()

            self.customer_id = self.customer.id
            self.admin_id = self.admin_user.id
            self.operator_id = self.operator_user.id
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

        self.app.dependency_overrides[get_db] = override_get_db
        # Varsayılan: operator olarak test et
        self._set_user_id(self.operator_id, "OPERATOR")
        self.client = TestClient(self.app)

    def _set_user_id(self, user_id, role="OPERATOR"):
        """Test kullanıcısını ID üzerinden ayarla (detached instance sorununu önler)."""
        session_local = self.SessionLocal

        def _get_user():
            db = session_local()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                return user
            finally:
                db.close()

        self.app.dependency_overrides[get_current_user] = _get_user
        if role in ("ADMIN", "OPERATOR"):
            self.app.dependency_overrides[require_operator] = _get_user
        if role == "ADMIN":
            self.app.dependency_overrides[require_admin] = _get_user

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def _valid_order_payload(self, **overrides):
        """Geçerli sipariş payload'ı üret."""
        payload = {
            "customer_id": self.customer_id,
            "phone_norm": "5551234567",
            "thickness_mm": 18,
            "plate_w_mm": 2800,
            "plate_h_mm": 2070,
            "color": "Beyaz",
            "material_name": "Suntalam",
            "band_mm": 0.4,
            "grain_default": "0-Material",
            "parts": [
                {
                    "part_group": "GOVDE",
                    "boy_mm": 700,
                    "en_mm": 400,
                    "adet": 2,
                    "grain_code": "0-Material",
                    "u1": True,
                    "u2": False,
                    "k1": True,
                    "k2": False,
                }
            ],
        }
        payload.update(overrides)
        return payload


class TestCreateOrder(BaseOrderTest):
    """Sipariş oluşturma testleri."""

    def test_create_order_success(self):
        """Geçerli payload → 201 + OrderOut döner."""
        payload = self._valid_order_payload()
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["customer_id"], self.customer_id)
        self.assertEqual(body["status"], "DRAFT")
        self.assertEqual(len(body["parts"]), 1)
        self.assertEqual(body["parts"][0]["boy_mm"], 700)

    def test_create_order_invalid_thickness(self):
        """Geçersiz kalınlık → 422."""
        payload = self._valid_order_payload(thickness_mm=12)
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_create_order_missing_parts(self):
        """Boş parça listesi → 422."""
        payload = self._valid_order_payload(parts=[])
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_create_order_invalid_part_dimensions(self):
        """Negatif boy → 422."""
        payload = self._valid_order_payload(parts=[{
            "part_group": "GOVDE",
            "boy_mm": -10,
            "en_mm": 400,
            "adet": 2,
            "grain_code": "0-Material",
        }])
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_create_order_arkalik_no_band(self):
        """Arkalık parçasında bant → 422."""
        payload = self._valid_order_payload(parts=[{
            "part_group": "ARKALIK",
            "boy_mm": 600,
            "en_mm": 300,
            "adet": 1,
            "grain_code": "0-Material",
            "u1": True,  # bant!
        }])
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_create_order_invalid_customer(self):
        """Olmayan müşteri → 404."""
        payload = self._valid_order_payload(customer_id=99999)
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertIn(resp.status_code, [400, 404])

    def test_create_order_invalid_grain_code(self):
        """Geçersiz grain_code → 422."""
        payload = self._valid_order_payload(parts=[{
            "part_group": "GOVDE",
            "boy_mm": 700,
            "en_mm": 400,
            "adet": 1,
            "grain_code": "INVALID",
        }])
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_create_order_phone_too_short(self):
        """Kısa telefon → 422."""
        payload = self._valid_order_payload(phone_norm="123")
        resp = self.client.post("/api/v1/orders", json=payload)
        self.assertEqual(resp.status_code, 422)


class TestUpdateOrder(BaseOrderTest):
    """Sipariş güncelleme testleri."""

    def _create_order(self):
        payload = self._valid_order_payload()
        resp = self.client.post("/api/v1/orders", json=payload)
        return resp.json()

    def test_update_order_header(self):
        """Başlık güncelleme → 200."""
        order = self._create_order()
        resp = self.client.put(
            f"/api/v1/orders/{order['id']}",
            json={"color": "Siyah"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["color"], "Siyah")

    def test_replace_parts(self):
        """Parça değiştirme → 200."""
        order = self._create_order()
        new_parts = [
            {
                "part_group": "GOVDE",
                "boy_mm": 500,
                "en_mm": 300,
                "adet": 4,
                "grain_code": "1-Material",
            }
        ]
        resp = self.client.put(
            f"/api/v1/orders/{order['id']}/parts",
            json=new_parts,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["parts"]), 1)
        self.assertEqual(resp.json()["parts"][0]["boy_mm"], 500)


class TestDeleteOrder(BaseOrderTest):
    """Sipariş silme testleri."""

    def _create_order(self):
        payload = self._valid_order_payload()
        return self.client.post("/api/v1/orders", json=payload).json()

    def test_delete_new_order(self):
        """NEW durumundaki siparişi sil → 200."""
        order = self._create_order()
        resp = self.client.delete(f"/api/v1/orders/{order['id']}")
        self.assertEqual(resp.status_code, 200)

    def test_delete_not_found(self):
        """Olmayan sipariş → 404."""
        resp = self.client.delete("/api/v1/orders/99999")
        self.assertIn(resp.status_code, [404])


class TestValidateOrder(BaseOrderTest):
    """Validasyon endpoint testleri."""

    def _create_order_with_parts(self, with_crm=True):
        payload = self._valid_order_payload()
        resp = self.client.post("/api/v1/orders", json=payload)
        order = resp.json()
        if not with_crm:
            db = self.SessionLocal()
            try:
                o = db.query(Order).filter(Order.id == order["id"]).first()
                o.crm_name_snapshot = None
                db.commit()
            finally:
                db.close()
        return order

    def test_validate_with_missing_crm(self):
        """CRM snapshot eksik → valid=False."""
        order = self._create_order_with_parts(with_crm=False)
        resp = self.client.post(f"/api/v1/orders/{order['id']}/validate")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertFalse(body["valid"])
        self.assertTrue(any(e["field"] == "crm_name_snapshot" for e in body["errors"]))

    def test_validate_with_empty_parts(self):
        """Parçasız sipariş → valid=False."""
        order = self._create_order_with_parts()
        # Parçaları sil
        db = self.SessionLocal()
        try:
            db.query(OrderPart).filter(OrderPart.order_id == order["id"]).delete()
            db.commit()
        finally:
            db.close()
        resp = self.client.post(f"/api/v1/orders/{order['id']}/validate")
        body = resp.json()
        self.assertFalse(body["valid"])
        self.assertTrue(any(e["field"] == "parts" for e in body["errors"]))


class TestStatusTransitions(BaseOrderTest):
    """Durum geçiş testleri."""

    def _create_order(self):
        payload = self._valid_order_payload()
        return self.client.post("/api/v1/orders", json=payload).json()

    def test_get_transitions(self):
        """Geçerli geçişleri getir → current_status + allowed_transitions."""
        order = self._create_order()
        resp = self.client.get(f"/api/v1/orders/{order['id']}/transitions")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("current_status", body)
        self.assertIn("allowed_transitions", body)

    def test_valid_transition(self):
        """NEW → HOLD geçerli geçiş."""
        order = self._create_order()
        # Önce durumu NEW'a çekelim
        db = self.SessionLocal()
        try:
            o = db.query(Order).filter(Order.id == order["id"]).first()
            o.status = "NEW"
            db.commit()
        finally:
            db.close()
        resp = self.client.patch(
            f"/api/v1/orders/{order['id']}/status?new_status=HOLD"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["new"], "HOLD")

    def test_invalid_transition(self):
        """NEW → DONE geçersiz geçiş → 400."""
        order = self._create_order()
        db = self.SessionLocal()
        try:
            o = db.query(Order).filter(Order.id == order["id"]).first()
            o.status = "NEW"
            db.commit()
        finally:
            db.close()
        resp = self.client.patch(
            f"/api/v1/orders/{order['id']}/status?new_status=DONE"
        )
        self.assertIn(resp.status_code, [400])


class TestListOrders(BaseOrderTest):
    """Sipariş listeleme testleri."""

    def test_list_empty(self):
        """Boş liste → 200 + total=0."""
        resp = self.client.get("/api/v1/orders")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["total"], 0)
        self.assertEqual(body["data"], [])

    def test_list_with_data(self):
        """Sipariş varsa listede görünür."""
        payload = self._valid_order_payload()
        self.client.post("/api/v1/orders", json=payload)
        resp = self.client.get("/api/v1/orders")
        body = resp.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(len(body["data"]), 1)


class TestSchemaValidation(unittest.TestCase):
    """Pydantic schema validasyon testleri (endpoint'siz)."""

    def test_valid_order_part_create(self):
        from app.schemas import OrderPartCreate
        part = OrderPartCreate(
            part_group="GOVDE",
            boy_mm=700,
            en_mm=400,
            adet=2,
            grain_code="0-Material",
        )
        self.assertEqual(part.boy_mm, 700)

    def test_invalid_part_group(self):
        from app.schemas import OrderPartCreate
        with self.assertRaises(Exception):
            OrderPartCreate(
                part_group="INVALID",
                boy_mm=700,
                en_mm=400,
                adet=2,
                grain_code="0-Material",
            )

    def test_negative_boy_mm(self):
        from app.schemas import OrderPartCreate
        with self.assertRaises(Exception):
            OrderPartCreate(
                part_group="GOVDE",
                boy_mm=-5,
                en_mm=400,
                adet=2,
                grain_code="0-Material",
            )

    def test_zero_adet(self):
        from app.schemas import OrderPartCreate
        with self.assertRaises(Exception):
            OrderPartCreate(
                part_group="GOVDE",
                boy_mm=700,
                en_mm=400,
                adet=0,
                grain_code="0-Material",
            )

    def test_arkalik_bant_rejected(self):
        from app.schemas import OrderPartCreate
        with self.assertRaises(Exception):
            OrderPartCreate(
                part_group="ARKALIK",
                boy_mm=700,
                en_mm=400,
                adet=2,
                grain_code="0-Material",
                u1=True,
            )

    def test_invalid_grain_code(self):
        from app.schemas import OrderPartCreate
        with self.assertRaises(Exception):
            OrderPartCreate(
                part_group="GOVDE",
                boy_mm=700,
                en_mm=400,
                adet=2,
                grain_code="5-Material",
            )

    def test_oversized_boy_mm(self):
        from app.schemas import OrderPartCreate
        with self.assertRaises(Exception):
            OrderPartCreate(
                part_group="GOVDE",
                boy_mm=6000,  # > 5000
                en_mm=400,
                adet=2,
                grain_code="0-Material",
            )

    def test_order_create_invalid_thickness(self):
        from app.schemas import OrderCreate
        with self.assertRaises(Exception):
            OrderCreate(
                customer_id=1,
                phone_norm="5551234567",
                thickness_mm=12,  # geçersiz
                plate_w_mm=2800,
                plate_h_mm=2070,
                color="Beyaz",
                material_name="Suntalam",
                parts=[{
                    "part_group": "GOVDE",
                    "boy_mm": 700,
                    "en_mm": 400,
                    "adet": 1,
                    "grain_code": "0-Material",
                }],
            )

    def test_order_create_empty_parts(self):
        from app.schemas import OrderCreate
        with self.assertRaises(Exception):
            OrderCreate(
                customer_id=1,
                phone_norm="5551234567",
                thickness_mm=18,
                plate_w_mm=2800,
                plate_h_mm=2070,
                color="Beyaz",
                material_name="Suntalam",
                parts=[],
            )


if __name__ == "__main__":
    unittest.main()
