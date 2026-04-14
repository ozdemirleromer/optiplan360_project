"""
CRM servis yardımcı fonksiyonları — birim testleri.

Bu testler crm_service.py modülündeki saf (state-free) fonksiyonları kapsar:
- _normalize_phone       : telefon numarası normalleştirme
- _normalize_tax_id      : vergi kimlik normalleştirme
- _normalize_account_type: hesap tipi normalleştirme
- _normalize_dealer_type : bayi tipi normalleştirme
- _normalize_tag_list    : etiket listesi normalleştirme
- _ensure_percentage     : yüzde değeri kontrolü
- _ensure_non_negative   : negatif değer kontrolü (module-level)
"""

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
from app.exceptions import ValidationError
from app.services.crm_service import (
    _ensure_non_negative,
    _ensure_percentage,
    _normalize_account_type,
    _normalize_dealer_type,
    _normalize_phone,
    _normalize_tag_list,
    _normalize_tax_id,
)


# ─── _normalize_phone ─────────────────────────────────────────────────────────

class TestNormalizePhone:
    def test_plain_digits_returned(self):
        assert _normalize_phone("5321234567") == "5321234567"

    def test_plus_prefix_kept(self):
        assert _normalize_phone("+905321234567") == "+905321234567"

    def test_separators_stripped(self):
        result = _normalize_phone("532 123 4567")
        assert result == "5321234567"

    def test_dashes_stripped(self):
        result = _normalize_phone("532-123-4567")
        assert result == "5321234567"

    def test_parentheses_stripped(self):
        result = _normalize_phone("(532) 123 4567")
        assert result == "5321234567"

    def test_no_digits_raises(self):
        with pytest.raises(ValidationError, match="formatı geçersiz"):
            _normalize_phone("abc")

    def test_none_returns_none(self):
        assert _normalize_phone(None) is None

    def test_empty_string_returns_none(self):
        assert _normalize_phone("") is None


# ─── _normalize_tax_id ────────────────────────────────────────────────────────

class TestNormalizeTaxId:
    def test_10_digits_accepted(self):
        result = _normalize_tax_id("1234567890")
        assert result == "1234567890"

    def test_11_digits_accepted(self):
        result = _normalize_tax_id("12345678901")
        assert result == "12345678901"

    def test_9_digits_rejected(self):
        with pytest.raises(ValidationError, match="10 veya 11"):
            _normalize_tax_id("123456789")

    def test_12_digits_rejected(self):
        with pytest.raises(ValidationError, match="10 veya 11"):
            _normalize_tax_id("123456789012")

    def test_separators_ignored(self):
        result = _normalize_tax_id("123 456 7890")
        assert result == "1234567890"

    def test_none_returns_none(self):
        assert _normalize_tax_id(None) is None


# ─── _normalize_account_type ─────────────────────────────────────────────────

class TestNormalizeAccountType:
    def test_corporate_accepted(self):
        assert _normalize_account_type("CORPORATE") == "CORPORATE"

    def test_individual_accepted(self):
        assert _normalize_account_type("INDIVIDUAL") == "INDIVIDUAL"

    def test_personal_alias_to_individual(self):
        assert _normalize_account_type("PERSONAL") == "INDIVIDUAL"

    def test_lowercase_normalised(self):
        assert _normalize_account_type("corporate") == "CORPORATE"

    def test_invalid_type_raises(self):
        with pytest.raises(ValidationError, match="geçersiz"):
            _normalize_account_type("YANLIS")

    def test_none_returns_none(self):
        assert _normalize_account_type(None) is None


# ─── _normalize_dealer_type ──────────────────────────────────────────────────

class TestNormalizeDealerType:
    def test_none_returns_none(self):
        assert _normalize_dealer_type(None) is None

    def test_invalid_raises(self):
        with pytest.raises(ValidationError, match="geçersiz"):
            _normalize_dealer_type("BILINMIYOR_TIP")


# ─── _normalize_tag_list ─────────────────────────────────────────────────────

class TestNormalizeTagList:
    def test_comma_split(self):
        result = _normalize_tag_list("a, b, c")
        assert "a" in result
        assert "b" in result
        assert "c" in result

    def test_deduplication(self):
        result = _normalize_tag_list("a, A, a")
        assert result.count("a") == 1 or result.count("A") == 1

    def test_empty_string_returns_none(self):
        assert _normalize_tag_list("") is None

    def test_none_returns_none(self):
        assert _normalize_tag_list(None) is None

    def test_semicolon_separator(self):
        result = _normalize_tag_list("x; y; z")
        parts = [p.strip() for p in result.split(",")]
        assert len(parts) == 3


# ─── _ensure_percentage ──────────────────────────────────────────────────────

class TestEnsurePercentage:
    def test_valid_percentage(self):
        assert _ensure_percentage(50, "indirim") == 50.0

    def test_zero_valid(self):
        assert _ensure_percentage(0, "indirim") == 0.0

    def test_100_valid(self):
        assert _ensure_percentage(100, "indirim") == 100.0

    def test_over_100_raises(self):
        with pytest.raises(ValidationError, match="100"):
            _ensure_percentage(101, "indirim")

    def test_negative_raises(self):
        with pytest.raises(ValidationError, match="negatif"):
            _ensure_percentage(-1, "indirim")


# ─── _ensure_non_negative (module-level) ─────────────────────────────────────

class TestModuleEnsureNonNegative:
    def test_positive_ok(self):
        assert _ensure_non_negative(10, "alan") == 10.0

    def test_zero_ok(self):
        assert _ensure_non_negative(0, "alan") == 0.0

    def test_negative_raises(self):
        with pytest.raises(ValidationError, match="negatif olamaz"):
            _ensure_non_negative(-0.01, "alan")

    def test_non_numeric_raises(self):
        with pytest.raises(ValidationError, match="sayısal olmalıdır"):
            _ensure_non_negative("x", "alan")
