"""
API Response Caching Middleware

Sık erişilen API yanıtlarını cache'leyerek performansı artırır.
Redis olmadan in-memory cache kullanır (geliştirme ortamı için).
"""

import asyncio
import hashlib
import json
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

# In-memory cache storage
# Production'da Redis kullanılmalı
_cache: Dict[str, Tuple[Any, float]] = {}  # {key: (value, expiry_timestamp)}


class CacheConfig:
    """Cache yapılandırması"""

    DEFAULT_TTL = 300  # 5 dakika (saniye)
    MAX_CACHE_SIZE = 1000  # Maksimum cache kaydı
    CLEANUP_INTERVAL = 100  # Her 100 cache'de bir temizlik


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """Cache key oluştur"""
    key_data = f"{prefix}:{str(args)}:{str(kwargs)}"
    return hashlib.md5(key_data.encode()).hexdigest()


def get_from_cache(key: str) -> Optional[Any]:
    """Cache'den veri al, süresi dolmuşsa temizle"""
    if key not in _cache:
        return None

    value, expiry = _cache[key]
    if time.time() > expiry:
        # Süresi dolmuş
        del _cache[key]
        return None

    return value


def set_cache(key: str, value: Any, ttl: int = CacheConfig.DEFAULT_TTL) -> None:
    """Cache'e veri kaydet"""
    # Cache boyutu kontrolü
    if len(_cache) >= CacheConfig.MAX_CACHE_SIZE:
        # En eski kayıtları temizle (FIFO)
        oldest_keys = sorted(_cache.keys(), key=lambda k: _cache[k][1])[
            : CacheConfig.CLEANUP_INTERVAL
        ]
        for old_key in oldest_keys:
            del _cache[old_key]

    expiry = time.time() + ttl
    _cache[key] = (value, expiry)


def invalidate_cache(pattern: str = "") -> int:
    """Pattern ile eşleşen cache'leri temizle, temizlenen sayıyı döndür"""
    keys_to_delete = [k for k in _cache.keys() if pattern in k]
    for key in keys_to_delete:
        del _cache[key]
    return len(keys_to_delete)


def cached_response(
    ttl: int = CacheConfig.DEFAULT_TTL,
    key_prefix: str = "",
    invalidate_on: Optional[Tuple[str, ...]] = None,
):
    """
    API endpoint cache decorator

    Kullanım:
        @router.get("/users")
        @cached_response(ttl=300, key_prefix="users")
        def list_users():
            return get_users()

    Args:
        ttl: Cache süresi (saniye)
        key_prefix: Cache key öneki
        invalidate_on: Bu endpoint'ler çağrıldığında cache'i temizle
    """

    def decorator(func: Callable) -> Callable:
        # Sync ve async fonksiyonları ayır
        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                cache_key = generate_cache_key(key_prefix or func.__name__, *args, **kwargs)
                cached_value = get_from_cache(cache_key)
                if cached_value is not None:
                    return cached_value
                result = await func(*args, **kwargs)
                set_cache(cache_key, result, ttl)
                return result

            async_wrapper.invalidate = lambda pattern=None: invalidate_cache(pattern or key_prefix)
            return async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                cache_key = generate_cache_key(key_prefix or func.__name__, *args, **kwargs)
                cached_value = get_from_cache(cache_key)
                if cached_value is not None:
                    return cached_value
                result = func(*args, **kwargs)
                set_cache(cache_key, result, ttl)
                return result

            sync_wrapper.invalidate = lambda pattern=None: invalidate_cache(pattern or key_prefix)
            return sync_wrapper

    return decorator


class CacheMiddleware:
    """
    FastAPI middleware olarak kullanılabilir cache katmanı

    Kullanım (main.py):
        from app.middleware.cache_middleware import CacheMiddleware
        app.add_middleware(CacheMiddleware, ttl=60)
    """

    def __init__(self, app, ttl: int = 60):
        self.app = app
        self.ttl = ttl

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)

        # Sadece GET isteklerini cache'le
        if request.method != "GET":
            await self.app(scope, receive, send)
            return

        # Guvenlik: auth/cookie/no-cache isteklerini cache'leme
        cache_control = request.headers.get("cache-control", "").lower()
        if (
            request.headers.get("authorization")
            or request.headers.get("cookie")
            or "no-cache" in cache_control
            or request.url.path.startswith("/api/v1/auth")
        ):
            await self.app(scope, receive, send)
            return

        # Cache key oluştur
        cache_key = f"{request.method}:{request.url.path}:{str(request.query_params)}"
        cache_hash = hashlib.md5(cache_key.encode()).hexdigest()

        # Cache kontrol
        cached_response = get_from_cache(cache_hash)
        if cached_response:
            # Cache hit
            response = JSONResponse(content=cached_response)
            await response(scope, receive, send)
            return

        # Cache miss - orijinal response'ı yakala
        response_body = []
        response_status = {"code": None}

        async def wrapped_send(message):
            if message["type"] == "http.response.start":
                response_status["code"] = message.get("status")
            if message["type"] == "http.response.body":
                response_body.append(message.get("body", b""))
            await send(message)

        await self.app(scope, receive, wrapped_send)

        # Response'ı cache'e kaydet
        if response_body and response_status["code"] == 200:
            try:
                body = b"".join(response_body)
                content = json.loads(body)
                set_cache(cache_hash, content, self.ttl)
            except Exception:
                # JSON parse hatası - cache'leme
                pass


def cache_with_tags(tags: list, ttl: int = CacheConfig.DEFAULT_TTL):
    """
    Tag-based cache invalidation destekli decorator

    Kullanım:
        @cache_with_tags(["users", "orders"], ttl=300)
        async def get_user_orders(user_id: int):
            return await fetch_orders(user_id)
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Tag'leri key'e ekle
            tag_prefix = ":".join(sorted(tags))
            cache_key = generate_cache_key(f"{tag_prefix}:{func.__name__}", *args, **kwargs)

            cached_value = get_from_cache(cache_key)
            if cached_value is not None:
                return cached_value

            result = await func(*args, **kwargs)
            set_cache(cache_key, result, ttl)

            return result

        return wrapper

    return decorator


def invalidate_cache_tags(*tags: str) -> int:
    """
    Belirtilen tag'lerle ilişkili tüm cache'leri temizle

    Returns:
        Temizlenen cache kaydı sayısı
    """
    if not tags:
        return 0

    # Tag'leri sırala ve ara
    tag_pattern = ":".join(sorted(tags))
    return invalidate_cache(tag_pattern)


# Cache istatistikleri
def get_cache_stats() -> dict:
    """Cache istatistiklerini döndür"""
    total_keys = len(_cache)
    expired_keys = sum(1 for key, (_, expiry) in _cache.items() if time.time() > expiry)
    active_keys = total_keys - expired_keys

    return {
        "total_keys": total_keys,
        "active_keys": active_keys,
        "expired_keys": expired_keys,
        "max_size": CacheConfig.MAX_CACHE_SIZE,
        "memory_usage_kb": len(str(_cache).encode()) / 1024,
    }
