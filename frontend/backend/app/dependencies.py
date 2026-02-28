from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from backend.app.core.security import decode_token
from backend.app.schemas.token import TokenPayload
from backend.app.services.user_service import get_user_by_username

_bearer_scheme = HTTPBearer(auto_error=True)


def _verify_token(expected_type: str) -> Callable[[HTTPAuthorizationCredentials], TokenPayload]:
    def _inner(credentials: HTTPAuthorizationCredentials) -> TokenPayload:
        if not credentials or not credentials.credentials:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
        try:
            payload = decode_token(credentials.credentials)
            token_data = TokenPayload(**payload)
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token validation failed",
            )
        if token_data.type != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Expected {expected_type} token",
            )
        return token_data
    return _inner


def get_access_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> TokenPayload:
    return _verify_token("access")(credentials)


def get_refresh_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> TokenPayload:
    return _verify_token("refresh")(credentials)


def get_current_user(token: TokenPayload = Depends(get_access_token_payload)) -> dict:
    user = get_user_by_username(token.sub)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {"username": user["username"], "scopes": user.get("scopes", [])}
