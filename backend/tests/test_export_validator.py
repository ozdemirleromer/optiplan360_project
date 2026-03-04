"""
OptiPlan360 — Export Validator Unit Tests

BÖLÜM 9: Test Üretimi — Export Validation Testleri

Çalıştır: pytest tests/test_export_validator.py -v
"""

import pandas as pd
import pytest
from app.services.export_validator import ExportValidator, ValidationResult
from app.constants.excel_schema import (
    REQUIRED_COLUMNS,
    VALID_GRAIN_VALUES,
    PART_GROUPS,
    ARKALIK_FORBIDDEN_COLUMNS,
)


class TestValidationResult:
    """Test ValidationResult dataclass."""

    def test_result_structure(self):
        """Verify ValidationResult has required fields."""
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        assert result.is_valid is True
        assert result.passed is True
        assert isinstance(result.errors, list)
        assert isinstance(result.warnings, list)
        assert isinstance(result.details, dict)

    def test_failed_result(self):
        """Verify failed validation."""
        result = ValidationResult(is_valid=False, errors=["Test error"])
        assert result.is_valid is False
        assert result.passed is False
        assert len(result.errors) == 1


class TestExportValidatorBasic:
    """Test basic validation logic."""

    @pytest.fixture
    def validator(self) -> ExportValidator:
        return ExportValidator()

    def test_valid_govde_export(self, validator):
        """Validate a correct GOVDE export."""
        data = pd.DataFrame({
            "NO": [1, 2],
            "CODE": ["M001", "M002"],
            "LENGTH": [1000.0, 800.0],
            "WIDTH": [600.0, 400.0],
            "QUANTITY": [2, 1],
            "GRAIN": ["1-Boyuna", "0-Material"],
            "TOP_EDGE": ["BANT", ""],
            "BOTTOM_EDGE": ["", "BANT"],
            "LEFT_EDGE": ["", ""],
            "RIGHT_EDGE": ["BANT", ""],
        })
        result = validator.validate(data, "GOVDE")
        assert result.is_valid is True
        assert result.passed is True
        assert len(result.errors) == 0

    def test_valid_arkalik_export(self, validator):
        """Validate a correct ARKALIK export (no bands)."""
        data = pd.DataFrame({
            "NO": [1, 2],
            "CODE": ["A001", "A002"],
            "LENGTH": [1000.0, 800.0],
            "WIDTH": [600.0, 400.0],
            "QUANTITY": [1, 1],
            "GRAIN": ["2-Enine", "0-Material"],
            "TOP_EDGE": ["", ""],
            "BOTTOM_EDGE": ["", ""],
            "LEFT_EDGE": ["", ""],
            "RIGHT_EDGE": ["", ""],
        })
        result = validator.validate(data, "ARKALIK")
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_missing_columns(self, validator):
        """Detect missing required columns."""
        data = pd.DataFrame({
            "NO": [1],
            "CODE": ["M001"],
            "LENGTH": [1000.0],
            # Missing: WIDTH, QUANTITY, GRAIN, band columns
        })
        result = validator.validate(data, "GOVDE")
        assert result.is_valid is False
        assert any("Eksik zorunlu kolonlar" in e for e in result.errors)
        assert "WIDTH" in result.details["missing_columns"]
        assert "QUANTITY" in result.details["missing_columns"]

    def test_invalid_part_group(self, validator):
        """Reject invalid part group."""
        data = pd.DataFrame({"NO": [1]})
        result = validator.validate(data, "INVALID_GROUP")
        assert result.is_valid is False
        assert any("Gecersiz part group" in e for e in result.errors)

    def test_invalid_grain_values(self, validator):
        """Detect invalid grain values."""
        data = pd.DataFrame({
            "NO": [1, 2],
            "CODE": ["M001", "M002"],
            "LENGTH": [1000.0, 800.0],
            "WIDTH": [600.0, 400.0],
            "QUANTITY": [2, 1],
            "GRAIN": ["1-Boyuna", "INVALID_GRAIN"],  # Invalid grain
            "TOP_EDGE": ["", ""],
            "BOTTOM_EDGE": ["", ""],
            "LEFT_EDGE": ["", ""],
            "RIGHT_EDGE": ["", ""],
        })
        result = validator.validate(data, "GOVDE")
        assert result.is_valid is False
        assert any("Gecersiz grain degerleri" in e for e in result.errors)


