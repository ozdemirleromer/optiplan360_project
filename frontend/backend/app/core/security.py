import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Dict, Iterable

from jose import JWTError, jwt

from backend.app.core.config import settings

PBKDF2_ITERATIONS = 200_000
PBKDF2_ALGORITHM = "sha256"


def _encode_bytes(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _decode_bytes(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM, password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${_encode_bytes(salt)}${_encode_bytes(derived)}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        algo, iterations, salt_str, derived_str = hashed_password.split("$")
        iterations = int(iterations)
        salt = _decode_bytes(salt_str)
        derived = _decode_bytes(derived_str)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        algo, plain_password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(candidate, derived)


def create_token(subject: str, token_type: str, expires_delta: timedelta, scopes: Iterable[str] | None = None) -> str:
    expire = datetime.utcnow() + expires_delta
    payload: Dict[str, str] = {
        "sub": subject,
        "exp": int(expire.timestamp()),
        "type": token_type,
    }
    if settings.app_name:
        payload.setdefault("iss", settings.app_name)
    if scopes:
        payload["scopes"] = list(scopes)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Dict[str, str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise JWTError("token validation failed") from exc
    return payload
