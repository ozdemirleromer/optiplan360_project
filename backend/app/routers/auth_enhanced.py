"""
OptiPlan 360 - Authentication Router
Enhanced JWT with refresh tokens and security
"""

from datetime import datetime, timezone
from typing import Optional

from app.database import get_db
from app.exceptions import AuthenticationError, BusinessRuleError
from app.models import User
from app.rate_limit import limiter
from app.security import hash_password
from app.services.token_service import (
    TokenService,
    check_auth_attempts,
    get_auth_security_headers,
    record_auth_attempt,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix="/auth", tags=["authentication"])

# Security scheme
security = HTTPBearer(auto_error=False)


# Request schemas
class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Enhanced login with rate limiting and security headers
    """
    client_ip = request.client.host

    # Check rate limiting
    if not check_auth_attempts(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Çok fazla deneme. Lütfen 15 dakika sonra tekrar deneyin.",
            headers=get_auth_security_headers(),
        )

    try:
        # Authenticate user
        user = (
            db.query(User)
            .filter(User.username == login_data.username, User.is_active == True)
            .first()
        )

        if not user or not hash_password(login_data.password, user.password_hash):
            record_auth_attempt(client_ip, False)
            raise AuthenticationError("Geçersiz kullanıcı adı veya şifre")

        record_auth_attempt(client_ip, True)

        # Create tokens
        access_token = TokenService.create_access_token(data={"sub": str(user.id)})
        refresh_token = TokenService.create_refresh_token(str(user.id))

        # Prepare response
        response_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": 30 * 60,  # 30 minutes in seconds
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "email": user.email,
                "role": user.role,
            },
        }

        # Create response with security headers
        response = Response(
            content=response_data, status_code=200, headers=get_auth_security_headers()
        )

        # Set refresh token in httpOnly cookie
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=7 * 24 * 60 * 60,  # 7 days
            httponly=True,
            secure=True,  # HTTPS only in production
            samesite="strict",
        )

        return response

    except (AuthenticationError, HTTPException):
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Giriş sırasında hata oluştu",
            headers=get_auth_security_headers(),
        )


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("15/minute")
async def refresh_token(
    request: Request,
    refresh_data: Optional[RefreshTokenRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Refresh access token using refresh token
    """
    try:
        # Get refresh token from request body or cookie
        if refresh_data and refresh_data.refresh_token:
            refresh_token = refresh_data.refresh_token
        else:
            refresh_token = request.cookies.get("refresh_token")

        if not refresh_token:
            raise AuthenticationError("Refresh token gerekli")

        # Generate new tokens
        new_tokens = TokenService.refresh_access_token(refresh_token)

        # Create response
        response = Response(
            content=new_tokens, status_code=200, headers=get_auth_security_headers()
        )

        # Update refresh token cookie
        response.set_cookie(
            key="refresh_token",
            value=new_tokens["refresh_token"],
            max_age=7 * 24 * 60 * 60,  # 7 days
            httponly=True,
            secure=True,
            samesite="strict",
        )

        return response

    except Exception as e:
        raise AuthenticationError("Token yenileme başarısız")


@router.post("/logout")
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Logout user and revoke tokens
    """
    try:
        # Revoke current access token
        if credentials and credentials.credentials:
            TokenService.revoke_token(credentials.credentials)

        # Revoke refresh token from cookie
        refresh_token = request.cookies.get("refresh_token")
        if refresh_token:
            TokenService.revoke_token(refresh_token)

        # Create response
        response = Response(
            content={"message": "Başarıyla çıkış yapıldı"},
            status_code=200,
            headers=get_auth_security_headers(),
        )

        # Clear refresh token cookie
        response.delete_cookie(
            key="refresh_token",
            httponly=True,
            secure=True,
            samesite="strict",
        )

        return response

    except (AuthenticationError, HTTPException):
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Çıkış sırasında hata oluştu",
            headers=get_auth_security_headers(),
        )


@router.get("/me")
async def get_current_user_info(
    credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)
):
    """
    Get current user information
    """
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Kimlik doğrulanmamış")

    try:
        payload = TokenService.decode_token(credentials.credentials)
        user_id = payload.get("sub")

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise AuthenticationError("Kullanıcı bulunamadı veya pasif")

        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email,
            "role": user.role,
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
        }

    except Exception as e:
        raise AuthenticationError("Token geçersiz")


@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    current_password: str,
    new_password: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Change user password
    """
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Kimlik doğrulanmamış")

    try:
        payload = TokenService.decode_token(credentials.credentials)
        user_id = payload.get("sub")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise AuthenticationError("Kullanıcı bulunamadı")

        # Verify current password
        if not hash_password(current_password, user.password_hash):
            raise BusinessRuleError("Mevcut şifre hatalı")

        # Update password
        user.password_hash = hash_password(new_password)
        user.last_password_change = datetime.now(timezone.utc)
        db.commit()

        return {"message": "Şifre başarıyla değiştirildi"}

    except (AuthenticationError, BusinessRuleError, HTTPException):
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Şifre değiştirme sırasında hata oluştu",
            headers=get_auth_security_headers(),
        )