class TestArkalikaValidation:
    """Test ARKALIK-specific validation rules."""

    @pytest.fixture
    def validator(self) -> ExportValidator:
        return ExportValidator()

    def test_arkalik_with_band_violation(self, validator):
        """Detect bands in ARKALIK (Kural #9 ihlali)."""
        data = pd.DataFrame({
            "NO": [1, 2],
            "CODE": ["A001", "A002"],
            "LENGTH": [1000.0, 800.0],
            "WIDTH": [600.0, 400.0],
            "QUANTITY": [1, 1],
            "GRAIN": ["0-Material", "0-Material"],
            "TOP_EDGE": ["BANT", ""],  # Violation!
            "BOTTOM_EDGE": ["", ""],
            "LEFT_EDGE": ["", ""],
            "RIGHT_EDGE": ["", ""],
        })
        result = validator.validate(data, "ARKALIK")
        assert result.is_valid is False
        assert any("Kural #9 ihlali" in e for e in result.errors)
        assert any("ARKALIK satirlarinda bant kolonlari bos olmali" in e for e in result.errors)

    def test_arkalik_all_empty_bands(self, validator):
        """ARKALIK with all empty bands should pass."""
        data = pd.DataFrame({
            "NO": [1, 2, 3],
            "CODE": ["A001", "A002", "A003"],
            "LENGTH": [1000.0, 800.0, 600.0],
            "WIDTH": [600.0, 400.0, 300.0],
            "QUANTITY": [1, 1, 1],
            "GRAIN": ["0-Material", "1-Boyuna", "2-Enine"],
            "TOP_EDGE": ["", "", ""],
            "BOTTOM_EDGE": ["", "", ""],
            "LEFT_EDGE": ["", "", ""],
            "RIGHT_EDGE": ["", "", ""],
        })
        result = validator.validate(data, "ARKALIK")
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_arkalik_multiple_band_violations(self, validator):
        """Detect multiple rows with band violations."""
        data = pd.DataFrame({
            "NO": [1, 2, 3],
            "CODE": ["A001", "A002", "A003"],
            "LENGTH": [1000.0, 800.0, 600.0],
            "WIDTH": [600.0, 400.0, 300.0],
            "QUANTITY": [1, 1, 1],
            "GRAIN": ["0-Material", "0-Material", "0-Material"],
            "TOP_EDGE": ["BANT", "", ""],
            "BOTTOM_EDGE": ["", "BANT", ""],
            "LEFT_EDGE": ["", "", "BANT"],
            "RIGHT_EDGE": ["", "", ""],
        })
        result = validator.validate(data, "ARKALIK")
        assert result.is_valid is False
        # Check violation row numbers
        error_message = " ".join(result.errors)
        assert "1" in error_message or "2" in error_message or "3" in error_message


class TestBackwardCompatibility:
    """Test validate_export_format (legacy dict format)."""

    @pytest.fixture
    def validator(self) -> ExportValidator:
        return ExportValidator()

    def test_valid_dict_format(self, validator):
        """Validate dict-based payload."""
        data = {
            "format": "xlsx",
            "columns": REQUIRED_COLUMNS,
            "measures": [
                {"grain": "1-Boyuna", "length": 1000, "width": 600},
                {"grain": "0-Material", "length": 800, "width": 400},
            ],
            "groups": []
        }
        result = validator.validate_export_format(data)
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_invalid_format_type(self, validator):
        """Reject non-xlsx formats."""
        data = {
            "format": "csv",
            "columns": REQUIRED_COLUMNS,
            "measures": []
        }
        result = validator.validate_export_format(data)
        assert result.is_valid is False
        assert any("Format hatasi" in e for e in result.errors)

    def test_dict_missing_columns(self, validator):
        """Detect missing columns in dict format."""
        data = {
            "format": "xlsx",
            "columns": ["NO", "CODE"],  # Missing most required columns
            "measures": []
        }
        result = validator.validate_export_format(data)
        assert result.is_valid is False
        assert any("Eksik zorunlu kolonlar" in e for e in result.errors)

    def test_dict_invalid_grains(self, validator):
        """Detect invalid grain values in dict measures."""
        data = {
            "format": "xlsx",
            "columns": REQUIRED_COLUMNS,
            "measures": [
                {"grain": "1-Boyuna"},
                {"grain": "INVALID_GRAIN"},
            ]
        }
        result = validator.validate_export_format(data)
        assert result.is_valid is False
        assert any("Gecersiz grain degerleri" in e for e in result.errors)

    def test_dict_arkalik_band_violation(self, validator):
        """Detect ARKALIK band violations in dict format."""
        data = {
            "format": "xlsx",
            "columns": REQUIRED_COLUMNS,
            "measures": [],
            "groups": [
                {
                    "type": "ARKALIK",
                    "measures": [
                        {"top_edge": "BANT"},  # Violation
                    ]
                }
            ]
        }
        result = validator.validate_export_format(data)
        assert result.is_valid is False
        assert any("Kural #9 ihlali" in e for e in result.errors)


