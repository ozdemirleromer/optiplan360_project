"""
Price Tracking integration tests:
1) Permission invariants
2) Service helpers / derived calculations
3) Router access control
"""
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pandas as pd
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

from app.auth import get_current_user  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.exceptions import AppError, AuthorizationError, ValidationError  # noqa: E402
from app.models import PriceUploadJob, User  # noqa: E402
from app.permissions import Permission, get_permissions_for_role  # noqa: E402
from app.routers import price_tracking_router  # noqa: E402
from app.services.price_tracking_helpers import normalize_columns  # noqa: E402
from app.services.price_tracking_service import PriceTrackingService  # noqa: E402


def _create_test_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def _app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(price_tracking_router.router)
    return app


class TestPriceTrackingPermissions(unittest.TestCase):
    def test_operator_subset_of_admin(self):
        admin_perms = set(get_permissions_for_role("ADMIN"))
        operator_perms = set(get_permissions_for_role("OPERATOR"))
        self.assertEqual(operator_perms - admin_perms, set())

    def test_viewer_only_view_permission_for_price_tracking(self):
        viewer = set(get_permissions_for_role("VIEWER"))
        self.assertIn(Permission.PRICE_TRACKING_VIEW.value, viewer)
        self.assertNotIn(Permission.PRICE_TRACKING_UPLOAD.value, viewer)
        self.assertNotIn(Permission.PRICE_TRACKING_EXPORT.value, viewer)
        self.assertNotIn(Permission.PRICE_TRACKING_DELETE.value, viewer)

    def test_operator_has_expected_price_tracking_permissions(self):
        operator = set(get_permissions_for_role("OPERATOR"))
        self.assertIn(Permission.PRICE_TRACKING_VIEW.value, operator)
        self.assertIn(Permission.PRICE_TRACKING_UPLOAD.value, operator)
        self.assertIn(Permission.PRICE_TRACKING_EXPORT.value, operator)
        self.assertNotIn(Permission.PRICE_TRACKING_DELETE.value, operator)


class TestPriceTrackingService(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        Base.metadata.create_all(bind=self.engine)

        db = self.SessionLocal()
        try:
            self.admin = User(
                email="admin.price@test.local",
                username="admin_price",
                display_name="Admin Price",
                role="ADMIN",
                is_active=True,
            )
            self.operator = User(
                email="operator.price@test.local",
                username="operator_price",
                display_name="Operator Price",
                role="OPERATOR",
                is_active=True,
            )
            db.add_all([self.admin, self.operator])
            db.flush()

            self.admin_id = self.admin.id
            self.operator_id = self.operator.id

            self.job = PriceUploadJob(
                id="job-service-1",
                status="PENDING",
                original_filename="prices.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                file_size=10,
                file_data=b"dummy",
                supplier="Demo Supplier",
                uploaded_by_id=self.admin_id,
            )
            db.add(self.job)
            db.commit()
        finally:
            db.close()

    def tearDown(self):
        self.engine.dispose()

    def test_normalize_columns_maps_common_aliases(self):
        mapped = normalize_columns(["Product Name", "Price", "Discount %"])
        self.assertEqual(mapped.get("Product Name"), "URUN_ADI")
        self.assertEqual(mapped.get("Price"), "LISTE_FIYATI")
        self.assertEqual(mapped.get("Discount %"), "ISKONTO_ORANI")

    def test_calculate_derived_fields(self):
        df = pd.DataFrame(
            [
                {
                    "URUN_ADI": "Ornek Urun",
                    "LISTE_FIYATI": 100.0,
                    "ISKONTO_ORANI": 10.0,
                    "KDV_ORANI": 20.0,
                }
            ]
        )
        out = PriceTrackingService._calculate_derived_fields(df)
        self.assertAlmostEqual(float(out.iloc[0]["NET_FIYAT"]), 90.0, places=2)
        self.assertAlmostEqual(float(out.iloc[0]["KDV_DAHIL_FIYAT"]), 108.0, places=2)

    def test_upload_validation_rejects_unsupported_extension(self):
        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == self.operator_id).first()
            with self.assertRaises(ValidationError):
                PriceTrackingService.upload_and_process(
                    db=db,
                    file_data=b"hello",
                    filename="prices.txt",
                    content_type="text/plain",
                    supplier="Demo Supplier",
                    user=user,
                )
        finally:
            db.close()

    def test_assert_can_modify_enforces_owner_for_operator(self):
        db = self.SessionLocal()
        try:
            job = db.query(PriceUploadJob).filter(PriceUploadJob.id == "job-service-1").first()
            operator = db.query(User).filter(User.id == self.operator_id).first()
            with self.assertRaises(AuthorizationError):
                PriceTrackingService._assert_can_modify(job, operator)
        finally:
            db.close()


