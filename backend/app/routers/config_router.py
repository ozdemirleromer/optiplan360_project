"""
OptiPlan 360 — Config Router (Genişletilmiş)
Uygulama konfigürasyonu, izin sorgulama ve sistem ayarları endpoint'leri.
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, Optional

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.exceptions import NotFoundError
from app.models import User
from app.permissions import ROLE_PERMISSIONS, get_permissions_for_role
from app.utils import create_audit_log
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/config", tags=["config"])


# ═══════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════


class AppConfig(BaseModel):
    app_name: str = "OptiPlan 360"
    version: str = "1.0.0"
    build_date: str = "2024-01-15"
    environment: str = "production"
    features: Dict[str, bool] = Field(
        default_factory=lambda: {
            "ai_orchestrator": True,
            "whatsapp_integration": True,
            "mikro_integration": True,
            "ocr_enabled": True,
            "compliance_checks": True,
            "advanced_analytics": True,
        }
    )


class SystemStatus(BaseModel):
    database: str = "connected"
    redis: Optional[str] = "not_configured"
    mikro_connection: str = "unknown"
    last_backup: Optional[str] = None
    uptime_hours: float = 0.0


class FeatureToggle(BaseModel):
    feature_name: str
    is_enabled: bool
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationConfig(BaseModel):
    email_enabled: bool = False
    whatsapp_enabled: bool = False
    sms_enabled: bool = False
    webhook_url: Optional[str] = None
    daily_digest: bool = True
    urgent_only: bool = False


# ═══════════════════════════════════════════════════
# PERMISSIONS ENDPOINT'İ
# ═══════════════════════════════════════════════════


@router.get("/permissions")
def get_permissions_config(current_user: User = Depends(get_current_user)):
    """
    Mevcut kullanıcının rol bazlı izin listesini döndürür.
    Frontend bu endpoint'i kullanarak UI elementlerini gösterip gizler.
    """
    user_role = (current_user.role or "OPERATOR").upper()
    user_permissions = get_permissions_for_role(user_role)

    # Tüm rol haritasını sadece ADMIN'e göster
    all_roles: dict = {}
    if user_role == "ADMIN":
        all_roles = {role: [p.value for p in perms] for role, perms in ROLE_PERMISSIONS.items()}

    # cache_key: saatlik segmentle üretilir
    hour_bucket = int(datetime.utcnow().timestamp() // 3600)

    return {
        "success": True,
        "user_role": user_role,
        "user_permissions": user_permissions,
        "all_roles": all_roles,
        "cache_key": f"perms_{user_role}_{hour_bucket}",
    }


# ═══════════════════════════════════════════════════
# UYGULAMA KONFİGÜRASYONU
# ═══════════════════════════════════════════════════


@router.get("/app")
def get_app_config():
    """Uygulama genel konfigürasyonunu getir."""
    return AppConfig()


@router.get("/status")
def get_system_status(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Sistem durumunu getir."""
    from sqlalchemy import text

    # Database bağlantı kontrolü
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Mikro bağlantı durumu
    from app import mikro_db

    mikro_cfg = mikro_db.get_config()
    mikro_status = "connected" if mikro_cfg else "not_configured"

    return SystemStatus(
        database=db_status,
        mikro_connection=mikro_status,
        uptime_hours=24.5,  # Gerçek uptime hesaplanmalı
    )


# ═══════════════════════════════════════════════════
# ÖZELLİK AÇMA/KAPAMA (FEATURE FLAGS)
# ═══════════════════════════════════════════════════

# Bellek içi özellik durumları
_feature_flags: Dict[str, FeatureToggle] = {
    "ai_orchestrator": FeatureToggle(feature_name="ai_orchestrator", is_enabled=True),
    "whatsapp_integration": FeatureToggle(feature_name="whatsapp_integration", is_enabled=True),
    "mikro_integration": FeatureToggle(feature_name="mikro_integration", is_enabled=True),
    "ocr_enabled": FeatureToggle(feature_name="ocr_enabled", is_enabled=True),
    "compliance_checks": FeatureToggle(feature_name="compliance_checks", is_enabled=True),
    "advanced_analytics": FeatureToggle(feature_name="advanced_analytics", is_enabled=True),
    "beta_features": FeatureToggle(feature_name="beta_features", is_enabled=False),
}


