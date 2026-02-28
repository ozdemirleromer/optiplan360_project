from datetime import timedelta

from backend.app.core.config import settings
from backend.app.core.security import create_token


def build_token_pair(username: str, scopes: list[str]) -> dict:
    access_token = create_token(
        subject=username,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        scopes=scopes,
    )
    refresh_token = create_token(
        subject=username,
        token_type="refresh",
        expires_delta=timedelta(minutes=settings.refresh_token_expire_minutes),
        scopes=scopes,
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }
