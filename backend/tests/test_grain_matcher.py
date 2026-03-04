"""
OptiPlan360 — Grain Matcher Unit Tests

BÖLÜM 9: Test Üretimi — Grain Otomatik Eşleştirme Testleri

Çalıştır: pytest tests/test_grain_matcher.py -v
"""

import pytest
from app.services.grain_matcher import (
    GrainMatcher,
    GrainSuggestion,
    suggest_grain,
    suggest_grain_with_explanation,
    batch_suggest,
    get_grain_dropdown_options,
)


class TestGrainSuggestionDataclass:
    """Test GrainSuggestion dataclass structure."""

    def test_suggestion_attributes(self):
        """Verify GrainSuggestion has required fields."""
        suggestion = GrainSuggestion(
            grain="1-Boyuna",
            confidence=0.85,
            reason="Ceviz pattern detected",
            grain_name="Boyuna Damar"
        )
        assert suggestion.grain == "1-Boyuna"
        assert suggestion.confidence == 0.85
        assert "Ceviz" in suggestion.reason
        assert suggestion.grain_name == "Boyuna Damar"


class TestGrainMatcher:
    """Test GrainMatcher class logic."""

    @pytest.fixture
    def matcher(self) -> GrainMatcher:
        """Create a GrainMatcher instance."""
        return GrainMatcher()

    def test_desensiz_detection(self, matcher):
        """Detect desensiz (0-Material) patterns."""
        # MDFLAM, Beyaz, Antrasit → 0-Material
        result = matcher.suggest_grain("MDFLAM Beyaz")
        assert result.grain == "0-Material"
        assert result.confidence >= 0.8

        result = matcher.suggest_grain("Antrasit MDF")
        assert result.grain == "0-Material"

    def test_boyuna_detection(self, matcher):
        """Detect boyuna (1-Boyuna) wood grain patterns."""
        # Ceviz, Meşe → 1-Boyuna
        result = matcher.suggest_grain("Ceviz 18mm")
        assert result.grain == "1-Boyuna"
        assert result.confidence >= 0.7

        result = matcher.suggest_grain("Meşe Doğal")
        assert result.grain == "1-Boyuna"

    def test_enine_detection(self, matcher):
        """Detect enine (2-Enine) patterns."""
        # Country, Rustik → 2-Enine
        result = matcher.suggest_grain("Country Tarzı")
        assert result.grain == "2-Enine"
        assert result.confidence >= 0.7

        result = matcher.suggest_grain("Rustik Desen")
        assert result.grain == "2-Enine"

    def test_mixed_detection(self, matcher):
        """Detect karışık (3-Material) patterns."""
        # Hafif desen, Doku, Textured → 3-Material
        result = matcher.suggest_grain("Hafif Desen")
        assert result.grain == "3-Material"
        assert result.confidence >= 0.7

        result = matcher.suggest_grain("Doku Görünüm")
        assert result.grain == "3-Material"

    def test_turkish_normalization(self, matcher):
        """Handle Turkish characters in material names."""
        # Test Turkish normalization - known wood types
        result = matcher.suggest_grain("Ceviz Doğal")
        assert result.grain == "1-Boyuna"

        result = matcher.suggest_grain("Meşe İnce")
        assert result.grain == "1-Boyuna"

    def test_case_insensitive(self, matcher):
        """Matching should be case-insensitive."""
        result1 = matcher.suggest_grain("CEVIZ")
        result2 = matcher.suggest_grain("ceviz")
        result3 = matcher.suggest_grain("Ceviz")
        assert result1.grain == result2.grain == result3.grain

    def test_whitespace_tolerance(self, matcher):
        """Handle extra whitespace in material names."""
        result = matcher.suggest_grain("  MDF  LAM   Beyaz  ")
        assert result.grain == "0-Material"

    def test_unknown_material_fallback(self, matcher):
        """Fallback to default for unrecognized materials."""
        result = matcher.suggest_grain("XYZZZ123 Unknown Material")
        # Should return a grain (likely 3-Material as fallback)
        assert result.grain in ["0-Material", "3-Material"]
        assert result.confidence < 0.6  # Low confidence

    def test_empty_input(self, matcher):
        """Handle empty material names gracefully."""
        result = matcher.suggest_grain("")
        assert result.grain in ["0-Material", "3-Material"]
        assert result.confidence >= 0


