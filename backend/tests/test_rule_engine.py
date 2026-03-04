import pytest

from app.constants.excel_schema import REQUIRED_COLUMNS, VALID_GRAIN_VALUES
from app.services.grain_matcher import batch_suggest, suggest_grain, suggest_grain_with_explanation
from app.utils.text_normalize import normalize_material_name, normalize_phone, normalize_turkish


class TestTextNormalize:
    def test_turkish_chars(self):
        assert normalize_turkish("Ğ") == "G"
        assert normalize_turkish("üçüncü") == "ucuncu"

    def test_material_normalize(self):
        assert normalize_material_name("MDFLAM") == "MDFLAM"
        assert normalize_material_name("MLAM Beyaz") == "MDFLAM Beyaz"
        assert normalize_material_name("SUNTA") == "SUNTALAM"

    def test_phone_normalize(self):
        assert normalize_phone("05321234567") == "+905321234567"
        assert normalize_phone("+905321234567") == "+905321234567"
        assert normalize_phone("5321234567") == "+905321234567"


class TestGrainMatcher:
    def test_mdf_gives_0_material(self):
        result = suggest_grain("18mm Beyaz MDF Lakeli")
        assert result.grain == "0-Material"
        assert result.confidence >= 0.85

    def test_oak_gives_1_boyuna(self):
        result = suggest_grain("Meşe 18mm Kahverengi")
        assert result.grain == "1-Boyuna"

    def test_unknown_returns_default(self):
        result = suggest_grain("XYZABC999")
        assert result.grain == "0-Material"
        assert result.confidence <= 0.5

    def test_explanation_and_batch_wrappers(self):
        explained = suggest_grain_with_explanation("MDFLAM Beyaz")
        batched = batch_suggest(["MDFLAM Beyaz", "Meşe"])

        assert explained["grain"] == "0-Material"
        assert len(batched) == 2
        assert batched[1].grain == "1-Boyuna"


class TestExcelSchema:
    def test_required_columns_not_empty(self):
        assert len(REQUIRED_COLUMNS) == 10
        assert "GRAIN" in REQUIRED_COLUMNS

    def test_valid_grain_values(self):
        assert "0-Material" in VALID_GRAIN_VALUES
        assert "1-Boyuna" in VALID_GRAIN_VALUES
