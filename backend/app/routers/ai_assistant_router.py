"""
AI Asistan Router - Gemini API entegrasyonu
OptiPlan 360 için AI destekli asistan endpoint'leri
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.auth import get_current_user
from app.database import get_db
from app.exceptions import BusinessRuleError, ValidationError
from app.models import User
from app.services.gemini_service import get_gemini_service
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic modelleri
class TextRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=10000)
    context: Optional[str] = Field(None, max_length=5000)
    system_instruction: Optional[str] = Field(None, max_length=2000)


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_items=1, max_items=50)
    system_instruction: Optional[str] = Field(None, max_length=2000)


class StructuredExtractionRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000)
    extraction_schema: Dict[str, Any] = Field(..., alias="schema")


class DocumentAnalysisRequest(BaseModel):
    document_text: str = Field(..., min_length=10, max_length=100000)
    document_type: str = Field("general", pattern="^(general|invoice|contract|report|price_list)$")


@router.post("/assistant/text", tags=["ai-assistant"])
async def generate_text_response(
    request: TextRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Metin tabanlı AI yanıt üretir

    - **prompt**: Kullanıcı sorusu veya komutu
    - **context**: İsteğe bağlı bağlam bilgisi
    - **system_instruction**: Sistem talimatları
    """
    try:
        gemini_service = get_gemini_service()

        # Prompt'u kontrol et
        if len(request.prompt.strip()) < 3:
            raise ValidationError("Prompt en az 3 karakter olmalıdır")

        # Asenkron yanıt üret
        response = await gemini_service.generate_text_response(
            prompt=request.prompt,
            context=request.context,
            system_instruction=request.system_instruction,
        )

        if not response["success"]:
            raise BusinessRuleError(
                f"AI yanıt üretilemedi: {response.get('error', 'Bilinmeyen hata')}"
            )

        return {
            "success": True,
            "data": {
                "response": response["response"],
                "model": response["model"],
                "timestamp": response["timestamp"],
                "tokens_used": response.get("tokens_used"),
            },
        }

    except Exception as e:
        logger.error(f"Text response hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assistant/chat", tags=["ai-assistant"])
