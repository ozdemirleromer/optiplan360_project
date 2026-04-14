"""
OptiPlan 360 - Bant Mapping Validation Service
Kritik Risk R-006 Çözümü: Bant mapping yanlışlığı önleme

Bu modül:
- Bant kalınlığı validasyonu
- UI-Export mapping doğrulama
- Mapping unit testleri
- Runtime validation
"""

import re
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class BantKalinligi(Enum):
    """Geçerli bant kalınlıkları"""
    MM_040 = "0.40 MM"
    MM_1 = "1 MM"
    MM_2 = "2 MM"


class ExportCode(Enum):
    """Export kodları"""
    CODE_040 = "04"
    CODE_1 = "1"
    CODE_2 = "2"


@dataclass
class BantMapping:
    """Bant kalınlığı mapping tanımı"""
    ui_value: str           # UI'da gösterilen değer
    export_code: str       # Export edilen kod
    numeric_mm: float     # Sayısal mm değeri
    description: str       # Açıklama


@dataclass
class BantConfig:
    """Satır bazlı bant konfigürasyonu"""
    plaka_ref: str
    bant_kalinligi: str   # "0.40 MM", "1 MM", "2 MM"
    u1: bool
    u2: bool
    k1: bool
    k2: bool


class BantMappingValidator:
    """
    Bant kalınlığı mapping validasyon servisi.
    
    Kurallar:
    1. Sadece 0.40 MM, 1 MM, 2 MM geçerli
    2. Export mapping:
       - 0.40 MM → "04"
       - 1 MM → "1"
       - 2 MM → "2"
    3. UI gösterim ile export kod farklı (doğrulama kritik)
    4. Satır bazlı override destekli
    """
    
    # Mapping tanımları
    MAPPINGS: Dict[str, BantMapping] = {
        BantKalinligi.MM_040.value: BantMapping(
            ui_value="0.40 MM",
            export_code="04",
            numeric_mm=0.40,
            description="0.40 mm bant kalınlığı"
        ),
        BantKalinligi.MM_1.value: BantMapping(
            ui_value="1 MM",
            export_code="1",
            numeric_mm=1.0,
            description="1 mm bant kalınlığı"
        ),
        BantKalinligi.MM_2.value: BantMapping(
            ui_value="2 MM",
            export_code="2",
            numeric_mm=2.0,
            description="2 mm bant kalınlığı"
        ),
    }
    
    # Reverse mapping (export code -> UI value)
    REVERSE_MAPPING: Dict[str, str] = {
        "04": "0.40 MM",
        "1": "1 MM",
        "2": "2 MM",
    }
    
    # Geçerli değerler set
    VALID_UI_VALUES: set = {m.ui_value for m in MAPPINGS.values()}
    VALID_EXPORT_CODES: set = {m.export_code for m in MAPPINGS.values()}
    
    def __init__(self):
        self._validation_errors: List[str] = []
        
    def validate_ui_value(self, value: str, context: str = "") -> Tuple[bool, str]:
        """
        UI değerini validasyon et.
        
        Args:
            value: UI'dan gelen değer
            context: Hata mesajı için bağlam (örn: "üst bar", "satır 5")
            
        Returns:
            (geçerli mi, temizlenmiş değer veya hata mesajı)
        """
        if not value:
            return False, f"{context}: Bant kalınlığı boş olamaz"
        
        # Normalizasyon
        normalized = self._normalize_value(value)
        
        # Geçerli değer kontrolü
        if normalized in self.VALID_UI_VALUES:
            return True, normalized
        
        # Hata: geçersiz değer
        valid_list = ", ".join(sorted(self.VALID_UI_VALUES))
        error_msg = (
            f"{context}: Geçersiz bant kalınlığı '{value}'. "
            f"Geçerli değerler: {valid_list}"
        )
        
        self._validation_errors.append(error_msg)
        logger.error(error_msg)
        
        return False, error_msg
    
    def validate_export_code(self, code: str, context: str = "") -> Tuple[bool, str]:
        """
        Export kodunu validasyon et.
        
        Args:
            code: Export edilen kod
            context: Hata mesajı için bağlam
            
        Returns:
            (geçerli mi, UI değeri veya hata mesajı)
        """
        if not code:
            return False, f"{context}: Export kodu boş olamaz"
        
        # Trim ve normalize
        normalized = code.strip()
        
        if normalized in self.VALID_EXPORT_CODES:
            ui_value = self.REVERSE_MAPPING.get(normalized)
            return True, ui_value
        
        valid_list = ", ".join(sorted(self.VALID_EXPORT_CODES))
        error_msg = (
            f"{context}: Geçersiz export kodu '{code}'. "
            f"Geçerli kodlar: {valid_list}"
        )
        
        self._validation_errors.append(error_msg)
        logger.error(error_msg)
        
        return False, error_msg
    
    def ui_to_export(self, ui_value: str) -> Tuple[bool, str]:
        """
        UI değerini export koduna dönüştür.
        
        Args:
            ui_value: "0.40 MM", "1 MM", "2 MM"
            
        Returns:
            (başarılı, export kodu veya hata)
        """
        valid, result = self.validate_ui_value(ui_value, "ui_to_export")
        
        if not valid:
            return False, result
        
        mapping = self.MAPPINGS.get(result)
        if mapping:
            return True, mapping.export_code
        
        return False, f"Mapping bulunamadı: {ui_value}"
    
    def export_to_ui(self, export_code: str) -> Tuple[bool, str]:
        """
        Export kodunu UI değerine dönüştür.
        
        Args:
            export_code: "04", "1", "2"
            
        Returns:
            (başarılı, UI değeri veya hata)
        """
        valid, result = self.validate_export_code(export_code, "export_to_ui")
        
        if not valid:
            return False, result
        
        ui_value = self.REVERSE_MAPPING.get(export_code)
        if ui_value:
            return True, ui_value
        
        return False, f"Reverse mapping bulunamadı: {export_code}"
    
    def validate_row_config(self, config: BantConfig) -> Tuple[bool, List[str]]:
        """
        Satır bant konfigürasyonunu validasyon et.
        
        Args:
            config: BantConfig (plaka_ref, bant_kalinligi, u1, u2, k1, k2)
            
        Returns:
            (geçerli mi, hata mesajları listesi)
        """
        errors = []
        
        # Bant kalınlığı validasyonu
        valid, result = self.validate_ui_value(
            config.bant_kalinligi, 
            f"Plaka {config.plaka_ref}"
        )
        
        if not valid:
            errors.append(result)
        
        # U1/U2/K1/K2 boolean kontrolü (opsiyonel, tip kontrolü)
        for field_name, value in [
            ("U1", config.u1), ("U2", config.u2),
            ("K1", config.k1), ("K2", config.k2)
        ]:
            if not isinstance(value, bool):
                errors.append(
                    f"Plaka {config.plaka_ref}: {field_name} boolean olmalı, "
                    f"geldi: {type(value)}"
                )
        
        return len(errors) == 0, errors
    
    def calculate_export_codes(
        self, 
        bant_kalinligi: str,
        u1: bool,
        u2: bool,
        k1: bool,
        k2: bool
    ) -> Dict[str, str]:
        """
        Export kodlarını hesapla.
        
        Returns:
            {
                "bant_kalinligi": "04"/"1"/"2",
                "u1": "" veya export code,
                "u2": "" veya export code,
                "k1": "" veya export code,
                "k2": "" veya export code
            }
        """
        result = {
            "bant_kalinligi": "",
            "u1": "",
            "u2": "",
            "k1": "",
            "k2": ""
        }
        
        # Bant kalınlığı
        valid, export_code = self.ui_to_export(bant_kalinligi)
        if valid:
            result["bant_kalinligi"] = export_code
        
        # U1/U2/K1/K2: True ise bant export code'unu kullan, False ise boş
        # Not: U1/U2/K1/K2 export hücrelerinde bant kalınlığı kodu yazılır
        if valid:
            result["u1"] = export_code if u1 else ""
            result["u2"] = export_code if u2 else ""
            result["k1"] = export_code if k1 else ""
            result["k2"] = export_code if k2 else ""
        
        return result
    
    def validate_export_row(
        self,
        bant_kalinligi_ui: str,
        bant_kalinligi_export: str,
        u1_ui: bool,
        u1_export: str,
        context: str = ""
    ) -> Tuple[bool, List[str]]:
        """
        Export edilmiş satırı validasyon et (round-trip test).
        
        Args:
            bant_kalinligi_ui: UI'dan seçilen değer
            bant_kalinligi_export: Export edilen kod
            u1_ui: UI'da U1 işaretli mi
            u1_export: Export'ta U1 hücresi
            context: Bağlam
            
        Returns:
            (doğru mu, tutarsızlık mesajları)
        """
        mismatches = []
        
        # UI -> Export mapping doğrulama
        valid, expected_export = self.ui_to_export(bant_kalinligi_ui)
        
        if valid and expected_export != bant_kalinligi_export:
            mismatches.append(
                f"{context}: Bant kalınlığı mapping hatası! "
                f"UI='{bant_kalinligi_ui}' → expected='{expected_export}', "
                f"actual='{bant_kalinligi_export}'"
            )
        
        # U1/U2/K1/K2 doğrulama
        if u1_ui and u1_export == "":
            mismatches.append(
                f"{context}: U1 UI'da işaretli ama export'ta boş!"
            )
        
        if not u1_ui and u1_export != "":
            mismatches.append(
                f"{context}: U1 UI'da işaretli değil ama export'ta dolu!"
            )
        
        return len(mismatches) == 0, mismatches
    
    def get_valid_options(self) -> List[Dict[str, str]]:
        """UI dropdown için geçerli seçenekler"""
        return [
            {"value": m.ui_value, "label": m.ui_value, "export_code": m.export_code}
            for m in self.MAPPINGS.values()
        ]
    
    def get_mapping_summary(self) -> Dict[str, Dict[str, str]]:
        """Mapping özet tablosu"""
        return {
            ui_value: {
                "export_code": mapping.export_code,
                "numeric_mm": str(mapping.numeric_mm),
                "description": mapping.description
            }
            for ui_value, mapping in self.MAPPINGS.items()
        }
    
    def clear_errors(self) -> None:
        """Validasyon hatalarını temizle"""
        self._validation_errors = []
    
    def get_errors(self) -> List[str]:
        """Tüm validasyon hatalarını getir"""
        return self._validation_errors.copy()
    
    def _normalize_value(self, value: str) -> str:
        """Değer normalizasyonu"""
        if not value:
            return ""
        
        # Trim
        value = value.strip()
        
        # Case insensitive normalizasyon
        value_lower = value.lower()
        
        # Yaygın yazım hatalarını düzelt
        corrections = {
            "0.4 mm": "0.40 MM",
            "0.4mm": "0.40 MM",
            "0.40mm": "0.40 MM",
            "1mm": "1 MM",
            "1 mm": "1 MM",
            "2mm": "2 MM",
            "2 mm": "2 MM",
        }
        
        if value_lower in corrections:
            return corrections[value_lower]
        
        # Standart format: "X.XX MM" veya "X MM"
        return value


