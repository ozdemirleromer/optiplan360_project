"""
Phase 4 Export: XLSX Export Backend Blocker Kuralları
XLSX export işlemleri için backend validation ve blocker kuralları
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class ExportStatus(Enum):
    """Export durumları"""
    READY = "ready"
    BLOCKED = "blocked"
    WARNING = "warning"
    ERROR = "error"


class BlockerType(Enum):
    """Blocker tipleri"""
    VALIDATION_ERROR = "validation_error"
    BUSINESS_RULE = "business_rule"
    PERMISSION_DENIED = "permission_denied"
    DATA_INTEGRITY = "data_integrity"
    SYSTEM_LIMIT = "system_limit"


@dataclass
class ExportBlocker:
    """Export blocker"""
    type: BlockerType
    field: str
    message: str
    severity: str  # "critical", "high", "medium", "low"
    suggestion: Optional[str] = None


@dataclass
class ExportValidationResult:
    """Export validasyon sonucu"""
    export_id: str
    status: ExportStatus
    can_export: bool
    blockers: List[ExportBlocker] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)


class XLSXExportValidationService:
    """XLSX Export validasyon servisi"""
    
    # Phase 4 Export Politikası
    EXPORT_RULES = {
        "max_records_per_export": 10000,
        "max_file_size_mb": 50,
        "required_fields": [
            "siparis_no",
            "cari_kodu", 
            "stok_kodu",
            "miktar",
            "fiyat",
            "toplam_tutar"
        ],
        "blocked_statuses": ["HATALI", "IPTAL_EDILDI", "BEKLEMEDE"],
        "data_quality_checks": {
            "miktar_min": 0.001,
            "miktar_max": 999999.999,
            "fiyat_min": 0.01,
            "fiyat_max": 999999.99
        }
    }
    
    def __init__(self):
        self.validation_rules = self.EXPORT_RULES
        self.export_history: List[Dict[str, Any]] = []
    
    def validate_export_request(self, export_data: Dict[str, Any]) -> ExportValidationResult:
        """
        Export isteğini Phase 4 kurallarına göre validasyon yap
        
        Args:
            export_data: Export verisi
            
        Returns:
            ExportValidationResult: Validasyon sonucu
        """
        export_id = export_data.get("export_id", "")
        records = export_data.get("records", [])
        user_id = export_data.get("user_id", "")
        
        blockers = []
        warnings = []
        
        # 1. Kayıt sayısı kontrolü
        record_count = len(records)
        if record_count > self.validation_rules["max_records_per_export"]:
            blockers.append(ExportBlocker(
                type=BlockerType.SYSTEM_LIMIT,
                field="record_count",
                message=f"Export limiti aşıldı: {record_count} > {self.validation_rules['max_records_per_export']}",
                severity="critical",
                suggestion=f"En fazla {self.validation_rules['max_records_per_export']} kayıt export edebilirsiniz"
            ))
        
        # 2. Veri kalitesi kontrolleri
        for idx, record in enumerate(records[:100]):  # İlk 100 kaydı kontrol et
            record_blockers = self._validate_record(record, idx)
            blockers.extend(record_blockers)
        
        # 3. Zorunlu alan kontrolü
        required_fields = self.validation_rules["required_fields"]
        for field in required_fields:
            missing_count = sum(1 for r in records if not r.get(field))
            if missing_count > 0:
                blockers.append(ExportBlocker(
                    type=BlockerType.VALIDATION_ERROR,
                    field=field,
                    message=f"Zorunlu alan eksik: {field} ({missing_count} kayıt)",
                    severity="high",
                    suggestion=f"{field} alanını tüm kayıtlarda doldurun"
                ))
        
        # 4. Durum kontrolü
        blocked_statuses = self.validation_rules["blocked_statuses"]
        blocked_count = sum(1 for r in records if r.get("durum") in blocked_statuses)
        if blocked_count > 0:
            blockers.append(ExportBlocker(
                type=BlockerType.BUSINESS_RULE,
                field="durum",
                message=f"Export bloke durumundaki kayıtlar var: {blocked_count}",
                severity="high",
                suggestion="Bloke durumundaki kayıtları düzeltin"
            ))
        
        # 5. Dosya boyutu tahmini
        estimated_size_mb = self._estimate_file_size(records)
        if estimated_size_mb > self.validation_rules["max_file_size_mb"]:
            blockers.append(ExportBlocker(
                type=BlockerType.SYSTEM_LIMIT,
                field="file_size",
                message=f"Tahmini dosya boyutu çok büyük: {estimated_size_mb:.1f}MB",
                severity="medium",
                suggestion=f"Kayıt sayısını {self.validation_rules['max_file_size_mb']}MB altına düşürün"
            ))
        
        # Sonuç belirle
        critical_blockers = [b for b in blockers if b.severity == "critical"]
        high_blockers = [b for b in blockers if b.severity == "high"]
        
        if critical_blockers:
            status = ExportStatus.ERROR
            can_export = False
        elif high_blockers:
            status = ExportStatus.BLOCKED
            can_export = False
        elif blockers:
            status = ExportStatus.WARNING
            can_export = True
        else:
            status = ExportStatus.READY
            can_export = True
        
        # Özet
        summary = {
            "total_records": record_count,
            "blockers_by_severity": {
                "critical": len(critical_blockers),
                "high": len(high_blockers),
                "medium": len([b for b in blockers if b.severity == "medium"]),
                "low": len([b for b in blockers if b.severity == "low"])
            },
            "estimated_file_size_mb": estimated_size_mb,
            "validation_timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Export history'e ekle
        self._add_to_history(export_id, export_data, status, len(blockers))
        
        return ExportValidationResult(
            export_id=export_id,
            status=status,
            can_export=can_export,
            blockers=blockers,
            warnings=warnings,
            summary=summary
        )
    
    def _validate_record(self, record: Dict[str, Any], index: int) -> List[ExportBlocker]:
        """Tek bir kaydı validasyon yap"""
        blockers = []
        quality_rules = self.validation_rules["data_quality_checks"]
        
        # Miktar validasyonu
        miktar = record.get("miktar")
        if miktar is not None:
            try:
                miktar_float = float(miktar)
                if miktar_float < quality_rules["miktar_min"]:
                    blockers.append(ExportBlocker(
                        type=BlockerType.DATA_INTEGRITY,
                        field="miktar",
                        message=f"Kayıt {index}: Miktar minimum değerden küçük",
                        severity="medium"
                    ))
                elif miktar_float > quality_rules["miktar_max"]:
                    blockers.append(ExportBlocker(
                        type=BlockerType.DATA_INTEGRITY,
                        field="miktar",
                        message=f"Kayıt {index}: Miktar maksimum değerden büyük",
                        severity="medium"
                    ))
            except (ValueError, TypeError):
                blockers.append(ExportBlocker(
                    type=BlockerType.VALIDATION_ERROR,
                    field="miktar",
                    message=f"Kayıt {index}: Miktar sayısal değil",
                    severity="high"
                ))
        
        # Fiyat validasyonu
        fiyat = record.get("fiyat")
        if fiyat is not None:
            try:
                fiyat_float = float(fiyat)
                if fiyat_float < quality_rules["fiyat_min"]:
                    blockers.append(ExportBlocker(
                        type=BlockerType.DATA_INTEGRITY,
                        field="fiyat",
                        message=f"Kayıt {index}: Fiyat minimum değerden küçük",
                        severity="medium"
                    ))
                elif fiyat_float > quality_rules["fiyat_max"]:
                    blockers.append(ExportBlocker(
                        type=BlockerType.DATA_INTEGRITY,
                        field="fiyat",
                        message=f"Kayıt {index}: Fiyat maksimum değerden büyük",
                        severity="medium"
                    ))
            except (ValueError, TypeError):
                blockers.append(ExportBlocker(
                    type=BlockerType.VALIDATION_ERROR,
                    field="fiyat",
                    message=f"Kayıt {index}: Fiyat sayısal değil",
                    severity="high"
                ))
        
        return blockers
    
    def _estimate_file_size(self, records: List[Dict[str, Any]]) -> float:
        """Dosya boyutunu tahmin et"""
        if not records:
            return 0.0
        
        # Ortalama kayıt boyutu (bytes)
        sample_record = str(records[0])
        avg_record_size = len(sample_record.encode('utf-8'))
        
        # XLSX overhead (header, metadata, etc.)
        overhead_kb = 100  # Tahmini 100KB
        
        total_bytes = (len(records) * avg_record_size) + (overhead_kb * 1024)
        return total_bytes / (1024 * 1024)  # MB
    
    def _add_to_history(self, export_id: str, export_data: Dict[str, Any], 
                       status: ExportStatus, blocker_count: int):
        """Export history'e ekle"""
        history_entry = {
            "export_id": export_id,
            "user_id": export_data.get("user_id"),
            "record_count": len(export_data.get("records", [])),
            "status": status.value,
            "blocker_count": blocker_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self.export_history.append(history_entry)
        
        # Son 1000 kaydı tut
        if len(self.export_history) > 1000:
            self.export_history = self.export_history[-1000:]
    
    def get_export_rules_summary(self) -> Dict[str, Any]:
        """Export kuralları özetini döndür"""
        return {
            "phase": "phase_4_export",
            "rules": self.validation_rules,
            "blocker_types": [bt.value for bt in BlockerType],
            "export_statuses": [es.value for es in ExportStatus],
            "description": "Phase 4 XLSX Export validation ve blocker kuralları"
        }
    
    def get_export_statistics(self) -> Dict[str, Any]:
        """Export istatistiklerini döndür"""
        if not self.export_history:
            return {"message": "Henüz export geçmişi bulunmuyor"}
        
        total_exports = len(self.export_history)
        successful_exports = sum(1 for h in self.export_history if h["status"] == ExportStatus.READY.value)
        blocked_exports = sum(1 for h in self.export_history if h["status"] in [ExportStatus.BLOCKED.value, ExportStatus.ERROR.value])
        
        return {
            "total_exports": total_exports,
            "successful_exports": successful_exports,
            "blocked_exports": blocked_exports,
            "success_rate": (successful_exports / total_exports * 100) if total_exports > 0 else 0,
            "total_records_exported": sum(h["record_count"] for h in self.export_history),
            "average_records_per_export": sum(h["record_count"] for h in self.export_history) / total_exports if total_exports > 0 else 0
        }


class XLSXExportService:
    """XLSX Export servisi"""
    
    def __init__(self):
        self.validator = XLSXExportValidationService()
    
    def prepare_export(self, export_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Export için veriyi hazırla
        
        Args:
            export_data: Export verisi
            
        Returns:
            Dict: Hazırlanmış export verisi
        """
        # Validasyon yap
        validation_result = self.validator.validate_export_request(export_data)
        
        if not validation_result.can_export:
            return {
                "success": False,
                "blocked": True,
                "export_id": export_data.get("export_id"),
                "validation_result": validation_result,
                "message": "Export bloke edildi - validasyon hataları var"
            }
        
        # Veriyi hazırla
        prepared_data = {
            "export_id": export_data.get("export_id"),
            "records": export_data.get("records", []),
            "validation_passed": True,
            "validation_summary": validation_result.summary,
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "ready_for_export"
        }
        
        return {
            "success": True,
            "prepared_data": prepared_data,
            "validation_summary": validation_result.summary
        }
    
    def get_export_dashboard_data(self) -> Dict[str, Any]:
        """Export dashboard verisi"""
        return {
            "validation_rules": self.validator.get_export_rules_summary(),
            "statistics": self.validator.get_export_statistics(),
            "blocker_categories": {
                "validation_error": "Veri formatı veya zorunlu alan hataları",
                "business_rule": "İş kurallarına uymayan durumlar",
                "permission_denied": "Yetki eksiklikleri",
                "data_integrity": "Veri tutarsızlıkları",
                "system_limit": "Sistem limitlerini aşan durumlar"
            }
        }


# Global instances
_export_validator = None
_export_service = None


def get_export_validator() -> XLSXExportValidationService:
    """Export validator singleton"""
    global _export_validator
    if _export_validator is None:
        _export_validator = XLSXExportValidationService()
    return _export_validator


def get_export_service() -> XLSXExportService:
    """Export service singleton"""
    global _export_service
    if _export_service is None:
        _export_service = XLSXExportService()
    return _export_service
