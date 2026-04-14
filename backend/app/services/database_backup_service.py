"""
Database Backup ve Restore Otomasyonu
PostgreSQL backup/restore servisi
"""

import os
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class DatabaseBackupService:
    """Database backup ve restore servisi"""
    
    def __init__(self, backup_dir: str = "backups"):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        self.db_url = os.getenv("DATABASE_URL", "")
    
    def create_backup(self, backup_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Database backup oluştur
        
        Args:
            backup_name: Backup dosya adı (opsiyonel)
            
        Returns:
            Dict: Backup sonucu
        """
        try:
            if not backup_name:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_name = f"optiplan360_backup_{timestamp}.sql"
            
            backup_path = self.backup_dir / backup_name
            
            # PostgreSQL için pg_dump kullan
            if self.db_url.startswith("postgresql"):
                result = self._backup_postgres(backup_path)
            else:
                # SQLite için dosya kopyala
                result = self._backup_sqlite(backup_path)
            
            if result["success"]:
                logger.info(f"[BACKUP] Backup created: {backup_path}")
            
            return result
            
        except Exception as e:
            logger.error(f"[BACKUP] Backup failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _backup_postgres(self, backup_path: Path) -> Dict[str, Any]:
        """PostgreSQL backup"""
        try:
            # DATABASE_URL'den bağlantı bilgilerini çıkar
            # postgresql://user:pass@host:port/dbname formatı
            
            cmd = [
                "pg_dump",
                "--format=custom",
                "--file", str(backup_path),
                self.db_url
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 dakika timeout
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "file": str(backup_path),
                    "size_mb": backup_path.stat().st_size / (1024 * 1024)
                }
            else:
                return {
                    "success": False,
                    "error": result.stderr
                }
                
        except FileNotFoundError:
            return {
                "success": False,
                "error": "pg_dump not found. Install PostgreSQL client tools."
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Backup timeout (5 minutes exceeded)"
            }
    
    def _backup_sqlite(self, backup_path: Path) -> Dict[str, Any]:
        """SQLite backup"""
        try:
            # SQLite veritabanı dosyasını kopyala
            import shutil
            
            # SQLite URL: sqlite:///./optiplan.db
            db_file = self.db_url.replace("sqlite:///", "")
            if not db_file.startswith("/"):
                db_file = "./" + db_file
            
            shutil.copy2(db_file, backup_path)
            
            return {
                "success": True,
                "file": str(backup_path),
                "size_mb": backup_path.stat().st_size / (1024 * 1024)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"SQLite backup failed: {str(e)}"
            }
    
    def restore_backup(self, backup_file: str) -> Dict[str, Any]:
        """
        Database restore yap
        
        Args:
            backup_file: Backup dosya adı
            
        Returns:
            Dict: Restore sonucu
        """
        try:
            backup_path = self.backup_dir / backup_file
            
            if not backup_path.exists():
                return {
                    "success": False,
                    "error": f"Backup file not found: {backup_file}"
                }
            
            # PostgreSQL için pg_restore kullan
            if self.db_url.startswith("postgresql"):
                result = self._restore_postgres(backup_path)
            else:
                result = self._restore_sqlite(backup_path)
            
            if result["success"]:
                logger.info(f"[BACKUP] Restore completed: {backup_file}")
            
            return result
            
        except Exception as e:
            logger.error(f"[BACKUP] Restore failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _restore_postgres(self, backup_path: Path) -> Dict[str, Any]:
        """PostgreSQL restore"""
        try:
            cmd = [
                "pg_restore",
                "--dbname", self.db_url,
                "--clean",  # Mevcut objeleri temizle
                "--if-exists",
                str(backup_path)
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 dakika timeout
            )
            
            if result.returncode == 0:
                return {"success": True}
            else:
                # pg_restore bazen uyarılarla 1 döndürür
                if "errors ignored" in result.stderr.lower():
                    return {
                        "success": True,
                        "warnings": result.stderr
                    }
                return {
                    "success": False,
                    "error": result.stderr
                }
                
        except FileNotFoundError:
            return {
                "success": False,
                "error": "pg_restore not found. Install PostgreSQL client tools."
            }
    
    def _restore_sqlite(self, backup_path: Path) -> Dict[str, Any]:
        """SQLite restore"""
        try:
            import shutil
            
            # Orijinal veritabanını yedekle
            db_file = self.db_url.replace("sqlite:///", "")
            if not db_file.startswith("/"):
                db_file = "./" + db_file
            
            original_backup = f"{db_file}.pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(db_file, original_backup)
            
            # Restore yap
            shutil.copy2(backup_path, db_file)
            
            return {
                "success": True,
                "original_backup": original_backup
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"SQLite restore failed: {str(e)}"
            }
    
    def list_backups(self) -> Dict[str, Any]:
        """Mevcut backup listesini döndür"""
        try:
            backups = []
            for backup_file in self.backup_dir.glob("*.sql"):
                stat = backup_file.stat()
                backups.append({
                    "file": backup_file.name,
                    "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size_mb": round(stat.st_size / (1024 * 1024), 2)
                })
            
            # Tarihe göre sırala (en yeni önce)
            backups.sort(key=lambda x: x["created"], reverse=True)
            
            return {
                "success": True,
                "backups": backups,
                "total_count": len(backups),
                "total_size_mb": sum(b["size_mb"] for b in backups)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
_backup_service = None


def get_backup_service() -> DatabaseBackupService:
    """Backup servisi singleton"""
    global _backup_service
    
    if _backup_service is None:
        _backup_service = DatabaseBackupService()
    
    return _backup_service
