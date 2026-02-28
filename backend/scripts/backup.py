#!/usr/bin/env python3
"""
OPTIPLAN360 Yedekleme Sistemi
NAS + Google Drive yedekleme stratejisi
"""

import os
import sys
import shutil
import sqlite3
import subprocess
import json
from datetime import datetime, timedelta
from pathlib import Path
import logging

# Logging yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class BackupManager:
    def __init__(self, config_file='config/backup_config.json'):
        self.config = self.load_config(config_file)
        self.project_root = Path(__file__).parent.parent
        self.backup_dir = self.project_root / 'backups'
        self.backup_dir.mkdir(exist_ok=True)
        
    def load_config(self, config_file):
        """Yedekleme konfigürasyonunu yükle"""
        default_config = {
            "nas_path": "\\\\NAS_SERVER\\optiplan360_backups",
            "google_drive_folder": "optiplan360_backups",
            "databases": [
                {
                    "name": "optiplan360",
                    "type": "postgresql",
                    "connection_string": "postgresql://user:pass@localhost/optiplan360"
                }
            ],
            "directories": [
                "database",
                "exports",
                "uploads/orders",
                "config"
            ],
            "retention_days": 30,
            "compression": True
        }
        
        config_path = Path(__file__).parent.parent / config_file
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
                default_config.update(user_config)
        else:
            # Konfigürasyon dosyası oluştur
            config_path.parent.mkdir(exist_ok=True)
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=2, ensure_ascii=False)
            logger.info(f"Konfigürasyon dosyası oluşturuldu: {config_path}")
            
        return default_config
    
    def create_backup_name(self, prefix="backup"):
        """Zaman damgalı yedekleme adı oluştur"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}"
    
    def backup_postgresql(self, db_config, backup_name):
        """PostgreSQL veritabanını yedekle"""
        logger.info(f"PostgreSQL yedekleniyor: {db_config['name']}")
        
        backup_file = self.backup_dir / f"{backup_name}_{db_config['name']}.sql"
        
        try:
            # pg_dump kullanarak yedekleme
            cmd = [
                'pg_dump',
                db_config['connection_string'],
                '--no-password',
                '--verbose',
                '--file', str(backup_file)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info(f"PostgreSQL yedekleme tamamlandı: {backup_file}")
            
            if self.config.get('compression'):
                self.compress_file(backup_file)
                backup_file = backup_file.with_suffix('.sql.gz')
                
            return backup_file
            
        except subprocess.CalledProcessError as e:
            logger.error(f"PostgreSQL yedekleme hatası: {e}")
            return None
    
    def backup_directory(self, dir_path, backup_name):
        """Dizin yedekleme"""
        source_path = self.project_root / dir_path
        if not source_path.exists():
            logger.warning(f"Dizin bulunamadı: {source_path}")
            return None
            
        logger.info(f"Dizin yedekleniyor: {dir_path}")
        
        # ZIP formatında yedekleme
        backup_file = self.backup_dir / f"{backup_name}_{dir_path.replace('/', '_')}.zip"
        
        try:
            shutil.make_archive(
                str(backup_file.with_suffix('')),
                'zip',
                str(source_path.parent),
                source_path.name
            )
            
            logger.info(f"Dizin yedekleme tamamlandı: {backup_file}")
            return backup_file
            
        except Exception as e:
            logger.error(f"Dizin yedekleme hatası: {e}")
            return None
    
    def compress_file(self, file_path):
        """Dosyayı sıkıştır"""
        try:
            import gzip
            with open(file_path, 'rb') as f_in:
                with gzip.open(f"{file_path}.gz", 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            os.remove(file_path)
            logger.info(f"Dosya sıkıştırıldı: {file_path}")
        except Exception as e:
            logger.error(f"Sıkıştırma hatası: {e}")
    
    def copy_to_nas(self, backup_file):
        """NAS kopyala"""
        if not self.config.get('nas_path'):
            logger.warning("NAS path konfigürasyonu eksik")
            return False
            
        try:
            nas_path = Path(self.config['nas_path'])
            nas_path.mkdir(parents=True, exist_ok=True)
            
            target_path = nas_path / backup_file.name
            shutil.copy2(backup_file, target_path)
            logger.info(f"NAS kopyalandı: {target_path}")
            return True
            
        except Exception as e:
            logger.error(f"NAS kopyalama hatası: {e}")
            return False
    
    def copy_to_google_drive(self, backup_file):
        """Google Drive kopyala"""
        try:
            # Google Drive API kullanımı (google-drive-downloader kütüphanesi)
            from pydrive2.auth import GoogleAuth
            from pydrive2.drive import GoogleDrive
            
            gauth = GoogleAuth()
            gauth.LocalWebserverAuth()
            drive = GoogleDrive(gauth)
            
            # Google Drive'da klasör bul veya oluştur
            folder_name = self.config.get('google_drive_folder', 'optiplan360_backups')
            
            file_drive = drive.CreateFile({
                'title': backup_file.name,
                'parents': [{'id': folder_name}] if folder_name else None
            })
            
            file_drive.SetContentFile(str(backup_file))
            file_drive.Upload()
            
            logger.info(f"Google Drive yüklendi: {backup_file.name}")
            return True
            
        except ImportError:
            logger.warning("Google Drive kütüphanesi kurulu değil")
            return False
        except Exception as e:
            logger.error(f"Google Drive yükleme hatası: {e}")
            return False
    
    def cleanup_old_backups(self):
        """Eski yedekleri temizle"""
        retention_days = self.config.get('retention_days', 30)
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        deleted_count = 0
        for backup_file in self.backup_dir.glob('*'):
            if backup_file.is_file():
                file_time = datetime.fromtimestamp(backup_file.stat().st_mtime)
                if file_time < cutoff_date:
                    try:
                        backup_file.unlink()
                        deleted_count += 1
                        logger.info(f"Eski yedek silindi: {backup_file.name}")
                    except Exception as e:
                        logger.error(f"Silme hatası: {e}")
        
        logger.info(f"Toplam {deleted_count} eski yedek silindi")
    
    def run_full_backup(self):
        """Tam yedekleme çalıştır"""
        logger.info("Tam yedekleme başlatılıyor...")
        backup_name = self.create_backup_name()
        backup_files = []
        
        # Veritabanı yedeklemeleri
        for db_config in self.config.get('databases', []):
            if db_config['type'] == 'postgresql':
                backup_file = self.backup_postgresql(db_config, backup_name)
                if backup_file:
                    backup_files.append(backup_file)
        
        # Dizin yedeklemeleri
        for directory in self.config.get('directories', []):
            backup_file = self.backup_directory(directory, backup_name)
            if backup_file:
                backup_files.append(backup_file)
        
        # Yedekleri hedeflere kopyala
        success_count = 0
        for backup_file in backup_files:
            if self.copy_to_nas(backup_file):
                success_count += 1
            if self.copy_to_google_drive(backup_file):
                success_count += 1
        
        # Eski yedekleri temizle
        self.cleanup_old_backups()
        
        logger.info(f"Yedekleme tamamlandı. {len(backup_files)} dosya, {success_count} hedefe kopyalandı")
        return backup_files

def main():
    """Ana fonksiyon"""
    try:
        backup_manager = BackupManager()
        backup_files = backup_manager.run_full_backup()
        
        # Rapor oluştur
        report = {
            "timestamp": datetime.now().isoformat(),
            "backup_count": len(backup_files),
            "backup_files": [str(f) for f in backup_files],
            "status": "success"
        }
        
        report_file = Path(__file__).parent / f"backup_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Rapor oluşturuldu: {report_file}")
        
    except Exception as e:
        logger.error(f"Yedekleme hatası: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
