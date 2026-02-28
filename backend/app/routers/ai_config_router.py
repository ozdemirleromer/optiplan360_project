"""
AI Konfigürasyon Router - AI servisleri yönetimi
API anahtarları ve provider seçimi için endpoint'ler
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json
import os
import logging

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.exceptions import ValidationError, BusinessRuleError
from app.services.gemini_service import get_gemini_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic modelleri
class AIProviderConfig(BaseModel):
    provider: str = Field(..., pattern="^(gemini|openai|custom)$")
    api_key: str = Field(..., min_length=10)
    model: str = Field(..., min_length=1)
    endpoint: Optional[str] = None
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(8192, ge=1, le=32768)
    is_active: bool = True

class AIConfigResponse(BaseModel):
    success: bool
    message: str
    config: Optional[Dict[str, Any]] = None
    providers: Optional[Dict[str, Any]] = None

class TestConnectionRequest(BaseModel):
    provider: str = Field(..., pattern="^(gemini|openai|custom)$")
    api_key: str = Field(..., min_length=10)
    model: Optional[str] = None
    endpoint: Optional[str] = None

# AI konfigürasyon dosyası yolu
AI_CONFIG_PATH = "config/ai_config.json"

def load_ai_config() -> Dict[str, Any]:
    """AI konfigürasyonunu dosyadan yükler"""
    try:
        if os.path.exists(AI_CONFIG_PATH):
            with open(AI_CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "current_provider": None,
            "providers": {},
            "settings": {
                "default_temperature": 0.7,
                "default_max_tokens": 8192,
                "timeout": 30
            }
        }
    except Exception as e:
        logger.error(f"AI config yüklenemedi: {str(e)}")
        return {"current_provider": None, "providers": {}, "settings": {}}

def save_ai_config(config: Dict[str, Any]) -> bool:
    """AI konfigürasyonunu dosyaya kaydeder"""
    try:
        os.makedirs(os.path.dirname(AI_CONFIG_PATH), exist_ok=True)
        with open(AI_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"AI config kaydedilemedi: {str(e)}")
        return False

@router.get("/config/ai", response_model=AIConfigResponse, tags=["ai-config"])
async def get_ai_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mevcut AI konfigürasyonunu getirir
    """
    try:
        config = load_ai_config()
        
        return AIConfigResponse(
            success=True,
            message="AI konfigürasyonu başarıyla getirildi",
            config=config,
            providers={
                "gemini": {
                    "name": "Google Gemini",
                    "models": ["gemini-1.5-pro", "gemini-1.5-pro-visional"],
                    "description": "Google'ın çok modelli AI modeli",
                    "features": ["text", "vision", "chat", "extraction"]
                },
                "openai": {
                    "name": "OpenAI GPT",
                    "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
                    "description": "OpenAI'nin dil modeli",
                    "features": ["text", "chat", "extraction"]
                },
                "custom": {
                    "name": "Özel API",
                    "models": ["custom"],
                    "description": "Özel AI API endpoint'i",
                    "features": ["text", "chat"]
                }
            }
        )
    except Exception as e:
        logger.error(f"AI config getirilemedi: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config/ai", response_model=AIConfigResponse, tags=["ai-config"])
