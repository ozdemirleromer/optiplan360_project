from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import get_db
from app.exceptions import AppError
from app.features.stock.transport.http.router import router as stock_router
from app.models.core import User


def _build_test_client(db_session) -> TestClient:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def _app_error_handler(_request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    app.include_router(stock_router)

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return User(
            id=1,
            username="admin",
            email="admin@test.local",
            role="ADMIN",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


def test_stock_router_create_accepts_child_payload_and_returns_child_lists(db_session) -> None:
    client = _build_test_client(db_session)

    create_response = client.post(
        "/api/v1/stock/stock-cards",
        json={
            "stock_code": "STK-ROUTER-001",
            "stock_name": "Router Stok",
            "unit": "ADET",
            "purchase_price": 90,
            "sale_price": 125,
            "total_quantity": 12,
            "barkodlar": [{"barcode": "8691234567890"}],
            "satis_fiyatlari": [{"price_type": "LISTE", "amount": 125}],
        },
    )

    assert create_response.status_code == 201
    created_payload = create_response.json()
    assert created_payload["stock_code"] == "STK-ROUTER-001"
    assert len(created_payload["barkodlar"]) == 1
    assert created_payload["barkodlar"][0]["barcode"] == "8691234567890"
    assert len(created_payload["satis_fiyatlari"]) == 1
    assert created_payload["satis_fiyatlari"][0]["price_type"] == "LISTE"
    assert created_payload["satis_fiyatlari"][0]["amount"] == 125.0

    detail_response = client.get("/api/v1/stock/stock-cards/STK-ROUTER-001")
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["barkodlar"][0]["barcode"] == "8691234567890"
    assert detail_payload["satis_fiyatlari"][0]["price_type"] == "LISTE"


def test_stock_router_create_rejects_blank_barcode_with_validation_contract(db_session) -> None:
    client = _build_test_client(db_session)

    response = client.post(
        "/api/v1/stock/stock-cards",
        json={
            "stock_code": "STK-ROUTER-ERR-001",
            "stock_name": "Hatali Barkod",
            "unit": "ADET",
            "total_quantity": 1,
            "barkodlar": [{"barcode": "   "}],
        },
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["message"] == "Barkod boş olamaz"


def test_stock_router_create_rejects_duplicate_price_type_with_validation_contract(db_session) -> None:
    client = _build_test_client(db_session)

    response = client.post(
        "/api/v1/stock/stock-cards",
        json={
            "stock_code": "STK-ROUTER-ERR-002",
            "stock_name": "Hatali Fiyat Tipi",
            "unit": "ADET",
            "total_quantity": 1,
            "satis_fiyatlari": [
                {"price_type": "LISTE", "amount": 125},
                {"price_type": "LISTE", "amount": 130},
            ],
        },
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["message"] == "Aynı fiyat tipi bir stok kartında tekrar edemez"


def test_stock_router_create_rejects_duplicate_barcode_with_validation_contract(db_session) -> None:
    client = _build_test_client(db_session)

    response = client.post(
        "/api/v1/stock/stock-cards",
        json={
            "stock_code": "STK-ROUTER-ERR-003",
            "stock_name": "Tekrarli Barkod",
            "unit": "ADET",
            "total_quantity": 1,
            "barkodlar": [
                {"barcode": "8691234567890"},
                {"barcode": "8691234567890"},
            ],
        },
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["message"] == "Aynı barkod bir stok kartında tekrar edemez"
