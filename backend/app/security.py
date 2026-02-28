# Security Headers Middleware
import secrets
from urllib.parse import urlparse

from fastapi import FastAPI, Request, Response
from fastapi.middleware.trustedhost import TrustedHostMiddleware


def _extract_host(value: str) -> str:
    if not value:
        return ""
    try:
        return (urlparse(value).hostname or "").lower()
    except Exception:
        return ""


def _is_allowed_host(host: str) -> bool:
    if not host:
        return False
    if host in {"localhost", "127.0.0.1", "optiplan360.com", "www.optiplan360.com"}:
        return True
    return host.endswith(".optiplan360.com")


def add_security_middleware(app: FastAPI):
    """Add comprehensive security middleware to FastAPI app"""

    # Trusted Host Middleware
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "*.optiplan360.com"]
    )

    # Security Headers Middleware
    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        response = await call_next(request)

        # Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=()"
        )

        # HSTS (only in production)
        if "optiplan360.com" in request.url.hostname:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self' https://api.optiplan360.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["Content-Security-Policy"] = csp

        return response

    # CSRF Protection
    @app.middleware("http")
    async def csrf_protection_middleware(request: Request, call_next):
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            origin = request.headers.get("origin", "")
            referer = request.headers.get("referer", "")

            origin_host = _extract_host(origin)
            referer_host = _extract_host(referer)

            # Allow localhost development and strict domain match for production.
            if origin_host and not _is_allowed_host(origin_host):
                return Response(
                    content="Invalid origin",
                    status_code=403,
                    headers={"Content-Type": "text/plain"},
                )

            if referer_host and not _is_allowed_host(referer_host):
                return Response(
                    content="Invalid referer",
                    status_code=403,
                    headers={"Content-Type": "text/plain"},
                )

        response = await call_next(request)
        return response

    # Request ID
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = secrets.token_hex(16)
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
