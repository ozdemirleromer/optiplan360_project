from typing import Optional

from app.exceptions import ValidationError as AppValidationError
from app.models import ReminderTypeEnum
from .calculations import calculate_expected_total

AMOUNT_TOLERANCE = 0.01
MAX_REMINDER_COUNT = 3
PROMISE_STATUS_PENDING = "PENDING"
PROMISE_STATUS_KEPT = "KEPT"
PROMISE_STATUS_BROKEN = "BROKEN"
PROMISE_STATUS_POSTPONED = "POSTPONED"
ALLOWED_PROMISE_STATUSES = {
    PROMISE_STATUS_PENDING,
    PROMISE_STATUS_KEPT,
    PROMISE_STATUS_BROKEN,
    PROMISE_STATUS_POSTPONED,
}
SUPPORTED_INVOICE_REMINDER_TYPES = {
    ReminderTypeEnum.EMAIL,
    ReminderTypeEnum.IN_APP,
    ReminderTypeEnum.SMS,
}


def assert_positive_amount(value: float, field_name: str) -> None:
    if value <= 0:
        raise AppValidationError(f"{field_name} sifirdan buyuk olmali")


def assert_non_negative_amount(value: float, field_name: str) -> None:
    if value < 0:
        raise AppValidationError(f"{field_name} negatif olamaz")


def validate_invoice_amounts(
    subtotal: float,
    tax_rate: float,
    discount_amount: float,
    total_amount: float,
) -> None:
    assert_non_negative_amount(subtotal, "Ara toplam")
    assert_non_negative_amount(tax_rate, "KDV orani")
    assert_non_negative_amount(discount_amount, "Indirim tutari")
    assert_non_negative_amount(total_amount, "Toplam tutar")

    if discount_amount > subtotal:
        raise AppValidationError("Indirim tutari ara toplamdan buyuk olamaz")

    expected_total = calculate_expected_total(
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_rate=tax_rate,
    )
    if abs(expected_total - total_amount) > AMOUNT_TOLERANCE:
        raise AppValidationError("Toplam tutar ara toplam/KDV/indirim hesaplamasi ile uyumsuz")


def validate_invoice_account_consistency(invoice_account_id: str, account_id: str) -> None:
    if invoice_account_id != account_id:
        raise AppValidationError("Cari hesap, fatura ile uyusmuyor")


def assert_reminder_quota(reminder_count: Optional[int], entity_label: str) -> None:
    if (reminder_count or 0) >= MAX_REMINDER_COUNT:
        raise AppValidationError(
            f"{entity_label} icin maksimum hatirlatma sayisina ({MAX_REMINDER_COUNT}) ulasildi"
        )


def assert_promise_is_remindable(status: str, is_fulfilled: bool) -> None:
    if status != PROMISE_STATUS_PENDING or is_fulfilled:
        raise AppValidationError("Sadece bekleyen odeme sozleri icin hatirlatma gonderilebilir")


def normalize_promise_status(status: str) -> str:
    normalized_status = (status or "").upper().strip()
    if normalized_status not in ALLOWED_PROMISE_STATUSES:
        allowed_values = ", ".join(sorted(ALLOWED_PROMISE_STATUSES))
        raise AppValidationError(f"Gecersiz odeme sozu durumu. Izin verilenler: {allowed_values}")
    return normalized_status


def assert_invoice_reminder_type_supported(reminder_type: Optional[ReminderTypeEnum]) -> None:
    if not reminder_type:
        raise AppValidationError("Bu fatura icin hatirlatma tipi tanimli degil")

    if reminder_type not in SUPPORTED_INVOICE_REMINDER_TYPES:
        allowed_types = ", ".join(sorted(item.value for item in SUPPORTED_INVOICE_REMINDER_TYPES))
        raise AppValidationError(
            f"Desteklenmeyen hatirlatma tipi: {reminder_type.value}. Desteklenen tipler: {allowed_types}"
        )


def assert_email_recipient_exists(email: Optional[str], entity_label: str) -> None:
    if not email:
        raise AppValidationError(f"{entity_label} icin e-posta adresi tanimli degil")
