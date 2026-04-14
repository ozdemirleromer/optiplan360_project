"""
Gemini OCR Adapter — OptiPlan 360 belge OCR entegrasyonu.

Görüntü bytes alır → Gemini Vision API'ye gönderir →
yapılandırılmış OcrDocumentResult döner.

KURAL:
  - Bu adapter yalnızca Gemini ile konuşur.
  - İş kuralı, faz mantığı, dosya işleme yoktur.
  - confidence / bbox yoksa graceful fallback uygulanır (sistem çökmez).
  - Gemini SDK yoksa/API key yoksa → None döner (çağıran fallback yapar).
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    from google import genai as _google_genai
    from google.genai import types as _google_genai_types
    _GENAI_AVAILABLE = True
except ImportError:
    _google_genai = None
    _google_genai_types = None
    _GENAI_AVAILABLE = False

# ---------------------------------------------------------------------------
# Çıktı veri sınıfları
# ---------------------------------------------------------------------------

@dataclass
class OcrFieldValue:
    """Tek bir OCR alanının tam metadata'sı."""
    extracted_value: str = ""
    normalized_value: Any = None          # int | float | str türü alana göre
    confidence_score: float = 0.0         # 0-100
    bounding_box: Optional[dict] = None   # {"x": int, "y": int, "w": int, "h": int} veya None
    source_text: str = ""


@dataclass
class OcrRowResult:
    """Tek bir kesim satırının OCR çıktısı."""
    satir_no: int = 0
    boy_mm: OcrFieldValue = field(default_factory=OcrFieldValue)
    en_mm: OcrFieldValue = field(default_factory=OcrFieldValue)
    adet: OcrFieldValue = field(default_factory=OcrFieldValue)
    malzeme: OcrFieldValue = field(default_factory=OcrFieldValue)
    bant_1: OcrFieldValue = field(default_factory=OcrFieldValue)
    bant_2: OcrFieldValue = field(default_factory=OcrFieldValue)
    bant_3: OcrFieldValue = field(default_factory=OcrFieldValue)
    bant_4: OcrFieldValue = field(default_factory=OcrFieldValue)
    yon: OcrFieldValue = field(default_factory=OcrFieldValue)
    delik: OcrFieldValue = field(default_factory=OcrFieldValue)
    parca_adi: OcrFieldValue = field(default_factory=OcrFieldValue)
    durum: OcrFieldValue = field(default_factory=OcrFieldValue)


@dataclass
class OcrDocumentResult:
    """Belgeden çıkarılan tüm OCR verisi."""
    unvan: OcrFieldValue = field(default_factory=OcrFieldValue)
    telefon: OcrFieldValue = field(default_factory=OcrFieldValue)
    satirlar: list[OcrRowResult] = field(default_factory=list)
    # Teknik metadata
    provider: str = "gemini"
    model_name: str = ""
    latency_ms: int = 0
    raw_response_text: str = ""
    parse_error: Optional[str] = None


