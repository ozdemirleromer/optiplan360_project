"""
Phase 3 Sipariş: Teklif Fişinden Siparişe Dönüşüm Akışı
Teklif fişi verilerini sipariş formatına dönüştürme servisi
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class ConversionStatus(Enum):
    """Dönüşüm durumları"""
    SUCCESS = "success"
    VALIDATION_ERROR = "validation_error"
    MAPPING_ERROR = "mapping_error"
    BUSINESS_RULE_ERROR = "business_rule_error"
    PARTIAL_SUCCESS = "partial_success"


class TeklifFieldType(Enum):
    """Teklif fişi alan tipleri"""
    TEKLIF_NO = "teklif_no"
    MUSTERI_KODU = "musteri_kodu"
    STOK_KODU = "stok_kodu"
    MIKTAR = "miktar"
    BIRIM = "birim"
    BIRIM_FIYAT = "birim_fiyat"
    TOPLAM_TUTAR = "toplam_tutar"
    PARA_BIRIMI = "para_birimi"
    VADE = "vade"
    ACIKLAMA = "aciklama"


class SiparisFieldType(Enum):
    """Sipariş alan tipleri"""
    SIPARIS_NO = "siparis_no"
    CARI_KODU = "cari_kodu"
    STOK_KODU = "stok_kodu"
    MIKTAR = "miktar"
    BIRIM = "birim"
    FIYAT = "fiyat"
    TOPLAM_TUTAR = "toplam_tutar"
    PARA_BIRIMI = "para_birimi"
    TERMIN = "termin"
    SIPARIS_TARIHI = "siparis_tarihi"
    TESLIM_TARIHI = "teslim_tarihi"
    ACIKLAMA = "aciklama"


@dataclass
class ConversionResult:
    """Dönüşüm sonucu"""
    status: ConversionStatus
    teklif_no: str
    siparis_no: Optional[str] = None
    converted_data: Optional[Dict[str, Any]] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    business_rules_applied: List[str] = field(default_factory=list)


class TeklifToSiparisConverter:
    """Teklif fişinden siparişe dönüşüm servisi"""
    
    # Phase 3 İş Kuralları
    BUSINESS_RULES = {
        "miktar_validation": {
            "min": 0.001,
            "max": 999999.999,
            "required": True
        },
        "fiyat_validation": {
            "min": 0.01,
            "max": 999999.99,
            "required": True
        },
        "termin_mapping": {
            "net": "NET",
            "havale": "HAVALE",
            "kapida": "KAPIDA",
            "vade_farkli": "VADE_FARKLI"
        },
        "siparis_no_generation": {
            "prefix": "SPR",
            "date_format": "%Y%m%d",
            "sequence_start": 1
        }
    }
    
    def __init__(self):
        self.conversion_count = 0
        self.last_conversion_date = None
    
    def convert_teklif_to_siparis(self, teklif_data: Dict[str, Any]) -> ConversionResult:
        """
        Teklif fişini sipariş formatına dönüştür
        
        Args:
            teklif_data: Teklif fişi verisi
            
        Returns:
            ConversionResult: Dönüşüm sonucu
        """
        self.conversion_count += 1
        self.last_conversion_date = datetime.now(timezone.utc)
        
        teklif_no = teklif_data.get(TeklifFieldType.TEKLIF_NO.value, "")
        
        # Validasyon kontrolleri
        validation_result = self._validate_teklif_data(teklif_data)
        if validation_result["status"] == "error":
            return ConversionResult(
                status=ConversionStatus.VALIDATION_ERROR,
                teklif_no=teklif_no,
                errors=validation_result["errors"]
            )
        
        try:
            # Alan mapping
            mapped_data = self._map_teklif_to_siparis_fields(teklif_data)
            
            # İş kurallarını uygula
            business_result = self._apply_business_rules(mapped_data, teklif_data)
            
            if business_result["status"] == "error":
                return ConversionResult(
                    status=ConversionStatus.BUSINESS_RULE_ERROR,
                    teklif_no=teklif_no,
                    errors=business_result["errors"]
                )
            
            # Sipariş numarası üret
            siparis_no = self._generate_siparis_no()
            
            # Final sipariş verisi
            final_siparis_data = {
                SiparisFieldType.SIPARIS_NO.value: siparis_no,
                SiparisFieldType.SIPARIS_TARIHI.value: datetime.now(timezone.utc).isoformat(),
                **business_result["data"]
            }
            
            return ConversionResult(
                status=ConversionStatus.SUCCESS,
                teklif_no=teklif_no,
                siparis_no=siparis_no,
                converted_data=final_siparis_data,
                business_rules_applied=business_result["rules_applied"],
                warnings=business_result["warnings"]
            )
            
        except Exception as e:
            logger.error(f"[TEKLIF_SIPARIS] Conversion failed for {teklif_no}: {e}")
            return ConversionResult(
                status=ConversionStatus.MAPPING_ERROR,
                teklif_no=teklif_no,
                errors=[f"Dönüşüm hatası: {str(e)}"]
            )
    
    def _validate_teklif_data(self, teklif_data: Dict[str, Any]) -> Dict[str, Any]:
        """Teklif verisini validasyon yap"""
        errors = []
        
        # Zorunlu alanlar
        required_fields = [
            TeklifFieldType.TEKLIF_NO,
            TeklifFieldType.MUSTERI_KODU,
            TeklifFieldType.STOK_KODU,
            TeklifFieldType.MIKTAR,
            TeklifFieldType.BIRIM_FIYAT,
            TeklifFieldType.TOPLAM_TUTAR
        ]
        
        for field in required_fields:
            if not teklif_data.get(field.value):
                errors.append(f"Zorunlu alan eksik: {field.value}")
        
        # Miktar validasyonu
        miktar = teklif_data.get(TeklifFieldType.MIKTAR.value, 0)
        try:
            miktar = float(miktar)
            if miktar <= 0:
                errors.append("Miktar 0'dan büyük olmalıdır")
        except (ValueError, TypeError):
            errors.append("Miktar sayısal olmalıdır")
        
        # Fiyat validasyonu
        birim_fiyat = teklif_data.get(TeklifFieldType.BIRIM_FIYAT.value, 0)
        try:
            birim_fiyat = float(birim_fiyat)
            if birim_fiyat <= 0:
                errors.append("Birim fiyat 0'dan büyük olmalıdır")
        except (ValueError, TypeError):
            errors.append("Birim fiyat sayısal olmalıdır")
        
        # Toplam tutar validasyonu
        toplam_tutar = teklif_data.get(TeklifFieldType.TOPLAM_TUTAR.value, 0)
        try:
            toplam_tutar = float(toplam_tutar)
            if toplam_tutar <= 0:
                errors.append("Toplam tutar 0'dan büyük olmalıdır")
        except (ValueError, TypeError):
            errors.append("Toplam tutar sayısal olmalıdır")
        
        return {
            "status": "error" if errors else "success",
            "errors": errors
        }
    
    def _map_teklif_to_siparis_fields(self, teklif_data: Dict[str, Any]) -> Dict[str, Any]:
        """Teklif alanlarını sipariş alanlarına map'le"""
        
        # Direct mapping
        mapped_data = {
            SiparisFieldType.CARI_KODU.value: teklif_data.get(TeklifFieldType.MUSTERI_KODU.value),
            SiparisFieldType.STOK_KODU.value: teklif_data.get(TeklifFieldType.STOK_KODU.value),
            SiparisFieldType.MIKTAR.value: teklif_data.get(TeklifFieldType.MIKTAR.value),
            SiparisFieldType.BIRIM.value: teklif_data.get(TeklifFieldType.BIRIM.value),
            SiparisFieldType.FIYAT.value: teklif_data.get(TeklifFieldType.BIRIM_FIYAT.value),
            SiparisFieldType.TOPLAM_TUTAR.value: teklif_data.get(TeklifFieldType.TOPLAM_TUTAR.value),
            SiparisFieldType.PARA_BIRIMI.value: teklif_data.get(TeklifFieldType.PARA_BIRIMI.value, "TRY"),
            SiparisFieldType.ACIKLAMA.value: teklif_data.get(TeklifFieldType.ACIKLAMA.value, "")
        }
        
        # Vade termin dönüşümü
        vade = teklif_data.get(TeklifFieldType.VADE.value, "")
        if vade:
            termin_mapping = self.BUSINESS_RULES["termin_mapping"]
            mapped_data[SiparisFieldType.TERMIN.value] = termin_mapping.get(vade.lower(), "NET")
        
        return mapped_data
    
    def _apply_business_rules(self, mapped_data: Dict[str, Any], original_data: Dict[str, Any]) -> Dict[str, Any]:
        """İş kurallarını uygula"""
        errors = []
        warnings = []
        rules_applied = []
        
        # Fiyat hesaplama kontrolü (miktar * birim_fiyat = toplam_tutar)
        miktar = mapped_data.get(SiparisFieldType.MIKTAR.value, 0)
        birim_fiyat = mapped_data.get(SiparisFieldType.FIYAT.value, 0)
        toplam_tutar = mapped_data.get(SiparisFieldType.TOPLAM_TUTAR.value, 0)
        
        try:
            calculated_toplam = float(miktar) * float(birim_fiyat)
            if abs(calculated_toplam - float(toplam_tutar)) > 0.01:  # 1 kuruş fark
                warnings.append("Toplam tutar miktar * birim_fiyat ile uyuşmuyor")
                # Toplamı düzelt
                mapped_data[SiparisFieldType.TOPLAM_TUTAR.value] = calculated_toplam
                rules_applied.append("toplam_tutar_correction")
        except (ValueError, TypeError):
            errors.append("Fiyat hesaplama hatası")
        
        # Miktar validasyonu
        miktar_rules = self.BUSINESS_RULES["miktar_validation"]
        try:
            miktar_float = float(miktar)
            if miktar_float < miktar_rules["min"]:
                errors.append(f"Miktar minimum {miktar_rules['min']} olmalıdır")
            elif miktar_float > miktar_rules["max"]:
                errors.append(f"Miktar maksimum {miktar_rules['max']} olabilir")
        except (ValueError, TypeError):
            errors.append("Miktar formatı hatalı")
        
        # Fiyat validasyonu
        fiyat_rules = self.BUSINESS_RULES["fiyat_validation"]
        try:
            fiyat_float = float(birim_fiyat)
            if fiyat_float < fiyat_rules["min"]:
                errors.append(f"Birim fiyat minimum {fiyat_rules['min']} olmalıdır")
            elif fiyat_float > fiyat_rules["max"]:
                errors.append(f"Birim fiyat maksimum {fiyat_rules['max']} olabilir")
        except (ValueError, TypeError):
            errors.append("Birim fiyat formatı hatalı")
        
        # Vade kontrolü
        vade = original_data.get(TeklifFieldType.VADE.value)
        if vade and vade not in self.BUSINESS_RULES["termin_mapping"]:
            warnings.append(f"Bilinmeyen vade tipi: {vade}")
        
        return {
            "status": "error" if errors else "success",
            "data": mapped_data,
            "errors": errors,
            "warnings": warnings,
            "rules_applied": rules_applied
        }
    
    def _generate_siparis_no(self) -> str:
        """Sipariş numarası üret"""
        rules = self.BUSINESS_RULES["siparis_no_generation"]
        
        # Tarih + sequence
        date_str = datetime.now(timezone.utc).strftime(rules["date_format"])
        sequence = rules["sequence_start"] + self.conversion_count
        
        return f"{rules['prefix']}{date_str}-{sequence:03d}"
    
    def get_conversion_stats(self) -> Dict[str, Any]:
        """Dönüşüm istatistiklerini döndür"""
        return {
            "total_conversions": self.conversion_count,
            "last_conversion_date": self.last_conversion_date.isoformat() if self.last_conversion_date else None,
            "business_rules": self.BUSINESS_RULES,
            "supported_fields": {
                "teklif_fields": [field.value for field in TeklifFieldType],
                "siparis_fields": [field.value for field in SiparisFieldType]
            }
        }


