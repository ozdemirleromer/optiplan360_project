"""
Phase 2 Validasyon Servisi — Blocker Tanılama

Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.1
"""

from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from ..models.enums import (
    BlockerReasonCodeEnum,
    CellApprovalStatusEnum,
)
from ..schemas_phase2 import CellBlockerResponse, ValidateCellRequest, ValidateCellResponse


class Phase2ValidationService:
    """
    [DOKUMAN] Hücre doğrulama motoru — alan-bazlı eşikler ve çok-adımlı rules
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.1
    """

    # Varsayılan doğrulama kuralları
    DEFAULT_VALIDATION_RULES = {
        "boy": {
            "min": 100,
            "max": 3000,
            "confidence_threshold": 75,
            "unit": "mm",
            "description": "Ürün boyu (Boy)",
        },
        "en": {
            "min": 100,
            "max": 3000,
            "confidence_threshold": 80,
            "unit": "mm",
            "description": "Ürün eni (En)",
        },
        "adet": {
            "min": 1,
            "max": 999,
            "confidence_threshold": 85,
            "unit": "piece",
            "description": "Ürün adedi",
        },
    }

    # Sık OCR hatası desenleri
    COMMON_OCR_ERRORS = {
        "0": "O",  # Sıfır yerine O harfi
        "O": "0",  # O harfi yerine sıfır
        "1": "I",  # Bir yerine I
        "I": "1",  # I yerine bir
        "8": "B",  # Sekiz yerine B
        "5": "S",  # Beş yerine S
    }

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self.rules = self.DEFAULT_VALIDATION_RULES

    def validate_cell(self, request: ValidateCellRequest) -> ValidateCellResponse:
        """
        Hücre doğrulama — çok adımlı pipeline
        Pipeline: Tip → Aralık → Birim → Tutarlılık → Güven
        """
        field_type = request.field_type.lower()

        if field_type not in self.rules:
            return ValidateCellResponse(
                is_valid=False,
                message=f"Bilinmeyen alan tipi: {field_type}",
                blockers=[],
            )

        rule = self.rules[field_type]
        blockers = []

        # 1. Tip Kontrolü
        type_blocker = self._check_type(field_type, request.value, request.original_ocr_value)
        if type_blocker:
            blockers.append(type_blocker)
            return ValidateCellResponse(
                is_valid=False,
                message="Değer sayı değil",
                blockers=blockers,
            )

        # 2. Aralık Kontrolü
        range_blocker = self._check_range(field_type, request.value, rule)
        if range_blocker:
            blockers.append(range_blocker)

        # 3. Birim Tahmini (future — şimdilik skip)
        # unit_blocker = self._check_unit(...)

        # 4. Tutarlılık (future — row context ile)
        # consistency_blocker = self._check_consistency(...)

        # 5. Güven Skoru
        confidence_blocker = self._check_confidence(
            field_type,
            request.current_confidence or 0,
            rule,
        )
        if confidence_blocker:
            blockers.append(confidence_blocker)

        return ValidateCellResponse(
            is_valid=len(blockers) == 0,
            message="Hücre geçerli" if len(blockers) == 0 else f"{len(blockers)} blocker tespit edildi",
            blockers=blockers,
        )

    def _check_type(
        self,
        field_type: str,
        value: float,
        original_ocr_value: Optional[str] = None,
    ) -> Optional[CellBlockerResponse]:
        """
        Tip Kontrol: Değer sayı mı?
        [DOKUMAN] Bölüm 5.1 — Validasyon Akışı
        """
        try:
            float(value)
            int(value)
        except (ValueError, TypeError):
            return CellBlockerResponse(
                reason_code=BlockerReasonCodeEnum.TYPE_INVALID,
                operator_message=f"'{value}' sayı değil. Lütfen sayısal bir değer girin.",
                is_blocker=True,
                severity="critical",
                confidence_score=0,
            )
        return None

    def _check_range(
        self,
        field_type: str,
        value: float,
        rule: Dict,
    ) -> Optional[CellBlockerResponse]:
        """
        Aralık Kontrolü: Min/Max sınırları
        [DOKUMAN] Bölüm 5.1
        """
        min_val = rule.get("min")
        max_val = rule.get("max")

        if min_val is not None and value < min_val:
            return CellBlockerResponse(
                reason_code=BlockerReasonCodeEnum.RANGE_OUT_OF_BOUNDS,
                operator_message=f"{rule.get('description')} {min_val} {rule.get('unit')} altında olamaz. Okunan: {value}",
                is_blocker=True,
                severity="critical",
                confidence_score=0,
            )

        if max_val is not None and value > max_val:
            return CellBlockerResponse(
                reason_code=BlockerReasonCodeEnum.RANGE_OUT_OF_BOUNDS,
                operator_message=f"{rule.get('description')} {max_val} {rule.get('unit')} üstünde olamaz. Okunan: {value}",
                is_blocker=True,
                severity="critical",
                confidence_score=0,
            )

        return None

    def _check_confidence(
        self,
        field_type: str,
        confidence: float,
        rule: Dict,
    ) -> Optional[CellBlockerResponse]:
        """
        Güven Skoru Kontrolü: Alan-bazlı eşik
        [DOKUMAN] Bölüm 5.1
        """
        threshold = rule.get("confidence_threshold", 80)

        if confidence < threshold:
            return CellBlockerResponse(
                reason_code=BlockerReasonCodeEnum.CONFIDENCE_LOW,
                operator_message=f"{rule.get('description')} algılama güveni %{confidence}, eşik %{threshold}. Lütfen onayla veya düzelt.",
                is_blocker=True,
                severity="warning" if confidence >= threshold - 10 else "critical",
                confidence_score=confidence,
            )

        return None

    def detect_common_ocr_errors(self, ocr_value: str) -> List[Dict]:
        """
        Sık OCR hatası tespiti
        [DOKUMAN] Bölüm 5.1 — OCR_COMMON_ERROR detektörü
        """
        suggestions = []
        for mistake, correct in self.COMMON_OCR_ERRORS.items():
            if mistake in ocr_value:
                suggested = ocr_value.replace(mistake, correct)
                if suggested != ocr_value:
                    suggestions.append({
                        "original": ocr_value,
                        "likely": suggested,
                        "reason": f"'{mistake}' → '{correct}' sık OCR hatası",
                    })
        return suggestions


