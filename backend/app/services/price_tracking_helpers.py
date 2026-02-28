"""
Fiyat takip sistemi yardımcı fonksiyonları — sütun eşleme, normalizasyon.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def load_mapping_rules() -> dict[str, Any]:
    """price_mapping_rules.json dosyasını yükler."""
    path = _CONFIG_DIR / "price_mapping_rules.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_alias_map() -> dict[str, str]:
    """
    Tüm alias → standart sütun eşleme dict'i oluşturur.
    Büyük/küçük harf duyarsız.
    """
    rules = load_mapping_rules()
    alias_map: dict[str, str] = {}

    for std_col, info in rules.get("column_aliases", {}).items():
        alias_map[std_col.lower()] = std_col
        for alias in info.get("aliases", []):
            alias_map[alias.lower().strip()] = std_col

    return alias_map


def normalize_columns(columns: list[str]) -> dict[str, str]:
    """
    Verilen sütun isimlerini standart isimlere eşler.

    ÖNEMLİ: Aynı standart isme (ör: URUN_KODU) birden fazla orijinal sütun
    eşleşirse, yalnızca İLK eşleşen sütun kullanılır.
    Bu, duplicate column oluşmasını önler.

    Returns:
        {orijinal_ad: standart_ad} — eşlenemeyen sütunlar dahil edilmez
    """
    alias_map = build_alias_map()
    result: dict[str, str] = {}
    used_targets: set[str] = set()  # Zaten eşlenmiş standart isimler

    for col in columns:
        normalized = col.lower().strip()
        if normalized in alias_map:
            target = alias_map[normalized]
            if target not in used_targets:
                result[col] = target
                used_targets.add(target)
            else:
                logger.warning(
                    "Duplicate sütun atlandı: '%s' -> '%s' (zaten eşlenmiş)",
                    col,
                    target,
                )
    return result


def get_file_type(extension: str) -> str:
    """Dosya uzantısından tip belirler: spreadsheet, pdf, image, unknown."""
    ext = extension.lower()
    if ext in (".xlsx", ".xls"):
        return "spreadsheet"
    if ext == ".pdf":
        return "pdf"
    if ext in (".jpg", ".jpeg", ".png", ".tiff", ".bmp"):
        return "image"
    return "unknown"


SUPPORTED_EXTENSIONS = {
    ".xlsx",
    ".xls",
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".tiff",
    ".bmp",
}

MAX_FILE_SIZE_MB = 50
