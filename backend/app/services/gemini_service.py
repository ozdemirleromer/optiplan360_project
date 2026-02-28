"""
Gemini AI Servisi - Google Gemini API entegrasyonu
OptiPlan 360 için AI destekli asistan fonksiyonları
"""

import asyncio
import io
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from google.generativeai.types import HarmBlockThreshold, HarmCategory

logger = logging.getLogger(__name__)


class GeminiService:
    """Google Gemini AI servis sınıfı"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Gemini servisini başlatır

        Args:
            api_key: Google API anahtarı (AI config dosyasından alınabilir)
        """
        # Önce AI config dosyasından anahtarı dene
        if not api_key:
            try:
                import json

                config_path = "config/ai_config.json"
                if os.path.exists(config_path):
                    with open(config_path, "r", encoding="utf-8") as f:
                        config = json.load(f)
                        if config.get("current_provider") == "gemini" and config.get(
                            "providers", {}
                        ).get("gemini"):
                            api_key = config["providers"]["gemini"].get("api_key")
            except Exception as e:
                logger.warning(f"AI config okunamadı: {str(e)}")

        # Son olarak environment değişkenini dene
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError(
                "Gemini API anahtarı gereklidir. AI Konfigürasyon ekranından ayarlayın veya GEMINI_API_KEY environment değişkenini tanımlayın."
            )

        self.api_key = api_key
        genai.configure(api_key=self.api_key)

        # Model konfigürasyonu
        self.model_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 8192,
        }

        # Güvenlik ayarları
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }

        # Modeller
        self.text_model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            generation_config=self.model_config,
            safety_settings=self.safety_settings,
        )

        self.vision_model = genai.GenerativeModel(
            model_name="gemini-1.5-pro-visional",
            generation_config=self.model_config,
            safety_settings=self.safety_settings,
        )

    async def generate_text_response(
        self, prompt: str, context: Optional[str] = None, system_instruction: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Metin tabanlı yanıt üretir

        Args:
            prompt: Kullanıcı sorusu/komutu
            context: İsteğe bağlı bağlam bilgisi
            system_instruction: Sistem talimatları

        Returns:
            Dict: Yanıt ve metadata
        """
        try:
            # Sistem talimatını hazırla
            full_prompt = self._build_prompt(prompt, context, system_instruction)

            # Asenkron yanıt üret
            response = await asyncio.to_thread(self.text_model.generate_content, full_prompt)

            return {
                "success": True,
                "response": response.text,
                "model": "gemini-1.5-pro",
                "timestamp": datetime.utcnow().isoformat(),
                "tokens_used": getattr(response, "usage_metadata", None),
            }

        except Exception as e:
            logger.error(f"Gemini metin yanıt hatası: {str(e)}")
            return {"success": False, "error": str(e), "timestamp": datetime.utcnow().isoformat()}

    async def analyze_image(
        self, image_data: bytes, prompt: str, mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Görüntü analizi yapar

        Args:
            image_data: Görüntü verisi (bytes)
            prompt: Analiz talimatı
            mime_type: Görüntü formatı

        Returns:
            Dict: Analiz sonuçları
        """
        try:
            import PIL.Image

            # Görüntüyü yükle
            image = PIL.Image.open(io.BytesIO(image_data))

            # Vision model ile analiz et
            response = await asyncio.to_thread(self.vision_model.generate_content, [prompt, image])

            return {
                "success": True,
                "response": response.text,
                "model": "gemini-1.5-pro-visional",
                "timestamp": datetime.utcnow().isoformat(),
                "image_size": f"{image.width}x{image.height}",
            }

        except Exception as e:
            logger.error(f"Gemini görüntü analizi hatası: {str(e)}")
            return {"success": False, "error": str(e), "timestamp": datetime.utcnow().isoformat()}

    async def extract_structured_data(self, text: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Metinden yapılandırılmış veri çıkarır

        Args:
            text: İşlenecek metin
            schema: Beklenen veri şeması

        Returns:
            Dict: Yapılandırılmış veri
        """
        try:
            schema_prompt = f"""
            Aşağıdaki metinden belirtilen şemaya uygun veri çıkar.
            Sadece JSON formatında yanıt ver.
            
            Şema:
            {json.dumps(schema, indent=2, ensure_ascii=False)}
            
            Metin:
            {text}
            """

            response = await self.generate_text_response(
                prompt=schema_prompt,
                system_instruction="Sen bir veri çıkarma uzmanısın. Sadece geçerli JSON formatında yanıt ver.",
            )

            if response["success"]:
                try:
                    # JSON yanıtını parse et
                    json_text = response["response"].strip()
                    if json_text.startswith("```json"):
                        json_text = json_text.replace("```json", "").replace("```", "").strip()

                    extracted_data = json.loads(json_text)
                    response["extracted_data"] = extracted_data

                except json.JSONDecodeError as e:
                    response["success"] = False
                    response["error"] = f"JSON parse hatası: {str(e)}"
                    response["raw_response"] = response["response"]

            return response

        except Exception as e:
            logger.error(f"Yapılandırılmış veri çıkarma hatası: {str(e)}")
            return {"success": False, "error": str(e), "timestamp": datetime.utcnow().isoformat()}

    async def chat_completion(
        self, messages: List[Dict[str, str]], system_instruction: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Konuşma tamamlama (chat) yanıtı üretir

        Args:
            messages: Mesaj geçmişi
            system_instruction: Sistem talimatları

        Returns:
            Dict: Yanıt
        """
        try:
            # Konuşma geçmişini formatla
            chat_history = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                chat_history.append({"role": role, "parts": [{"text": content}]})

            # Chat session oluştur
            if system_instruction:
                model = genai.GenerativeModel(
                    model_name="gemini-1.5-pro",
                    system_instruction=system_instruction,
                    generation_config=self.model_config,
                    safety_settings=self.safety_settings,
                )
            else:
                model = self.text_model

            chat = model.start_chat(history=chat_history[:-1])

            # Son mesaja yanıt ver
            last_message = chat_history[-1]["parts"][0]["text"] if chat_history else ""
            response = await asyncio.to_thread(chat.send_message, last_message)

            return {
                "success": True,
                "response": response.text,
                "model": "gemini-1.5-pro",
                "timestamp": datetime.utcnow().isoformat(),
                "tokens_used": getattr(response, "usage_metadata", None),
            }

        except Exception as e:
            logger.error(f"Chat completion hatası: {str(e)}")
            return {"success": False, "error": str(e), "timestamp": datetime.utcnow().isoformat()}

    def _build_prompt(
        self, prompt: str, context: Optional[str] = None, system_instruction: Optional[str] = None
    ) -> str:
        """Tam prompt'u oluşturur"""
        parts = []

        if system_instruction:
            parts.append(f"Sistem Talimatları: {system_instruction}\n")

        if context:
            parts.append(f"Bağlam Bilgisi: {context}\n")

        parts.append(f"Soru/Komut: {prompt}")

        return "\n".join(parts)

    async def analyze_document(
        self, document_text: str, document_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Doküman analizi yapar (fatura, sözleşme, vb.)

        Args:
            document_text: Doküman metni
            document_type: Doküman tipi

        Returns:
            Dict: Analiz sonuçları
        """
        try:
            system_prompts = {
                "invoice": "Sen bir fatura analisis uzmanısın. Faturalardan önemli bilgileri çıkar ve yapılandır.",
                "contract": "Sen bir sözleşme analisis uzmanısın. Sözleşmelerdeki önemli maddeleri ve bilgileri çıkar.",
                "general": "Sen bir doküman analisis uzmanısın. Dokümanlardan önemli bilgileri çıkar ve özetle.",
            }

            system_instruction = system_prompts.get(document_type, system_prompts["general"])

            prompt = f"""
            Aşağıdaki {document_type} dokümanını analiz et ve şu bilgileri çıkar:
            1. Doküman türü ve tarihi
            2. Taraflar (müşteri, tedarikçi, vb.)
            3. Önemli sayılar (tutar, tarih, miktar)
            4. Ana konular ve maddeler
            5. Riskli veya dikkat edilmesi gereken noktalar
            
            Doküman:
            {document_text}
            """

            return await self.generate_text_response(
                prompt=prompt, system_instruction=system_instruction
            )

        except Exception as e:
            logger.error(f"Doküman analizi hatası: {str(e)}")
            return {"success": False, "error": str(e), "timestamp": datetime.utcnow().isoformat()}


# Singleton instance
_gemini_service = None


def get_gemini_service() -> GeminiService:
    """Gemini servisi singleton instance'ı döndürür"""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
