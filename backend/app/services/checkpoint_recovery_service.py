"""
OptiPlan 360 - Checkpoint Recovery Service
Kritik Risk R-005 Çözümü: Sistem kapanması sonrası yarım iş recovery

Bu modül:
- Periyodik checkpoint oluşturma
- Sistem kapanması sonrası recovery
- Yarım kalmış işlerin tespiti ve temizliği
- Job scheduler entegrasyonu
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field, asdict
from pathlib import Path
from threading import Lock
import threading

logger = logging.getLogger(__name__)


class CheckpointPhase(Enum):
    """Checkpoint fazları"""
    OCR_PROCESSING = "ocr_processing"
    PHASE_2_CONTROL = "phase_2_control"
    PHASE_3_EDITING = "phase_3_editing"
    EXPORT_PREPARATION = "export_preparation"
    EXPORT_WRITING = "export_writing"
    EXPORT_COMMIT = "export_commit"


class RecoveryStatus(Enum):
    """Recovery durumları"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    MANUAL_INTERVENTION = "manual_intervention"


@dataclass
class JobCheckpoint:
    """İş checkpoint kaydı"""
    checkpoint_id: str
    islem_id: str
    phase: CheckpointPhase
    data_snapshot: Dict[str, Any]  # İş durumunun snapshot'ı
    temp_files: List[str]  # Temp dosya yolları
    created_at: datetime
    expires_at: datetime  # Otomatik temizlik süresi
    recovered_at: Optional[datetime] = None
    recovery_status: RecoveryStatus = RecoveryStatus.PENDING
    recovery_attempts: int = 0
    error_log: List[str] = field(default_factory=list)


@dataclass
class RecoveryJob:
    """Recovery job tanımı"""
    job_id: str
    islem_id: str
    phase: CheckpointPhase
    action: Callable[[str, Dict[str, Any]], bool]  # (islem_id, snapshot) -> success
    priority: int = 1  # 1 = yüksek, 5 = düşük
    max_attempts: int = 3