async def chat_completion(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Konuşma tabanlı AI yanıtı üretir

    - **messages**: Konuşma geçmişi
    - **system_instruction**: Sistem talimatları
    """
    try:
        gemini_service = get_gemini_service()

        # Mesajları kontrol et
        if not request.messages:
            raise ValidationError("En az bir mesaj gereklidir")

        # Mesajları formatla
        formatted_messages = []
        for msg in request.messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        # Asenkron yanıt üret
        response = await gemini_service.chat_completion(
            messages=formatted_messages, system_instruction=request.system_instruction
        )

        if not response["success"]:
            raise BusinessRuleError(
                f"AI yanıt üretilemedi: {response.get('error', 'Bilinmeyen hata')}"
            )

        return {
            "success": True,
            "data": {
                "response": response["response"],
                "model": response["model"],
                "timestamp": response["timestamp"],
                "tokens_used": response.get("tokens_used"),
            },
        }

    except Exception as e:
        logger.error(f"Chat completion hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assistant/extract", tags=["ai-assistant"])
async def extract_structured_data(
    request: StructuredExtractionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Metinden yapılandırılmış veri çıkarır

    - **text**: İşlenecek metin
    - **schema**: Beklenen veri şeması (JSON formatında)
    """
    try:
        gemini_service = get_gemini_service()

        # Girdileri kontrol et
        if len(request.text.strip()) < 10:
            raise ValidationError("Metin en az 10 karakter olmalıdır")

        if not request.extraction_schema:
            raise ValidationError("Veri şeması gereklidir")

        # Asenkron veri çıkarma
        response = await gemini_service.extract_structured_data(
            text=request.text, schema=request.extraction_schema
        )

        if not response["success"]:
            raise BusinessRuleError(
                f"Veri çıkarılamadı: {response.get('error', 'Bilinmeyen hata')}"
            )

        return {
            "success": True,
            "data": {
                "extracted_data": response.get("extracted_data"),
                "model": response["model"],
                "timestamp": response["timestamp"],
                "raw_response": response.get("raw_response"),
            },
        }

    except Exception as e:
        logger.error(f"Structured extraction hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assistant/analyze-document", tags=["ai-assistant"])
async def analyze_document(
    request: DocumentAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Doküman analizi yapar (fatura, sözleşme, rapor, fiyat listesi)

    - **document_text**: Doküman metni
    - **document_type**: Doküman tipi (general, invoice, contract, report, price_list)
    """
    try:
        gemini_service = get_gemini_service()

        # Girdileri kontrol et
        if len(request.document_text.strip()) < 10:
            raise ValidationError("Doküman metni en az 10 karakter olmalıdır")

        # Asenkron doküman analizi
        response = await gemini_service.analyze_document(
            document_text=request.document_text, document_type=request.document_type
        )

        if not response["success"]:
            raise BusinessRuleError(
                f"Doküman analiz edilemedi: {response.get('error', 'Bilinmeyen hata')}"
            )

        return {
            "success": True,
            "data": {
                "analysis": response["response"],
                "document_type": request.document_type,
                "model": response["model"],
                "timestamp": response["timestamp"],
            },
        }

    except Exception as e:
        logger.error(f"Document analysis hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assistant/analyze-image", tags=["ai-assistant"])
async def analyze_image(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Görüntü analizi yapar

    - **file**: Analiz edilecek görüntü dosyası
    - **prompt**: Analiz talimatı
    """
    try:
        gemini_service = get_gemini_service()

        # Dosya kontrolü
        if not file.content_type.startswith("image/"):
            raise ValidationError("Sadece görüntü dosyaları kabul edilir")

        # Dosya boyutu kontrolü (10MB limit)
        if file.size > 10 * 1024 * 1024:
            raise ValidationError("Dosya boyutu 10MB'dan küçük olmalıdır")

        # Görüntü verisini oku
        image_data = await file.read()

        # Asenkron görüntü analizi
        response = await gemini_service.analyze_image(
            image_data=image_data, prompt=prompt, mime_type=file.content_type
        )

        if not response["success"]:
            raise BusinessRuleError(
                f"Görüntü analiz edilemedi: {response.get('error', 'Bilinmeyen hata')}"
            )

        return {
            "success": True,
            "data": {
                "analysis": response["response"],
                "model": response["model"],
                "timestamp": response["timestamp"],
                "image_size": response.get("image_size"),
                "file_name": file.filename,
            },
        }

    except Exception as e:
        logger.error(f"Image analysis hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assistant/models", tags=["ai-assistant"])
async def get_available_models(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Kullanılabilir AI modellerini listeler
    """
    try:
        return {
            "success": True,
            "data": {
                "models": [
                    {
                        "id": "gemini-1.5-pro",
                        "name": "Gemini 1.5 Pro",
                        "type": "text",
                        "description": "Genel amaçlı metin üretimi ve analiz",
                        "max_tokens": 8192,
                    },
                    {
                        "id": "gemini-1.5-pro-visional",
                        "name": "Gemini 1.5 Pro Vision",
                        "type": "multimodal",
                        "description": "Metin ve görüntü analizi",
                        "max_tokens": 8192,
                    },
                ],
                "features": [
                    "text_generation",
                    "chat_completion",
                    "image_analysis",
                    "structured_extraction",
                    "document_analysis",
                ],
            },
        }

    except Exception as e:
        logger.error(f"Models list hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assistant/health", tags=["ai-assistant"])
async def health_check(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    AI servisi sağlık kontrolü
    """
    try:
        gemini_service = get_gemini_service()

        # Basit test isteği
        test_response = await gemini_service.generate_text_response(
            prompt="Test", system_instruction="Kısa cevap ver"
        )

        return {
            "success": True,
            "data": {
                "status": "healthy" if test_response["success"] else "unhealthy",
                "service": "gemini",
                "timestamp": test_response["timestamp"],
                "test_response": test_response["success"],
            },
        }

    except Exception as e:
        logger.error(f"Health check hatası: {str(e)}")
        return {
            "success": False,
            "data": {
                "status": "unhealthy",
                "service": "gemini",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            },
        }
