"""
Phase 4 Export: Export Sonuçları Durum Yönetimi
Export sonuçlarının BASARILI/KISMI_BASARILI/HATALI durum yönetimi
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class ExportResultStatus(Enum):
    """Export sonuç durumları"""
    BASARILI = "BASARILI"
    KISMI_BASARILI = "KISMI_BASARILI"
    HATALI = "HATALI"
    BEKLEMEDE = "BEKLEMEDE"
    IPTAL_EDILDI = "IPTAL_EDILDI"


class ExportPhase(Enum):
    """Export aşamaları"""
    VALIDATION = "validation"
    PREPARATION = "preparation"
    PROCESSING = "processing"
    FILE_GENERATION = "file_generation"
    UPLOAD = "upload"
    COMPLETED = "completed"


@dataclass
class ExportRecord:
    """Export kaydı"""
    export_id: str
    record_id: str
    status: ExportResultStatus
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None
    retry_count: int = 0


@dataclass
class ExportSummary:
    """Export özeti"""
    export_id: str
    total_records: int
    successful_records: int
    partial_successful_records: int
    failed_records: int
    overall_status: ExportResultStatus
    processing_time_seconds: Optional[float] = None
    file_path: Optional[str] = None
    file_size_mb: Optional[float] = None
    error_summary: Dict[str, int] = field(default_factory=dict)


class ExportResultManager:
    """Export sonuç yönetim servisi"""
    
    # Phase 4 Durum Politikası
    STATUS_RULES = {
        "success_threshold": 0.95,      # %95+ = BASARILI
        "partial_threshold": 0.70,      # %70-95 = KISMI_BASARILI
        "failure_threshold": 0.70,      # <70% = HATALI
        "max_retries": 3,
        "retry_delay_seconds": 60
    }
    
    def __init__(self):
        self.export_records: Dict[str, List[ExportRecord]] = {}
        self.export_summaries: Dict[str, ExportSummary] = {}
        self.error_patterns: Dict[str, int] = {}
    
    def create_export_session(self, export_id: str, total_records: int) -> ExportSummary:
        """
        Yeni export oturumu oluştur
        
        Args:
            export_id: Export ID
            total_records: Toplam kayıt sayısı
            
        Returns:
            ExportSummary: Export özeti
        """
        summary = ExportSummary(
            export_id=export_id,
            total_records=total_records,
            successful_records=0,
            partial_successful_records=0,
            failed_records=0,
            overall_status=ExportResultStatus.BEKLEMEDE
        )
        
        self.export_summaries[export_id] = summary
        self.export_records[export_id] = []
        
        logger.info(f"[EXPORT_RESULT] Export session created: {export_id}, records: {total_records}")
        
        return summary
    
    def update_record_status(self, export_id: str, record_id: str, 
                           status: ExportResultStatus, error_message: Optional[str] = None) -> bool:
        """
        Tek bir kaydın durumunu güncelle
        
        Args:
            export_id: Export ID
            record_id: Kayıt ID
            status: Yeni durum
            error_message: Hata mesajı
            
        Returns:
            bool: Başarılı mı
        """
        if export_id not in self.export_records:
            logger.error(f"[EXPORT_RESULT] Export session not found: {export_id}")
            return False
        
        # Mevcut kaydı bul veya oluştur
        existing_record = None
        for record in self.export_records[export_id]:
            if record.record_id == record_id:
                existing_record = record
                break
        
        if existing_record:
            existing_record.status = status
            existing_record.error_message = error_message
            existing_record.processed_at = datetime.utcnow()
        else:
            new_record = ExportRecord(
                export_id=export_id,
                record_id=record_id,
                status=status,
                error_message=error_message,
                processed_at=datetime.utcnow()
            )
            self.export_records[export_id].append(new_record)
        
        # Error pattern kaydet
        if status == ExportResultStatus.HATALI and error_message:
            self.error_patterns[error_message] = self.error_patterns.get(error_message, 0) + 1
        
        # Özeti güncelle
        self._update_export_summary(export_id)
        
        return True
    
    def complete_export(self, export_id: str, file_path: Optional[str] = None) -> ExportSummary:
        """
        Export işlemini tamamla ve overall status belirle
        
        Args:
            export_id: Export ID
            file_path: Oluşturulan dosya yolu
            
        Returns:
            ExportSummary: Nihai export özeti
        """
        if export_id not in self.export_summaries:
            raise ValueError(f"Export session not found: {export_id}")
        
        summary = self.export_summaries[export_id]
        
        # Overall status belirle
        if summary.total_records == 0:
            overall_status = ExportResultStatus.HATALI
        else:
            success_rate = summary.successful_records / summary.total_records
            
            if success_rate >= self.STATUS_RULES["success_threshold"]:
                overall_status = ExportResultStatus.BASARILI
            elif success_rate >= self.STATUS_RULES["partial_threshold"]:
                overall_status = ExportResultStatus.KISMI_BASARILI
            else:
                overall_status = ExportResultStatus.HATALI
        
        summary.overall_status = overall_status
        
        # Dosya bilgileri
        if file_path:
            summary.file_path = file_path
            try:
                import os
                if os.path.exists(file_path):
                    summary.file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            except Exception as e:
                logger.warning(f"[EXPORT_RESULT] Could not get file size: {e}")
        
        logger.info(f"[EXPORT_RESULT] Export completed: {export_id}, status: {overall_status.value}")
        
        return summary
    
    def _update_export_summary(self, export_id: str):
        """Export özetini güncelle"""
        if export_id not in self.export_records:
            return
        
        records = self.export_records[export_id]
        summary = self.export_summaries[export_id]
        
        # Sayımları güncelle
        summary.successful_records = sum(1 for r in records if r.status == ExportResultStatus.BASARILI)
        summary.partial_successful_records = sum(1 for r in records if r.status == ExportResultStatus.KISMI_BASARILI)
        summary.failed_records = sum(1 for r in records if r.status == ExportResultStatus.HATALI)
        
        # Error özetini güncelle
        error_summary = {}
        for record in records:
            if record.status == ExportResultStatus.HATALI and record.error_message:
                error_type = self._categorize_error(record.error_message)
                error_summary[error_type] = error_summary.get(error_type, 0) + 1
        
        summary.error_summary = error_summary
    
    def _categorize_error(self, error_message: str) -> str:
        """Hata mesajını kategorize et"""
        error_message = error_message.lower()
        
        if "validation" in error_message or "validasyon" in error_message:
            return "validation_error"
        elif "permission" in error_message or "yetki" in error_message:
            return "permission_error"
        elif "connection" in error_message or "bağlantı" in error_message:
            return "connection_error"
        elif "timeout" in error_message or "zaman aşımı" in error_message:
            return "timeout_error"
        elif "memory" in error_message or "bellek" in error_message:
            return "memory_error"
        else:
            return "other_error"
    
    def get_failed_records(self, export_id: str) -> List[ExportRecord]:
        """Başarısız kayıtları döndür"""
        if export_id not in self.export_records:
            return []
        
        return [r for r in self.export_records[export_id] if r.status == ExportResultStatus.HATALI]
    
    def retry_failed_records(self, export_id: str, max_retries: Optional[int] = None) -> Dict[str, Any]:
        """
        Başarısız kayıtları yeniden dene
        
        Args:
            export_id: Export ID
            max_retries: Maksimum deneme sayısı
            
        Returns:
            Dict: Retry sonucu
        """
        if export_id not in self.export_records:
            return {"success": False, "error": "Export session not found"}
        
        failed_records = self.get_failed_records(export_id)
        max_retries = max_retries or self.STATUS_RULES["max_retries"]
        
        retry_candidates = []
        for record in failed_records:
            if record.retry_count < max_retries:
                retry_candidates.append(record)
        
        if not retry_candidates:
            return {"success": True, "message": "No records to retry", "retry_count": 0}
        
        # Retry işlemini simüle et (gerçek implementasyon async olmalı)
        retried_count = 0
        for record in retry_candidates:
            record.retry_count += 1
            # Burada retry logic olmalı
            retried_count += 1
        
        logger.info(f"[EXPORT_RESULT] Retried {retried_count} records for export: {export_id}")
        
        return {
            "success": True,
            "retry_count": retried_count,
            "remaining_failed": len(failed_records) - retried_count
        }
    
    def get_export_statistics(self) -> Dict[str, Any]:
        """Export istatistiklerini döndür"""
        if not self.export_summaries:
            return {"message": "Henüz export geçmişi bulunmuyor"}
        
        total_exports = len(self.export_summaries)
        successful_exports = sum(1 for s in self.export_summaries.values() 
                                if s.overall_status == ExportResultStatus.BASARILI)
        partial_exports = sum(1 for s in self.export_summaries.values() 
                            if s.overall_status == ExportResultStatus.KISMI_BASARILI)
        failed_exports = sum(1 for s in self.export_summaries.values() 
                           if s.overall_status == ExportResultStatus.HATALI)
        
        return {
            "total_exports": total_exports,
            "successful_exports": successful_exports,
            "partial_successful_exports": partial_exports,
            "failed_exports": failed_exports,
            "success_rate": (successful_exports / total_exports * 100) if total_exports > 0 else 0,
            "total_records_processed": sum(s.total_records for s in self.export_summaries.values()),
            "top_error_patterns": dict(sorted(self.error_patterns.items(), 
                                            key=lambda x: x[1], reverse=True)[:10])
        }
    
    def get_export_dashboard_data(self, export_id: Optional[str] = None) -> Dict[str, Any]:
        """Export dashboard verisi"""
        if export_id and export_id in self.export_summaries:
            summary = self.export_summaries[export_id]
            failed_records = self.get_failed_records(export_id)
            
            return {
                "export_summary": {
                    "export_id": summary.export_id,
                    "total_records": summary.total_records,
                    "successful_records": summary.successful_records,
                    "partial_successful_records": summary.partial_successful_records,
                    "failed_records": summary.failed_records,
                    "overall_status": summary.overall_status.value,
                    "file_size_mb": summary.file_size_mb,
                    "error_summary": summary.error_summary
                },
                "failed_records": [
                    {
                        "record_id": r.record_id,
                        "error_message": r.error_message,
                        "retry_count": r.retry_count
                    }
                    for r in failed_records[:50]  # İlk 50 kayıt
                ]
            }
        
        return {
            "status_rules": self.STATUS_RULES,
            "status_descriptions": {
                "BASARILI": "Tüm kayıtlar başarıyla işlendi (%95+)",
                "KISMI_BASARILI": "Bazı kayıtlar başarısız oldu (%70-95)",
                "HATALI": "Çok sayıda kayıt başarısız oldu (<%70)",
                "BEKLEMEDE": "Export işleniyor",
                "IPTAL_EDILDI": "Export iptal edildi"
            },
            "statistics": self.get_export_statistics()
        }


# Global instance
_export_result_manager = None


def get_export_result_manager() -> ExportResultManager:
    """Export result manager singleton"""
    global _export_result_manager
    if _export_result_manager is None:
        _export_result_manager = ExportResultManager()
    return _export_result_manager