class CheckpointRecoveryService:
    """
    Checkpoint ve recovery yönetimi.
    
    Akış:
    1. Her faz geçişinde checkpoint oluştur
    2. Sistem kapanması sonrası checkpoint'leri tara
    3. Yarım kalmış işleri tespit et
    4. Recovery job'ları çalıştır
    5. Başarısız işleri manual intervention kuyruğuna al
    """
    
    def __init__(self, checkpoint_dir: str = "./checkpoints"):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self._recovery_jobs: Dict[CheckpointPhase, RecoveryJob] = {}
        self._lock = Lock()
        self._running = False
        self._recovery_thread: Optional[threading.Thread] = None
        
    def register_recovery_job(self, job: RecoveryJob) -> None:
        """
        Faz bazlı recovery job kaydet.
        
        Args:
            job: RecoveryJob tanımı
        """
        with self._lock:
            self._recovery_jobs[job.phase] = job
            logger.info(f"Recovery job kaydedildi: {job.phase.value}")
    
    def create_checkpoint(
        self,
        islem_id: str,
        phase: CheckpointPhase,
        data_snapshot: Dict[str, Any],
        temp_files: List[str] = None,
        ttl_hours: int = 24
    ) -> JobCheckpoint:
        """
        Yeni checkpoint oluştur.
        
        Args:
            islem_id: İş UUID
            phase: Faz (OCR_PROCESSING, EXPORT_WRITING, vb.)
            data_snapshot: İş durumu snapshot'ı
            temp_files: Temp dosya yolları (recovery'de temizlik için)
            ttl_hours: Checkpoint saklama süresi
            
        Returns:
            Checkpoint kaydı
        """
        checkpoint_id = f"{islem_id}_{phase.value}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        
        checkpoint = JobCheckpoint(
            checkpoint_id=checkpoint_id,
            islem_id=islem_id,
            phase=phase,
            data_snapshot=data_snapshot,
            temp_files=temp_files or [],
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        )
        
        self._save_checkpoint(checkpoint)
        
        logger.info(
            f"Checkpoint oluşturuldu: {checkpoint_id}, "
            f"islem={islem_id}, phase={phase.value}"
        )
        
        return checkpoint
    
    def update_checkpoint_progress(
        self,
        checkpoint_id: str,
        progress_data: Dict[str, Any]
    ) -> None:
        """
        Checkpoint'e ilerleme bilgisi ekle.
        (Uzun süren işlemler için)
        """
        checkpoint = self._load_checkpoint(checkpoint_id)
        if not checkpoint:
            return
        
        checkpoint.data_snapshot.update({
            "_progress": progress_data,
            "_updated_at": datetime.now(timezone.utc).isoformat()
        })
        
        self._save_checkpoint(checkpoint)
    
    def complete_checkpoint(self, checkpoint_id: str) -> None:
        """
        Checkpoint'i tamamlandı olarak işaretle.
        (Faz başarıyla tamamlandığında çağrılır)
        """
        checkpoint = self._load_checkpoint(checkpoint_id)
        if not checkpoint:
            return
        
        checkpoint.recovery_status = RecoveryStatus.COMPLETED
        checkpoint.recovered_at = datetime.now(timezone.utc)
        
        self._save_checkpoint(checkpoint)
        
        # Temp dosyaları temizle
        self._cleanup_temp_files(checkpoint.temp_files)
        
        logger.info(f"Checkpoint tamamlandı: {checkpoint_id}")
    
    def scan_for_recovery(self) -> List[JobCheckpoint]:
        """
        Sistem kapanması sonrası yarım kalmış checkpoint'leri tara.
        
        Returns:
            Recovery gereken checkpoint listesi
        """
        incomplete_checkpoints = []
        
        for checkpoint_file in self.checkpoint_dir.glob("*.json"):
            try:
                checkpoint = self._load_checkpoint_from_file(checkpoint_file)
                
                if not checkpoint:
                    continue
                
                # Tamamlanmamış veya failed checkpoint'leri bul
                if checkpoint.recovery_status in [
                    RecoveryStatus.PENDING,
                    RecoveryStatus.FAILED
                ]:
                    # Süresi dolmuş mu kontrol et
                    if datetime.now(timezone.utc) > checkpoint.expires_at:
                        logger.warning(
                            f"Checkpoint süresi doldu: {checkpoint.checkpoint_id}"
                        )
                        continue
                    
                    incomplete_checkpoints.append(checkpoint)
                    
            except Exception as e:
                logger.error(f"Checkpoint parse hatası ({checkpoint_file}): {e}")
        
        # Priority sıralaması (yüksek öncelik önce)
        incomplete_checkpoints.sort(key=lambda c: self._get_priority(c.phase))
        
        logger.info(
            f"Recovery taraması tamamlandı: "
            f"{len(incomplete_checkpoints)} checkpoint bulundu"
        )
        
        return incomplete_checkpoints
    
    def recover_checkpoint(self, checkpoint_id: str) -> bool:
        """
        Tek bir checkpoint'i recover et.
        
        Args:
            checkpoint_id: Checkpoint ID
            
        Returns:
            Recovery başarılı mı
        """
        checkpoint = self._load_checkpoint(checkpoint_id)
        if not checkpoint:
            logger.error(f"Checkpoint bulunamadı: {checkpoint_id}")
            return False
        
        # Recovery job'u bul
        job = self._recovery_jobs.get(checkpoint.phase)
        if not job:
            logger.error(
                f"Recovery job bulunamadı: {checkpoint.phase.value}"
            )
            checkpoint.recovery_status = RecoveryStatus.MANUAL_INTERVENTION
            checkpoint.error_log.append(
                f"{datetime.now(timezone.utc)}: Recovery job tanımlanmamış"
            )
            self._save_checkpoint(checkpoint)
            return False
        
        # Max attempts kontrolü
        if checkpoint.recovery_attempts >= job.max_attempts:
            logger.error(
                f"Max recovery attempts aşıldı: {checkpoint_id}"
            )
            checkpoint.recovery_status = RecoveryStatus.MANUAL_INTERVENTION
            self._save_checkpoint(checkpoint)
            return False
        
        # Recovery dene
        checkpoint.recovery_status = RecoveryStatus.IN_PROGRESS
        checkpoint.recovery_attempts += 1
        self._save_checkpoint(checkpoint)
        
        try:
            logger.info(
                f"Recovery başlatıldı: {checkpoint_id}, "
                f"attempt={checkpoint.recovery_attempts}"
            )
            
            success = job.action(
                checkpoint.islem_id,
                checkpoint.data_snapshot
            )
            
            if success:
                checkpoint.recovery_status = RecoveryStatus.COMPLETED
                checkpoint.recovered_at = datetime.now(timezone.utc)
                self._save_checkpoint(checkpoint)
                
                # Temp dosyaları temizle
                self._cleanup_temp_files(checkpoint.temp_files)
                
                logger.info(f"Recovery başarılı: {checkpoint_id}")
                return True
            else:
                raise Exception("Recovery action failed")
                
        except Exception as e:
            error_msg = f"{datetime.now(timezone.utc)}: {str(e)}"
            checkpoint.error_log.append(error_msg)
            checkpoint.recovery_status = RecoveryStatus.FAILED
            self._save_checkpoint(checkpoint)
            
            logger.error(f"Recovery hatası ({checkpoint_id}): {e}")
            return False
    
    def run_recovery_batch(self, max_parallel: int = 3) -> Dict[str, int]:
        """
        Tüm yarım kalmış checkpoint'leri recover et.
        
        Args:
            max_parallel: Paralel recovery sayısı
            
        Returns:
            İstatistikler
        """
        checkpoints = self.scan_for_recovery()
        
        stats = {
            "total": len(checkpoints),
            "successful": 0,
            "failed": 0,
            "manual_intervention": 0
        }
        
        for checkpoint in checkpoints[:max_parallel]:
            success = self.recover_checkpoint(checkpoint.checkpoint_id)
            
            if success:
                stats["successful"] += 1
            else:
                cp = self._load_checkpoint(checkpoint.checkpoint_id)
                if cp and cp.recovery_status == RecoveryStatus.MANUAL_INTERVENTION:
                    stats["manual_intervention"] += 1
                else:
                    stats["failed"] += 1
        
        logger.info(f"Recovery batch tamamlandı: {stats}")
        return stats
    
    def start_recovery_monitor(self, interval_seconds: int = 60) -> None:
        """
        Arka planda recovery monitörü başlat.
        (Sistem açılışında çağrılır)
        """
        if self._running:
            return
        
        self._running = True
        
        def monitor_loop():
            while self._running:
                try:
                    self.run_recovery_batch()
                except Exception as e:
                    logger.error(f"Recovery monitor hatası: {e}")
                
                # Interval bekle (interruptible)
                for _ in range(interval_seconds):
                    if not self._running:
                        break
                    import time
                    time.sleep(1)
        
        self._recovery_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._recovery_thread.start()
        
        logger.info(f"Recovery monitor başlatıldı: interval={interval_seconds}s")
    
    def stop_recovery_monitor(self) -> None:
        """Recovery monitörünü durdur"""
        self._running = False
        if self._recovery_thread:
            self._recovery_thread.join(timeout=5)
        logger.info("Recovery monitor durduruldu")
    
    def cleanup_old_checkpoints(self, max_age_hours: int = 168) -> int:
        """
        Eski tamamlanmış checkpoint'leri temizle.
        (Cron job: haftada bir çalıştır)
        
        Args:
            max_age_hours: Maksimum yaş (default: 7 gün)
            
        Returns:
            Temizlenen checkpoint sayısı
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        cleaned = 0
        
        for checkpoint_file in self.checkpoint_dir.glob("*.json"):
            try:
                checkpoint = self._load_checkpoint_from_file(checkpoint_file)
                
                if not checkpoint:
                    continue
                
                # Tamamlanmış ve eski mi?
                if (checkpoint.recovery_status == RecoveryStatus.COMPLETED and
                    checkpoint.created_at < cutoff):
                    
                    os.remove(checkpoint_file)
                    cleaned += 1
                    
            except Exception as e:
                logger.error(f"Temizlik hatası ({checkpoint_file}): {e}")
        
        logger.info(f"Eski checkpoint'ler temizlendi: {cleaned}")
        return cleaned
    
    def get_recovery_report(self) -> Dict[str, Any]:
        """Recovery durum raporu"""
        checkpoints = []
        
        for checkpoint_file in self.checkpoint_dir.glob("*.json"):
            cp = self._load_checkpoint_from_file(checkpoint_file)
            if cp:
                checkpoints.append({
                    "id": cp.checkpoint_id,
                    "islem_id": cp.islem_id,
                    "phase": cp.phase.value,
                    "status": cp.recovery_status.value,
                    "attempts": cp.recovery_attempts,
                    "created": cp.created_at.isoformat(),
                    "expires": cp.expires_at.isoformat()
                })
        
        by_status = {}
        for cp in checkpoints:
            status = cp["status"]
            by_status[status] = by_status.get(status, 0) + 1
        
        return {
            "total_checkpoints": len(checkpoints),
            "by_status": by_status,
            "checkpoints": checkpoints
        }
    
    def _save_checkpoint(self, checkpoint: JobCheckpoint) -> None:
        """Checkpoint'i dosyaya kaydet"""
        filepath = self.checkpoint_dir / f"{checkpoint.checkpoint_id}.json"
        
        data = {
            "checkpoint_id": checkpoint.checkpoint_id,
            "islem_id": checkpoint.islem_id,
            "phase": checkpoint.phase.value,
            "data_snapshot": checkpoint.data_snapshot,
            "temp_files": checkpoint.temp_files,
            "created_at": checkpoint.created_at.isoformat(),
            "expires_at": checkpoint.expires_at.isoformat(),
            "recovered_at": checkpoint.recovered_at.isoformat() if checkpoint.recovered_at else None,
            "recovery_status": checkpoint.recovery_status.value,
            "recovery_attempts": checkpoint.recovery_attempts,
            "error_log": checkpoint.error_log
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _load_checkpoint(self, checkpoint_id: str) -> Optional[JobCheckpoint]:
        """Checkpoint ID'den yükle"""
        filepath = self.checkpoint_dir / f"{checkpoint_id}.json"
        return self._load_checkpoint_from_file(filepath)
    
    def _load_checkpoint_from_file(self, filepath: Path) -> Optional[JobCheckpoint]:
        """Dosyadan checkpoint yükle"""
        if not filepath.exists():
            return None
        
        try:
            with open(filepath) as f:
                data = json.load(f)
            
            return JobCheckpoint(
                checkpoint_id=data["checkpoint_id"],
                islem_id=data["islem_id"],
                phase=CheckpointPhase(data["phase"]),
                data_snapshot=data["data_snapshot"],
                temp_files=data["temp_files"],
                created_at=datetime.fromisoformat(data["created_at"]),
                expires_at=datetime.fromisoformat(data["expires_at"]),
                recovered_at=datetime.fromisoformat(data["recovered_at"]) if data["recovered_at"] else None,
                recovery_status=RecoveryStatus(data["recovery_status"]),
                recovery_attempts=data["recovery_attempts"],
                error_log=data.get("error_log", [])
            )
        except Exception as e:
            logger.error(f"Checkpoint yükleme hatası ({filepath}): {e}")
            return None
    
    def _get_priority(self, phase: CheckpointPhase) -> int:
        """Faz önceliği"""
        priorities = {
            CheckpointPhase.EXPORT_COMMIT: 1,  # En kritik
            CheckpointPhase.EXPORT_WRITING: 2,
            CheckpointPhase.EXPORT_PREPARATION: 3,
            CheckpointPhase.PHASE_3_EDITING: 4,
            CheckpointPhase.PHASE_2_CONTROL: 5,
            CheckpointPhase.OCR_PROCESSING: 6,
        }
        return priorities.get(phase, 99)
    
    def _cleanup_temp_files(self, temp_files: List[str]) -> None:
        """Temp dosyalarını temizle"""
        for filepath in temp_files:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                    logger.debug(f"Temp dosya silindi: {filepath}")
            except Exception as e:
                logger.error(f"Temp temizlik hatası ({filepath}): {e}")


class RecoveryJobRegistry:
    """
    Önceden tanımlı recovery job'ları.
    """
    
    @staticmethod
    def create_default_jobs() -> List[RecoveryJob]:
        """Default recovery job'ları oluştur"""
        
        def recover_ocr_processing(islem_id: str, snapshot: Dict) -> bool:
            """OCR processing recovery"""
            logger.info(f"OCR recovery: {islem_id}")
            # OCR işlemini yeniden başlat
            # veya temp dosyaları temizle
            return True
        
        def recover_export_writing(islem_id: str, snapshot: Dict) -> bool:
            """Export writing recovery"""
            logger.info(f"Export writing recovery: {islem_id}")
            # Temp dosyaları temizle
            # İş durumunu "export başarısız" olarak güncelle
            return True
        
        def recover_export_commit(islem_id: str, snapshot: Dict) -> bool:
            """Export commit recovery"""
            logger.info(f"Export commit recovery: {islem_id}")
            # Dosya bütünlüğünü kontrol et
            # Yarım kalmışsa temizle
            return True
        
        return [
            RecoveryJob(
                job_id="ocr_recovery",
                islem_id="*",  # Tüm işler için
                phase=CheckpointPhase.OCR_PROCESSING,
                action=recover_ocr_processing,
                priority=3
            ),
            RecoveryJob(
                job_id="export_writing_recovery",
                islem_id="*",
                phase=CheckpointPhase.EXPORT_WRITING,
                action=recover_export_writing,
                priority=1
            ),
            RecoveryJob(
                job_id="export_commit_recovery",
                islem_id="*",
                phase=CheckpointPhase.EXPORT_COMMIT,
                action=recover_export_commit,
                priority=1
            ),
        ]


# Global servis instance
checkpoint_service = CheckpointRecoveryService()