class GateStatusService:
    """
    Phase 3 Gate Control — Blocker yönetimi ve gate açıklaması
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.2 & 5.5
    """

    # Gate Kuralları
    GATE_RULES = {
        "adet": {
            "minimum_confidence": 85,
            "severity": "critical",
            "description": "Adet (Quantity) — En açık tanım gerekli",
        },
        "boy": {
            "minimum_confidence": 75,
            "severity": "warning",
            "description": "Boy (Height) — Normalde ±10% tolerans",
        },
        "en": {
            "minimum_confidence": 80,
            "severity": "warning",
            "description": "En (Width) — Hassas ölçüm",
        },
    }

    def check_phase3_gate(
        self,
        record_uuid: str,
        rows_with_cells: List[Dict],
    ) -> Dict:
        """
        Phase 3 gate kontrol — hangi hücreler bloke ediyor?
        [DOKUMAN] Bölüm 5.4
        """
        blockers = []
        critical_count = 0
        warning_count = 0

        for row in rows_with_cells:
            for field_type in ["adet", "boy", "en"]:
                cell_key = f"{field_type}_onay"
                confidence_key = f"{field_type}_guven"

                approval_status = row.get(cell_key, "PENDING")
                confidence = row.get(confidence_key, 0)

                rule = self.GATE_RULES.get(field_type, {})
                min_confidence = rule.get("minimum_confidence", 80)

                # Blocker tespit: onaysız VE güven < eşik
                if approval_status != "APPROVED" and confidence < min_confidence:
                    blocker = {
                        "row_id": row.get("row_id"),
                        "field_type": field_type,
                        "reason_code": BlockerReasonCodeEnum.CONFIDENCE_LOW.value,
                        "operator_message": f"{rule.get('description')} — güven %{confidence}, gerekli %{min_confidence}. Onayla veya düzelt.",
                        "suggested_action": "Değeri doğrula, onayla veya önerileri uygula",
                        "confidence_score": confidence,
                        "severity": rule.get("severity", "warning"),
                    }
                    blockers.append(blocker)

                    if rule.get("severity") == "critical":
                        critical_count += 1
                    else:
                        warning_count += 1

        can_proceed = len(blockers) == 0

        return {
            "can_proceed": can_proceed,
            "message": "Phase 3'e geçiş hazır" if can_proceed else f"{len(blockers)} blocker bulundu",
            "blocker_reasons": blockers,
            "summary": {
                "total_blockers": len(blockers),
                "critical_count": critical_count,
                "warning_count": warning_count,
            },
        }
