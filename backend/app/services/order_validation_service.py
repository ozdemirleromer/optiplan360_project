"""
Phase 3 Sipariş: Cari Kodu, Stok Kodu, Termin Validasyon Kapıları
Phase 3 Sipariş Hazırlama için zorunlu alan validasyonu
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validasyon seviyeleri"""
    BLOCKER = "blocker"        # Export bloke
    ERROR = "error"            # Hata ama devam edebilir
    WARNING = "warning"          # Uyarı
    INFO = "info"              # Bilgilendirme


class FieldType(Enum):
    """Alan tipleri"""
    CARI_KODU = "cari_kodu"
    STOK_KODU = "stok_kodu"
    TERMIN = "termin"
    MIKTAR = "miktar"
    BIRIM = "birim"
    FIYAT = "fiyat"
    PARA_BIRIMI = "para_birimi"


@dataclass
class ValidationResult:
    """Validasyon sonucu"""
    field: FieldType
    value: str
    is_valid: bool
    level: ValidationLevel
    message: str
    suggestion: Optional[str] = None


@dataclass
class OrderValidationResult:
    """Sipariş validasyon sonucu"""
    order_id: str
    all_valid: bool
    can_export: bool
    results: List[ValidationResult]
    summary: Dict[str, int]


class OrderValidationService:
    """Sipariş validasyon servisi"""
    
    # Phase 3 Politikası: Zorunlu alanlar
    REQUIRED_FIELDS = {
        "cari_kodu": {
            "pattern": r'^[A-Z0-9]{3,10}$',
            "description": "Cari kodu (3-10 alphanumeric)",
            "examples": ["ABC123", "XYZ001", "MUSTERI1"]
        },
        "stok_kodu": {
            "pattern": r'^[A-Z0-9]{3,15}$',
            "description": "Stok kodu (3-15 alphanumeric)",
            "examples": ["STK001", "URUN123", "MALZEME45"]
        },
        "termin": {
            "pattern": r'^(NET|HAVALE|KAPIDA|VADE_FARKLI)$',
            "description": "Termin (NET/HAVALE/KAPIDA/VADE_FARKLI)",
            "examples": ["NET", "HAVALE", "KAPIDA"]
        }
    }
    
    def __init__(self):
        self.validation_rules = self._load_validation_rules()
    
    def _load_validation_rules(self) -> Dict[str, Dict]:
        """Validasyon kurallarını yükle"""
        return self.REQUIRED_FIELDS
    
    def validate_field(self, field_type: FieldType, value: str) -> ValidationResult:
        """
        Tek bir alanı validasyon kurallarına göre kontrol et
        
        Args:
            field_type: Alan tipi
            value: Alan değeri
            
        Returns:
            ValidationResult: Validasyon sonucu
        """
        if not value or not value.strip():
            return ValidationResult(
                field=field_type,
                value=value,
                is_valid=False,
                level=ValidationLevel.BLOCKER,
                message=f"{field_type.value} boş bırakılamaz",
                suggestion=f"{field_type.value} alanını doldurun"
            )
        
        value = value.strip().upper()
        
        if field_type.value not in self.validation_rules:
            return ValidationResult(
                field=field_type,
                value=value,
                is_valid=False,
                level=ValidationLevel.ERROR,
                message=f"Tanımlanmamış alan tipi: {field_type.value}"
            )

        rule = self.validation_rules[field_type.value]
        pattern = rule["pattern"]
        
        if not re.match(pattern, value):
            return ValidationResult(
                field=field_type,
                value=value,
                is_valid=False,
                level=ValidationLevel.BLOCKER,
                message=f"{rule['description']} formatına uygun değil",
                suggestion=f"Örnek: {', '.join(rule['examples'])}"
            )
        
        return ValidationResult(
            field=field_type,
            value=value,
            is_valid=True,
            level=ValidationLevel.INFO,
            message="Geçerli format"
        )
    
    def validate_order(self, order_data: Dict[str, Any]) -> OrderValidationResult:
        """
        Sipariş verisini Phase 3 kurallarına göre validasyon yap
        
        Args:
            order_data: Sipariş verisi
            
        Returns:
            OrderValidationResult: Validasyon sonucu
        """
        order_id = order_data.get("order_id", "")
        results = []
        
        # Zorunlu alanları kontrol et
        for field_type in [FieldType.CARI_KODU, FieldType.STOK_KODU, FieldType.TERMIN]:
            field_value = str(order_data.get(field_type.value, ""))
            result = self.validate_field(field_type, field_value)
            results.append(result)
        
        # Opsiyonel alanları kontrol et
        optional_fields = {
            FieldType.MIKTAR: order_data.get("miktar", ""),
            FieldType.BIRIM: order_data.get("birim", ""),
            FieldType.FIYAT: order_data.get("fiyat", ""),
            FieldType.PARA_BIRIMI: order_data.get("para_birimi", "")
        }
        
        for field_type, value in optional_fields.items():
            if value:  # Sadece doluysa kontrol et
                result = self.validate_field(field_type, str(value))
                results.append(result)
        
        # Özet hesapla
        all_valid = all(r.is_valid for r in results)
        has_blocker = any(r.level == ValidationLevel.BLOCKER for r in results)
        can_export = all_valid and not has_blocker
        
        summary = {
            "total_fields": len(results),
            "valid_fields": sum(1 for r in results if r.is_valid),
            "blocker_errors": sum(1 for r in results if r.level == ValidationLevel.BLOCKER),
            "warning_errors": sum(1 for r in results if r.level == ValidationLevel.WARNING)
        }
        
        return OrderValidationResult(
            order_id=order_id,
            all_valid=all_valid,
            can_export=can_export,
            results=results,
            summary=summary
        )
    
    def get_field_examples(self, field_type: FieldType) -> List[str]:
        """Alan için geçerli örnekler döndür"""
        if field_type in self.validation_rules:
            return self.validation_rules[field_type]["examples"]
        return []
    
    def get_validation_rules_summary(self) -> Dict[str, Any]:
        """Validasyon kuralları özetini döndür"""
        return {
            "required_fields": list(self.REQUIRED_FIELDS.keys()),
            "validation_rules": self.validation_rules,
            "phase": "phase_3_preparation",
            "description": "Phase 3 Sipariş Hazırlama validasyon kuralları"
        }
    
    def suggest_corrections(self, validation_result: ValidationResult) -> List[str]:
        """Validasyon hatası için düzeltme önerileri"""
        suggestions = []
        
        if not validation_result.is_valid:
            field_type = validation_result.field
            value = validation_result.value
            
            if field_type == FieldType.CARI_KODU:
                # Cari kodu düzeltmeleri
                if len(value) < 3:
                    suggestions.append("Cari kodu en az 3 karakter olmalıdır")
                elif len(value) > 10:
                    suggestions.append("Cari kodu en fazla 10 karakter olabilir")
                elif not value.isalnum():
                    suggestions.append("Cari kodu sadece harf ve rakam içermelidir")
                elif not value.isupper():
                    suggestions.append("Cari kodu büyük harf olmalıdır")
            
            elif field_type == FieldType.STOK_KODU:
                # Stok kodu düzeltmeleri
                if len(value) < 3:
                    suggestions.append("Stok kodu en az 3 karakter olmalıdır")
                elif len(value) > 15:
                    suggestions.append("Stok kodu en fazla 15 karakter olabilir")
                elif not value.isalnum():
                    suggestions.append("Stok kodu sadece harf ve rakam içermelidir")
                elif not value.isupper():
                    suggestions.append("Stok kodu büyük harf olmalıdır")
            
            elif field_type == FieldType.TERMIN:
                # Termin düzeltmeleri
                valid_terms = ["NET", "HAVALE", "KAPIDA", "VADE_FARKLI"]
                if value not in valid_terms:
                    suggestions.append(f"Geçerli terminler: {', '.join(valid_terms)}")
        
        return suggestions


