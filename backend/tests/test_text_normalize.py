"""
OptiPlan360 — Text Normalization Unit Tests

BÖLÜM 9: Test Üretimi — Rule Engine Testleri

Çalıştır: pytest tests/test_text_normalize.py -v
"""

import pytest
from app.utils.text_normalize import (
    normalize_turkish,
    normalize_text,
    normalize_material_name,
    normalize_phone,
    sanitize_filename,
)


class TestNormalizeTurkish:
    """Turkish character normalization tests."""

    def test_turkish_to_ascii(self):
        """Convert Turkish characters to ASCII equivalents."""
        assert normalize_turkish("çağrı") == "cagri"
        assert normalize_turkish("ŞÖFÖR") == "SOFOR"
        assert normalize_turkish("ığdır") == "igdir"

    def test_unicode_combining(self):
        """Remove Unicode combining characters."""
        text = "café"  # e with acute accent (combining)
        result = normalize_turkish(text)
        assert "cafe" in result.lower()

    def test_empty_input(self):
        """Handle empty/None input gracefully."""
        assert normalize_turkish("") == ""
        assert normalize_turkish(None) == ""

    def test_mixed_content(self):
        """Preserve numbers and symbols while normalizing."""
        assert normalize_turkish("Müşteri-123") == "Musteri-123"
        assert normalize_turkish("ürün_özel") == "urun_ozel"


class TestNormalizeText:
    """General text normalization for matching operations."""

    def test_lowercase_and_whitespace(self):
        """Convert to lowercase and normalize whitespace."""
        assert normalize_text("  MDF   LAM  ") == "mdf lam"
        assert normalize_text("ÜrünAdı") == "urunadi"  # Turkish+lowercase

    def test_turkish_integration(self):
        """Verify Turkish normalization is applied."""
        assert normalize_text("ŞEKER ÇİKOLATA") == "seker cikolata"

    def test_multiple_spaces(self):
        """Collapse multiple spaces to single space."""
        result = normalize_text("a    b     c")
        assert result == "a b c"


class TestNormalizeMaterialName:
    """Material name alias expansion tests."""

    def test_mlam_expansion(self):
        """Expand MLAM to MDFLAM."""
        assert "MDFLAM" in normalize_material_name("MLAM 18mm")
        assert "MDFLAM" in normalize_material_name("mlam beyaz")

    def test_sunta_expansion(self):
        """Expand SUNTA aliases to SUNTALAM."""
        assert "SUNTALAM" in normalize_material_name("SUNTA 18mm")
        assert "SUNTALAM" in normalize_material_name("SLAM Beyaz")

    def test_word_boundary_respect(self):
        """Only expand whole words, not substrings."""
        # "MLAM" in "XMLAM" should not expand
        result = normalize_material_name("XMLAM test")
        assert "XMLAM" in result or "MDFLAM" not in result

    def test_preserve_case_insensitive(self):
        """Expansion works regardless of input case."""
        assert "MDFLAM" in normalize_material_name("mlam")
        assert "MDFLAM" in normalize_material_name("MLAM")
        assert "MDFLAM" in normalize_material_name("MlaM")

    def test_empty_input(self):
        """Handle empty material names."""
        assert normalize_material_name("") == ""
        assert normalize_material_name(None) == ""


class TestNormalizePhone:
    """Turkish phone number normalization tests."""

    def test_valid_mobile_with_90(self):
        """Parse numbers starting with 90."""
        assert normalize_phone("905551234567") == "+905551234567"

    def test_valid_mobile_with_leading_zero(self):
        """Parse numbers with leading 0."""
        assert normalize_phone("05551234567") == "+905551234567"

    def test_valid_mobile_clean(self):
        """Parse 10-digit mobile numbers."""
        assert normalize_phone("5551234567") == "+905551234567"

    def test_formatted_input(self):
        """Strip formatting characters."""
        assert normalize_phone("+90 555 123 45 67") == "+905551234567"
        assert normalize_phone("(555) 123-45-67") == "+905551234567"

    def test_invalid_length(self):
        """Reject numbers with invalid length."""
        assert normalize_phone("123") == ""
        assert normalize_phone("55512345678901") == ""

    def test_non_mobile_prefix(self):
        """Reject landline numbers (not starting with 5)."""
        assert normalize_phone("2121234567") == ""

    def test_empty_input(self):
        """Handle empty phone numbers."""
        assert normalize_phone("") == ""
        assert normalize_phone(None) == ""


class TestSanitizeFilename:
    """Filename sanitization tests."""

    def test_remove_invalid_chars(self):
        """Remove Windows reserved characters."""
        result = sanitize_filename("test<file>.txt")
        assert "<" not in result
        assert ">" not in result
        assert "txt" in result

    def test_colon_slash_removal(self):
        """Remove path separators."""
        result = sanitize_filename("C:\\path\\file:name")
        assert "\\" not in result
        assert ":" not in result

    def test_max_length_truncation(self):
        """Truncate to max_len parameter."""
        long_name = "a" * 200
        result = sanitize_filename(long_name, max_len=50)
        assert len(result) <= 50

    def test_preserve_extension(self):
        """Keep file extension if possible."""
        result = sanitize_filename("valid_file.xlsx", max_len=100)
        assert ".xlsx" in result


class TestEdgeCases:
    """Edge cases and regression tests."""

    def test_normalize_turkish_numeric_input(self):
        """Handle numeric input."""
        assert normalize_turkish(12345) == ""

    def test_normalize_phone_with_spaces(self):
        """Parse formatted phone with spaces."""
        assert normalize_phone("0 555 123 45 67") == "+905551234567"

    def test_material_name_whitespace_collapse(self):
        """Collapse whitespace in material names."""
        result = normalize_material_name("MDF  LAM    18mm")
        assert "  " not in result

    def test_filename_unicode_turkish(self):
        """Sanitize filenames with Turkish characters."""
        result = sanitize_filename("Müşteri_Dosyası.pdf")
        # Should remove Turkish chars via normalize_turkish
        assert "Musteri" in result or "pdf" in result
