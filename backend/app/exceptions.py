"""
OptiPlan 360 — Merkezi Hata Yönetimi
Standart hata yanıt formatı ve uygulama-spesifik istisnalar.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel

# ═══════════════════════════════════════════════════
# STANDART HATA YANIT MODELI
# ═══════════════════════════════════════════════════


class FieldError(BaseModel):
    """Tek bir alan hatası."""

    field: str
    message: str
    row: Optional[int] = None


class ErrorResponse(BaseModel):
    """API hata yanıt formatı (tüm endpointler için standart)."""

    code: str
    message: str
    details: List[FieldError] = []


# ═══════════════════════════════════════════════════
# UYGULAMA İSTİSNALARI
# ═══════════════════════════════════════════════════


class AppError(Exception):
    """Temel uygulama istisnası."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[List[FieldError]] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []
        super().__init__(message)

    def to_response(self) -> Dict[str, Any]:
        return {
            "error": ErrorResponse(
                code=self.code,
                message=self.message,
                details=self.details,
            ).model_dump()
        }


class NotFoundError(AppError):
    """Kaynak bulunamadı (404)."""

    def __init__(self, resource: str, identifier: Any = None):
        msg = f"{resource} bulunamadı"
        if identifier:
            msg = f"{resource} bulunamadı (id={identifier})"
        super().__init__(404, "NOT_FOUND", msg)


class ValidationError(AppError):
    """İş kuralı validasyon hatası (422)."""

    def __init__(self, message: str, details: Optional[List[FieldError]] = None):
        super().__init__(422, "VALIDATION_ERROR", message, details)


class BusinessRuleError(AppError):
    """İş kuralı ihlali (400)."""

    def __init__(self, message: str, code: str = "BUSINESS_RULE_ERROR"):
        super().__init__(400, code, message)


class AuthorizationError(AppError):
    """Yetkilendirme hatası (403)."""

    def __init__(self, message: str = "Bu işlem için yetkiniz yok"):
        super().__init__(403, "FORBIDDEN", message)


class AuthenticationError(AppError):
    """Kimlik doğrulama hatası (401)."""

    def __init__(self, message: str = "Kimlik doğrulama başarısız"):
        super().__init__(401, "UNAUTHORIZED", message)


class ConflictError(AppError):
    """Çakışma hatası — kaynak zaten mevcut veya durum uyumsuz (409)."""

    def __init__(self, message: str):
        super().__init__(409, "CONFLICT", message)


class StatusTransitionError(BusinessRuleError):
    """Geçersiz durum geçişi."""

    def __init__(self, current: str, target: str, allowed: List[str]):
        allowed_str = ", ".join(allowed) if allowed else "yok (son durum)"
        msg = f"'{current}' → '{target}' geçişi izin verilmiyor. " f"İzin verilen: {allowed_str}"
        super().__init__(msg, code="INVALID_STATUS_TRANSITION")


# ═══════════════════════════════════════════════════
# MİKRO ENTEGRASYON İSTİSNALARI
# ═══════════════════════════════════════════════════


class MikroIntegrationError(AppError):
    """Mikro entegrasyon temel hatası (502)."""

    def __init__(self, message: str, operation: str = ""):
        AppError.__init__(self, 502, "MIKRO_INTEGRATION_ERROR", message)


class MikroConnectionError(MikroIntegrationError):
    """Mikro bağlantı hatası."""

    def __init__(self, message: str, host: str = ""):
        self.host = host
        AppError.__init__(self, 502, "MIKRO_CONNECTION_ERROR", f"Mikro bağlantı hatası: {message}")


class MikroAuthError(MikroIntegrationError):
    """Mikro kimlik doğrulama hatası. str() her zaman standart mesajı döner."""

    def __init__(self, message: str = ""):
        AppError.__init__(self, 401, "MIKRO_AUTH_ERROR", "Kimlik doğrulama başarısız")


class MikroTimeoutError(MikroIntegrationError):
    """Mikro zaman aşımı hatası."""

    def __init__(self, timeout: int = 0, operation: str = ""):
        self.timeout = timeout
        parts = [f"Mikro bağlantı timeout ({timeout}s)"]
        if operation:
            parts.append(operation)
        AppError.__init__(self, 504, "MIKRO_TIMEOUT_ERROR", ": ".join(parts))


class MikroQueryError(MikroIntegrationError):
    """Mikro sorgu hatası."""

    def __init__(self, message: str, query: str = ""):
        self.query = query
        AppError.__init__(self, 502, "MIKRO_QUERY_ERROR", f"Mikro sorgu hatası: {message}")


class MikroDataError(MikroIntegrationError):
    """Mikro veri hatası."""

    def __init__(self, message: str, table: str = ""):
        self.table = table
        AppError.__init__(self, 502, "MIKRO_DATA_ERROR", f"Mikro veri hatası: {message}")


class MikroDataIntegrityError(MikroDataError):
    """Mikro veri bütünlüğü hatası (duplicate key, not-null ihlali vb.)."""

    def __init__(self, message: str, table: str = ""):
        self.table = table
        AppError.__init__(self, 409, "MIKRO_DATA_INTEGRITY_ERROR", f"Mikro veri bütünlüğü hatası: {message}")