class OrderPreparationService:
    """Sipariş hazırlama servisi"""
    
    def __init__(self):
        self.validator = OrderValidationService()
    
    def prepare_for_export(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Siparişi export için hazırla
        
        Args:
            order_data: Ham sipariş verisi
            
        Returns:
            Dict: Hazırlanmış sipariş verisi
        """
        # Validasyon yap
        validation_result = self.validator.validate_order(order_data)
        
        if not validation_result.can_export:
            return {
                "success": False,
                "blocked": True,
                "order_id": order_data.get("order_id"),
                "validation_results": validation_result.results,
                "message": "Sipariş export için hazır değil - zorunlu alanlar eksik"
            }
        
        # Veriyi temizle ve formatla
        prepared_order = {}
        
        for result in validation_result.results:
            if result.is_valid:
                prepared_order[result.field.value] = result.value
        
        # Ek alanları ekle
        prepared_order.update({
            "validation_timestamp": None,  # Will be set
            "validated_by": "system",
            "export_status": "ready"
        })
        
        return {
            "success": True,
            "prepared_order": prepared_order,
            "validation_summary": validation_result.summary
        }
    
    def get_validation_dashboard_data(self) -> Dict[str, Any]:
        """Validasyon dashboard verisi"""
        return {
            "validation_rules": self.validator.get_validation_rules_summary(),
            "required_fields": {
                "cari_kodu": {
                    "description": "Müşteri cari kodu",
                    "pattern": "3-10 alphanumeric",
                    "examples": ["ABC123", "XYZ001"]
                },
                "stok_kodu": {
                    "description": "Ürün stok kodu", 
                    "pattern": "3-15 alphanumeric",
                    "examples": ["STK001", "URUN123"]
                },
                "termin": {
                    "description": "Sipariş tipi",
                    "pattern": "NET/HAVALE/KAPIDA/VADE_FARKLI",
                    "examples": ["NET", "HAVALE", "KAPIDA"]
                }
            },
            "export_blockers": [
                "cari_kodu eksik veya geçersiz format",
                "stok_kodu eksik veya geçersiz format", 
                "termin eksik veya geçersiz değer"
            ]
        }


# Global instances
_order_validator = None
_order_preparation_service = None


def get_order_validator() -> OrderValidationService:
    """Order validator singleton"""
    global _order_validator
    if _order_validator is None:
        _order_validator = OrderValidationService()
    return _order_validator


def get_order_preparation_service() -> OrderPreparationService:
    """Order preparation service singleton"""
    global _order_preparation_service
    if _order_preparation_service is None:
        _order_preparation_service = OrderPreparationService()
    return _order_preparation_service
