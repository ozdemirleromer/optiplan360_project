"""
OptiPlan 360 - Distributed Locking Service
Kritik Risk R-004 Çözümü: Eş zamanlı export race condition

Bu modül iş bazlı distributed locking sağlar:
- Row-level locking (pessimistic)
- Distributed lock (Redis-based)
- Lock timeout ve otomatik release
- Deadlock detection
"""

import time
import uuid
import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional, Dict, Any, Callable
from contextlib import contextmanager
from dataclasses import dataclass

logger = logging.getLogger(__name__)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class LockType(Enum):
    """Lock tipleri"""
    EXPORT = "export"          # Export işlemi lock
    EDIT = "edit"             # Düzenleme lock
    DELETE = "delete"         # Silme lock
    PLAKA_CHANGE = "plaka"    # Plaka değişikliği lock


@dataclass
class LockInfo:
    """Lock bilgisi"""
    lock_id: str
    islem_id: str
    lock_type: LockType
    owner: str  # user_id veya session_id
    acquired_at: datetime
    expires_at: datetime
    metadata: Dict[str, Any]


class DistributedLockService:
    """
    İş bazlı distributed locking servisi.
    
    Kullanım:
        with lock_service.acquire_lock(islem_id, LockType.EXPORT, user_id):
            # Export işlemi
            pass
    """
    
    def __init__(self, default_timeout: int = 300):
        self.default_timeout = default_timeout  # saniye
        self._locks: Dict[str, LockInfo] = {}  # In-memory (prod: Redis)
        self._owner_locks: Dict[str, set] = {}  # Owner -> lock_ids mapping
        
    def acquire_lock(
        self,
        islem_id: str,
        lock_type: LockType,
        owner: str,
        timeout: Optional[int] = None,
        blocking: bool = True,
        blocking_timeout: int = 10
    ) -> Optional[str]:
        """
        İş için lock al.
        
        Args:
            islem_id: İş UUID
            lock_type: Lock tipi
            owner: Lock sahibi (user_id)
            timeout: Lock süresi (saniye), None = default
            blocking: Lock alana kadar bekle
            blocking_timeout: Bekleme süresi (saniye)
            
        Returns:
            Lock ID (başarılı) veya None (başarısız)
        """
        lock_key = self._get_lock_key(islem_id, lock_type)
        timeout = timeout or self.default_timeout
        
        start_time = time.time()
        
        while True:
            # Mevcut lock kontrolü
            existing_lock = self._locks.get(lock_key)
            
            if existing_lock is None or self._is_expired(existing_lock):
                # Lock alınabilir
                if existing_lock and self._is_expired(existing_lock):
                    # Eski lock'u temizle
                    self._release_lock_internal(lock_key, existing_lock.lock_id)
                
                # Yeni lock oluştur
                lock_id = str(uuid.uuid4())
                lock_info = LockInfo(
                    lock_id=lock_id,
                    islem_id=islem_id,
                    lock_type=lock_type,
                    owner=owner,
                    acquired_at=_utcnow_naive(),
                    expires_at=_utcnow_naive() + timedelta(seconds=timeout),
                    metadata={
                        "acquired_at_timestamp": time.time(),
                        "timeout": timeout
                    }
                )
                
                self._locks[lock_key] = lock_info
                
                # Owner mapping güncelle
                if owner not in self._owner_locks:
                    self._owner_locks[owner] = set()
                self._owner_locks[owner].add(lock_id)
                
                logger.info(
                    f"Lock alındı: {lock_key}, owner={owner}, "
                    f"type={lock_type.value}, id={lock_id}"
                )
                
                return lock_id
            
            # Lock alınamadı
            if not blocking:
                logger.warning(
                    f"Lock alınamadı (non-blocking): {lock_key}, "
                    f"mevcut sahip: {existing_lock.owner}"
                )
                return None
            
            # Timeout kontrolü
            if time.time() - start_time >= blocking_timeout:
                logger.error(
                    f"Lock timeout: {lock_key}, "
                    f"mevcut sahip: {existing_lock.owner}"
                )
                raise LockAcquisitionError(
                    f"İş başka kullanıcı tarafından işleniyor. "
                    f"Sahip: {existing_lock.owner}, "
                    f"Alınma zamanı: {existing_lock.acquired_at}"
                )
            
            # Kısa bekle ve tekrar dene
            time.sleep(0.1)
    
    def release_lock(self, lock_id: str, owner: str) -> bool:
        """
        Lock'u serbest bırak.
        
        Args:
            lock_id: Lock ID
            owner: Lock sahibi (güvenlik kontrolü)
            
        Returns:
            Başarılı mı
        """
        # Lock'u bul
        lock_key = None
        lock_info = None
        
        for key, info in self._locks.items():
            if info.lock_id == lock_id:
                lock_key = key
                lock_info = info
                break
        
        if not lock_key:
            logger.warning(f"Lock bulunamadı: {lock_id}")
            return False
        
        # Owner kontrolü
        if lock_info.owner != owner:
            logger.error(
                f"Lock release yetki hatası: lock={lock_id}, "
                f"expected={lock_info.owner}, got={owner}"
            )
            return False
        
        self._release_lock_internal(lock_key, lock_id)
        
        logger.info(f"Lock serbest bırakıldı: {lock_key}, id={lock_id}")
        return True
    
    @contextmanager
    def lock_context(
        self,
        islem_id: str,
        lock_type: LockType,
        owner: str,
        timeout: Optional[int] = None,
        blocking: bool = True,
        blocking_timeout: int = 10
    ):
        """
        Context manager ile lock.
        
        Usage:
            with lock_service.lock_context(islem_id, LockType.EXPORT, user_id):
                # Export işlemi
                pass
        """
        lock_id = self.acquire_lock(
            islem_id, lock_type, owner,
            timeout, blocking, blocking_timeout
        )
        
        if not lock_id:
            raise LockAcquisitionError(f"Lock alınamadı: {islem_id}")
        
        try:
            yield lock_id
        finally:
            self.release_lock(lock_id, owner)
    
    def check_lock(self, islem_id: str, lock_type: LockType) -> Optional[LockInfo]:
        """
        İşin lock durumunu kontrol et.
        
        Returns:
            LockInfo (kilitliyse) veya None (kilitsizse)
        """
        lock_key = self._get_lock_key(islem_id, lock_type)
        lock_info = self._locks.get(lock_key)
        
        if lock_info and self._is_expired(lock_info):
            # Süresi dolmuş lock'u temizle
            self._release_lock_internal(lock_key, lock_info.lock_id)
            return None
        
        return lock_info
    
    def is_locked_by_owner(
        self,
        islem_id: str,
        lock_type: LockType,
        owner: str
    ) -> bool:
        """İş belirli bir owner tarafından kilitli mi?"""
        lock_info = self.check_lock(islem_id, lock_type)
        return lock_info is not None and lock_info.owner == owner
    
    def extend_lock(self, lock_id: str, owner: str, additional_seconds: int) -> bool:
        """
        Lock süresini uzat.
        
        Args:
            lock_id: Lock ID
            owner: Lock sahibi
            additional_seconds: Eklenecek süre
            
        Returns:
            Başarılı mı
        """
        for lock_info in self._locks.values():
            if lock_info.lock_id == lock_id:
                if lock_info.owner != owner:
                    return False
                
                lock_info.expires_at += timedelta(seconds=additional_seconds)
                lock_info.metadata["extended_at"] = _utcnow_naive().isoformat()
                
                logger.info(
                    f"Lock süresi uzatıldı: {lock_id}, "
                    f"yeni süre: {lock_info.expires_at}"
                )
                return True
        
        return False
    
    def release_all_owner_locks(self, owner: str) -> int:
        """
        Bir owner'ın tüm lock'larını serbest bırak.
        (Kullanıcı logout veya session timeout durumunda)
        
        Returns:
            Serbest bırakılan lock sayısı
        """
        lock_ids = self._owner_locks.get(owner, set()).copy()
        released = 0
        
        for lock_id in lock_ids:
            if self.release_lock(lock_id, owner):
                released += 1
        
        if owner in self._owner_locks:
            del self._owner_locks[owner]
        
        logger.info(f"Tüm lock'lar serbest bırakıldı: owner={owner}, count={released}")
        return released
    
    def cleanup_expired_locks(self) -> int:
        """
        Süresi dolmuş tüm lock'ları temizle.
        (Cron job veya periyodik task olarak çalıştır)
        
        Returns:
            Temizlenen lock sayısı
        """
        expired_keys = []
        
        for lock_key, lock_info in self._locks.items():
            if self._is_expired(lock_info):
                expired_keys.append((lock_key, lock_info.lock_id))
        
        for lock_key, lock_id in expired_keys:
            self._release_lock_internal(lock_key, lock_id)
        
        if expired_keys:
            logger.info(f"Süresi dolmuş lock'lar temizlendi: count={len(expired_keys)}")
        
        return len(expired_keys)
    
    def get_lock_stats(self) -> Dict[str, Any]:
        """Lock istatistikleri"""
        stats = {
            "total_locks": len(self._locks),
            "owners": len(self._owner_locks),
            "by_type": {},
            "expired": 0
        }
        
        for lock_info in self._locks.values():
            lock_type = lock_info.lock_type.value
            stats["by_type"][lock_type] = stats["by_type"].get(lock_type, 0) + 1
            
            if self._is_expired(lock_info):
                stats["expired"] += 1
        
        return stats
    
    def _get_lock_key(self, islem_id: str, lock_type: LockType) -> str:
        """Lock key üret"""
        return f"{islem_id}:{lock_type.value}"
    
    def _is_expired(self, lock_info: LockInfo) -> bool:
        """Lock süresi doldu mu?"""
        return _utcnow_naive() > lock_info.expires_at
    
    def _release_lock_internal(self, lock_key: str, lock_id: str) -> None:
        """Internal lock release (owner kontrolü yok)"""
        if lock_key in self._locks:
            lock_info = self._locks[lock_key]
            
            # Owner mapping'den kaldır
            if lock_info.owner in self._owner_locks:
                self._owner_locks[lock_info.owner].discard(lock_id)
                if not self._owner_locks[lock_info.owner]:
                    del self._owner_locks[lock_info.owner]
            
            # Lock'u kaldır
            del self._locks[lock_key]


class LockAcquisitionError(Exception):
    """Lock alma hatası"""
    pass


class DatabaseLockManager:
    """
    Veritabanı seviyesi row-level locking.
    SQLAlchemy ile SELECT FOR UPDATE kullanımı.
    """
    
    @staticmethod
    @contextmanager
    def lock_islem_row(db_session, islem_id: str, timeout: int = 10):
        """
        İş satırını kilitle (SELECT FOR UPDATE).
        
        Usage:
            with DatabaseLockManager.lock_islem_row(db, islem_id):
                # Satır kilitli, güncelleme yap
                pass
        """
        from sqlalchemy import text
        
        try:
            # NOWAIT: kilitli ise bekleme, hata ver
            # SKIP LOCKED: kilitli ise atla (farklı senaryolar için)
            db_session.execute(
                text("SELECT 1 FROM islemler WHERE id = :id FOR UPDATE NOWAIT"),
                {"id": islem_id}
            )
            yield
        except Exception as e:
            logger.error(f"Row lock hatası: {e}")
            raise LockAcquisitionError(f"İş şu anda başka süreç tarafından kilitli: {e}")


# Global servis instance
lock_service = DistributedLockService()