# ---------------------------------------------------------------------------
# Gemini'ye gönderilecek sistem promptu
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """Sen OptiPlan 360 mobilya üretim sisteminin OCR bileşenisin.
Sana bir kesim listesi belgesi görseli veriliyor.
Görüntüdeki tüm bilgileri çıkar ve SADECE aşağıdaki JSON formatında döndür.
JSON dışında hiçbir metin yazma, açıklama ekleme.

{
  "unvan": {
    "extracted_value": "MÜŞTERİ ADI",
    "normalized_value": "Müşteri Adı",
    "confidence_score": 90,
    "source_text": "ham metin"
  },
  "telefon": {
    "extracted_value": "05XX...",
    "normalized_value": "+90...",
    "confidence_score": 85,
    "source_text": "ham metin"
  },
  "satirlar": [
    {
      "satir_no": 1,
      "boy_mm": {
        "extracted_value": "450",
        "normalized_value": 450,
        "confidence_score": 92,
        "bounding_box": {"x": 100, "y": 200, "w": 60, "h": 20},
        "source_text": "450"
      },
      "en_mm": {
        "extracted_value": "300",
        "normalized_value": 300,
        "confidence_score": 88,
        "bounding_box": null,
        "source_text": "300"
      },
      "adet": {
        "extracted_value": "2",
        "normalized_value": 2,
        "confidence_score": 95,
        "bounding_box": null,
        "source_text": "2"
      },
      "malzeme": {
        "extracted_value": "18MM BEYAZ",
        "normalized_value": "18MM BEYAZ",
        "confidence_score": 90,
        "source_text": "18MM BEYAZ"
      },
      "bant_1": {"extracted_value": "2MM", "normalized_value": "2MM", "confidence_score": 80, "source_text": "2MM"},
      "bant_2": {"extracted_value": "", "normalized_value": "", "confidence_score": 95, "source_text": ""},
      "bant_3": {"extracted_value": "", "normalized_value": "", "confidence_score": 95, "source_text": ""},
      "bant_4": {"extracted_value": "", "normalized_value": "", "confidence_score": 95, "source_text": ""},
      "yon": {"extracted_value": "3", "normalized_value": 3, "confidence_score": 85, "source_text": "3"},
      "delik": {"extracted_value": "", "normalized_value": "", "confidence_score": 95, "source_text": ""},
      "parca_adi": {"extracted_value": "GOVDE", "normalized_value": "GOVDE", "confidence_score": 88, "source_text": "GOVDE"},
      "durum": {"extracted_value": "", "normalized_value": "", "confidence_score": 95, "source_text": ""}
    }
  ]
}

KURALLAR:
- Her sayısal alan için gerçekçi confidence_score ver (0-100).
- Belirsiz veya okunamayan alanlar için confidence_score 60'ın altında ver.
- bounding_box yoksa null koy — null hata sayılmaz.
- Satır yoksa "satirlar": [] döndür.
- Kesinlikle yalnızca JSON döndür."""


# ---------------------------------------------------------------------------
# Ana adapter fonksiyonu
# ---------------------------------------------------------------------------

def run_gemini_ocr(
    image_bytes: bytes,
    *,
    source_ext: str = ".jpg",
    model_name: str = "",
) -> Optional[OcrDocumentResult]:
    """
    Görüntü bytes'ini Gemini Vision API'ye gönderir, OcrDocumentResult döner.

    Döner None:
      - Gemini SDK kurulu değilse
      - API key bulunamazsa
      - API çağrısı başarısız olursa (çağıran fallback yapar)
    """
    if not _GENAI_AVAILABLE:
        logger.warning("google-genai SDK kurulu değil — Gemini OCR atlanıyor")
        return None

    api_key = _resolve_api_key()
    if not api_key:
        logger.warning("Gemini API key bulunamadı — Gemini OCR atlanıyor")
        return None

    resolved_model = model_name or _default_model()
    mime_type = _mime_type_for_ext(source_ext)

    try:
        return _call_gemini(
            api_key=api_key,
            image_bytes=image_bytes,
            mime_type=mime_type,
            model_name=resolved_model,
        )
    except Exception as exc:
        logger.exception("Gemini OCR çağrısı başarısız: %s", exc)
        return None


# ---------------------------------------------------------------------------
# İç yardımcılar
# ---------------------------------------------------------------------------

def _resolve_api_key() -> Optional[str]:
    """Önce env var, sonra config dosyasından API key alır."""
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key

    # config/ai_config.json'dan oku
    config_paths = [
        "config/ai_config.json",
        "backend/config/ai_config.json",
    ]
    for path in config_paths:
        try:
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                cfg = json.load(f)
            # Flat format: {"api_key": "...", "provider": "gemini"}
            if cfg.get("provider") == "gemini" or cfg.get("current_provider") == "gemini":
                key = (
                    cfg.get("api_key")
                    or cfg.get("providers", {}).get("gemini", {}).get("api_key")
                )
                if key:
                    return str(key)
        except Exception:
            continue
    return None