class TestPriceTrackingRouterPermissions(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        Base.metadata.create_all(bind=self.engine)

        db = self.SessionLocal()
        try:
            self.admin = User(
                email="admin.router@test.local",
                username="admin_router",
                display_name="Admin Router",
                role="ADMIN",
                is_active=True,
            )
            self.operator = User(
                email="operator.router@test.local",
                username="operator_router",
                display_name="Operator Router",
                role="OPERATOR",
                is_active=True,
            )
            self.viewer = User(
                email="viewer.router@test.local",
                username="viewer_router",
                display_name="Viewer Router",
                role="VIEWER",
                is_active=True,
            )
            db.add_all([self.admin, self.operator, self.viewer])
            db.flush()

            self.admin_id = self.admin.id
            self.operator_id = self.operator.id
            self.viewer_id = self.viewer.id
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

    def test_viewer_can_list_jobs(self):
        self._set_user(self.viewer_id)
        resp = self.client.get("/api/v1/price-tracking/jobs")
        self.assertEqual(resp.status_code, 200)

    def test_viewer_cannot_upload(self):
        self._set_user(self.viewer_id)
        resp = self.client.post(
            "/api/v1/price-tracking/upload",
            data={"supplier": "Demo Supplier"},
            files={"file": ("prices.xlsx", b"dummy", "application/octet-stream")},
        )
        self.assertEqual(resp.status_code, 403)

    def test_operator_upload_allowed(self):
        self._set_user(self.operator_id)
        with patch(
            "app.routers.price_tracking_router.PriceTrackingService.upload_and_process"
        ) as mock_upload:
            mock_upload.return_value = {
                "id": "job-router-upload-1",
                "status": "PENDING",
                "original_filename": "prices.xlsx",
                "supplier": "Demo Supplier",
                "rows_extracted": 0,
                "error_message": None,
                "created_at": datetime.utcnow().isoformat(),
            }
            resp = self.client.post(
                "/api/v1/price-tracking/upload",
                data={"supplier": "Demo Supplier"},
                files={
                    "file": (
                        "prices.xlsx",
                        b"dummy",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
            self.assertEqual(resp.status_code, 201)

    def test_viewer_cannot_export(self):
        self._set_user(self.viewer_id)
        resp = self.client.post(
            "/api/v1/price-tracking/export",
            json={"job_ids": ["job-1"]},
        )
        self.assertEqual(resp.status_code, 403)

    def test_operator_can_export(self):
        self._set_user(self.operator_id)
        with patch(
            "app.routers.price_tracking_router.PriceTrackingService.export_to_excel"
        ) as mock_export:
            mock_export.return_value = b"excel-bytes"
            resp = self.client.post(
                "/api/v1/price-tracking/export",
                json={"job_ids": ["job-1"]},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertIn(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                resp.headers.get("content-type", ""),
            )

    def test_operator_cannot_delete(self):
        self._set_user(self.operator_id)
        resp = self.client.delete("/api/v1/price-tracking/jobs/job-1")
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_delete(self):
        self._set_user(self.admin_id)
        with patch(
            "app.routers.price_tracking_router.PriceTrackingService.delete_job"
        ) as mock_delete:
            mock_delete.return_value = None
            resp = self.client.delete("/api/v1/price-tracking/jobs/job-1")
            self.assertEqual(resp.status_code, 204)


if __name__ == "__main__":
    unittest.main()