async def save_ai_provider_config(
    config_data: AIProviderConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI provider konfigürasyonunu kaydeder
    """
    try:
        # Admin kontrolü
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("AI konfigürasyonu için yetkiniz yok")
        
        config = load_ai_config()
        
        # Provider konfigürasyonunu güncelle
        provider_config = {
            "api_key": config_data.api_key,
            "model": config_data.model,
            "endpoint": config_data.endpoint,
            "temperature": config_data.temperature,
            "max_tokens": config_data.max_tokens,
            "is_active": config_data.is_active,
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": current_user.username
        }
        
        config["providers"][config_data.provider] = provider_config
        
        # Eğer bu provider aktifse, current_provider olarak ayarla
        if config_data.is_active:
            config["current_provider"] = config_data.provider
        
        # Konfigürasyonu kaydet
        if save_ai_config(config):
            return AIConfigResponse(
                success=True,
                message=f"{config_data.provider.upper()} konfigürasyonu başarıyla kaydedildi",
                config=config
            )
        else:
            raise BusinessRuleError("Konfigürasyon kaydedilemedi")
            
    except Exception as e:
        logger.error(f"AI config kaydedilemedi: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config/ai/test", response_model=AIConfigResponse, tags=["ai-config"])
async def test_ai_connection(
    test_data: TestConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI provider bağlantısını test eder
    """
    try:
        if test_data.provider == "gemini":
            # Gemini test
            try:
                import google.generativeai as genai
                genai.configure(api_key=test_data.api_key)
                model = genai.GenerativeModel(test_data.model or "gemini-1.5-pro")
                
                # Basit test
                response = model.generate_content("Test")
                
                return AIConfigResponse(
                    success=True,
                    message="Gemini bağlantısı başarılı",
                    config={"test_response": response.text[:100]}
                )
            except Exception as e:
                return AIConfigResponse(
                    success=False,
                    message=f"Gemini bağlantı hatası: {str(e)}"
                )
        
        elif test_data.provider == "openai":
            # OpenAI test (gelecekte eklenecek)
            return AIConfigResponse(
                success=False,
                message="OpenAI entegrasyonu henüz mevcut değil"
            )
        
        else:
            return AIConfigResponse(
                success=False,
                message="Bilinmeyen provider"
            )
            
    except Exception as e:
        logger.error(f"AI test hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/config/ai/switch/{provider}", response_model=AIConfigResponse, tags=["ai-config"])
async def switch_ai_provider(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aktif AI provider'ını değiştirir
    """
    try:
        # Admin kontrolü
        if current_user.role not in ["ADMIN", "OPERATOR"]:
            raise BusinessRuleError("Provider değiştirme yetkiniz yok")
        
        if provider not in ["gemini", "openai", "custom"]:
            raise ValidationError("Geçersiz provider")
        
        config = load_ai_config()
        
        if provider not in config["providers"]:
            raise ValidationError(f"{provider} provider'ı yapılandırılmamış")
        
        # Aktif provider'ı değiştir
        config["current_provider"] = provider
        
        if save_ai_config(config):
            return AIConfigResponse(
                success=True,
                message=f"Aktif provider {provider.upper()} olarak değiştirildi",
                config=config
            )
        else:
            raise BusinessRuleError("Provider değiştirilemedi")
            
    except Exception as e:
        logger.error(f"Provider değiştirilemedi: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/config/ai/{provider}", response_model=AIConfigResponse, tags=["ai-config"])
async def delete_ai_provider_config(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI provider konfigürasyonunu siler
    """
    try:
        # Admin kontrolü
        if current_user.role not in ["ADMIN"]:
            raise BusinessRuleError("Provider silme yetkiniz yok")
        
        config = load_ai_config()
        
        if provider not in config["providers"]:
            raise ValidationError(f"{provider} provider'ı mevcut değil")
        
        # Eğer silinen provider aktifse, current_provider'ı temizle
        if config.get("current_provider") == provider:
            config["current_provider"] = None
        
        # Provider'ı sil
        del config["providers"][provider]
        
        if save_ai_config(config):
            return AIConfigResponse(
                success=True,
                message=f"{provider.upper()} konfigürasyonu silindi",
                config=config
            )
        else:
            raise BusinessRuleError("Provider silinemedi")
            
    except Exception as e:
        logger.error(f"Provider silinemedi: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config/ai/status", response_model=AIConfigResponse, tags=["ai-config"])
async def get_ai_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI servislerinin durumunu kontrol eder
    """
    try:
        config = load_ai_config()
        status = {
            "current_provider": config.get("current_provider"),
            "configured_providers": list(config.get("providers", {}).keys()),
            "services": {}
        }
        
        # Her provider için durum kontrolü
        for provider_name, provider_config in config.get("providers", {}).items():
            status["services"][provider_name] = {
                "configured": True,
                "active": config.get("current_provider") == provider_name,
                "model": provider_config.get("model"),
                "last_updated": provider_config.get("updated_at")
            }
        
        return AIConfigResponse(
            success=True,
            message="AI durum bilgileri getirildi",
            config=status
        )
        
    except Exception as e:
        logger.error(f"AI status alınamadı: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
