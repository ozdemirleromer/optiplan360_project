from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.dependencies import get_refresh_token_payload
from backend.app.schemas.auth import LoginRequest, TokenResponse
from backend.app.schemas.token import TokenPayload
from backend.app.services.token_service import build_token_pair
from backend.app.services.user_service import authenticate_user

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(form: LoginRequest):
    user = authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token_pair = build_token_pair(user["username"], user.get("scopes", []))
    return TokenResponse(**token_pair)


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh(payload: TokenPayload = Depends(get_refresh_token_payload)):
    token_pair = build_token_pair(payload.sub, payload.scopes or [])
    return TokenResponse(**token_pair)