def _default_model() -> str:
    return os.environ.get("GEMINI_OCR_MODEL", "gemini-1.5-flash")


def _mime_type_for_ext(ext: str) -> str:
    ext_lower = ext.lower().lstrip(".")
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "pdf": "application/pdf",
        "webp": "image/webp",
    }.get(ext_lower, "image/jpeg")


def _call_gemini(
    *,
    api_key: str,
    image_bytes: bytes,
    mime_type: str,
    model_name: str,
) -> OcrDocumentResult:
    """Asıl Gemini API çağrısı."""
    client = _google_genai.Client(api_key=api_key)
    image_part = _google_genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    t_start = time.monotonic()
    response = client.models.generate_content(
        model=model_name,
        contents=[_SYSTEM_PROMPT, image_part],
        config=_google_genai_types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=4096,
        ),
    )
    latency_ms = int((time.monotonic() - t_start) * 1000)

    raw_text = (response.text or "").strip()
    return _parse_gemini_response(raw_text, model_name=model_name, latency_ms=latency_ms)


def _parse_gemini_response(
    raw_text: str,
    *,
    model_name: str,
    latency_ms: int,
) -> OcrDocumentResult:
    """
    Gemini yanıtını parse eder.
    JSON ayrıştırma başarısızsa parse_error doldurur, satirlar boş döner.
    """
    result = OcrDocumentResult(
        model_name=model_name,
        latency_ms=latency_ms,
        raw_response_text=raw_text,
    )

    # Markdown kod bloğu temizle
    clean = raw_text
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", clean)
    if code_block:
        clean = code_block.group(1).strip()
    # JSON dışı prefix temizle
    json_start = clean.find("{")
    if json_start > 0:
        clean = clean[json_start:]

    try:
        data: dict[str, Any] = json.loads(clean)
    except json.JSONDecodeError as exc:
        result.parse_error = f"JSON parse hatası: {exc}"
        logger.warning("Gemini yanıtı JSON parse başarısız: %s | Raw: %.200s", exc, raw_text)
        return result

    result.unvan = _parse_field(data.get("unvan"), str)
    result.telefon = _parse_field(data.get("telefon"), str)

    for raw_row in (data.get("satirlar") or []):
        if not isinstance(raw_row, dict):
            continue
        row = OcrRowResult(
            satir_no=int(raw_row.get("satir_no", 0)),
            boy_mm=_parse_field(raw_row.get("boy_mm"), int),
            en_mm=_parse_field(raw_row.get("en_mm"), int),
            adet=_parse_field(raw_row.get("adet"), int),
            malzeme=_parse_field(raw_row.get("malzeme"), str),
            bant_1=_parse_field(raw_row.get("bant_1"), str),
            bant_2=_parse_field(raw_row.get("bant_2"), str),
            bant_3=_parse_field(raw_row.get("bant_3"), str),
            bant_4=_parse_field(raw_row.get("bant_4"), str),
            yon=_parse_field(raw_row.get("yon"), int),
            delik=_parse_field(raw_row.get("delik"), str),
            parca_adi=_parse_field(raw_row.get("parca_adi"), str),
            durum=_parse_field(raw_row.get("durum"), str),
        )
        result.satirlar.append(row)

    return result


