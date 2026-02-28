"""
Entegrasyon Ayarları Servisi
Tüm entegrasyon ayarlarını yönetir (Mikro, SMTP, SMS, vb.)
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models import IntegrationSettings, IntegrationTypeEnum
from .base_service import BaseService

logger = logging.getLogger(__name__)


class IntegrationSettingsService(BaseService[IntegrationSettings]):
    """Entegrasyon ayarları yönetim servisi"""

    def __init__(self, db: Session):
        super().__init__(db, IntegrationSettings)

    def get_by_id(self, id: str) -> Optional[IntegrationSettings]:
        """ID ile entegrasyon ayarini getir"""
        try:
            return self.db.query(self.model).filter(self.model.id == id).first()
        except Exception as e:
            self._handle_error("get_by_id", e, id=id)
            raise

    def create(self, data: Dict[str, Any]) -> IntegrationSettings:
        """Yeni entegrasyon ayari olustur"""
        try:
            payload = dict(data)
            payload.setdefault("id", str(uuid.uuid4()))
            instance = self.model(**payload)
            self.db.add(instance)
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("create", e, data=data)
            raise

    def update(self, id: str, data: Dict[str, Any]) -> Optional[IntegrationSettings]:
        """Entegrasyon ayarini guncelle"""
        try:
            instance = self.get_by_id(id)
            if not instance:
                return None

            for key, value in data.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)

            instance.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("update", e, id=id, data=data)
            raise

    def delete(self, id: str) -> bool:
        """Entegrasyon ayarini sil"""
        try:
            instance = self.get_by_id(id)
            if not instance:
                return False

            self.db.delete(instance)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            self._handle_error("delete", e, id=id)
            raise

    def list(self, skip: int = 0, limit: int = 100) -> List[IntegrationSettings]:
        """Entegrasyon ayarlarini listele"""
        try:
            limit = min(limit, 1000)
            skip = max(skip, 0)
            return (
                self.db.query(self.model)
                .order_by(self.model.updated_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        except Exception as e:
            self._handle_error("list", e, skip=skip, limit=limit)
            raise

    def get_settings(
        self, integration_type: IntegrationTypeEnum, category: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Entegrasyon ayarlarını getir

        Args:
            integration_type: MIKRO, SMTP, SMS, vb.
            category: ORDER, INVOICE, STOCK (optional)

        Returns:
            Settings dictionary veya None
        """
        try:
            query = self.db.query(IntegrationSettings).filter_by(integration_type=integration_type)

            if category:
                query = query.filter_by(category=category)

            setting = query.first()

            if setting:
                return {
                    "id": setting.id,
                    "integration_type": setting.integration_type.value,
                    "category": setting.category,
                    "settings": (
                        json.loads(setting.settings)
                        if isinstance(setting.settings, str)
                        else setting.settings
                    ),
                    "is_active": setting.is_active,
                    "auto_sync_enabled": setting.auto_sync_enabled,
                    "sync_interval_minutes": setting.sync_interval_minutes,
                }
            return None

        except Exception as e:
            logger.error(f"Ayar getirme hatası: {e}")
            return None

    def get_all_settings(self) -> Dict[str, Dict[str, Any]]:
        """Tüm entegrasyon ayarlarını getir"""
        try:
            settings = self.db.query(IntegrationSettings).all()

            result = {}
            for setting in settings:
                key = f"{setting.integration_type.value}"
                if setting.category:
                    key += f"_{setting.category}"

                result[key] = {
                    "id": setting.id,
                    "integration_type": setting.integration_type.value,
                    "category": setting.category,
                    "settings": (
                        json.loads(setting.settings)
                        if isinstance(setting.settings, str)
                        else setting.settings
                    ),
                    "is_active": setting.is_active,
                    "auto_sync_enabled": setting.auto_sync_enabled,
                    "sync_interval_minutes": setting.sync_interval_minutes,
                }

            return result

        except Exception as e:
            logger.error(f"Tüm ayarları getirme hatası: {e}")
            return {}

    def update_settings(
        self,
        integration_type: IntegrationTypeEnum,
        category: Optional[str],
        settings: Dict[str, Any],
        is_active: Optional[bool] = None,
        auto_sync: Optional[bool] = None,
        sync_interval: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Entegrasyon ayarlarını güncelle

        Returns:
            {"success": bool, "message": str}
        """
        try:
            query = self.db.query(IntegrationSettings).filter_by(integration_type=integration_type)

            if category:
                query = query.filter_by(category=category)

            existing = query.first()

            if existing:
                # UPDATE
                existing.settings = json.dumps(settings)
                if is_active is not None:
                    existing.is_active = is_active
                if auto_sync is not None:
                    existing.auto_sync_enabled = auto_sync
                if sync_interval is not None:
                    existing.sync_interval_minutes = sync_interval
                existing.updated_at = datetime.utcnow()

                self.db.commit()
                logger.info(f"Ayarlar güncellendi: {integration_type.value}/{category or 'GLOBAL'}")
                return {"success": True, "message": "Ayarlar güncellendi"}
            else:
                # CREATE
                new_setting = IntegrationSettings(
                    id=str(uuid.uuid4()),
                    integration_type=integration_type,
                    category=category,
                    settings=json.dumps(settings),
                    is_active=is_active if is_active is not None else True,
                    auto_sync_enabled=auto_sync if auto_sync is not None else False,
                    sync_interval_minutes=sync_interval or 15,
                )
                self.db.add(new_setting)
                self.db.commit()
                logger.info(
                    f"Yeni ayar oluşturuldu: {integration_type.value}/{category or 'GLOBAL'}"
                )
                return {"success": True, "message": "Ayarlar oluşturuldu"}

        except Exception as e:
            logger.error(f"Ayar güncelleme hatası: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    def toggle_active(
        self, integration_type: IntegrationTypeEnum, category: Optional[str] = None
    ) -> bool:
        """Entegrasyonu aktif/pasif yap"""
        try:
            query = self.db.query(IntegrationSettings).filter_by(integration_type=integration_type)

            if category:
                query = query.filter_by(category=category)

            setting = query.first()
            if setting:
                setting.is_active = not setting.is_active
                setting.updated_at = datetime.utcnow()
                self.db.commit()
                logger.info(
                    f"Entegrasyon {'aktif' if setting.is_active else 'pasif'}: {integration_type.value}/{category or 'GLOBAL'}"
                )
                return setting.is_active

            return False

        except Exception as e:
            logger.error(f"Toggle hatası: {e}")
            self.db.rollback()
            return False

    def is_integration_active(
        self, integration_type: IntegrationTypeEnum, category: Optional[str] = None
    ) -> bool:
        """Entegrasyonun aktif olup olmadığını kontrol et"""
        try:
            query = self.db.query(IntegrationSettings).filter_by(
                integration_type=integration_type, is_active=True
            )

            if category:
                query = query.filter_by(category=category)

            return query.first() is not None

        except Exception as e:
            logger.error(f"Aktiflik kontrolü hatası: {e}")
            return False

    def is_auto_sync_enabled(
        self, integration_type: IntegrationTypeEnum, category: Optional[str] = None
    ) -> bool:
        """Otomatik senkronizasyon aktif mi?"""
        try:
            query = self.db.query(IntegrationSettings).filter_by(
                integration_type=integration_type, is_active=True, auto_sync_enabled=True
            )

            if category:
                query = query.filter_by(category=category)

            return query.first() is not None

        except Exception as e:
            logger.error(f"Auto sync kontrolü hatası: {e}")
            return False

    # ═══════════════════════════════════════════════════════════
    # PRESET GETTER'LAR
    # ═══════════════════════════════════════════════════════════

    def get_mikro_sql_settings(self) -> Optional[Dict[str, Any]]:
        """Mikro SQL genel ayarlarını getir"""
        setting = self.get_settings(IntegrationTypeEnum.MIKRO, category=None)
        if setting and "settings" in setting:
            return setting["settings"]
        return None

    def get_mikro_order_settings(self) -> Optional[Dict[str, Any]]:
        """Mikro sipariş ayarlarını getir"""
        setting = self.get_settings(IntegrationTypeEnum.MIKRO, category="ORDER")
        if setting and "settings" in setting:
            return setting["settings"]
        return None

    def get_smtp_settings(self) -> Optional[Dict[str, Any]]:
        """SMTP ayarlarını getir"""
        setting = self.get_settings(IntegrationTypeEnum.SMTP)
        if setting and "settings" in setting:
            return setting["settings"]
        return None

    def get_sms_settings(self) -> Optional[Dict[str, Any]]:
        """SMS gateway ayarlarını getir"""
        setting = self.get_settings(IntegrationTypeEnum.SMS)
        if setting and "settings" in setting:
            return setting["settings"]
        return None
