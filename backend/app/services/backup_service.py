"""
OptiPlan 360 - Backup Service
Otomatik yedekleme ve geri yükleme mekanizması
"""

import gzip
import json
import os
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

# Backup configuration
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "./backups"))
BACKUP_DIR.mkdir(exist_ok=True)

MAX_BACKUP_AGE_DAYS = int(os.getenv("MAX_BACKUP_AGE_DAYS", "30"))
MAX_BACKUP_COUNT = int(os.getenv("MAX_BACKUP_COUNT", "50"))


class BackupService:
    """Yedekleme servisi"""

    @staticmethod
    def create_backup() -> dict:
        """Tam veritabanı yedeği oluştur"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"optiplan360_backup_{timestamp}"
        backup_path = BACKUP_DIR / backup_name
        backup_path.mkdir(exist_ok=True)

        try:
            # Database backup
            db_backup = BackupService._backup_database(backup_path)

            # Config files backup
            config_backup = BackupService._backup_configs(backup_path)

            # Uploaded files backup (if any)
            files_backup = BackupService._backup_uploads(backup_path)

            # Create manifest
            manifest = {
                "version": "1.0",
                "timestamp": timestamp,
                "created_at": datetime.now().isoformat(),
                "components": {
                    "database": db_backup,
                    "configs": config_backup,
                    "uploads": files_backup,
                },
            }

            manifest_path = backup_path / "manifest.json"
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)

            # Compress backup
            archive_path = BackupService._compress_backup(backup_path)

            # Cleanup old backups
            BackupService.cleanup_old_backups()

            return {
                "success": True,
                "backup_id": backup_name,
                "path": str(archive_path),
                "size_bytes": archive_path.stat().st_size,
                "manifest": manifest,
            }

        except Exception as e:
            # Cleanup on failure
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise Exception(f"Backup failed: {str(e)}")

    @staticmethod
    def _backup_database(backup_path: Path) -> dict:
        """Veritabanı yedeği"""
        db_url = os.getenv("DATABASE_URL", "sqlite:///./optiplan.db")

        if db_url.startswith("sqlite"):
            # SQLite backup
            db_file = db_url.replace("sqlite:///", "")
            backup_file = backup_path / "database.sqlite.gz"

            with open(db_file, "rb") as f_in:
                with gzip.open(backup_file, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)

            return {
                "type": "sqlite",
                "source": db_file,
                "backup_file": str(backup_file),
                "compressed": True,
            }
        else:
            # PostgreSQL backup (using pg_dump)
            backup_file = backup_path / "database.sql.gz"

            # Extract connection info from URL
            # postgresql://user:pass@host:port/dbname
            pg_dump_cmd = [
                "pg_dump",
                db_url,
                "--verbose",
                "--no-owner",
                "--no-acl",
            ]

            with gzip.open(backup_file, "wb") as f_out:
                subprocess.run(pg_dump_cmd, stdout=f_out, check=True)

            return {
                "type": "postgresql",
                "backup_file": str(backup_file),
                "compressed": True,
            }

    @staticmethod
    def _backup_configs(backup_path: Path) -> dict:
        """Konfigürasyon dosyaları yedeği"""
        config_files = [
            ".env",
            "config.yaml",
            "config.json",
        ]

        config_backup_dir = backup_path / "configs"
        config_backup_dir.mkdir(exist_ok=True)

        backed_up = []
        for config_file in config_files:
            if os.path.exists(config_file):
                shutil.copy2(config_file, config_backup_dir / config_file)
                backed_up.append(config_file)

        return {
            "files_backed_up": backed_up,
            "backup_dir": str(config_backup_dir),
        }

    @staticmethod
    def _backup_uploads(backup_path: Path) -> dict:
        """Yüklenen dosyalar yedeği"""
        uploads_dir = Path("./uploads")

        if not uploads_dir.exists():
            return {
                "files_backed_up": 0,
                "backup_dir": None,
            }

        uploads_backup_dir = backup_path / "uploads"

        if uploads_dir.exists():
            shutil.copytree(uploads_dir, uploads_backup_dir, dirs_exist_ok=True)

        file_count = sum(1 for _ in uploads_backup_dir.rglob("*") if _.is_file())

        return {
            "files_backed_up": file_count,
            "backup_dir": str(uploads_backup_dir),
        }

    @staticmethod
    def _compress_backup(backup_path: Path) -> Path:
        """Yedeği sıkıştır"""
        archive_path = Path(f"{backup_path}.tar.gz")

        subprocess.run(
            ["tar", "-czf", str(archive_path), "-C", str(backup_path.parent), backup_path.name],
            check=True,
        )

        # Remove uncompressed directory
        shutil.rmtree(backup_path)

        return archive_path

    @staticmethod
    def list_backups() -> List[dict]:
        """Mevcut yedekleri listele"""
        backups = []

        for backup_file in BACKUP_DIR.glob("optiplan360_backup_*.tar.gz"):
            stat = backup_file.stat()
            backups.append(
                {
                    "id": backup_file.stem,
                    "filename": backup_file.name,
                    "path": str(backup_file),
                    "size_bytes": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size_formatted": f"{stat.st_size / (1024*1024):.2f} MB",
                }
            )

        # Sort by creation time (newest first)
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return backups

    @staticmethod
    def restore_backup(backup_id: str, target_dir: Optional[str] = None) -> dict:
        """Yedeği geri yükle"""
        backup_file = BACKUP_DIR / f"{backup_id}.tar.gz"

        if not backup_file.exists():
            raise Exception(f"Backup not found: {backup_id}")

        # Extract backup
        extract_dir = BACKUP_DIR / f"restore_{backup_id}"
        extract_dir.mkdir(exist_ok=True)

        try:
            subprocess.run(
                ["tar", "-xzf", str(backup_file), "-C", str(extract_dir)],
                check=True,
            )

            # Find extracted backup directory
            extracted_backup = next(extract_dir.iterdir())

            # Read manifest
            manifest_path = extracted_backup / "manifest.json"
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            # Restore database
            if manifest["components"]["database"]["type"] == "sqlite":
                db_backup = extracted_backup / "database.sqlite.gz"
                db_target = target_dir or "."

                with gzip.open(db_backup, "rb") as f_in:
                    with open(f"{db_target}/optiplan.db", "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)

            # Restore configs
            config_backup_dir = extracted_backup / "configs"
            if config_backup_dir.exists():
                for config_file in config_backup_dir.iterdir():
                    shutil.copy2(config_file, config_file.name)

            # Restore uploads
            uploads_backup_dir = extracted_backup / "uploads"
            if uploads_backup_dir.exists():
                uploads_target = target_dir or "./uploads"
                shutil.copytree(uploads_backup_dir, uploads_target, dirs_exist_ok=True)

            return {
                "success": True,
                "backup_id": backup_id,
                "restored_components": list(manifest["components"].keys()),
            }

        finally:
            # Cleanup extraction directory
            if extract_dir.exists():
                shutil.rmtree(extract_dir)

    @staticmethod
    def cleanup_old_backups():
        """Eski yedekleri temizle"""
        backups = BackupService.list_backups()

        # Remove backups exceeding max count
        if len(backups) > MAX_BACKUP_COUNT:
            for old_backup in backups[MAX_BACKUP_COUNT:]:
                backup_file = Path(old_backup["path"])
                if backup_file.exists():
                    backup_file.unlink()

        # Remove backups older than max age
        cutoff_date = datetime.now() - timedelta(days=MAX_BACKUP_AGE_DAYS)

        for backup in backups:
            backup_date = datetime.fromisoformat(backup["created_at"])
            if backup_date < cutoff_date:
                backup_file = Path(backup["path"])
                if backup_file.exists():
                    backup_file.unlink()

    @staticmethod
    def get_backup_status() -> dict:
        """Yedekleme durumunu getir"""
        backups = BackupService.list_backups()

        if not backups:
            return {
                "last_backup": None,
                "total_backups": 0,
                "total_size_bytes": 0,
                "status": "no_backups",
            }

        total_size = sum(b["size_bytes"] for b in backups)
        last_backup = backups[0]

        # Check if backup is recent (within 24 hours)
        last_backup_time = datetime.fromisoformat(last_backup["created_at"])
        is_recent = (datetime.now() - last_backup_time) < timedelta(hours=24)

        return {
            "last_backup": last_backup,
            "total_backups": len(backups),
            "total_size_bytes": total_size,
            "total_size_formatted": f"{total_size / (1024*1024):.2f} MB",
            "status": "ok" if is_recent else "stale",
            "auto_backup_enabled": True,
        }


# Singleton instance
backup_service = BackupService()


def scheduled_backup():
    """Zamanlanmış yedekleme görevi"""
    try:
        result = backup_service.create_backup()
        print(f"Scheduled backup completed: {result['backup_id']}")
        return result
    except Exception as e:
        print(f"Scheduled backup failed: {e}")
        raise
