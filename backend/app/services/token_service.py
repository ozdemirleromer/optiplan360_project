"""
OptiPlan 360 - JWT Token Refresh Service
Token yenileme ve güvenlik optimizasyonu
"""
import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, Request, Response
from app.exceptions import AuthenticationError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("OPTIPLAN_SECRET_KEY", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 dakika
REFRESH_TOKEN_EXPIRE_DAYS = 7   # 7 gün
BLACKLISTED_TOKENS = set()  # Production'da Redis kullanılmalı

class TokenService:
    """JWT token yönetimi ve yenileme servisi"""
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Access token oluştur"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access",
            "jti": secrets.token_hex(16),  # Unique token ID
        })
        
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def create_refresh_token(user_id: str) -> str:
        """Refresh token oluştur"""
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode = {
            "sub": user_id,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
            "jti": secrets.token_hex(16),
        }
        
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Token decode et ve blacklist kontrolü yap"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Blacklist kontrolü (production'da Redis kullanılmalı)
            if payload.get("jti") in BLACKLISTED_TOKENS:
                raise AuthenticationError("Token geçersiz kılındı")
            
            return payload
            
        except JWTError as e:
            logger.warning(f"JWT decode error: {str(e)}")
            raise AuthenticationError("Geçersiz token")
    
    @staticmethod
    def refresh_access_token(refresh_token: str) -> Dict[str, str]:
        """Refresh token ile yeni access token oluştur"""
        try:
            payload = TokenService.decode_token(refresh_token)
            
            # Refresh token tipini kontrol et
            if payload.get("type") != "refresh":
                raise AuthenticationError("Geçersiz refresh token")
            
            user_id = payload.get("sub")
            if not user_id:
                raise AuthenticationError("Token kullanıcı bilgisi içermiyor")
            
            # Eski refresh token'ı blacklist'e ekle
            BLACKLISTED_TOKENS.add(payload.get("jti"))
            
            # Yeni access token oluştur
            new_access_token = TokenService.create_access_token(
                data={"sub": user_id},
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            
            # Yeni refresh token oluştur (optional - sliding session)
            new_refresh_token = TokenService.create_refresh_token(user_id)
            
            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "Bearer",
                "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # seconds
            }
            
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            raise AuthenticationError("Token yenileme başarısız")
    
    @staticmethod
    def revoke_token(token: str) -> bool:
        """Token'ı geçersiz kıl (logout için)"""
        try:
            payload = TokenService.decode_token(token)
            BLACKLISTED_TOKENS.add(payload.get("jti"))
            return True
        except Exception as e:
            logger.error(f"Token revocation error: {str(e)}")
            return False
    
    @staticmethod
    def is_token_blacklisted(jti: str) -> bool:
        """Token blacklist kontrolü"""
        return jti in BLACKLISTED_TOKENS
    
    @staticmethod
    def cleanup_expired_tokens():
        """Süresi dolmuş token'ları blacklist'ten temizle"""
        # Production'da Redis TTL kullanılmalı
        current_time = datetime.now(timezone.utc)
        expired_tokens = []
        
        # Bu basit bir implementasyon - production'da Redis kullanın
        for jti in BLACKLISTED_TOKENS:
            try:
                payload = jwt.decode(
                    jwt.encode({"jti": jti, "exp": current_time.timestamp()}, SECRET_KEY, algorithm=ALGORITHM),
                    SECRET_KEY,
                    algorithms=[ALGORITHM]
                )
                if payload.get("exp", 0) < current_time.timestamp():
                    expired_tokens.append(jti)
            except:
                expired_tokens.append(jti)
        
        for jti in expired_tokens:
            BLACKLISTED_TOKENS.discard(jti)
        
        if expired_tokens:
            logger.info(f"Cleaned up {len(expired_tokens)} expired tokens from blacklist")

# Middleware for automatic token refresh
async def token_refresh_middleware(request: Request, call_next):
    """
    Otomatik token refresh middleware
    Eğer access token süresi dolmuşsa, refresh token ile yenile
    """
    # Bypass for auth endpoints
    if request.url.path in ["/auth/login", "/auth/refresh", "/auth/logout"]:
        return await call_next(request)
    
    # Get Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return await call_next(request)
    
    try:
        token = auth_header.split(" ")[1]
        payload = TokenService.decode_token(token)
        
        # Check if access token is expired
        exp = payload.get("exp", 0)
        current_time = datetime.now(timezone.utc).timestamp()
        
        if exp > current_time:
            # Token still valid, continue
            return await call_next(request)
        
        # Access token expired, try to refresh
        refresh_token = request.cookies.get("refresh_token")
        if not refresh_token:
            raise AuthenticationError("Refresh token gerekli")
        
        # Generate new access token
        new_tokens = TokenService.refresh_access_token(refresh_token)
        
        # Create response with new token
        response = await call_next(request)
        response.headers["Authorization"] = f"Bearer {new_tokens['access_token']}"
        
        # Set new refresh token in cookie (httpOnly, secure, sameSite)
        response.set_cookie(
            key="refresh_token",
            value=new_tokens["refresh_token"],
            max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # days to seconds
            httponly=True,
            secure=True,  # HTTPS only
            samesite="strict",
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh middleware error: {str(e)}")
        raise AuthenticationError("Token yenileme hatası")

# Rate limiting for auth endpoints
AUTH_ATTEMPTS = {}  # Production'da Redis kullanılmalı
MAX_AUTH_ATTEMPTS = 5
AUTH_LOCKOUT_DURATION = 15  # minutes

def check_auth_attempts(ip: str) -> bool:
    """IP bazlı auth deneme kontrolü"""
    attempts = AUTH_ATTEMPTS.get(ip, {"count": 0, "locked_until": None})
    
    if attempts.get("locked_until"):
        if datetime.now().timestamp() < attempts["locked_until"]:
            return False  # Locked
        else:
            # Lockout expired, reset
            AUTH_ATTEMPTS[ip] = {"count": 0, "locked_until": None}
    
    return True

def record_auth_attempt(ip: str, success: bool):
    """Auth denemesini kaydet"""
    if success:
        AUTH_ATTEMPTS[ip] = {"count": 0, "locked_until": None}
    else:
        attempts = AUTH_ATTEMPTS.get(ip, {"count": 0, "locked_until": None})
        attempts["count"] += 1
        
        if attempts["count"] >= MAX_AUTH_ATTEMPTS:
            attempts["locked_until"] = datetime.now().timestamp() + (AUTH_LOCKOUT_DURATION * 60)
            logger.warning(f"IP {ip} locked for {AUTH_LOCKOUT_DURATION} minutes")
        
        AUTH_ATTEMPTS[ip] = attempts

# Security headers for auth responses
def get_auth_security_headers() -> Dict[str, str]:
    """Auth endpoint'leri için güvenlik header'ları"""
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
