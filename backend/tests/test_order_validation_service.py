"""
OrderValidationService — birim testleri.

Kapsam:
- validate_field: cari_kodu / stok_kodu / termin
- validate_order: all_valid / can_export / summary
- suggest_corrections: alan-bazlı öneriler
- get_validation_rules_summary: dict yapısı
"""

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
from app.services.order_validation_service import (
    FieldType,
    OrderValidationService,
    ValidationLevel,
)


@pytest.fixture()
def svc():
    return OrderValidationService()


# ─── validate_field: cari_kodu ────────────────────────────────────────────────

class TestValidateCariKodu:
    def test_valid_cari_kodu(self, svc):
        result = svc.validate_field(FieldType.CARI_KODU, "ABC123")
        assert result.is_valid is True

    def test_too_short_rejected(self, svc):
        result = svc.validate_field(FieldType.CARI_KODU, "AB")
        assert result.is_valid is False
        assert result.level == ValidationLevel.BLOCKER

    def test_too_long_rejected(self, svc):
        result = svc.validate_field(FieldType.CARI_KODU, "ABCDEFGHIJK")  # 11 chars
        assert result.is_valid is False

    def test_lowercase_normalised(self, svc):
        # value is .upper()'d inside the service
        result = svc.validate_field(FieldType.CARI_KODU, "abc123")
        assert result.is_valid is True

    def test_empty_string_blocked(self, svc):
        result = svc.validate_field(FieldType.CARI_KODU, "")
        assert result.is_valid is False
        assert result.level == ValidationLevel.BLOCKER

    def test_whitespace_only_blocked(self, svc):
        result = svc.validate_field(FieldType.CARI_KODU, "   ")
        assert result.is_valid is False


# ─── validate_field: stok_kodu ────────────────────────────────────────────────

class TestValidateStokKodu:
    def test_valid_stok_kodu(self, svc):
        assert svc.validate_field(FieldType.STOK_KODU, "STK001").is_valid is True

    def test_too_short(self, svc):
        assert svc.validate_field(FieldType.STOK_KODU, "AB").is_valid is False

    def test_max_length_15_ok(self, svc):
        assert svc.validate_field(FieldType.STOK_KODU, "STOK123456789AB").is_valid is True  # 15

    def test_16_chars_rejected(self, svc):
        assert svc.validate_field(FieldType.STOK_KODU, "STOK1234567890AB").is_valid is False


# ─── validate_field: termin ───────────────────────────────────────────────────

class TestValidateTermin:
    @pytest.mark.parametrize("value", ["NET", "HAVALE", "KAPIDA", "VADE_FARKLI"])
    def test_valid_terminler(self, svc, value):
        assert svc.validate_field(FieldType.TERMIN, value).is_valid is True

    def test_invalid_termin_rejected(self, svc):
        result = svc.validate_field(FieldType.TERMIN, "YANLIS")
        assert result.is_valid is False
        assert result.level == ValidationLevel.BLOCKER

    def test_lowercase_termin_normalised(self, svc):
        assert svc.validate_field(FieldType.TERMIN, "net").is_valid is True


# ─── validate_order ───────────────────────────────────────────────────────────

class TestValidateOrder:
    def _valid_order(self):
        return {
            "order_id": "ORD001",
            "cari_kodu": "ABC123",
            "stok_kodu": "STK001",
            "termin": "NET",
        }

    def test_valid_order_passes(self, svc):
        result = svc.validate_order(self._valid_order())
        assert result.all_valid is True
        assert result.can_export is True

    def test_missing_cari_kodu_blocks(self, svc):
        data = self._valid_order()
        data["cari_kodu"] = ""
        result = svc.validate_order(data)
        assert result.all_valid is False
        assert result.can_export is False

    def test_missing_termin_blocks(self, svc):
        data = self._valid_order()
        data["termin"] = ""
        result = svc.validate_order(data)
        assert result.can_export is False

    def test_summary_structure(self, svc):
        result = svc.validate_order(self._valid_order())
        assert "total_fields" in result.summary
        assert "valid_fields" in result.summary
        assert "blocker_errors" in result.summary

    def test_blocker_count_correct(self, svc):
        data = {"order_id": "X", "cari_kodu": "", "stok_kodu": "", "termin": ""}
        result = svc.validate_order(data)
        assert result.summary["blocker_errors"] >= 3


# ─── suggest_corrections ─────────────────────────────────────────────────────

class TestSuggestCorrections:
    def test_short_cari_kodu_suggestion(self, svc):
        vr = svc.validate_field(FieldType.CARI_KODU, "AB")
        suggestions = svc.suggest_corrections(vr)
        assert len(suggestions) > 0
        assert any("3" in s for s in suggestions)

    def test_invalid_termin_suggestion(self, svc):
        vr = svc.validate_field(FieldType.TERMIN, "YANLIS")
        suggestions = svc.suggest_corrections(vr)
        assert len(suggestions) > 0
        assert any("NET" in s for s in suggestions)

    def test_valid_result_no_suggestions(self, svc):
        vr = svc.validate_field(FieldType.CARI_KODU, "ABC123")
        suggestions = svc.suggest_corrections(vr)
        assert suggestions == []


# ─── get_validation_rules_summary ─────────────────────────────────────────────

class TestGetValidationRulesSummary:
    def test_summary_has_required_keys(self, svc):
        summary = svc.get_validation_rules_summary()
        assert "required_fields" in summary
        assert "phase" in summary

    def test_required_fields_list_contains_core(self, svc):
        summary = svc.get_validation_rules_summary()
        required = summary["required_fields"]
        assert "cari_kodu" in required
        assert "stok_kodu" in required
        assert "termin" in required