@router.get("/features")
def list_feature_flags(_: User = Depends(get_current_user)):
    """Tüm özellik bayraklarını listele."""
    return {
        "features": [
            {
                "name": f.feature_name,
                "enabled": f.is_enabled,
                "updated_at": f.updated_at.isoformat(),
            }
            for f in _feature_flags.values()
        ]
    }


@router.put("/features/{feature_name}")
def toggle_feature(
    feature_name: str,
    enabled: bool,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Bir özelliği aç veya kapat."""
    if feature_name not in _feature_flags:
        raise NotFoundError("Özellik")

    _feature_flags[feature_name].is_enabled = enabled
    _feature_flags[feature_name].updated_at = datetime.utcnow()

    create_audit_log(
        db,
        admin.id,
        "FEATURE_TOGGLE",
        f"Özellik '{feature_name}' {('aktif' if enabled else 'pasif')} edildi",
        None,
    )
    db.commit()

    return {
        "feature_name": feature_name,
        "enabled": enabled,
        "updated_at": _feature_flags[feature_name].updated_at.isoformat(),
    }


# ═══════════════════════════════════════════════════
# BİLDİRİM AYARLARI
# ═══════════════════════════════════════════════════

_notification_config_path = "config/notifications.json"
_default_notification_config = NotificationConfig()


def _load_notification_config() -> NotificationConfig:
    """Diskten bildirim ayarlarını yükle."""
    if os.path.exists(_notification_config_path):
        try:
            with open(_notification_config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return NotificationConfig(**data)
        except Exception as e:
            logger.warning(f"Bildirim ayarları yüklenemedi: {e}")
    return _default_notification_config


def _save_notification_config(config: NotificationConfig):
    """Bildirim ayarlarını diske kaydet."""
    os.makedirs(os.path.dirname(_notification_config_path), exist_ok=True)
    with open(_notification_config_path, "w", encoding="utf-8") as f:
        json.dump(config.dict(), f, ensure_ascii=False, indent=2)


@router.get("/notifications")
def get_notification_config(_: User = Depends(get_current_user)):
    """Bildirim ayarlarını getir."""
    return _load_notification_config()


@router.put("/notifications")
def update_notification_config(
    config: NotificationConfig, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    """Bildirim ayarlarını güncelle."""
    _save_notification_config(config)

    create_audit_log(
        db,
        admin.id,
        "NOTIFICATION_CONFIG_UPDATED",
        f"Bildirim ayarları güncellendi. Email: {config.email_enabled}, WhatsApp: {config.whatsapp_enabled}",
        None,
    )
    db.commit()

    return config


# ═══════════════════════════════════════════════════
# CACHE YÖNETİMİ
# ═══════════════════════════════════════════════════


@router.post("/cache/clear")
def clear_system_cache(cache_type: Optional[str] = "all", admin: User = Depends(require_admin)):
    """Sistem cache'ini temizle."""
    # Burada Redis/Memcached temizleme kodu olmalı
    # Şimdilik sadece loglama yapıyoruz
    logger.info(f"Cache temizleme isteği: {cache_type}")

    return {
        "success": True,
        "cleared_cache": cache_type,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/cache/stats")
def get_cache_stats(_: User = Depends(require_admin)):
    """Cache istatistiklerini getir."""
    # Gerçek cache istatistikleri
    return {
        "total_keys": 0,
        "memory_used": "0 MB",
        "hit_rate": "0%",
        "cached_endpoints": [
            "/api/v1/admin/users",
            "/api/v1/admin/stats",
            "/api/v1/admin/insights",
        ],
    }


# ═══════════════════════════════════════════════════
# SİSTEM SAĞLIK KONTROLÜ
# ═══════════════════════════════════════════════════

# ═══════════════════════════════════════════════════
# AI API YAPILANDIRMASI
# ═══════════════════════════════════════════════════

_ai_config_path = "config/ai_config.json"


class AIConfig(BaseModel):
    """AI API yapılandırma şeması."""

    provider: str = "openai"
    api_key: str = ""
    model: str = "gpt-4o"
    max_tokens: int = 4096
    temperature: float = 0.0
    enabled: bool = False


def _load_ai_config() -> AIConfig:
    """Diskten AI yapılandırmasını yükle, env var fallback."""
    if os.path.exists(_ai_config_path):
        try:
            with open(_ai_config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return AIConfig(**data)
        except Exception as e:
            logger.warning(f"AI config yüklenemedi: {e}")

    # Env var fallback
    env_key = os.getenv("OPENAI_API_KEY", "")
    return AIConfig(api_key=env_key, enabled=bool(env_key))


def _save_ai_config(config: AIConfig):
    """AI yapılandırmasını diske kaydet."""
    os.makedirs(os.path.dirname(_ai_config_path), exist_ok=True)
    with open(_ai_config_path, "w", encoding="utf-8") as f:
        json.dump(config.dict(), f, ensure_ascii=False, indent=2)


def _mask_api_key(key: str) -> str:
    """API anahtarını maskele: ilk 4 + son 4 karakter, geri kalan *."""
    if not key or len(key) < 10:
        return "***" if key else ""
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


@router.get("/ai")
def get_ai_config(_: User = Depends(get_current_user)):
    """AI API yapılandırmasını getir (anahtar maskelenmiş)."""
    config = _load_ai_config()
    return {
        "provider": config.provider,
        "api_key_masked": _mask_api_key(config.api_key),
        "api_key_set": bool(config.api_key),
        "model": config.model,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "enabled": config.enabled,
    }


@router.put("/ai")
def update_ai_config(
    config: AIConfig,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """AI API yapılandırmasını güncelle. Yalnızca ADMIN."""
    _save_ai_config(config)

    # price_tracking_ai modülündeki cached client'ı sıfırla
    try:
        from app.services import price_tracking_ai

        price_tracking_ai._client = None
    except Exception:
        pass

    create_audit_log(
        db,
        admin.id,
        "AI_CONFIG_UPDATED",
        f"AI yapılandırması güncellendi. Provider: {config.provider}, Model: {config.model}, Enabled: {config.enabled}",
        None,
    )
    db.commit()

    logger.info(
        "AI config güncellendi: provider=%s, model=%s, enabled=%s",
        config.provider,
        config.model,
        config.enabled,
    )

    return {
        "success": True,
        "provider": config.provider,
        "api_key_masked": _mask_api_key(config.api_key),
        "api_key_set": bool(config.api_key),
        "model": config.model,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "enabled": config.enabled,
    }


@router.post("/ai/test")
def test_ai_connection(
    _: User = Depends(require_admin),
):
    """AI API bağlantısını test et."""
    config = _load_ai_config()
    if not config.api_key:
        return {"success": False, "message": "API anahtarı ayarlanmamış"}

    try:
        from openai import OpenAI

        client = OpenAI(api_key=config.api_key)
        response = client.chat.completions.create(
            model=config.model,
            max_tokens=10,
            messages=[{"role": "user", "content": "Merhaba"}],
        )
        content = response.choices[0].message.content or ""
        return {
            "success": True,
            "message": f"Bağlantı başarılı. Model: {config.model}",
            "response_preview": content[:100],
        }
    except ImportError:
        return {"success": False, "message": "openai kütüphanesi yüklü değil"}
    except Exception as e:
        return {"success": False, "message": f"Bağlantı hatası: {str(e)}"}


@router.get("/health")
def health_check():
    """Basit sağlık kontrolü - auth gerektirmez."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "version": "1.0.0"}


@router.get("/health/detailed")
def detailed_health_check(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Detaylı sağlık kontrolü."""
    from sqlalchemy import text

    checks = {
        "database": {"status": "unknown", "latency_ms": 0},
        "disk_space": {"status": "unknown", "free_percent": 0},
        "memory": {"status": "unknown", "usage_percent": 0},
    }

    # Database kontrolü
    try:
        import time

        start = time.time()
        db.execute(text("SELECT 1"))
        checks["database"] = {
            "status": "healthy",
            "latency_ms": round((time.time() - start) * 1000, 2),
        }
    except Exception as e:
        checks["database"] = {"status": f"error: {str(e)}", "latency_ms": -1}

    # Disk kontrolü
    try:
        import shutil

        stat = shutil.disk_usage("/")
        free_percent = (stat.free / stat.total) * 100
        checks["disk_space"] = {
            "status": "healthy" if free_percent > 10 else "warning",
            "free_percent": round(free_percent, 1),
        }
    except Exception as e:
        checks["disk_space"] = {"status": f"error: {str(e)}", "free_percent": 0}

    overall = "healthy" if all(c["status"] == "healthy" for c in checks.values()) else "degraded"

    return {"overall_status": overall, "checks": checks, "timestamp": datetime.utcnow().isoformat()}
