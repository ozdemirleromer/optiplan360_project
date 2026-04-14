"""
Phase 2 Doğrulama Servisi — Birim Testleri

Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.9
"""

import pytest
from app.services.phase2_validation_service import Phase2ValidationService, GateStatusService
from app.schemas_phase2 import ValidateCellRequest


class TestPhase2ValidationService:
    """Phase 2 validasyon motoru testleri"""

    @pytest.fixture
    def validator(self):
        return Phase2ValidationService()

    # ────────────────────────────────────────
    # Tip Kontrolü
    # ────────────────────────────────────────

    def test_validate_cell_type_invalid(self, validator):
        """Tip kontrolü: sayı değil → TYPE_INVALID blocker"""
        request = ValidateCellRequest(
            field_type="boy",
            value=float("nan"),
            current_confidence=50,
        )
        response = validator.validate_cell(request)

        assert not response.is_valid
        assert any(b.reason_code == "TYPE_INVALID" for b in response.blockers)

    # ────────────────────────────────────────
    # Aralık Kontrolü
    # ────────────────────────────────────────

    def test_validate_cell_range_too_small(self, validator):
        """Aralık kontrolü: Boy < 100 → RANGE_OUT_OF_BOUNDS"""
        request = ValidateCellRequest(
            field_type="boy",
            value=50,  # < min 100
            current_confidence=90,
        )
        response = validator.validate_cell(request)

        assert not response.is_valid
        assert any(b.reason_code == "RANGE_OUT_OF_BOUNDS" for b in response.blockers)

    def test_validate_cell_range_too_large(self, validator):
        """Aralık kontrolü: Boy > 3000 → RANGE_OUT_OF_BOUNDS"""
        request = ValidateCellRequest(
            field_type="boy",
            value=4000,  # > max 3000
            current_confidence=90,
        )
        response = validator.validate_cell(request)

        assert not response.is_valid
        assert any(b.reason_code == "RANGE_OUT_OF_BOUNDS" for b in response.blockers)

    # ────────────────────────────────────────
    # Alan-Bazlı Güven Eşiği
    # ────────────────────────────────────────

    def test_validate_cell_confidence_boy(self, validator):
        """Boy alanı: confidence 75% eşik"""
        request = ValidateCellRequest(
            field_type="boy",
            value=800,  # Valid
            current_confidence=70,  # < 75% threshold
        )
        response = validator.validate_cell(request)

        assert not response.is_valid
        assert any(b.reason_code == "CONFIDENCE_LOW" for b in response.blockers)

    def test_validate_cell_confidence_adet(self, validator):
        """Adet alanı: confidence 85% eşik (daha sıkı)"""
        request = ValidateCellRequest(
            field_type="adet",
            value=2,  # Valid
            current_confidence=75,  # < 85% threshold
        )
        response = validator.validate_cell(request)

        assert not response.is_valid
        assert any(b.reason_code == "CONFIDENCE_LOW" for b in response.blockers)

    # ────────────────────────────────────────
    # Sık OCR Hatası Tespiti
    # ────────────────────────────────────────

    def test_detect_common_ocr_errors_zero_to_o(self, validator):
        """OCR hatası: O → 0 (sıfır yerine O harfi)"""
        suggestions = validator.detect_common_ocr_errors("O12")
        assert len(suggestions) > 0
        assert suggestions[0]["original"] == "O12"
        assert "0" in suggestions[0]["likely"]

    def test_detect_common_ocr_errors_i_to_one(self, validator):
        """OCR hatası: I → 1 (bir yerine I)"""
        suggestions = validator.detect_common_ocr_errors("I23")
        assert len(suggestions) > 0

    # ────────────────────────────────────────
    # Geçerli Hücreler
    # ────────────────────────────────────────

    def test_validate_cell_valid_boy(self, validator):
        """Boy 800, confidence 80% → Valid"""
        request = ValidateCellRequest(
            field_type="boy",
            value=800,
            current_confidence=80,
        )
        response = validator.validate_cell(request)

        assert response.is_valid
        assert len(response.blockers) == 0

    def test_validate_cell_valid_adet(self, validator):
        """Adet 2, confidence 90% → Valid"""
        request = ValidateCellRequest(
            field_type="adet",
            value=2,
            current_confidence=90,
        )
        response = validator.validate_cell(request)

        assert response.is_valid
        assert len(response.blockers) == 0


class TestGateStatusService:
    """Phase 3 Gate Status testleri"""

    @pytest.fixture
    def gate_service(self):
        return GateStatusService()

    def test_gate_ready_all_approved(self, gate_service):
        """Tüm hücreler onaylı → Gate READY"""
        rows = [
            {
                "row_id": "row1",
                "adet_onay": "APPROVED",
                "adet_guven": 90,
                "boy_onay": "APPROVED",
                "boy_guven": 85,
                "en_onay": "APPROVED",
                "en_guven": 88,
            }
        ]

        result = gate_service.check_phase3_gate("record-1", rows)
        assert result["can_proceed"] is True
        assert result["summary"]["total_blockers"] == 0

    def test_gate_blocked_low_confidence_adet(self, gate_service):
        """Adet güveni < 85% → Gate BLOCKED (critical)"""
        rows = [
            {
                "row_id": "row1",
                "adet_onay": "PENDING",
                "adet_guven": 70,  # < 85% threshold
                "boy_onay": "APPROVED",
                "boy_guven": 85,
                "en_onay": "APPROVED",
                "en_guven": 88,
            }
        ]

        result = gate_service.check_phase3_gate("record-1", rows)
        assert result["can_proceed"] is False
        assert result["summary"]["total_blockers"] == 1
        assert result["summary"]["critical_count"] == 1

    def test_gate_blocked_multiple_blockers(self, gate_service):
        """Birden fazla blocker → toplam count doğru"""
        rows = [
            {
                "row_id": "row1",
                "adet_onay": "PENDING",
                "adet_guven": 70,    # Blocker
                "boy_onay": "PENDING",
                "boy_guven": 60,     # Blocker
                "en_onay": "APPROVED",
                "en_guven": 88,
            }
        ]

        result = gate_service.check_phase3_gate("record-1", rows)
        assert result["can_proceed"] is False
        assert result["summary"]["total_blockers"] == 2
        assert result["summary"]["critical_count"] == 1  # adet
        assert result["summary"]["warning_count"] == 1   # boy

    def test_gate_blocker_message_clear(self, gate_service):
        """Blocker mesajı Türkçe ve anlaşılır"""
        rows = [
            {
                "row_id": "row1",
                "adet_onay": "PENDING",
                "adet_guven": 70,
                "boy_onay": "APPROVED",
                "boy_guven": 85,
                "en_onay": "APPROVED",
                "en_guven": 88,
            }
        ]

        result = gate_service.check_phase3_gate("record-1", rows)
        assert len(result["blocker_reasons"]) == 1
        blocker = result["blocker_reasons"][0]
        assert "Adet" in blocker["operator_message"]
        assert "70" in blocker["operator_message"]
        assert "85" in blocker["operator_message"]  # Threshold
