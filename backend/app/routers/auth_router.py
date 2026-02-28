"""
OptiPlan 360 - Auth Router
POST /api/v1/auth/login
"""

import os
from datetime import datetime, timezone

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.exceptions import AuthenticationError
from app.models import User
from app.rate_limit import limiter
from app.schemas import LoginRequest, LoginResponse
from app.services.email_service import email_service
from fastapi import APIRouter, Depends, Request
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter((User.username == body.username) | (User.email == body.username))
        .first()
    )
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise AuthenticationError("Kullanıcı adı veya şifre hatalı")
    if not user.is_active:
        raise AuthenticationError("Hesap devre dışı")

    # JWT standardına göre sub claim daima string olmalıdır.
    token = create_access_token({"sub": str(user.id), "role": user.role})

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return LoginResponse(
        token=token,
        user={
            "id": user.id,
            "username": user.username or user.email,
            "display_name": user.display_name,
            "role": user.role,
            "email": user.email,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
    )


@router.post("/refresh")
@limiter.limit("20/minute")
def refresh_token(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Geçerli token'ı yenile.
    Token süresi dolmadan önce çağrılmalı -> get_current_user() doğrulama yapar.
    """
    new_token = create_access_token({"sub": str(current_user.id), "role": current_user.role})
    return {"token": new_token}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Oturum açmış kullanıcı bilgilerini döndür"""
    return {
        "id": current_user.id,
        "username": current_user.username or current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "last_login_at": (
            current_user.last_login_at.isoformat() if current_user.last_login_at else None
        ),
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Şifre sıfırlama e-postası gönderir."""
    user = db.query(User).filter(User.email == body.email).first()

    # Güvenlik gereği kullanıcı bulunamasa bile aynı başarılı yanıtı döneriz
    if user and user.is_active:
        # Geçici bir reset token üretimi
        token = create_access_token({"sub": str(user.id), "type": "reset"})

        # Müşteri portalı URL'sini belirleme (Customer portal genellikle farklı portta çalışır)
        # PORTAL_URL env parametresinden veya email_service.app_url'den birleştirilebilir.
        portal_url = os.getenv("PORTAL_URL", "http://localhost:3005")
        reset_link = f"{portal_url}/reset-password?token={token}"

        try:
            email_service.send_password_reset(
                to_email=user.email,
                username=user.display_name or user.username or "Müşteri",
                reset_link=reset_link,
            )
        except Exception as e:
            print(f"Sifre sifirlama maili iletilemedi: {e}")

    return {
        "message": "Eğer e-posta sistemimizde kayıtlı ise, şifre sıfırlama bağlantısı gönderilmiştir."
    }


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Token kullanarak yeni şifreyi belirler."""
    try:
        payload = jwt.decode(body.token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if not user_id or token_type != "reset":
            raise AuthenticationError("Geçersiz veya süresi dolmuş bağlantı.")

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise AuthenticationError("Kullanıcı bulunamadı veya pasif.")

        # Şifre kuralları
        if len(body.new_password) < 6:
            raise AuthenticationError("Şifre en az 6 karakter olmalıdır.")

        # Yeni şifreyi hash'le ve kaydet
        user.password_hash = hash_password(body.new_password)
        db.commit()

        return {"message": "Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz."}

    except JWTError:
        raise AuthenticationError("Geçersiz veya süresi dolmuş bağlantı.")
