import os
from typing import List


def _list_from_env(name: str, default: List[str]) -> List[str]:
    raw = os.environ.get(name)
    if not raw:
        return default
    return [part.strip() for part in raw.split(",") if part.strip()]


class Settings:
    app_name: str = os.environ.get("APP_NAME", "OptiPlan Backend")
    jwt_secret: str = os.environ.get("JWT_SECRET", "replace-with-strong-secret")
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
    refresh_token_expire_minutes: int = int(os.environ.get("REFRESH_TOKEN_EXPIRE_MINUTES", 1440))
    demo_user_username: str = os.environ.get("DEMO_USER_USERNAME", "demo")
    demo_user_password: str = os.environ.get("DEMO_USER_PASSWORD", "demo-password")
    cors_origins: List[str] = _list_from_env("BACKEND_CORS_ORIGINS", ["http://localhost:3001"])


settings = Settings()
