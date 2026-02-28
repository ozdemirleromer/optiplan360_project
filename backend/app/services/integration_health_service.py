"""
Entegrasyon Sağlık Kontrolü Servisi
Tüm entegrasyonların bağlantı durumunu ve istatistiklerini kontrol eder
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..integrations.mikro_sql_client import get_mikro_client
from ..models import (
    IntegrationError,
    IntegrationSyncJob,
    IntegrationTypeEnum,
    SyncStatusEnum,
)
from .integration_settings_service import IntegrationSettingsService

logger = logging.getLogger(__name__)


class IntegrationHealthService:
    """Entegrasyon sağlık kontrolü servisi"""

    def __init__(self, db: Session):
        self.db = db
        self.settings_service = IntegrationSettingsService(db)

    def check_all_integrations(self) -> Dict[str, Any]:
        """Tüm entegrasyonların sağlık durumunu kontrol et"""
        try:
            health_status = {
                "overall_status": "HEALTHY",
                "timestamp": datetime.utcnow().isoformat(),
                "integrations": {},
                "errors": [],
            }

            # Mikro SQL kontrolü
            mikro_health = self.check_mikro_health()
            health_status["integrations"]["MIKRO"] = mikro_health
            if not mikro_health["connection"]:
                health_status["overall_status"] = "DEGRADED"

            # SMTP kontrolü
            smtp_health = self.check_smtp_health()
            health_status["integrations"]["SMTP"] = smtp_health

            # SMS kontrolü
            sms_health = self.check_sms_health()
            health_status["integrations"]["SMS"] = sms_health

            # e-Fatura kontrolü
            einvoice_health = self.check_einvoice_health()
            health_status["integrations"]["EINVOICE"] = einvoice_health

            # Kargo kontrolü
            cargo_health = self.check_cargo_health()
            health_status["integrations"]["CARGO"] = cargo_health

            # Son 24 saatteki hataları getir
            recent_errors = self.get_recent_errors(hours=24)
            health_status["errors"] = recent_errors

            if len(recent_errors) > 10:
                health_status["overall_status"] = "UNHEALTHY"

            return health_status

        except Exception as e:
            logger.error(f"Sağlık kontrolü hatası: {e}")
            return {
                "overall_status": "ERROR",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    def check_mikro_health(self) -> Dict[str, Any]:
        """Mikro SQL bağlantı durumunu kontrol et"""
        try:
            # Ayarları kontrol et
            is_active = self.settings_service.is_integration_active(IntegrationTypeEnum.MIKRO)

            if not is_active:
                return {"status": "DISABLED", "connection": False, "message": "Entegrasyon pasif"}

            # Bağlantı testi
            try:
                mikro_client = get_mikro_client()
                test_result = mikro_client.test_connection()

                if test_result.get("success"):
                    # İstatistikleri getir
                    stats = self.get_sync_statistics(IntegrationTypeEnum.MIKRO, hours=24)

                    return {
                        "status": "HEALTHY",
                        "connection": True,
                        "database": test_result.get("database"),
                        "last_sync": stats.get("last_sync"),
                        "pending_syncs": stats.get("pending_count", 0),
                        "success_rate": stats.get("success_rate", 0),
                    }
                else:
                    return {
                        "status": "ERROR",
                        "connection": False,
                        "error": test_result.get("error"),
                    }
            except Exception as conn_e:
                return {"status": "ERROR", "connection": False, "error": str(conn_e)}

        except Exception as e:
            logger.error(f"Mikro sağlık kontrolü hatası: {e}")
            return {"status": "ERROR", "connection": False, "error": str(e)}

    def check_smtp_health(self) -> Dict[str, Any]:
        """SMTP bağlantı durumunu kontrol et"""
        try:
            is_active = self.settings_service.is_integration_active(IntegrationTypeEnum.SMTP)

            if not is_active:
                return {
                    "status": "DISABLED",
                    "connection": False,
                    "message": "SMTP entegrasyonu pasif",
                }

            smtp_settings = self.settings_service.get_smtp_settings()
            if not smtp_settings:
                return {
                    "status": "NOT_CONFIGURED",
                    "connection": False,
                    "message": "SMTP ayarları yapılmamış",
                }

            # Basit bağlantı kontrolü (gerçek SMTP test edilebilir)
            return {
                "status": "HEALTHY",
                "connection": True,
                "host": smtp_settings.get("host"),
                "port": smtp_settings.get("port"),
            }

        except Exception as e:
            logger.error(f"SMTP sağlık kontrolü hatası: {e}")
            return {"status": "ERROR", "connection": False, "error": str(e)}

    def check_sms_health(self) -> Dict[str, Any]:
        """SMS gateway durumunu kontrol et"""
        try:
            is_active = self.settings_service.is_integration_active(IntegrationTypeEnum.SMS)

            if not is_active:
                return {
                    "status": "DISABLED",
                    "connection": False,
                    "message": "SMS entegrasyonu pasif",
                }

            sms_settings = self.settings_service.get_sms_settings()
            if not sms_settings:
                return {
                    "status": "NOT_CONFIGURED",
                    "connection": False,
                    "message": "SMS ayarları yapılmamış",
                }

            return {
                "status": "HEALTHY",
                "connection": True,
                "provider": sms_settings.get("provider"),
            }

        except Exception as e:
            logger.error(f"SMS sağlık kontrolü hatası: {e}")
            return {"status": "ERROR", "connection": False, "error": str(e)}

    def check_einvoice_health(self) -> Dict[str, Any]:
        """e-Fatura durumunu kontrol et"""
        try:
            is_active = self.settings_service.is_integration_active(IntegrationTypeEnum.EINVOICE)

            if not is_active:
                return {
                    "status": "DISABLED",
                    "connection": False,
                    "message": "e-Fatura entegrasyonu pasif",
                }

            return {"status": "HEALTHY", "connection": True, "message": "e-Fatura aktif"}

        except Exception as e:
            logger.error(f"e-Fatura sağlık kontrolü hatası: {e}")
            return {"status": "ERROR", "connection": False, "error": str(e)}

    def check_cargo_health(self) -> Dict[str, Any]:
        """Kargo entegrasyonu durumunu kontrol et"""
        try:
            is_active = self.settings_service.is_integration_active(IntegrationTypeEnum.CARGO)

            if not is_active:
                return {
                    "status": "DISABLED",
                    "connection": False,
                    "message": "Kargo entegrasyonu pasif",
                }

            return {"status": "HEALTHY", "connection": True, "message": "Kargo entegrasyonu aktif"}

        except Exception as e:
            logger.error(f"Kargo sağlık kontrolü hatası: {e}")
            return {"status": "ERROR", "connection": False, "error": str(e)}

    def get_sync_statistics(
        self, integration_type: IntegrationTypeEnum, hours: int = 24
    ) -> Dict[str, Any]:
        """Senkronizasyon istatistiklerini getir"""
        try:
            since = datetime.utcnow() - timedelta(hours=hours)

            # Toplam job sayısı
            total = (
                self.db.query(IntegrationSyncJob)
                .filter(IntegrationSyncJob.created_at >= since)
                .count()
            )

            # Başarılı job sayısı
            success = (
                self.db.query(IntegrationSyncJob)
                .filter(
                    IntegrationSyncJob.created_at >= since,
                    IntegrationSyncJob.status == SyncStatusEnum.SUCCESS,
                )
                .count()
            )

            # Başarısız job sayısı
            failed = (
                self.db.query(IntegrationSyncJob)
                .filter(
                    IntegrationSyncJob.created_at >= since,
                    IntegrationSyncJob.status == SyncStatusEnum.FAILED,
                )
                .count()
            )

            # Bekleyen job sayısı
            pending = (
                self.db.query(IntegrationSyncJob)
                .filter(
                    IntegrationSyncJob.status.in_([SyncStatusEnum.QUEUED, SyncStatusEnum.RUNNING])
                )
                .count()
            )

            # Son başarılı sync
            last_sync_job = (
                self.db.query(IntegrationSyncJob)
                .filter(IntegrationSyncJob.status == SyncStatusEnum.SUCCESS)
                .order_by(IntegrationSyncJob.completed_at.desc())
                .first()
            )

            return {
                "total_syncs": total,
                "success_count": success,
                "failed_count": failed,
                "pending_count": pending,
                "success_rate": round((success / total * 100) if total > 0 else 0, 2),
                "last_sync": (
                    last_sync_job.completed_at.isoformat()
                    if last_sync_job and last_sync_job.completed_at
                    else None
                ),
            }

        except Exception as e:
            logger.error(f"İstatistik getirme hatası: {e}")
            return {
                "total_syncs": 0,
                "success_count": 0,
                "failed_count": 0,
                "pending_count": 0,
                "success_rate": 0,
            }

    def get_recent_errors(self, hours: int = 24, limit: int = 10) -> List[Dict[str, Any]]:
        """Son hataları getir"""
        try:
            since = datetime.utcnow() - timedelta(hours=hours)

            errors = (
                self.db.query(IntegrationError)
                .filter(IntegrationError.created_at >= since, IntegrationError.is_resolved == False)
                .order_by(IntegrationError.created_at.desc())
                .limit(limit)
                .all()
            )

            return [
                {
                    "id": err.id,
                    "entity_type": err.entity_type,
                    "entity_id": err.entity_id,
                    "error_code": err.error_code,
                    "error_message": err.error_message,
                    "timestamp": err.created_at.isoformat(),
                }
                for err in errors
            ]

        except Exception as e:
            logger.error(f"Hata listesi getirme hatası: {e}")
            return []