class TestDataFrameCoercion:
    """Test _coerce_dataframe internal method."""

    @pytest.fixture
    def validator(self) -> ExportValidator:
        return ExportValidator()

    def test_coerce_from_dataframe(self, validator):
        """Pass through existing DataFrame."""
        df = pd.DataFrame({"A": [1, 2], "B": [3, 4]})
        result = validator._coerce_dataframe(df)
        assert isinstance(result, pd.DataFrame)
        assert list(result.columns) == ["A", "B"]

    def test_coerce_from_list(self, validator):
        """Convert list of dicts to DataFrame."""
        data = [{"A": 1, "B": 2}, {"A": 3, "B": 4}]
        result = validator._coerce_dataframe(data)
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2

    def test_coerce_from_dict_with_rows(self, validator):
        """Convert dict with 'rows' key to DataFrame."""
        data = {"rows": [{"A": 1}, {"A": 2}]}
        result = validator._coerce_dataframe(data)
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2

    def test_coerce_from_dict_with_measures(self, validator):
        """Convert dict with 'measures' key to DataFrame."""
        data = {"measures": [{"length": 1000}, {"length": 800}]}
        result = validator._coerce_dataframe(data)
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2

    def test_coerce_from_invalid(self, validator):
        """Return empty DataFrame for invalid input."""
        result = validator._coerce_dataframe("invalid")
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0


class TestHasValue:
    """Test _has_value internal method."""

    @pytest.fixture
    def validator(self) -> ExportValidator:
        return ExportValidator()

    def test_none_is_empty(self, validator):
        """None should be considered empty."""
        assert validator._has_value(None) is False

    def test_empty_string_is_empty(self, validator):
        """Empty string should be considered empty."""
        assert validator._has_value("") is False
        assert validator._has_value("   ") is False

    def test_zero_string_is_empty(self, validator):
        """'0' and '0.0' should be considered empty."""
        assert validator._has_value("0") is False
        assert validator._has_value("0.0") is False

    def test_false_string_is_empty(self, validator):
        """'false' and 'False' should be considered empty."""
        assert validator._has_value("false") is False
        assert validator._has_value("False") is False

    def test_valid_value(self, validator):
        """Non-empty values should be detected."""
        assert validator._has_value("BANT") is True
        assert validator._has_value("1") is True
        assert validator._has_value(True) is True
        assert validator._has_value(42) is True


class TestEdgeCases:
    """Edge cases and regression tests."""

    @pytest.fixture
    def validator(self) -> ExportValidator:
        return ExportValidator()

    def test_empty_dataframe(self, validator):
        """Handle empty DataFrame."""
        data = pd.DataFrame()
        result = validator.validate(data, "GOVDE")
        assert result.is_valid is False
        assert any("Eksik zorunlu kolonlar" in e for e in result.errors)

    def test_case_insensitive_group(self, validator):
        """Part group validation should be case-insensitive."""
        data = pd.DataFrame({col: [] for col in REQUIRED_COLUMNS})
        result = validator.validate(data, "govde")
        assert result.details["group"] == "GOVDE"

    def test_mixed_case_grain_values(self, validator):
        """Grain values are case-sensitive."""
        data = pd.DataFrame({
            "NO": [1],
            "CODE": ["M001"],
            "LENGTH": [1000.0],
            "WIDTH": [600.0],
            "QUANTITY": [1],
            "GRAIN": ["1-boyuna"],  # lowercase - invalid
            "TOP_EDGE": [""],
            "BOTTOM_EDGE": [""],
            "LEFT_EDGE": [""],
            "RIGHT_EDGE": [""],
        })
        result = validator.validate(data, "GOVDE")
        assert result.is_valid is False

    def test_null_grain_values_ignored(self, validator):
        """Null/NaN grain values should be ignored in validation."""
        data = pd.DataFrame({
            "NO": [1, 2],
            "CODE": ["M001", "M002"],
            "LENGTH": [1000.0, 800.0],
            "WIDTH": [600.0, 400.0],
            "QUANTITY": [1, 1],
            "GRAIN": ["1-Boyuna", None],  # Null grain
            "TOP_EDGE": ["", ""],
            "BOTTOM_EDGE": ["", ""],
            "LEFT_EDGE": ["", ""],
            "RIGHT_EDGE": ["", ""],
        })
        result = validator.validate(data, "GOVDE")
        # Should not complain about null grain
        if not result.is_valid:
            assert not any("Gecersiz grain" in e for e in result.errors)
