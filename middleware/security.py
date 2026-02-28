"""
OPTIPLAN360 - Güvenli Ara Katman
Bulut çıkışı için güvenlik middleware
"""
import os
import hashlib
import hmac
import time
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging

logger = logging.getLogger(__name__)

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Güvenlik ara katmanı - Bulut entegrasyonları için
    - Rate limiting
    - IP whitelist
    - Request signing
    - CORS güvenliği
    """
    
    def __init__(self, app, config: Optional[Dict[str, Any]] = None):
        super().__init__(app)
        self.config = config or self._default_config()
        self.request_counts = {}  # Basit rate limiting için
        
    def _default_config(self) -> Dict[str, Any]:
        return {
            "rate_limit": {
                "requests_per_minute": 60,
                "requests_per_hour": 1000
            },
            "allowed_ips": [
                "127.0.0.1",  # Localhost
                "10.0.0.0/8",  # Private network
                "172.16.0.0/12",  # Private network
                "192.168.0.0/16"  # Private network
            ],
            "cloud_endpoints": {
                "whatsapp": True,
                "mikro_sql": True,
                "backup": True
            },
            "enable_request_signing": True,
            "max_request_size_mb": 10
        }
    
    async def dispatch(self, request: Request, call_next):
        # IP adresi kontrolü
        client_ip = self._get_client_ip(request)
        if not self._is_ip_allowed(client_ip):
            logger.warning(f"Engellenen IP denemesi: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="IP adresi izin verilen listede değil"
            )
        
        # Rate limiting
        if not self._check_rate_limit(client_ip):
            logger.warning(f"Rate limit aşıldı: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="İstek limiti aşıldı"
            )
        
        # Request boyutu kontrolü
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.config["max_request_size_mb"] * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="İstek boyutu çok büyük"
            )
        
        # Request signing (bulut endpoint'leri için)
        if self.config["enable_request_signing"]:
            self._validate_request_signature(request)
        
        # Request loglama
        await self._log_request(request)
        
        # Response işle
        response = await call_next(request)
        
        # Security headers ekle
        self._add_security_headers(response)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Client IP adresini al"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        return request.client.host if request.client else "unknown"
    
    def _is_ip_allowed(self, ip: str) -> bool:
        """IP adresi izin verilen listede mi?"""
        import ipaddress
        
        try:
            client_ip = ipaddress.ip_address(ip)
            for allowed in self.config["allowed_ips"]:
                if "/" in allowed:
                    # CIDR notation
                    network = ipaddress.ip_network(allowed, strict=False)
                    if client_ip in network:
                        return True
                else:
                    # Tek IP
                    if str(client_ip) == allowed:
                        return True
            return False
        except ValueError:
            logger.error(f"Geçersiz IP formatı: {ip}")
            return False
    
    def _check_rate_limit(self, client_ip: str) -> bool:
        """Basit rate limiting kontrolü"""
        now = int(time.time())
        minute_key = f"{client_ip}:{now // 60}"
        hour_key = f"{client_ip}:{now // 3600}"
        
        # Dakikalık limit
        if minute_key not in self.request_counts:
            self.request_counts[minute_key] = 0
        self.request_counts[minute_key] += 1
        
        if self.request_counts[minute_key] > self.config["rate_limit"]["requests_per_minute"]:
            return False
        
        # Saatlik limit
        if hour_key not in self.request_counts:
            self.request_counts[hour_key] = 0
        self.request_counts[hour_key] += 1
        
        if self.request_counts[hour_key] > self.config["rate_limit"]["requests_per_hour"]:
            return False
        
        # Eski kayıtları temizle
        self._cleanup_old_requests(now)
        
        return True
    
    def _cleanup_old_requests(self, now: int):
        """Eski rate limiting kayıtlarını temizle"""
        keys_to_remove = []
        for key in self.request_counts:
            timestamp = int(key.split(":")[-1])
            if now - timestamp > 7200:  # 2 saatten eski
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.request_counts[key]
    
    def _validate_request_signature(self, request: Request):
        """Request signature doğrulama (bulut entegrasyonları için)"""
        signature = request.headers.get("x-signature")
        timestamp = request.headers.get("x-timestamp")
        
        if not signature or not timestamp:
            return  # İmza zorunlu değil (local requests)
        
        # Zaman damgası kontrolü (5 dakika içinde olmalı)
        try:
            request_time = int(timestamp)
            if abs(time.time() - request_time) > 300:  # 5 dakika
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="İstek zaman aşımı"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz zaman damgası"
            )
        
        # Signature doğrulama
        secret = os.getenv("CLOUD_SECRET_KEY", "default_secret")
        expected_signature = hmac.new(
            secret.encode(),
            f"{timestamp}{request.url}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz imza"
            )
    
    async def _log_request(self, request: Request):
        """Security loglama"""
        log_data = {
            "timestamp": time.time(),
            "method": request.method,
            "url": str(request.url),
            "client_ip": self._get_client_ip(request),
            "user_agent": request.headers.get("user-agent", ""),
            "content_length": request.headers.get("content-length", "0")
        }
        
        logger.info(f"Security Log: {log_data}")
    
    def _add_security_headers(self, response: Response):
        """Security headers ekle"""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"


class CloudSecurityManager:
    """
    Bulut entegrasyonları için güvenlik yöneticisi
    """
    
    def __init__(self):
        self.api_keys = self._load_api_keys()
    
    def _load_api_keys(self) -> Dict[str, str]:
        """API keys'leri güvenli şekilde yükle"""
        return {
            "whatsapp": os.getenv("WHATSAPP_API_KEY", ""),
            "mikro_sql": os.getenv("MIKRO_SQL_API_KEY", ""),
            "backup": os.getenv("BACKUP_API_KEY", ""),
            "internal": os.getenv("INTERNAL_API_KEY", "optiplan360_internal_key_2024")
        }
    
    def validate_api_key(self, service: str, provided_key: str) -> bool:
        """API key doğrulama"""
        expected_key = self.api_keys.get(service)
        if not expected_key:
            logger.error(f"Bilinmeyen servis: {service}")
            return False
        
        return hmac.compare_digest(provided_key, expected_key)
    
    def generate_request_signature(self, url: str, timestamp: int) -> str:
        """Request signature oluştur"""
        secret = os.getenv("CLOUD_SECRET_KEY", "default_secret")
        message = f"{timestamp}{url}"
        return hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()


# FastAPI Security Bearer
security = HTTPBearer(auto_error=False)

async def verify_api_key(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = None):
    """API key doğrulama middleware"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key gerekli",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Servis belirle (URL'den)
    path = request.url.path
    if "/whatsapp" in path:
        service = "whatsapp"
    elif "/mikro" in path:
        service = "mikro_sql"
    elif "/backup" in path:
        service = "backup"
    else:
        service = "internal"
    
    security_manager = CloudSecurityManager()
    if not security_manager.validate_api_key(service, credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz API key"
        )
    
    return {"service": service, "valid": True}
