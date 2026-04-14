"""Compatibility shim for legacy JWT middleware imports.

The supported backend auth flow lives in ``app.auth`` and
``app.services.token_service``. This module re-exports the maintained helpers
under the older middleware-style names.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from app.auth import (
    ALGORITHM,
    ORCH_INTERNAL_KEY,
    SECRET_KEY,
    create_access_token,
    get_current_user,
    get_current_user_or_internal,
    hash_password,
    require_admin,
    require_operator,
    require_permissions,
    verify_password,
)
from app.services.token_service import (
    BLACKLISTED_TOKENS,
    TokenService,
    check_auth_attempts,
    get_auth_security_headers,
    record_auth_attempt,
    token_refresh_middleware,
)


def generateAccessToken(payload: dict) -> str:
    return create_access_token(payload)


def generateRefreshToken(user_id: str) -> str:
    return TokenService.create_refresh_token(user_id)


def verifyToken(token: str):
    try:
        return TokenService.decode_token(token)
    except Exception:
        return None


def blacklistToken(jti: str, reason: str = "logout") -> None:
    del reason
    BLACKLISTED_TOKENS.add(jti)


def shouldRotateToken(payload: Dict[str, Any]) -> bool:
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        return False

    time_until_expiry = int(exp) - int(datetime.now(timezone.utc).timestamp())
    return time_until_expiry < 5 * 60


def rotateToken(refreshToken: str):
    try:
        return TokenService.refresh_access_token(refreshToken)
    except Exception:
        return None


def validateToken(token: str):
    try:
        payload = TokenService.decode_token(token)
        return {"valid": True, "payload": payload}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


def getTokenInfo(token: str):
    try:
        payload = TokenService.decode_token(token)
        return {
            "jti": payload.get("jti"),
            "expires": payload.get("exp"),
            "user_id": payload.get("user_id"),
        }
    except Exception:
        return None


def cleanupExpiredTokens() -> None:
    TokenService.cleanup_expired_tokens()


jwtMiddleware = token_refresh_middleware


__all__ = [
    "ALGORITHM",
    "BLACKLISTED_TOKENS",
    "ORCH_INTERNAL_KEY",
    "SECRET_KEY",
    "TokenService",
    "blacklistToken",
    "check_auth_attempts",
    "cleanupExpiredTokens",
    "create_access_token",
    "generateAccessToken",
    "generateRefreshToken",
    "getTokenInfo",
    "get_auth_security_headers",
    "get_current_user",
    "get_current_user_or_internal",
    "hash_password",
    "jwtMiddleware",
    "record_auth_attempt",
    "require_admin",
    "require_operator",
    "require_permissions",
    "rotateToken",
    "shouldRotateToken",
    "token_refresh_middleware",
    "validateToken",
    "verifyToken",
    "verify_password",
]
