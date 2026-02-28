from backend.app.core.config import settings
from backend.app.core.security import hash_password, verify_password

_demo_user_hash: str | None = None


def _get_demo_hash() -> str:
    global _demo_user_hash
    if _demo_user_hash is None:
        _demo_user_hash = hash_password(settings.demo_user_password)
    return _demo_user_hash


def get_user_by_username(username: str) -> dict | None:
    if username != settings.demo_user_username:
        return None
    return {
        "username": settings.demo_user_username,
        "hashed_password": _get_demo_hash(),
        "scopes": ["admin"],
    }


def authenticate_user(username: str, password: str) -> dict | None:
    user = get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user
