"""
OptiPlan 360 — JWT sub claim kontrat + Exception hiyerarşi testleri

JWT standardı: sub claim her zaman str(user.id) olmalı.
Exception hiyerarşi: AppError alt sınıfları doğru status_code ve code değerlerine sahip.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from jose import jwt

from app.services.token_service import TokenService, SECRET_KEY, ALGORITHM
from app.exceptions import (
    AppError,
    NotFoundError,
    ValidationError,
    BusinessRuleError,
    AuthorizationError,
    AuthenticationError,
    ConflictError,
    StatusTransitionError,
)


# ── JWT sub claim kontrat ────────────────────────────────────────────────────


class TestJWTSubClaim:
    """JWT sub claim her zaman string olmalı (RFC 7519)."""

    def test_create_refresh_token_sub_is_string(self):
        token = TokenService.create_refresh_token("42")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert isinstance(payload["sub"], str), "JWT sub claim string olmalı"
        assert payload["sub"] == "42"

    def test_create_access_token_sub_is_string(self):
        token = TokenService.create_access_token({"sub": "99", "role": "OPERATOR"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert isinstance(payload["sub"], str), "JWT sub claim string olmalı"
        assert payload["sub"] == "99"

    def test_refresh_token_type_claim(self):
        token = TokenService.create_refresh_token("1")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload.get("type") == "refresh"

    def test_access_token_type_claim(self):
        token = TokenService.create_access_token({"sub": "1", "role": "ADMIN"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload.get("type") == "access"

    def test_refresh_token_has_jti(self):
        """Her token benzersiz jti içermeli (replay attack önlemi)."""
        token = TokenService.create_refresh_token("5")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "jti" in payload, "JWT jti claim eksik"
        assert len(payload["jti"]) > 8


# ── Exception hiyerarşi kontrat ───────────────────────────────────────────────


class TestExceptionHierarchy:
    """AppError alt sınıfları doğru status_code & code değerlerine sahip olmalı."""

    def test_not_found_error_404(self):
        err = NotFoundError("Sipariş", 99)
        assert err.status_code == 404
        assert err.code == "NOT_FOUND"
        assert "99" in err.message

    def test_not_found_error_without_id(self):
        err = NotFoundError("Kullanıcı")
        assert err.status_code == 404
        assert "Kullanıcı" in err.message

    def test_validation_error_422(self):
        err = ValidationError("Alan geçersiz")
        assert err.status_code == 422
        assert err.code == "VALIDATION_ERROR"

    def test_authorization_error_403(self):
        err = AuthorizationError()
        assert err.status_code == 403
        assert err.code == "FORBIDDEN"

    def test_authorization_error_custom_message(self):
        err = AuthorizationError("Yetkin yok")
        assert err.status_code == 403
        assert "Yetkin yok" in err.message

    def test_authentication_error_401(self):
        err = AuthenticationError()
        assert err.status_code == 401
        assert err.code == "UNAUTHORIZED"

    def test_conflict_error_409(self):
        err = ConflictError("Zaten mevcut")
        assert err.status_code == 409
        assert err.code == "CONFLICT"

    def test_business_rule_error_400(self):
        err = BusinessRuleError("Kural ihlali")
        assert err.status_code == 400
        assert err.code == "BUSINESS_RULE_ERROR"

    def test_status_transition_error_is_business_rule(self):
        err = StatusTransitionError("NEW", "DONE", ["PROCESSING"])
        assert isinstance(err, BusinessRuleError)
        assert err.status_code == 400
        assert err.code == "INVALID_STATUS_TRANSITION"
        assert "NEW" in err.message
        assert "DONE" in err.message

    def test_all_errors_are_app_error(self):
        errors = [
            NotFoundError("X"),
            ValidationError("msg"),
            AuthorizationError(),
            AuthenticationError(),
            ConflictError("c"),
            BusinessRuleError("b"),
        ]
        for err in errors:
            assert isinstance(err, AppError), f"{type(err)} AppError değil"
            assert isinstance(err, Exception)

    def test_to_response_format(self):
        """to_response her zaman {'error': {'code':..,'message':..,'details':..}} formatında döner."""
        err = NotFoundError("Stok")
        response = err.to_response()
        assert "error" in response
        assert "code" in response["error"]
        assert "message" in response["error"]
        assert "details" in response["error"]

    def test_validation_error_with_details(self):
        from app.exceptions import FieldError
        details = [FieldError(field="stock_code", message="Zorunlu alan")]
        err = ValidationError("Validasyon hatası", details=details)
        assert len(err.details) == 1
        assert err.details[0].field == "stock_code"
