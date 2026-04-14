"""
Secure Error Handling Service
Error mesajlarında information disclosure azaltma
"""

import logging
import traceback
from typing import Dict, Any, Optional
from fastapi import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class SecureErrorHandler:
    """Güvenli error handling servisi"""
    
    # Internal-only detaylar (loglara yazılır, client'a gönderilmez)
    INTERNAL_DETAILS = [
        "database", "sql", "connection", "password", "secret", "key",
        "internal", "traceback", "stack", "file", "line", "module"
    ]
    
    # User-friendly error mesajları
    USER_MESSAGES = {
        "database_error": "Veritabanı işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        "auth_error": "Kimlik doğrulama başarısız. Lütfen giriş bilgilerinizi kontrol edin.",
        "permission_error": "Bu işlem için yetkiniz bulunmuyor.",
        "not_found": "İstenen kaynak bulunamadı.",
        "validation_error": "Girilen bilgilerde hata var. Lütfen kontrol edip tekrar deneyin.",
        "server_error": "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
        "rate_limit": "Çok fazla istek gönderildi. Lütfen bekleyip tekrar deneyin."
    }
    
    @staticmethod
    def handle_exception(
        request: Request,
        exc: Exception,
        debug: bool = False
    ) -> JSONResponse:
        """
        Exception'ı güvenli şekilde işle
        
        Args:
            request: HTTP request
            exc: Exception
            debug: Debug modu (development'ta True olabilir)
            
        Returns:
            JSONResponse: Güvenli error response
        """
        error_type = type(exc).__name__
        
        # Internal log (detaylı)
        logger.error(
            f"[ERROR] {error_type}: {str(exc)} | "
            f"Path: {request.url.path} | "
            f"Client: {request.client.host if request.client else 'unknown'}",
            exc_info=True
        )
        
        # Error kategorisini belirle
        status_code = SecureErrorHandler._get_status_code(exc)
        user_message = SecureErrorHandler._get_user_message(exc, error_type)
        
        # Client response (güvenli)
        response_data = {
            "error": True,
            "message": user_message,
            "type": SecureErrorHandler._sanitize_error_type(error_type),
            "status_code": status_code
        }
        
        # Debug modunda ek bilgi (development only)
        if debug:
            response_data["debug"] = {
                "detail": str(exc),
                "type": error_type
            }
        
        return JSONResponse(
            status_code=status_code,
            content=response_data
        )
    
    @staticmethod
    def _get_status_code(exc: Exception) -> int:
        """Exception'dan HTTP status code belirle"""
        exc_type = type(exc).__name__
        
        status_map = {
            "AuthenticationError": 401,
            "AuthorizationError": 403,
            "NotFoundError": 404,
            "ValidationError": 422,
            "RateLimitError": 429,
        }
        
        return status_map.get(exc_type, 500)
    
    @staticmethod
    def _get_user_message(exc: Exception, error_type: str) -> str:
        """User-friendly error mesajı üret"""
        exc_str = str(exc).lower()
        
        # Database hataları
        if any(keyword in exc_str for keyword in ["database", "sql", "connection", "db"]):
            return SecureErrorHandler.USER_MESSAGES["database_error"]
        
        # Authentication hataları
        if any(keyword in exc_str for keyword in ["auth", "login", "token", "jwt"]):
            return SecureErrorHandler.USER_MESSAGES["auth_error"]
        
        # Permission hataları
        if any(keyword in exc_str for keyword in ["permission", "forbidden", "access"]):
            return SecureErrorHandler.USER_MESSAGES["permission_error"]
        
        # Not found
        if any(keyword in exc_str for keyword in ["not found", "does not exist", "bulunamadı"]):
            return SecureErrorHandler.USER_MESSAGES["not_found"]
        
        # Validation
        if any(keyword in exc_str for keyword in ["validation", "invalid", "required", "zorunlu"]):
            return SecureErrorHandler.USER_MESSAGES["validation_error"]
        
        # Default
        return SecureErrorHandler.USER_MESSAGES["server_error"]
    
    @staticmethod
    def _sanitize_error_type(error_type: str) -> str:
        """Error tipini sanitize et (internal detayları gizle)"""
        # Internal detayları içeren error tiplerini maskele
        internal_patterns = ["SQL", "Database", "Connection", "Internal"]
        
        for pattern in internal_patterns:
            if pattern in error_type:
                return "ServerError"
        
        return error_type
    
    @staticmethod
    def sanitize_log_message(message: str) -> str:
        """Log mesajında hassas bilgileri maskele"""
        import re
        
        # Password'leri maskele
        message = re.sub(r'password["\']?\s*[:=]\s*["\']?[^\s"\']+', 'password="***"', message, flags=re.IGNORECASE)
        
        # Token'ları maskele
        message = re.sub(r'token["\']?\s*[:=]\s*["\']?[^\s"\']+', 'token="***"', message, flags=re.IGNORECASE)
        
        # Secret'ları maskele
        message = re.sub(r'secret["\']?\s*[:=]\s*["\']?[^\s"\']+', 'secret="***"', message, flags=re.IGNORECASE)
        
        # API key'leri maskele
        message = re.sub(r'api[_-]?key["\']?\s*[:=]\s*["\']?[^\s"\']+', 'api_key="***"', message, flags=re.IGNORECASE)
        
        return message


# Global instance
_error_handler = None


def get_error_handler() -> SecureErrorHandler:
    """Error handler singleton"""
    global _error_handler
    
    if _error_handler is None:
        _error_handler = SecureErrorHandler()
    
    return _error_handler


def secure_error_response(
    request: Request,
    exc: Exception,
    debug: bool = False
) -> JSONResponse:
    """Kolay kullanım için helper fonksiyon"""
    return SecureErrorHandler.handle_exception(request, exc, debug)