def _parse_field(raw: Any, target_type: type) -> OcrFieldValue:
    """
    Ham JSON alanını OcrFieldValue'ya dönüştürür.
    Eksik, null veya hatalı alan için graceful fallback OcrFieldValue() döner.
    """
    if not isinstance(raw, dict):
        return OcrFieldValue()

    extracted = str(raw.get("extracted_value") or "")
    confidence = _safe_float(raw.get("confidence_score"), default=0.0)
    confidence = max(0.0, min(100.0, confidence))

    # normalized_value: type-cast ile güvenli dönüşüm
    raw_norm = raw.get("normalized_value")
    try:
        if raw_norm is None or raw_norm == "":
            normalized = None
        elif target_type is int:
            normalized = int(float(str(raw_norm).replace(",", "."))) if str(raw_norm).strip() else None
        elif target_type is float:
            normalized = float(str(raw_norm).replace(",", ".")) if str(raw_norm).strip() else None
        else:
            normalized = str(raw_norm)
    except (ValueError, TypeError):
        normalized = None

    # bounding_box: {"x", "y", "w", "h"} veya None
    bbox_raw = raw.get("bounding_box")
    bbox = None
    if isinstance(bbox_raw, dict) and all(k in bbox_raw for k in ("x", "y", "w", "h")):
        try:
            bbox = {k: int(bbox_raw[k]) for k in ("x", "y", "w", "h")}
        except (ValueError, TypeError):
            bbox = None

    return OcrFieldValue(
        extracted_value=extracted,
        normalized_value=normalized,
        confidence_score=confidence,
        bounding_box=bbox,
        source_text=str(raw.get("source_text") or ""),
    )


