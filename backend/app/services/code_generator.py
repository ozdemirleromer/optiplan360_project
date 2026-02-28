"""
Otomatik Kod Üretici — Çakışmasız, deterministik kodlar
Formatlar:
  Account: ACC-{YY}{MM}-{SEQ6}-{CD}
  Item Stock: STK-{YY}{MM}-{SEQ7}-{CD}
  Item Service: SRV-{YY}{MM}-{SEQ6}-{CD}
  MaterialSpec: {SHORT_CODE}-{COLOR}-{THICK}-{WxH}
"""
import hashlib
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Item, MaterialSpec


def _check_digit(base: str) -> str:
    """Luhn mod-10 check digit."""
    digits = [int(c) for c in base if c.isdigit()]
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return str((10 - (total % 10)) % 10)


def generate_item_code(db: Session) -> str:
    """STK-{YY}{MM}-{SEQ7}-{CD} formatında benzersiz stok kodu üretir."""
    now = datetime.now()
    prefix = f"STK-{now.strftime('%y%m')}-"

    # Mevcut en yüksek sequence'ı bul
    last = (
        db.query(Item.code)
        .filter(Item.code.like(f"{prefix}%"))
        .order_by(Item.code.desc())
        .first()
    )

    if last and last[0]:
        try:
            parts = last[0].split("-")
            seq = int(parts[2]) + 1
        except (IndexError, ValueError):
            seq = 1
    else:
        seq = 1

    seq_str = str(seq).zfill(7)
    base = f"{prefix}{seq_str}"
    cd = _check_digit(base)
    return f"{base}-{cd}"


def generate_spec_code(
    product_type_short: str,
    color_code: str,
    thickness_mm: float,
    width_cm: float,
    height_cm: float,
) -> str:
    """Deterministik spec kodu: MLM-BEYAZ-18-210x280"""
    t = str(int(thickness_mm)) if thickness_mm == int(thickness_mm) else str(thickness_mm)
    w = str(int(width_cm)) if width_cm == int(width_cm) else str(width_cm)
    h = str(int(height_cm)) if height_cm == int(height_cm) else str(height_cm)
    return f"{product_type_short}-{color_code}-{t}-{w}x{h}"


def generate_spec_hash(
    product_type_short: str,
    color_text: str,
    thickness_mm: float,
    width_cm: float,
    height_cm: float,
) -> str:
    """Spec hash — incoming_specs eşleştirmesi için."""
    raw = f"{product_type_short}|{color_text}|{thickness_mm}|{width_cm}|{height_cm}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