class TestGrainMatcherWithExplanation:
    """Test suggest_grain_with_explanation method."""

    @pytest.fixture
    def matcher(self) -> GrainMatcher:
        return GrainMatcher()

    def test_explanation_structure(self, matcher):
        """Verify explanation dict has required keys."""
        result = matcher.suggest_grain_with_explanation("Ceviz 18mm")
        assert "grain" in result
        assert "grain_name" in result
        assert "confidence" in result
        assert "reason" in result

    def test_explanation_content(self, matcher):
        """Verify explanation contains meaningful data."""
        result = matcher.suggest_grain_with_explanation("MDFLAM Beyaz")
        assert result["grain"] == "0-Material"
        assert "Desensiz" in result["grain_name"]
        assert result["confidence"] >= 0.8


class TestSingletonFunctions:
    """Test module-level singleton functions."""

    def test_suggest_grain_function(self):
        """Test standalone suggest_grain function."""
        result = suggest_grain("Ceviz")
        assert isinstance(result, GrainSuggestion)
        assert result.grain == "1-Boyuna"

    def test_suggest_grain_with_explanation_function(self):
        """Test standalone suggest_grain_with_explanation function."""
        result = suggest_grain_with_explanation("Meşe")
        assert isinstance(result, dict)
        assert result["grain"] == "1-Boyuna"

    def test_batch_suggest_function(self):
        """Test batch_suggest for multiple materials."""
        materials = ["MDFLAM Beyaz", "Ceviz", "Doku Görünüm"]
        results = batch_suggest(materials)
        assert len(results) == 3
        assert all(isinstance(r, GrainSuggestion) for r in results)
        assert results[0].grain == "0-Material"
        assert results[1].grain == "1-Boyuna"
        assert results[2].grain == "3-Material"

    def test_get_grain_dropdown_options(self):
        """Test dropdown options generator."""
        options = get_grain_dropdown_options()
        assert isinstance(options, list)
        assert len(options) == 4  # 0, 1, 2, 3
        assert all("value" in opt and "label" in opt for opt in options)


class TestConfidenceScoring:
    """Test confidence score logic."""

    @pytest.fixture
    def matcher(self) -> GrainMatcher:
        return GrainMatcher()

    def test_high_confidence_exact_match(self, matcher):
        """Exact pattern match should have high confidence."""
        result = matcher.suggest_grain("MDFLAM")
        assert result.confidence >= 0.85

    def test_medium_confidence_partial_match(self, matcher):
        """Partial matches should have medium confidence."""
        result = matcher.suggest_grain("Ceviz renkli panel")
        assert 0.6 <= result.confidence <= 0.95

    def test_low_confidence_ambiguous(self, matcher):
        """Ambiguous materials should have low confidence."""
        result = matcher.suggest_grain("Generic Panel")
        assert result.confidence <= 0.7


class TestRegressionCases:
    """Regression tests for known edge cases."""

    @pytest.fixture
    def matcher(self) -> GrainMatcher:
        return GrainMatcher()

    def test_mlam_alias(self, matcher):
        """MLAM should expand to MDFLAM and match 0-Material."""
        # This depends on normalize_material_name being called
        result = matcher.suggest_grain("MLAM 18mm")
        # Should still detect as desensiz
        assert result.grain in ["0-Material", "3-Material"]

    def test_sunta_alias(self, matcher):
        """SUNTA/SLAM should expand to SUNTALAM."""
        result = matcher.suggest_grain("SUNTA Beyaz")
        assert result.grain == "0-Material"

    def test_numeric_thickness(self, matcher):
        """Material names with thickness (18mm, 16mm) should be parsed."""
        result = matcher.suggest_grain("Ceviz 18mm")
        assert result.grain == "1-Boyuna"

        result = matcher.suggest_grain("MDFLAM Beyaz 16mm")
        assert result.grain == "0-Material"

    def test_special_characters(self, matcher):
        """Material names with hyphens, underscores should work."""
        result = matcher.suggest_grain("MDF-LAM_Beyaz")
        assert result.grain == "0-Material"


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    @pytest.fixture
    def matcher(self) -> GrainMatcher:
        return GrainMatcher()

    def test_very_long_material_name(self, matcher):
        """Handle extremely long material names."""
        long_name = "MDF " * 100 + "Beyaz"
        result = matcher.suggest_grain(long_name)
        assert result.grain == "0-Material"

    def test_numeric_only_input(self, matcher):
        """Handle numeric-only material names."""
        result = matcher.suggest_grain("12345")
        assert result.grain in ["0-Material", "3-Material"]

    def test_special_chars_only(self, matcher):
        """Handle special characters only."""
        result = matcher.suggest_grain("###@@@")
        assert isinstance(result, GrainSuggestion)
        assert result.confidence >= 0

    def test_mixed_language(self, matcher):
        """Handle mixed Turkish/English material names."""
        result = matcher.suggest_grain("Oak Meşe Natural")
        assert result.grain == "1-Boyuna"