def _safe_float(value: Any, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _has_band_signal(field: OcrFieldValue) -> bool:
    candidate = field.normalized_value if field.normalized_value not in (None, "") else field.extracted_value
    if candidate is None:
        return False
    value = str(candidate).strip().upper()
    if not value:
        return False
    return value not in {"0", "0MM", "YOK", "NONE", "FALSE", "-"}


def _build_band_review(field: OcrFieldValue) -> dict[str, Any]:
    normalized = field.normalized_value if field.normalized_value not in (None, "") else None
    extracted = field.extracted_value.strip() if field.extracted_value else ""
    return {
        "active": _has_band_signal(field),
        "value": str(normalized) if normalized is not None else (extracted or None),
        "confidence": round(_safe_float(field.confidence_score, default=0.0), 2),
        "source_text": field.source_text or extracted or None,
    }


# ---------------------------------------------------------------------------
# OcrDocumentResult → workflow service payload dönüşümü
# ---------------------------------------------------------------------------

def to_workflow_payload(result: OcrDocumentResult) -> dict[str, Any]:
    """
    OcrDocumentResult'ı optiplan_workflow_service._ingest_source_file'ın
    beklediği payload formatına dönüştürür.

    Dönen dict anahtarları:
      ocr_ham_json, ayristirilmis_ocr_alanlari,
      okunan_cari_unvan, okunan_cari_telefon,
      ai_guven_skoru_ozeti, malzeme, satirlar
    """
    parsed_rows: list[dict[str, Any]] = []
    confidence_values: list[float] = []

    for row in result.satirlar:
        boy_conf = row.boy_mm.confidence_score
        en_conf = row.en_mm.confidence_score
        adet_conf = row.adet.confidence_score
        malzeme_conf = row.malzeme.confidence_score
        grain_conf = row.yon.confidence_score
        bilgi_conf = row.parca_adi.confidence_score
        delik_conf = row.delik.confidence_score
        confidence_scores = {
            "boy": boy_conf,
            "en": en_conf,
            "adet": adet_conf,
            "malzeme": malzeme_conf,
            "grain": grain_conf,
            "bilgi": bilgi_conf,
            "delik_1": delik_conf,
            "delik": delik_conf,
        }

        row_min = min(confidence_scores.values())
        row_avg = sum(confidence_scores.values()) / len(confidence_scores)
        confidence_values.append(row_min)

        # bbox_json: satır için bbox listesi, koordinatları saklıyoruz
        bbox_items = []
        for field_name, field_obj in (
            ("boy_mm", row.boy_mm),
            ("en_mm", row.en_mm),
            ("adet", row.adet),
            ("malzeme", row.malzeme),
            ("bant_1", row.bant_1),
            ("bant_2", row.bant_2),
            ("bant_3", row.bant_3),
            ("bant_4", row.bant_4),
            ("yon", row.yon),
            ("delik", row.delik),
            ("parca_adi", row.parca_adi),
        ):
            if field_obj.bounding_box:
                bbox_items.append({"field": field_name, "bbox": field_obj.bounding_box})

        # bant kodlarını bant_kalinligi_override olarak ilk dolu bant'tan al
        bant_val = (
            row.bant_1.normalized_value
            or row.bant_2.normalized_value
            or row.bant_3.normalized_value
            or row.bant_4.normalized_value
        )
        band_review = {
            "u1": _build_band_review(row.bant_1),
            "u2": _build_band_review(row.bant_2),
            "k1": _build_band_review(row.bant_3),
            "k2": _build_band_review(row.bant_4),
        }

        parsed_rows.append({
            "satir_sirasi": row.satir_no or len(parsed_rows) + 1,
            "malzeme": row.malzeme.normalized_value or row.malzeme.extracted_value or None,
            "boy": row.boy_mm.normalized_value,
            "en": row.en_mm.normalized_value,
            "adet": row.adet.normalized_value or 1,
            "grain": int(row.yon.normalized_value) if row.yon.normalized_value is not None else 3,
            "bilgi": row.parca_adi.normalized_value or None,
            "u1": band_review["u1"]["active"],
            "u2": band_review["u2"]["active"],
            "k1": band_review["k1"]["active"],
            "k2": band_review["k2"]["active"],
            "delik_1": row.delik.normalized_value or None,
            "delik_2": None,
            "satir_kaynagi": "OCR",
            "bant_kalinligi_override": str(bant_val) if bant_val else None,
            "hucre_guven_skorlari": confidence_scores,
            "satir_guven_skor_ozeti": {
                "min": round(row_min, 2),
                "avg": round(row_avg, 2),
                "max": round(max(confidence_scores.values()), 2),
                "review_required": row_min < 80,
                "band_review": band_review,
                "source": "gemini_ocr",
                "model": result.model_name,
            },
            "bbox_json": bbox_items or None,
        })

    # Üst seviye güven özeti
    avg_conf = round(sum(confidence_values) / len(confidence_values), 2) if confidence_values else 0.0
    min_conf = round(min(confidence_values), 2) if confidence_values else 0.0
    ai_summary = {
        "source": "gemini_ocr",
        "model": result.model_name,
        "latency_ms": result.latency_ms,
        "line_count": len(parsed_rows),
        "avg_confidence": avg_conf,
        "min_confidence": min_conf,
        "review_required": min_conf < 80,
        "parse_error": result.parse_error,
    }

    # Ham OCR JSON (tam response saklanır)
    ocr_ham_json: dict[str, Any] = {
        "status": "COMPLETED" if parsed_rows else "NO_ROWS",
        "engine": "gemini_ocr",
        "model": result.model_name,
        "latency_ms": result.latency_ms,
        "raw_response_snippet": result.raw_response_text[:1000] if result.raw_response_text else "",
        "parse_error": result.parse_error,
    }

    # Materyali ilk satırdan al veya boş bırak
    first_malzeme = None
    for row in result.satirlar:
        val = row.malzeme.normalized_value or row.malzeme.extracted_value
        if val:
            first_malzeme = str(val)
            break

    return {
        "ocr_ham_json": ocr_ham_json,
        "ayristirilmis_ocr_alanlari": {
            "satirlar": parsed_rows,
            "okunan_cari_unvan": result.unvan.normalized_value or result.unvan.extracted_value,
            "okunan_cari_telefon": result.telefon.normalized_value or result.telefon.extracted_value,
            "malzeme": first_malzeme,
        },
        "okunan_cari_unvan": result.unvan.normalized_value or result.unvan.extracted_value,
        "okunan_cari_telefon": result.telefon.normalized_value or result.telefon.extracted_value,
        "ai_guven_skoru_ozeti": ai_summary,
        "malzeme": first_malzeme,
        "satirlar": parsed_rows,
    }


