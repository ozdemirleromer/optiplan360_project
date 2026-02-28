import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.auth import get_current_user
from app.database import get_db


@pytest.fixture()
def client():
    return TestClient(app, headers={"Host": "localhost"})


def _make_mock_user(role="CUSTOMER", crm_account_id="test_crm_123"):
    user = MagicMock()
    user.role = role
    user.crm_account_id = crm_account_id
    user.id = 1
    return user


@pytest.mark.skip(reason="Order modeli crm_account_id alanina sahip degil — portal endpoint model uyumsuzlugu")
def test_customer_portal_dashboard(client):
    customer_user = _make_mock_user("CUSTOMER", "test_crm_account_123")

    mock_db = MagicMock()

    # active orders count
    mock_db.query.return_value.filter.return_value.count.side_effect = [5, 12]

    # CRM account balance
    mock_crm_account = MagicMock()
    mock_crm_account.balance = 1500.50
    mock_db.query.return_value.filter.return_value.first.return_value = mock_crm_account

    app.dependency_overrides[get_current_user] = lambda: customer_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        response = client.get("/api/v1/portal/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "TRY"
    finally:
        app.dependency_overrides.clear()


def test_customer_portal_forbidden_for_operator(client):
    operator_user = _make_mock_user("OPERATOR", None)

    app.dependency_overrides[get_current_user] = lambda: operator_user
    try:
        response = client.get("/api/v1/portal/dashboard")
        assert response.status_code == 403
        detail = response.json().get("detail", "")
        assert "sadece müşteri" in detail.lower()
    finally:
        app.dependency_overrides.clear()


def test_customer_portal_forbidden_without_crm_account(client):
    customer_user = _make_mock_user("CUSTOMER", None)

    app.dependency_overrides[get_current_user] = lambda: customer_user
    try:
        response = client.get("/api/v1/portal/dashboard")
        assert response.status_code == 403
        detail = response.json().get("detail", "")
        assert "tanımlı bir şirket" in detail.lower()
    finally:
        app.dependency_overrides.clear()
