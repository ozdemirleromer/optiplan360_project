import re
import unicodedata


INVALID_FILENAME_CHARS = r'[<>:"/\\|?*]'
MATERIAL_NORMALIZE_RULES = {
    "MLAM": "MDFLAM",
    "SLAM": "SUNTALAM",
    "SUNTA": "SUNTALAM",
}


def normalize_turkish(text: str) -> str:
    """Convert Turkish text into an ASCII-safe representation."""

    if not isinstance(text, str) or not text:
        return ""

    translated = str(text).translate(str.maketrans("ğĞıİöÖüÜşŞçÇ", "gGiIoOuUsScC"))
    normalized = unicodedata.normalize("NFKD", translated)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_text(text: str) -> str:
    """Lowercase and whitespace-normalize text for matching operations."""

    base = normalize_turkish(text).lower()
    return " ".join(base.split())


def normalize_material_name(name: str) -> str:
    """Normalize material aliases into canonical business terms."""

    if not name:
        return ""

    normalized = " ".join(str(name).split())
    for source, target in MATERIAL_NORMALIZE_RULES.items():
        normalized = re.sub(rf"\b{source}\b", target, normalized, flags=re.IGNORECASE)
    return normalized


def normalize_phone(phone: str) -> str:
    """Normalize Turkish phone numbers to +90XXXXXXXXXX format."""

    if not phone:
        return ""

    digits = re.sub(r"\D", "", str(phone))
    if digits.startswith("90"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = digits[1:]

    if len(digits) == 10 and digits.startswith("5"):
        return f"+90{digits}"
    return ""


def sanitize_filename(name: str, max_len: int = 100) -> str:
    """Strip unsafe characters and return an ASCII-safe filename fragment."""

    cleaned = normalize_turkish(name).replace(" ", "_").strip("._")
    cleaned = re.sub(INVALID_FILENAME_CHARS, "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned)
    if not cleaned:
        return "UNKNOWN"
    return cleaned[:max_len]
