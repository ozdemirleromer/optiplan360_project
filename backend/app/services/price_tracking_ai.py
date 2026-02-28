"""
Fiyat takip sistemi — GPT-4o ile yapılandırılmış veri çıkarma.
"""
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_client = None

EXTRACTION_SYSTEM_PROMPT = """Sen bir fiyat listesi analiz uzmanısın. Sana verilen metin bir fiyat listesi belgesinden çıkarılmıştır.

Görevin: Metindeki tüm ürünleri yapılandırılmış JSON formatında çıkarmak.

Her ürün için şu alanları çıkar (varsa):
- urun_kodu: Ürün/stok kodu
- urun_adi: Ürün adı (ZORUNLU)
- birim: Ölçü birimi (Adet, KG, Metre vb.)
- liste_fiyati: Liste/birim fiyatı (sayısal)
- iskonto_orani: İskonto yüzdesi (sayısal, 0-100)
- net_fiyat: Net fiyat (sayısal)
- kdv_orani: KDV oranı (sayısal, genelde 20)
- kdv_dahil_fiyat: KDV dahil fiyat (sayısal)
- para_birimi: Para birimi (TRY, USD, EUR, GBP)
- kategori: Ürün kategorisi
- marka: Marka/üretici

Kurallar:
1. Sadece gerçek ürün satırlarını çıkar (başlık, toplam, not satırlarını ATLA)
2. Fiyatları sayısal değer olarak döndür (binlik ayracı, para birimi sembolü olmadan)
3. Yanıtını SADECE JSON array olarak ver: [{"urun_adi": "...", ...}, ...]
4. Ürün adı olmayan satırları dahil etme
"""


def _get_client():
    """OpenAI istemcisini lazy-init ile döndürür. Config dosyasından veya env var'dan okur."""
    global _client
    if _client is None:
        try:
            from openai import OpenAI

            # Önce config dosyasından oku
            api_key = None
            config_path = "config/ai_config.json"
            try:
                import json as _json
                if os.path.exists(config_path):
                    with open(config_path, "r", encoding="utf-8") as f:
                        cfg = _json.load(f)
                        if cfg.get("enabled") and cfg.get("api_key"):
                            api_key = cfg["api_key"]
                            logger.info("AI API anahtarı config dosyasından yüklendi")
            except Exception as e:
                logger.warning("AI config dosyası okunamadı: %s", e)

            # Env var fallback
            if not api_key:
                api_key = os.getenv("OPENAI_API_KEY")
                if api_key:
                    logger.info("AI API anahtarı env var'dan yüklendi")

            if not api_key:
                logger.warning("OPENAI_API_KEY ayarlanmamış (ne config ne env var)")
                return None
            _client = OpenAI(api_key=api_key)
        except ImportError:
            logger.warning("openai kütüphanesi yüklü değil")
            return None
    return _client


def _get_config_model() -> str:
    """Config dosyasından model adını oku, yoksa gpt-4o döndür."""
    config_path = "config/ai_config.json"
    try:
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                return cfg.get("model", "gpt-4o")
    except Exception:
        pass
    return "gpt-4o"


def extract_price_data_from_text(
    text: str,
    supplier: str = "",
    model: str = "",
    max_text_length: int = 15000,
) -> list[dict[str, Any]]:
    """
    GPT-4o ile metinden yapılandırılmış fiyat verisi çıkarır.

    Args:
        text: OCR veya PDF'den çıkarılmış ham metin
        supplier: Tedarikçi adı (context için)
        model: OpenAI model adı
        max_text_length: Metin uzunluk limiti

    Returns:
        Ürün dict listesi
    """
    client = _get_client()
    if client is None:
        logger.warning("OpenAI istemcisi mevcut değil, AI çıkarma atlanıyor")
        return []

    # Model adını config'den al (parametre boşsa)
    if not model:
        model = _get_config_model()

    if not text or len(text.strip()) < 20:
        logger.warning("Çıkarma için yetersiz metin")
        return []

    # Metin uzunluk limiti
    if len(text) > max_text_length:
        text = text[:max_text_length]
        logger.info("Metin %d karaktere kısaltıldı", max_text_length)

    user_prompt = f"Tedarikçi: {supplier}\n\nFiyat listesi metni:\n{text}"

    try:
        response = client.chat.completions.create(
            model=model,
            temperature=0.0,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )

        content = response.choices[0].message.content or ""

        # JSON çıkarma
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])

        items = json.loads(content)

        # Normalize
        if isinstance(items, dict):
            for key in ("items", "products", "data", "urunler"):
                if key in items and isinstance(items[key], list):
                    items = items[key]
                    break
            else:
                items = [items]

        if not isinstance(items, list):
            logger.warning("AI yanıtı list değil: %s", type(items))
            return []

        # Ürün adı olmayanları filtrele
        valid = [
            item for item in items
            if isinstance(item, dict) and item.get("urun_adi")
        ]

        logger.info("AI çıkarma: %d ürün (toplam %d)", len(valid), len(items))
        return valid

    except json.JSONDecodeError as e:
        logger.error("AI yanıtı JSON parse edilemedi: %s", e)
        return []
    except Exception as e:
        logger.error("AI çıkarma hatası: %s", e)
        return []
