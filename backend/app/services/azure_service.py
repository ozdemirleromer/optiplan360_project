"""
Azure Services Entegrasyonu
- Azure Cognitive Services OCR
- Azure Blob Storage
- Azure Configuration Management
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from app.models import AzureConfig
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class AzureOCRConfig(BaseModel):
    """Azure Cognitive Services OCR yapılandırması"""

    subscription_key: str = Field(..., description="Azure Subscription Key")
    endpoint: str = Field(
        ..., description="Azure Endpoint URL (örn: https://<name>.cognitiveservices.azure.com)"
    )
    region: str = Field(default="westeurope", description="Azure Region")
    api_version: str = Field(default="v3.2", description="OCR API Version")
    enabled: bool = Field(default=True)


class AzureBlobConfig(BaseModel):
    """Azure Blob Storage yapılandırması"""

    connection_string: str = Field(..., description="Azure Storage Connection String")
    container_name: str = Field(default="optiplan360-ocr", description="Blob Container Name")
    enabled: bool = Field(default=True)


class AzureConfigOut(BaseModel):
    """Azure yapılandırma çıktısı (sensitif bilgiler gizli)"""

    configured: bool
    ocr_configured: bool
    blob_configured: bool
    ocr_endpoint: Optional[str] = None
    ocr_region: str = "westeurope"
    blob_container: str = "optiplan360-ocr"
    last_tested: Optional[str] = None
    test_status: Optional[str] = None


class AzureOCRResult(BaseModel):
    """Azure OCR sonuç modeli"""

    success: bool
    text: str
    confidence: float
    lines: List[Dict[str, Any]]
    raw_response: Optional[Dict] = None
    error: Optional[str] = None


class AzureBlobUploadResult(BaseModel):
    """Azure Blob upload sonucu"""

    success: bool
    blob_url: Optional[str] = None
    blob_name: Optional[str] = None
    size_bytes: int = 0
    error: Optional[str] = None


class AzureService:
    """Azure servisleri ana sınıfı"""

    def __init__(self, db: Session):
        self.db = db
        self._ocr_config = None
        self._blob_config = None

    def _get_config(self, key: str) -> Optional[str]:
        """Veritabanından config değeri al"""
        row = self.db.query(AzureConfig).filter(AzureConfig.key == key).first()
        return row.value if row else None

    def _set_config(self, key: str, value: str):
        """Veritabanına config değeri kaydet"""
        row = self.db.query(AzureConfig).filter(AzureConfig.key == key).first()
        if row:
            row.value = value
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = AzureConfig(
                key=key,
                value=value,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            self.db.add(row)
        self.db.commit()

    def get_ocr_config(self) -> Optional[AzureOCRConfig]:
        """OCR config'i al"""
        if self._ocr_config:
            return self._ocr_config

        endpoint = self._get_config("azure_ocr_endpoint")
        key = self._get_config("azure_ocr_key")
        region = self._get_config("azure_ocr_region") or "westeurope"

        if endpoint and key:
            self._ocr_config = AzureOCRConfig(
                subscription_key=key, endpoint=endpoint, region=region
            )
            return self._ocr_config
        return None

    def get_blob_config(self) -> Optional[AzureBlobConfig]:
        """Blob config'i al"""
        if self._blob_config:
            return self._blob_config

        conn_str = self._get_config("azure_blob_connection_string")
        container = self._get_config("azure_blob_container") or "optiplan360-ocr"

        if conn_str:
            self._blob_config = AzureBlobConfig(
                connection_string=conn_str, container_name=container
            )
            return self._blob_config
        return None

    def is_configured(self) -> Dict[str, bool]:
        """Azure yapılandırma durumunu kontrol et"""
        return {
            "ocr": self._get_config("azure_ocr_key") is not None,
            "blob": self._get_config("azure_blob_connection_string") is not None,
        }

    async def test_ocr_connection(self) -> Dict[str, Any]:
        """Azure OCR bağlantısını test et"""
        config = self.get_ocr_config()
        if not config:
            return {"success": False, "error": "OCR yapılandırması bulunamadı"}

        try:
            # Azure Computer Vision API test
            url = f"{config.endpoint}/vision/v3.2/read/analyze"
            headers = {
                "Ocp-Apim-Subscription-Key": config.subscription_key,
                "Content-Type": "application/json",
            }

            # Test için basit bir istek (base64 encoded 1x1 pixel image)
            test_image = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, data=test_image, timeout=10)

                if response.status_code == 202:
                    return {"success": True, "message": "Azure OCR bağlantısı başarılı"}
                else:
                    return {
                        "success": False,
                        "error": f"API Hatası: {response.status_code} - {response.text}",
                    }

        except Exception as e:
            logger.error(f"Azure OCR test hatası: {e}")
            return {"success": False, "error": str(e)}

    async def process_ocr(self, image_data: bytes) -> AzureOCRResult:
        """
        Azure Computer Vision OCR ile görüntü işle
        """
        config = self.get_ocr_config()
        if not config:
            return AzureOCRResult(
                success=False,
                text="",
                confidence=0,
                lines=[],
                error="Azure OCR yapılandırması bulunamadı",
            )

        try:
            # Azure Computer Vision Read API v3.2
            url = f"{config.endpoint}/vision/v3.2/read/analyze"
            headers = {
                "Ocp-Apim-Subscription-Key": config.subscription_key,
                "Content-Type": "application/octet-stream",
            }

            async with httpx.AsyncClient() as client:
                # 1. Görüntüyü gönder ve operation location al
                response = await client.post(url, headers=headers, data=image_data, timeout=30)

                if response.status_code != 202:
                    return AzureOCRResult(
                        success=False,
                        text="",
                        confidence=0,
                        lines=[],
                        error=f"Azure API Hatası: {response.status_code} - {response.text}",
                    )

                operation_url = response.headers.get("Operation-Location")
                if not operation_url:
                    return AzureOCRResult(
                        success=False,
                        text="",
                        confidence=0,
                        lines=[],
                        error="Operation-Location header bulunamadı",
                    )

                # 2. İşlem tamamlanana kadar bekle
                max_attempts = 10
                for _ in range(max_attempts):
                    await asyncio.sleep(1)

                    result_response = await client.get(
                        operation_url,
                        headers={"Ocp-Apim-Subscription-Key": config.subscription_key},
                        timeout=10,
                    )

                    if result_response.status_code == 200:
                        result_data = result_response.json()
                        status = result_data.get("status")

                        if status == "succeeded":
                            # Sonuçları parse et
                            return self._parse_azure_ocr_result(result_data)
                        elif status == "failed":
                            return AzureOCRResult(
                                success=False,
                                text="",
                                confidence=0,
                                lines=[],
                                error="Azure OCR işlemi başarısız oldu",
                            )

                return AzureOCRResult(
                    success=False, text="", confidence=0, lines=[], error="OCR işlem zaman aşımı"
                )

        except Exception as e:
            logger.error(f"Azure OCR işleme hatası: {e}")
            return AzureOCRResult(success=False, text="", confidence=0, lines=[], error=str(e))

    def _parse_azure_ocr_result(self, result_data: Dict) -> AzureOCRResult:
        """Azure OCR sonuçlarını parse et"""
        lines = []
        all_text = []
        total_confidence = 0
        word_count = 0

        analyze_result = result_data.get("analyzeResult", {})
        read_results = analyze_result.get("readResults", [])

        for page in read_results:
            for line in page.get("lines", []):
                line_text = line.get("text", "").strip()
                if line_text:
                    all_text.append(line_text)

                    # Kelime güven skorlarını hesapla
                    words = line.get("words", [])
                    for word in words:
                        total_confidence += word.get("confidence", 0.8)
                        word_count += 1

                    lines.append(
                        {
                            "text": line_text,
                            "bounding_box": line.get("boundingBox", []),
                            "words": [
                                {"text": w.get("text"), "confidence": w.get("confidence")}
                                for w in words
                            ],
                        }
                    )

        avg_confidence = (total_confidence / word_count * 100) if word_count > 0 else 0

        return AzureOCRResult(
            success=True,
            text="\n".join(all_text),
            confidence=round(avg_confidence, 2),
            lines=lines,
            raw_response=result_data,
        )

    async def upload_to_blob(
        self, file_data: bytes, file_name: str, content_type: str = "application/octet-stream"
    ) -> AzureBlobUploadResult:
        """
        Dosyayı Azure Blob Storage'a yükle
        """
        config = self.get_blob_config()
        if not config:
            return AzureBlobUploadResult(
                success=False, error="Azure Blob yapılandırması bulunamadı"
            )

        try:
            from azure.storage.blob import BlobServiceClient, ContentSettings

            # Blob service client oluştur
            blob_service_client = BlobServiceClient.from_connection_string(config.connection_string)

            # Container oluştur (yoksa)
            container_client = blob_service_client.get_container_client(config.container_name)
            if not container_client.exists():
                container_client.create_container()

            # Benzersiz blob adı oluştur
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            blob_name = f"{timestamp}_{uuid4().hex[:8]}_{file_name}"

            # Blob client
            blob_client = container_client.get_blob_client(blob_name)

            # Yükle
            content_settings = ContentSettings(content_type=content_type)
            blob_client.upload_blob(file_data, overwrite=True, content_settings=content_settings)

            # URL oluştur
            blob_url = blob_client.url

            return AzureBlobUploadResult(
                success=True, blob_url=blob_url, blob_name=blob_name, size_bytes=len(file_data)
            )

        except ImportError:
            return AzureBlobUploadResult(
                success=False,
                error="Azure Storage SDK yüklü değil. 'pip install azure-storage-blob' çalıştırın.",
            )
        except Exception as e:
            logger.error(f"Azure Blob upload hatası: {e}")
            return AzureBlobUploadResult(success=False, error=str(e))

    async def delete_from_blob(self, blob_name: str) -> bool:
        """Blob'dan dosya sil"""
        config = self.get_blob_config()
        if not config:
            return False

        try:
            from azure.storage.blob import BlobServiceClient

            blob_service_client = BlobServiceClient.from_connection_string(config.connection_string)
            container_client = blob_service_client.get_container_client(config.container_name)
            blob_client = container_client.get_blob_client(blob_name)

            blob_client.delete_blob()
            return True

        except Exception as e:
            logger.error(f"Azure Blob silme hatası: {e}")
            return False

    def update_config(
        self,
        ocr_config: Optional[AzureOCRConfig] = None,
        blob_config: Optional[AzureBlobConfig] = None,
    ) -> AzureConfigOut:
        """Azure yapılandırmasını güncelle"""
        if ocr_config:
            self._set_config("azure_ocr_endpoint", ocr_config.endpoint)
            self._set_config("azure_ocr_key", ocr_config.subscription_key)
            self._set_config("azure_ocr_region", ocr_config.region)
            self._set_config("azure_ocr_enabled", str(ocr_config.enabled))

        if blob_config:
            self._set_config("azure_blob_connection_string", blob_config.connection_string)
            self._set_config("azure_blob_container", blob_config.container_name)
            self._set_config("azure_blob_enabled", str(blob_config.enabled))

        status = self.is_configured()
        return AzureConfigOut(
            configured=status["ocr"] or status["blob"],
            ocr_configured=status["ocr"],
            blob_configured=status["blob"],
            blob_container=self._get_config("azure_blob_container") or "optiplan360-ocr",
        )


# Azure modelleri için veritabanı tablosu
# models.py'e eklenecek:
# class AzureConfig(Base):
#     __tablename__ = "azure_configs"
#     id = Column(Integer, primary_key=True)
#     key = Column(String, unique=True, nullable=False)
#     value = Column(Text)
#     created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
#     updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
