"""
Google Cloud Vision OCR Entegrasyonu
Dünya standartlarında OCR doğruluğu, 200+ dil desteği
"""

import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class GoogleVisionConfig(BaseModel):
    """Google Cloud Vision yapılandırması"""

    api_key: str = Field(..., description="Google Cloud API Key")
    project_id: Optional[str] = None
    location: str = Field(default="us", description="API Region: us, eu, asia")
    enabled: bool = True


class GoogleVisionOCRResult(BaseModel):
    """Google Vision OCR sonuç modeli"""

    success: bool
    text: str
    confidence: float
    lines: List[Dict[str, Any]]
    pages: List[Dict[str, Any]] = []
    raw_response: Optional[Dict] = None
    error: Optional[str] = None


class GoogleVisionService:
    """Google Cloud Vision OCR servisi"""

    VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"

    def __init__(self, db: Session):
        self.db = db
        self._config = None

    def _get_config(self, key: str) -> Optional[str]:
        """Veritabanından config değeri al"""
        from app.models import GoogleVisionConfig as ConfigModel

        row = self.db.query(ConfigModel).filter(ConfigModel.key == key).first()
        return row.value if row else None

    def get_vision_config(self) -> Optional[GoogleVisionConfig]:
        """Vision config'i al"""
        if self._config:
            return self._config

        api_key = self._get_config("google_vision_api_key")
        project_id = self._get_config("google_vision_project_id")
        location = self._get_config("google_vision_location") or "us"

        if api_key:
            self._config = GoogleVisionConfig(
                api_key=api_key, project_id=project_id, location=location
            )
            return self._config
        return None

    def is_configured(self) -> bool:
        """Google Vision yapılandırma durumunu kontrol et"""
        return self._get_config("google_vision_api_key") is not None

    async def test_connection(self) -> Dict[str, Any]:
        """Google Vision API bağlantısını test et"""
        config = self.get_vision_config()
        if not config:
            return {"success": False, "error": "Google Vision yapılandırması bulunamadı"}

        try:
            # Test için basit bir görüntü (1x1 pixel)
            test_image = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

            result = await self.process_ocr(test_image)

            if result.success:
                return {"success": True, "message": "Google Vision API bağlantısı başarılı"}
            else:
                return {"success": False, "error": result.error}

        except Exception as e:
            logger.error(f"Google Vision test hatası: {e}")
            return {"success": False, "error": str(e)}

    async def process_ocr(self, image_data: bytes) -> GoogleVisionOCRResult:
        """
        Google Cloud Vision API ile OCR işle
        DOCUMENT_TEXT_DETECTION kullan (TEXT_DETECTION'dan daha iyi)
        """
        config = self.get_vision_config()
        if not config:
            return GoogleVisionOCRResult(
                success=False,
                text="",
                confidence=0,
                lines=[],
                error="Google Vision yapılandırması bulunamadı",
            )

        try:
            # Base64 encode
            encoded_image = base64.b64encode(image_data).decode("utf-8")

            # API Request
            url = f"{self.VISION_API_URL}?key={config.api_key}"

            payload = {
                "requests": [
                    {
                        "image": {"content": encoded_image},
                        "features": [{"type": "DOCUMENT_TEXT_DETECTION", "maxResults": 1}],
                        "imageContext": {"languageHints": ["tr", "en"]},
                    }
                ]
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, json=payload, headers={"Content-Type": "application/json"}, timeout=30
                )

                if response.status_code != 200:
                    error_text = response.text
                    try:
                        error_json = response.json()
                        error_text = error_json.get("error", {}).get("message", error_text)
                    except Exception:
                        pass

                    return GoogleVisionOCRResult(
                        success=False,
                        text="",
                        confidence=0,
                        lines=[],
                        error=f"Google Vision API Hatası: {response.status_code} - {error_text}",
                    )

                data = response.json()
                return self._parse_vision_response(data)

        except Exception as e:
            logger.error(f"Google Vision OCR işleme hatası: {e}")
            return GoogleVisionOCRResult(
                success=False, text="", confidence=0, lines=[], error=str(e)
            )

    def _parse_vision_response(self, data: Dict) -> GoogleVisionOCRResult:
        """Google Vision API yanıtını parse et"""
        responses = data.get("responses", [])
        if not responses:
            return GoogleVisionOCRResult(
                success=False,
                text="",
                confidence=0,
                lines=[],
                error="API yanıtında textAnnotation bulunamadı",
            )

        response = responses[0]

        # Hata kontrolü
        if "error" in response:
            return GoogleVisionOCRResult(
                success=False,
                text="",
                confidence=0,
                lines=[],
                error=response["error"].get("message", "Bilinmeyen hata"),
            )

        full_text = response.get("fullTextAnnotation", {})
        text = full_text.get("text", "")

        pages = full_text.get("pages", [])
        lines_out = []
        total_confidence = 0
        word_count = 0

        for page in pages:
            for block in page.get("blocks", []):
                for paragraph in block.get("paragraphs", []):
                    para_text = ""
                    para_confidence = 0
                    word_count_para = 0

                    for word in paragraph.get("words", []):
                        word_text = ""
                        for symbol in word.get("symbols", []):
                            word_text += symbol.get("text", "")

                        para_text += word_text + " "
                        word_confidence = word.get("confidence", 0.9)
                        para_confidence += word_confidence
                        word_count_para += 1

                    # Satır olarak ekle
                    if para_text.strip():
                        lines_out.append(
                            {
                                "text": para_text.strip(),
                                "confidence": (
                                    para_confidence / word_count_para
                                    if word_count_para > 0
                                    else 0.9
                                ),
                                "bounding_box": paragraph.get("boundingBox", {}),
                            }
                        )
                        total_confidence += para_confidence
                        word_count += word_count_para

        avg_confidence = (total_confidence / word_count * 100) if word_count > 0 else 0

        return GoogleVisionOCRResult(
            success=True,
            text=text,
            confidence=round(avg_confidence, 2),
            lines=lines_out,
            pages=pages,
            raw_response=data,
        )

    def update_config(self, config: GoogleVisionConfig) -> bool:
        """Google Vision yapılandırmasını güncelle"""
        from app.models import GoogleVisionConfig as ConfigModel

        configs = [
            ("google_vision_api_key", config.api_key),
            ("google_vision_project_id", config.project_id or ""),
            ("google_vision_location", config.location),
            ("google_vision_enabled", str(config.enabled)),
        ]

        for key, value in configs:
            row = self.db.query(ConfigModel).filter(ConfigModel.key == key).first()
            if row:
                row.value = value
                row.updated_at = datetime.now(timezone.utc)
            else:
                row = ConfigModel(
                    key=key,
                    value=value,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                self.db.add(row)

        self.db.commit()
        return True