class TeklifSiparisPipeline:
    """Teklif sipariş pipeline servisi"""
    
    def __init__(self):
        self.converter = TeklifToSiparisConverter()
    
    def process_batch_conversion(self, teklif_list: List[Dict[str, Any]]) -> List[ConversionResult]:
        """
        Batch dönüşüm yap
        
        Args:
            teklif_list: Teklif listesi
            
        Returns:
            List[ConversionResult]: Dönüşüm sonuçları
        """
        results = []
        
        for teklif_data in teklif_list:
            result = self.converter.convert_teklif_to_siparis(teklif_data)
            results.append(result)
        
        # Batch özeti
        successful = sum(1 for r in results if r.status == ConversionStatus.SUCCESS)
        failed = len(results) - successful
        
        logger.info(f"[TEKLIF_SIPARIS] Batch conversion completed: {successful} successful, {failed} failed")
        
        return results
    
    def get_conversion_dashboard_data(self) -> Dict[str, Any]:
        """Dönüşüm dashboard verisi"""
        return {
            "pipeline_status": "active",
            "conversion_rules": self.converter.get_conversion_stats(),
            "field_mappings": {
                "teklif_no": "siparis_no",
                "musteri_kodu": "cari_kodu",
                "stok_kodu": "stok_kodu",
                "birim_fiyat": "fiyat",
                "toplam_tutar": "toplam_tutar"
            },
            "business_rules": [
                "Miktar x Birim Fiyat = Toplam Tutar",
                "Fiyat ve miktar validasyonu",
                "Vade termin dönüşümü"
            ]
        }


# Global instances
_teklif_converter = None
_teklif_pipeline = None


def get_teklif_converter() -> TeklifToSiparisConverter:
    """Teklif converter singleton"""
    global _teklif_converter
    if _teklif_converter is None:
        _teklif_converter = TeklifToSiparisConverter()
    return _teklif_converter


def get_teklif_pipeline() -> TeklifSiparisPipeline:
    """Teklif pipeline singleton"""
    global _teklif_pipeline
    if _teklif_pipeline is None:
        _teklif_pipeline = TeklifSiparisPipeline()
    return _teklif_pipeline