class BantMappingUnitTest:
    """
    Bant mapping unit testleri.
    CI/CD pipeline'da çalıştırılır.
    """
    
    @staticmethod
    def run_all_tests() -> Dict[str, any]:
        """Tüm mapping testlerini çalıştır"""
        validator = BantMappingValidator()
        
        tests = [
            ("UI to Export - 0.40 MM", BantMappingUnitTest._test_ui_to_export_040, validator),
            ("UI to Export - 1 MM", BantMappingUnitTest._test_ui_to_export_1, validator),
            ("UI to Export - 2 MM", BantMappingUnitTest._test_ui_to_export_2, validator),
            ("Export to UI - 04", BantMappingUnitTest._test_export_to_ui_04, validator),
            ("Export to UI - 1", BantMappingUnitTest._test_export_to_ui_1, validator),
            ("Export to UI - 2", BantMappingUnitTest._test_export_to_ui_2, validator),
            ("Invalid UI Value", BantMappingUnitTest._test_invalid_ui, validator),
            ("Invalid Export Code", BantMappingUnitTest._test_invalid_export, validator),
            ("Round-trip", BantMappingUnitTest._test_round_trip, validator),
            ("U1 Export Code", BantMappingUnitTest._test_u1_export_code, validator),
            ("Normalization", BantMappingUnitTest._test_normalization, validator),
        ]
        
        results = {
            "total": len(tests),
            "passed": 0,
            "failed": 0,
            "details": []
        }
        
        for test_name, test_func, validator in tests:
            try:
                success, message = test_func(validator)
                if success:
                    results["passed"] += 1
                    status = "PASS"
                else:
                    results["failed"] += 1
                    status = "FAIL"
                
                results["details"].append({
                    "test": test_name,
                    "status": status,
                    "message": message
                })
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "test": test_name,
                    "status": "ERROR",
                    "message": str(e)
                })
        
        return results
    
    @staticmethod
    def _test_ui_to_export_040(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.ui_to_export("0.40 MM")
        expected = "04"
        return success and result == expected, f"Expected '04', got '{result}'"
    
    @staticmethod
    def _test_ui_to_export_1(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.ui_to_export("1 MM")
        expected = "1"
        return success and result == expected, f"Expected '1', got '{result}'"
    
    @staticmethod
    def _test_ui_to_export_2(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.ui_to_export("2 MM")
        expected = "2"
        return success and result == expected, f"Expected '2', got '{result}'"
    
    @staticmethod
    def _test_export_to_ui_04(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.export_to_ui("04")
        expected = "0.40 MM"
        return success and result == expected, f"Expected '0.40 MM', got '{result}'"
    
    @staticmethod
    def _test_export_to_ui_1(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.export_to_ui("1")
        expected = "1 MM"
        return success and result == expected, f"Expected '1 MM', got '{result}'"
    
    @staticmethod
    def _test_export_to_ui_2(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.export_to_ui("2")
        expected = "2 MM"
        return success and result == expected, f"Expected '2 MM', got '{result}'"
    
    @staticmethod
    def _test_invalid_ui(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.validate_ui_value("3 MM")
        return not success, f"'3 MM' geçersiz olmalı, valid={success}"
    
    @staticmethod
    def _test_invalid_export(validator: BantMappingValidator) -> Tuple[bool, str]:
        success, result = validator.validate_export_code("3")
        return not success, f"'3' geçersiz olmalı, valid={success}"
    
    @staticmethod
    def _test_round_trip(validator: BantMappingValidator) -> Tuple[bool, str]:
        # UI → Export → UI
        for ui_value in ["0.40 MM", "1 MM", "2 MM"]:
            success1, export_code = validator.ui_to_export(ui_value)
            if not success1:
                return False, f"UI→Export failed for {ui_value}"
            
            success2, back_to_ui = validator.export_to_ui(export_code)
            if not success2 or back_to_ui != ui_value:
                return False, f"Round-trip failed: {ui_value} → {export_code} → {back_to_ui}"
        
        return True, "All round-trips successful"
    
    @staticmethod
    def _test_u1_export_code(validator: BantMappingValidator) -> Tuple[bool, str]:
        # U1=True, Bant=0.40 MM → U1 export'ta "04" olmalı
        result = validator.calculate_export_codes("0.40 MM", True, False, False, False)
        expected_u1 = "04"
        return result["u1"] == expected_u1, f"U1 expected '{expected_u1}', got '{result['u1']}'"
    
    @staticmethod
    def _test_normalization(validator: BantMappingValidator) -> Tuple[bool, str]:
        # Yaygın yazım hataları
        test_cases = [
            ("0.4 mm", "0.40 MM"),
            ("0.4mm", "0.40 MM"),
            ("1mm", "1 MM"),
            ("2mm", "2 MM"),
        ]
        
        for input_val, expected_normalized in test_cases:
            normalized = validator._normalize_value(input_val)
            if normalized != expected_normalized:
                return False, f"Normalization failed: '{input_val}' → '{normalized}' (expected '{expected_normalized}')"
        
        return True, "All normalizations correct"


# Global servis instance
bant_validator = BantMappingValidator()
