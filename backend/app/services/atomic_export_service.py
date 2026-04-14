"""
OptiPlan 360 - Atomic Export Transaction Service
Kritik Risk R-001 Çözümü: Export yarım kalma / transaction rollback

Bu modül export işlemlerini atomic transaction mantığıyla yönetir:
- Temp dosya oluşturma
- Başarılı olunca atomic rename
- Hata durumunda rollback (temp temizlik)
- Checkpoint ve recovery desteği
"""

import os
import tempfile
import hashlib
import json
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, List, Any, Callable
from pathlib import Path
from contextlib import contextmanager
import shutil

logger = logging.getLogger(__name__)


class ExportStatus(Enum):
    """Export işlem durumları"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    TEMP_CREATED = "temp_created"
    VALIDATED = "validated"
    COMMITTED = "committed"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


@dataclass
class ExportCheckpoint:
    """Export checkpoint kaydı"""
    checkpoint_id: str
    islem_id: str
    phase: str  # 'prepare', 'write', 'validate', 'commit'
    status: ExportStatus
    temp_path: Optional[str] = None
    final_path: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error_message: Optional[str] = None


@dataclass
class ExportTransaction:
    """Atomic export transaction context"""
    transaction_id: str
    islem_id: str
    temp_dir: str
    target_dir: str
    filename: str
    checkpoints: List[ExportCheckpoint] = field(default_factory=list)
    rollback_actions: List[Callable] = field(default_factory=list)
    status: ExportStatus = ExportStatus.PENDING


class AtomicExportService:
    """
    Atomic export transaction yönetimi.
    
    Akış:
    1. BEGIN: Temp dosya yolu oluştur
    2. WRITE: Veriyi temp dosyaya yaz
    3. VALIDATE: Dosya bütünlüğünü kontrol et
    4. COMMIT: Atomic rename ile final konuma taşı
    5. ROLLBACK (hata durumunda): Temp dosyayı sil
    """
    
    def __init__(self, checkpoint_dir: str = "./export_checkpoints"):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self._active_transactions: Dict[str, ExportTransaction] = {}
        
    def begin_transaction(
        self,
        islem_id: str,
        target_dir: str,
        filename: str
    ) -> ExportTransaction:
        """
        Yeni atomic export transaction başlat.
        
        Args:
            islem_id: İş kaydı UUID
            target_dir: Hedef dizin (örn: /exports/mikro)
            filename: Dosya adı (örn: MUSTERI_18MM_BEYAZ_20260314.xlsx)
            
        Returns:
            ExportTransaction context
        """
        transaction_id = self._generate_transaction_id(islem_id)
        
        # System temp dizini kullan (disk dolu olsa bile genellikle ayrı partition)
        temp_dir = tempfile.gettempdir()
        temp_path = Path(temp_dir) / f"optiplan_export_{transaction_id}"
        
        transaction = ExportTransaction(
            transaction_id=transaction_id,
            islem_id=islem_id,
            temp_dir=str(temp_path),
            target_dir=target_dir,
            filename=filename,
            status=ExportStatus.PENDING
        )
        
        # Checkpoint kaydet
        self._create_checkpoint(transaction, "begin", ExportStatus.PENDING)
        
        self._active_transactions[transaction_id] = transaction
        
        logger.info(
            f"Export transaction başladı: {transaction_id}, "
            f"temp={temp_path}, target={target_dir}/{filename}"
        )
        
        return transaction
    
    @contextmanager
    def transaction_context(
        self,
        islem_id: str,
        target_dir: str,
        filename: str
    ):
        """
        Context manager ile atomic export transaction.
        
        Usage:
            with export_service.transaction_context(
                islem_id="uuid",
                target_dir="/exports",
                filename="test.xlsx"
            ) as tx:
                # Excel dosyasını tx.temp_dir içine yaz
                write_excel(f"{tx.temp_dir}/data.xlsx", data)
                
                # Commit (başarılı olursa final konuma taşınır)
                export_service.commit(tx.transaction_id)
        """
        transaction = self.begin_transaction(islem_id, target_dir, filename)
        
        try:
            yield transaction
            # Context çıkılınca otomatik commit (eğer hata yoksa)
            if transaction.status == ExportStatus.TEMP_CREATED:
                self.commit(transaction.transaction_id)
                
        except Exception as e:
            # Hata durumunda rollback
            logger.error(f"Export transaction hatası: {e}")
            self.rollback(transaction.transaction_id, str(e))
            raise
    
    def write_temp_file(
        self,
        transaction_id: str,
        content: bytes,
        validate_checksum: bool = True
    ) -> str:
        """
        Veriyi temp dosyaya yaz.
        
        Args:
            transaction_id: Transaction ID
            content: Dosya içeriği (bytes)
            validate_checksum: MD5 checksum doğrulama yap
            
        Returns:
            Temp dosya yolu
        """
        tx = self._get_transaction(transaction_id)
        
        temp_file_path = Path(tx.temp_dir) / tx.filename
        temp_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Atomic write: önce .tmp uzantılı yaz, sonra rename
        temp_ext = f"{temp_file_path}.tmp"
        
        try:
            with open(temp_ext, 'wb') as f:
                f.write(content)
            
            # Checksum hesapla
            if validate_checksum:
                checksum = hashlib.md5(content).hexdigest()
                checksum_file = f"{temp_ext}.md5"
                with open(checksum_file, 'w') as f:
                    f.write(checksum)
            
            # Atomic rename
            os.replace(temp_ext, str(temp_file_path))
            
            tx.status = ExportStatus.TEMP_CREATED
            self._create_checkpoint(tx, "write", ExportStatus.TEMP_CREATED, 
                                 temp_path=str(temp_file_path))
            
            logger.info(f"Temp dosya yazıldı: {temp_file_path}")
            return str(temp_file_path)
            
        except Exception as e:
            # Temizlik
            for ext in [temp_ext, f"{temp_ext}.md5"]:
                if os.path.exists(ext):
                    os.remove(ext)
            raise ExportTransactionError(f"Temp dosya yazma hatası: {e}")
    
    def validate_file(
        self,
        transaction_id: str,
        expected_size: Optional[int] = None,
        expected_checksum: Optional[str] = None
    ) -> bool:
        """
        Temp dosya bütünlüğünü doğrula.
        
        Args:
            transaction_id: Transaction ID
            expected_size: Beklenen dosya boyutu (bytes)
            expected_checksum: Beklenen MD5 checksum
            
        Returns:
            Doğrulama başarılı mı
        """
        tx = self._get_transaction(transaction_id)
        temp_file = Path(tx.temp_dir) / tx.filename
        
        if not temp_file.exists():
            raise ExportTransactionError(f"Temp dosya bulunamadı: {temp_file}")
        
        actual_size = temp_file.stat().st_size
        
        # Boyut kontrolü
        if expected_size and actual_size != expected_size:
            raise ExportTransactionError(
                f"Dosya boyutu uyuşmuyor: expected={expected_size}, "
                f"actual={actual_size}"
            )
        
        # Checksum kontrolü
        if expected_checksum:
            actual_checksum = self._calculate_checksum(str(temp_file))
            if actual_checksum != expected_checksum:
                raise ExportTransactionError(
                    f"Checksum uyuşmuyor: expected={expected_checksum}, "
                    f"actual={actual_checksum}"
                )
        
        # Dosya boş mu kontrolü
        if actual_size == 0:
            raise ExportTransactionError("Dosya boş (0 bytes)")
        
        tx.status = ExportStatus.VALIDATED
        self._create_checkpoint(tx, "validate", ExportStatus.VALIDATED)
        
        logger.info(f"Dosya doğrulama başarılı: {temp_file}")
        return True
    
    def commit(self, transaction_id: str) -> str:
        """
        Transaction'ı commit et (atomic rename).
        
        Args:
            transaction_id: Transaction ID
            
        Returns:
            Final dosya yolu
        """
        tx = self._get_transaction(transaction_id)
        
        if tx.status not in [ExportStatus.TEMP_CREATED, ExportStatus.VALIDATED]:
            raise ExportTransactionError(
                f"Commit için geçersiz durum: {tx.status}"
            )
        
        temp_file = Path(tx.temp_dir) / tx.filename
        final_dir = Path(tx.target_dir)
        final_path = final_dir / tx.filename
        
        # Hedef dizin yoksa oluştur
        final_dir.mkdir(parents=True, exist_ok=True)
        
        # Eğer hedefte aynı isimde dosya varsa backup al
        if final_path.exists():
            backup_path = self._create_backup(final_path)
            tx.rollback_actions.append(lambda: self._restore_backup(backup_path, final_path))
        
        try:
            # Atomic rename (POSIX: atomic, Windows: mv önce temp sonra rename)
            # Windows'ta os.replace kullan (atomic rename)
            os.replace(str(temp_file), str(final_path))
            
            tx.status = ExportStatus.COMMITTED
            self._create_checkpoint(tx, "commit", ExportStatus.COMMITTED,
                                   final_path=str(final_path))
            
            # Temp dizini temizle
            self._cleanup_temp(tx.temp_dir)
            
            logger.info(f"Export commit başarılı: {final_path}")
            return str(final_path)
            
        except Exception as e:
            # Rollback trigger
            self.rollback(transaction_id, str(e))
            raise ExportTransactionError(f"Commit hatası: {e}")
    
    def rollback(self, transaction_id: str, error_message: str = "") -> None:
        """
        Transaction'ı rollback et (tüm değişiklikleri geri al).
        
        Args:
            transaction_id: Transaction ID
            error_message: Hata mesajı (opsiyonel)
        """
        tx = self._active_transactions.get(transaction_id)
        if not tx:
            logger.warning(f"Rollback için transaction bulunamadı: {transaction_id}")
            return
        
        try:
            # Temp dosyaları temizle
            self._cleanup_temp(tx.temp_dir)
            
            # Kayıtlı rollback action'ları çalıştır (backup restore vb)
            for action in reversed(tx.rollback_actions):
                try:
                    action()
                except Exception as e:
                    logger.error(f"Rollback action hatası: {e}")
            
            tx.status = ExportStatus.ROLLED_BACK
            self._create_checkpoint(tx, "rollback", ExportStatus.ROLLED_BACK,
                                 error_message=error_message)
            
            logger.info(f"Export rollback tamamlandı: {transaction_id}")
            
        except Exception as e:
            logger.error(f"Rollback hatası: {e}")
        finally:
            # Transaction'ı listeden kaldır
            if transaction_id in self._active_transactions:
                del self._active_transactions[transaction_id]
    
    def recover_interrupted_exports(self) -> List[Dict]:
        """
        Sistem kapanması sonrası yarım kalmış export'ları tespit et ve temizle.
        
        Returns:
            Temizlenen transaction listesi
        """
        recovered = []
        
        # Checkpoint dosyalarını tara
        for checkpoint_file in self.checkpoint_dir.glob("*.json"):
            try:
                with open(checkpoint_file) as f:
                    data = json.load(f)

                # JSON'dan yüklenen alanları doğru tiplere çevir
                if isinstance(data.get("status"), str):
                    data["status"] = ExportStatus(data["status"])
                for dt_field in ("created_at", "updated_at"):
                    if isinstance(data.get(dt_field), str):
                        from datetime import timezone as _tz
                        data[dt_field] = datetime.fromisoformat(data[dt_field])

                checkpoint = ExportCheckpoint(**data)
                
                # Yarım kalmış transaction'ları tespit et
                if checkpoint.status in [ExportStatus.IN_PROGRESS, 
                                        ExportStatus.TEMP_CREATED]:
                    logger.warning(
                        f"Yarım kalmış export bulundu: {checkpoint.checkpoint_id}, "
                        f"durum: {checkpoint.status}"
                    )
                    
                    # Temp dosyaları temizle
                    if checkpoint.temp_path and os.path.exists(checkpoint.temp_path):
                        self._cleanup_temp(os.path.dirname(checkpoint.temp_path))
                    
                    # Checkpoint'i güncelle (failed olarak işaretle)
                    checkpoint.status = ExportStatus.FAILED
                    checkpoint.error_message = "Sistem kapanması nedeniyle yarım kaldı"
                    checkpoint.updated_at = datetime.now(timezone.utc)
                    
                    self._save_checkpoint(checkpoint)
                    
                    recovered.append({
                        "checkpoint_id": checkpoint.checkpoint_id,
                        "islem_id": checkpoint.islem_id,
                        "previous_status": data["status"],
                        "cleaned": True
                    })
                    
            except Exception as e:
                logger.error(f"Checkpoint parse hatası ({checkpoint_file}): {e}")
        
        return recovered
    
    def _generate_transaction_id(self, islem_id: str) -> str:
        """Benzersiz transaction ID üret"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        random_suffix = hashlib.md5(
            f"{islem_id}{timestamp}{os.urandom(8)}".encode()
        ).hexdigest()[:8]
        return f"{timestamp}_{random_suffix}"
    
    def _get_transaction(self, transaction_id: str) -> ExportTransaction:
        """Transaction'ı getir"""
        tx = self._active_transactions.get(transaction_id)
        if not tx:
            raise ExportTransactionError(f"Transaction bulunamadı: {transaction_id}")
        return tx
    
    def _create_checkpoint(
        self,
        tx: ExportTransaction,
        phase: str,
        status: ExportStatus,
        temp_path: Optional[str] = None,
        final_path: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> ExportCheckpoint:
        """Checkpoint kaydet"""
        checkpoint = ExportCheckpoint(
            checkpoint_id=f"{tx.transaction_id}_{phase}",
            islem_id=tx.islem_id,
            phase=phase,
            status=status,
            temp_path=temp_path,
            final_path=final_path,
            error_message=error_message,
            metadata={
                "transaction_id": tx.transaction_id,
                "filename": tx.filename,
                "target_dir": tx.target_dir
            }
        )
        
        tx.checkpoints.append(checkpoint)
        self._save_checkpoint(checkpoint)
        
        return checkpoint
    
    def _save_checkpoint(self, checkpoint: ExportCheckpoint) -> None:
        """Checkpoint'i dosyaya kaydet"""
        filepath = self.checkpoint_dir / f"{checkpoint.checkpoint_id}.json"
        
        data = {
            "checkpoint_id": checkpoint.checkpoint_id,
            "islem_id": checkpoint.islem_id,
            "phase": checkpoint.phase,
            "status": checkpoint.status.value,
            "temp_path": checkpoint.temp_path,
            "final_path": checkpoint.final_path,
            "metadata": checkpoint.metadata,
            "created_at": checkpoint.created_at.isoformat(),
            "updated_at": checkpoint.updated_at.isoformat(),
            "error_message": checkpoint.error_message
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _calculate_checksum(self, filepath: str) -> str:
        """Dosya MD5 checksum hesapla"""
        hash_md5 = hashlib.md5()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def _create_backup(self, filepath: Path) -> Path:
        """Mevcut dosyanın backup'ını al"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        backup_path = filepath.parent / f"{filepath.stem}_backup_{timestamp}{filepath.suffix}"
        shutil.copy2(str(filepath), str(backup_path))
        return backup_path
    
    def _restore_backup(self, backup_path: Path, original_path: Path) -> None:
        """Backup'tan geri yükle"""
        if backup_path.exists():
            shutil.copy2(str(backup_path), str(original_path))
            backup_path.unlink()
    
    def _cleanup_temp(self, temp_dir: str) -> None:
        """Temp dizinini temizle"""
        try:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                logger.debug(f"Temp dizini temizlendi: {temp_dir}")
        except Exception as e:
            logger.error(f"Temp temizlik hatası ({temp_dir}): {e}")


class ExportTransactionError(Exception):
    """Export transaction hata sınıfı"""
    pass


# Global servis instance
atomic_export_service = AtomicExportService()
