AMOUNT_PRECISION = 2


def normalize_amount(value: float) -> float:
    return round(float(value or 0.0), AMOUNT_PRECISION)


def calculate_tax_amount(subtotal: float, discount_amount: float, tax_rate: float) -> float:
    taxable_base = normalize_amount(subtotal - discount_amount)
    tax = taxable_base * (float(tax_rate) / 100)
    return normalize_amount(tax)


def calculate_expected_total(subtotal: float, discount_amount: float, tax_rate: float) -> float:
    taxable_base = normalize_amount(subtotal - discount_amount)
    return normalize_amount(taxable_base + calculate_tax_amount(subtotal, discount_amount, tax_rate))


def calculate_remaining_amount(total_amount: float, paid_amount: float) -> float:
    remaining = normalize_amount(total_amount - paid_amount)
    return normalize_amount(max(0.0, remaining))
