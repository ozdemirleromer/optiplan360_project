"""
OptiPlan 360 - JWT authentication helpers.
Compatible with bcrypt when installed; falls back to PBKDF2-SHA256.
"""

import base64
import hashlib
import hmac
import logging
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

try:
    import bcrypt
except ImportError:
    bcrypt = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

from app.database import get_db
from app.exceptions import AuthenticationError, AuthorizationError
from app.models.core import User
from app.permissions import Permission, has_permission


def _resolve_secret_key() -> str:
    """
    SECRET_KEY'i çözümle.
    - Production ortamında env var zorunlu (min 32 karakter).
    - Development ortamında eksikse geçici key üretir ve uyarı verir.
    """
    raw = os.environ.get("OPTIPLAN_SECRET_KEY", "").strip()
    env = os.environ.get("OPTIPLAN_ENV", "development").lower()

    if env == "production":
        if not raw or len(raw) < 32:
            sys.exit(
                "[FATAL] OPTIPLAN_SECRET_KEY env var eksik veya çok kısa "
                "(minimum 32 karakter). Uygulama durduruluyor."
            )
        return raw

    # Development / test ortamı
    if not raw or len(raw) < 32:
        generated = secrets.token_hex(32)
        logger.warning(
            "OPTIPLAN_SECRET_KEY tanımlı değil veya çok kısa. "
            "Geçici key üretildi — her restart'ta değişir. "
            "Production için mutlaka env var set edin."
        )
        return generated

    return raw


SECRET_KEY = _resolve_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

security = HTTPBearer()
_optional_security = HTTPBearer(auto_error=False)

# Internal API key — Orchestrator service-to-service auth
ORCH_INTERNAL_KEY = os.environ.get("ORCH_INTERNAL_KEY", "").strip()


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    if bcrypt is not None:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

    # Fallback format: pbkdf2_sha256$<salt_b64>$<digest_b64>
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt, 120_000)
    return f"pbkdf2_sha256${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(plain: str, hashed: str) -> bool:
    plain_bytes = plain.encode("utf-8")

    if hashed.startswith("$2"):
        if bcrypt is None:
            return False
        return bcrypt.checkpw(plain_bytes, hashed.encode("utf-8"))

    if hashed.startswith("pbkdf2_sha256$"):
        try:
            _, salt_b64, digest_b64 = hashed.split("$", 2)
            salt = base64.b64decode(salt_b64.encode())
            expected = base64.b64decode(digest_b64.encode())
            actual = hashlib.pbkdf2_hmac("sha256", plain_bytes, salt, 120_000)
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False

    return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Geçersiz token")
    except JWTError:
        raise AuthenticationError("Geçersiz token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise AuthenticationError("Kullanıcı bulunamadı")
    return user


def get_current_user_or_internal(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_optional_security),
    db: Session = Depends(get_db),
) -> User | None:
    """
    JWT veya X-Internal-Key ile kimlik doğrulama.
    Orchestrator → Backend service-to-service çağrıları için internal key destekler.
    1) Authorization: Bearer <jwt> varsa → normal JWT doğrulama
    2) X-Internal-Key header varsa → ORCH_INTERNAL_KEY env var ile karşılaştır
    3) İkisi de yoksa → 401
    """
    # 1) JWT token varsa normal akış
    if credentials and credentials.credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user and user.is_active:
                    return user
        except JWTError:
            pass

    # 2) Internal API key kontrolü
    internal_header = request.headers.get("X-Internal-Key", "").strip()
    if (
        ORCH_INTERNAL_KEY
        and internal_header
        and hmac.compare_digest(internal_header, ORCH_INTERNAL_KEY)
    ):
        logger.info("Internal API key ile erişim: %s %s", request.method, request.url.path)
        return None  # Authenticated but no user object (service-to-service)

    raise AuthenticationError("Kimlik doğrulama gerekli")


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.upper() != "ADMIN":
        raise AuthorizationError("Bu işlem için Admin yetkisi gerekli")
    return current_user


def require_operator(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.upper() not in ("ADMIN", "OPERATOR"):
        raise AuthorizationError("Bu işlem için Operator veya Admin yetkisi gerekli")
    return current_user


def require_permissions(*required: Permission):
    """Belirli izinleri zorunlu kilan dependency."""

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        role = (current_user.role or "").upper()
        if not role:
            raise AuthorizationError("Yetersiz yetki")

        for perm in required:
            if not has_permission(role, perm):
                raise AuthorizationError("Yetersiz yetki")

        return current_user

    return _dependency
