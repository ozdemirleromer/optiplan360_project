from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

INVOICE_NUMBER_PREFIX = "INV"
PAYMENT_NUMBER_PREFIX = "PAY"
DEFAULT_INVOICE_TYPE = "SALES"
DEFAULT_CURRENCY = "TRY"


def generate_sequential_number(
    db: Session,
    model: Any,
    prefix: str,
    year: Optional[int] = None,
) -> str:
    sequence = db.query(model).count() + 1
    target_year = year or datetime.now().year
    return f"{prefix}-{target_year}-{sequence:05d}"


__all__ = [
    "DEFAULT_CURRENCY",
    "DEFAULT_INVOICE_TYPE",
    "INVOICE_NUMBER_PREFIX",
    "PAYMENT_NUMBER_PREFIX",
    "generate_sequential_number",
]
