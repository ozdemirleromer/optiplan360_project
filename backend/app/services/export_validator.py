"""
Export Format Doğrulama Servisi
Değişmez kurallara göre export öncesi format kontrolü
"""

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class ValidationResult:
    passed: bool
    details: Dict[str, Any]
    errors: List[str]
    warnings: List[str]


class ExportValidator:
    """
    Export öncesi format doğrulama
    ✅ Kural #3: .xlsx formatı kontrolü
    ✅ Kural #4: Tag bütünlüğü kontrolü
    ✅ Kural #5: Ondalık değer doğrulama
    ✅ Kural #1: Gövde/Arkalık ayrımı
    ✅ Kural #2: Renk/Kalınlık ayrımı
    """

    # OptiPlanning Excel tag'leri - Kural #4: Asla değiştirilmez
    REQUIRED_EXCEL_TAGS = [
        "NO",
        "CODE",
        "LENGTH",
        "WIDTH",
        "QUANTITY",
        "GRAIN",
        "TOP_EDGE",
        "BOTTOM_EDGE",
        "LEFT_EDGE",
        "RIGHT_EDGE",
    ]

    # Kural #8: Makinenin kabul ettiği grain değerleri
    VALID_GRAIN_VALUES = ["0-Material", "1-Material", "2-Material", "3-Material"]

    def __init__(self):
        self.errors = []
        self.warnings = []

    def validate_export_format(self, data: Dict[str, Any]) -> ValidationResult:
        """Ana doğrulama fonksiyonu"""
        self.errors = []
        self.warnings = []

        details = {
            "format_check": self._check_format(data),
            "tags_intact": self._verify_excel_tags(data),
            "decimal_values": self._check_decimal_values(data),
            "split_by_group": self._check_group_separation(data),
            "split_by_material": self._check_material_separation(data),
            "grain_values": self._check_grain_values(data),
            "band_on_arkalik": self._check_no_band_on_arkalik(data),
        }

        passed = all(details.values()) and len(self.errors) == 0

        return ValidationResult(
            passed=passed, details=details, errors=self.errors, warnings=self.warnings
        )

    def _check_format(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #3: Format .xlsx olmalı"""
        format_type = data.get("format", "").lower()
        if format_type != "xlsx":
            self.errors.append(f"Format hatası: {format_type} yerine xlsx olmalı (Kural #3)")
            return False
        return True

    def _verify_excel_tags(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #4: Excel tag'leri asla değiştirilmez/eksiltilmez"""
        columns = data.get("columns", [])
        missing_tags = [tag for tag in self.REQUIRED_EXCEL_TAGS if tag not in columns]

        if missing_tags:
            self.errors.append(f"Eksik Excel tag'leri: {missing_tags} (Kural #4)")
            return False

        extra_tags = [tag for tag in columns if tag not in self.REQUIRED_EXCEL_TAGS]
        if extra_tags:
            self.warnings.append(f"Ekstra tag'ler (dikkat): {extra_tags}")

        return True

    def _check_decimal_values(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #5: Makine ondalık kabul eder"""
        measures = data.get("measures", [])
        invalid_measures = []

        for measure in measures:
            length = measure.get("length")
            width = measure.get("width")

            # Ondalık kontrolü
            if isinstance(length, int) or isinstance(width, int):
                invalid_measures.append(measure)
                self.warnings.append(f"Tam sayı değer: {measure}. Ondalığa çevrilecek (Kural #5)")

        return len(invalid_measures) == 0

    def _check_group_separation(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #1: Gövde ve arkalık ayrı çıktı"""
        groups = data.get("groups", [])

        has_govde = any(g.get("type") == "GOVDE" for g in groups)
        has_arkalik = any(g.get("type") == "ARKALIK" for g in groups)

        if has_govde and has_arkalik:
            # Aynı dosyada olmamalı
            govde_count = sum(1 for g in groups if g.get("type") == "GOVDE")
            arkalik_count = sum(1 for g in groups if g.get("type") == "ARKALIK")

            if govde_count > 0 and arkalik_count > 0:
                self.errors.append(
                    "Gövde ve arkalık aynı dosyada! Ayrı export yapılmalı (Kural #1)"
                )
                return False

        return True

    def _check_material_separation(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #2: Renk ve kalınlık farklıysa ayrı liste"""
        groups = data.get("groups", [])

        if not groups:
            return True

        # Her grup içinde malzeme çeşitliliği kontrolü
        for group in groups:
            materials = group.get("materials", [])
            unique_combinations = set()

            for material in materials:
                thickness = material.get("thickness")
                color = material.get("color")
                combo = f"{thickness}_{color}"
                unique_combinations.add(combo)

            if len(unique_combinations) > 1:
                self.warnings.append(
                    f"Grup '{group.get('name')}' içinde farklı malzemeler: {unique_combinations}. "
                    f"Ayrı listeler önerilir (Kural #2)"
                )

        return True

    def _check_grain_values(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #8: Grain değerleri 0/1/2/3-Material olmalı"""
        measures = data.get("measures", [])

        for measure in measures:
            grain = measure.get("grain")
            if grain and grain not in self.VALID_GRAIN_VALUES:
                self.errors.append(
                    f"Geçersiz grain değeri: {grain}. "
                    f"Olmalı: {self.VALID_GRAIN_VALUES} (Kural #8)"
                )
                return False

        return True

    def _check_no_band_on_arkalik(self, data: Dict[str, Any]) -> bool:
        """✅ Kural #9: Arkalıkta bant kesinlikle olmaz"""
        groups = data.get("groups", [])

        for group in groups:
            if group.get("type") == "ARKALIK":
                measures = group.get("measures", [])
                for measure in measures:
                    band_edges = [
                        measure.get("top_edge", False),
                        measure.get("bottom_edge", False),
                        measure.get("left_edge", False),
                        measure.get("right_edge", False),
                    ]
                    if any(band_edges):
                        self.errors.append(f"Arkalıkta bant var! Satır: {measure} (Kural #9)")
                        return False

        return True

    def generate_checklist(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Export öncesi kontrol listesi"""
        return [
            {
                "item": "Gövde/Arkalık ayrımı",
                "status": self._check_group_separation(data),
                "rule": "#1",
            },
            {
                "item": "Renk/Kalınlık ayrımı",
                "status": self._check_material_separation(data),
                "rule": "#2",
            },
            {"item": "Format .xlsx", "status": self._check_format(data), "rule": "#3"},
            {"item": "Excel tag'leri bütün", "status": self._verify_excel_tags(data), "rule": "#4"},
            {
                "item": "Ondalık değerler hazır",
                "status": self._check_decimal_values(data),
                "rule": "#5",
            },
            {
                "item": "Grain değerleri doğru",
                "status": self._check_grain_values(data),
                "rule": "#8",
            },
            {
                "item": "Arkalıkta bant yok",
                "status": self._check_no_band_on_arkalik(data),
                "rule": "#9",
            },
        ]


# Singleton instance
validator = ExportValidator()


def validate_export(data: Dict[str, Any]) -> ValidationResult:
    """Kolay kullanım fonksiyonu"""
    return validator.validate_export_format(data)
