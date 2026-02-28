r"""
OptiPlan 360 - Tracking Folder Service

Siparis takip klasorlerini yonetir.
State degisikliklerinde XLSX/XML dosyalarini ilgili takip klasorune kopyalar.

Klasor yapisi:
  C:\Optiplan360_Entegrasyon\
  +-- OptiPlanning\
  |   +-- Import\          <- XLSX dosyalari (OptiPlanning'e aktarilacak)
  |   +-- Import\_archive\ <- Islenen XLSX'ler
  |   +-- Export\Sol\      <- XML cozum dosyalari
  |   +-- Export\_archive\ <- Islenen XML'ler
  |   +-- Tx\inbox\        <- Makineye teslim
  |   +-- Tx\processed\    <- Makine ACK (basarili)
  |   +-- Tx\failed\       <- Makine ACK (hatali)
  |   +-- Templates\       <- Excel sablonu
  |   +-- Config\          <- Konfigurasyon
  |   +-- Logs\            <- Otomasyon loglari
  +-- OPTiPLAN\
      +-- 0_ISLENIYOR\             <- OPTI_RUNNING
      +-- 1_GELEN_SIPARISLER\     <- NEW / OPTI_IMPORTED
      +-- 2_ISLENEN_SIPARISLER\   <- OPTI_DONE (veri aktarildi)
      +-- 3_HATALI_VERILER\       <- FAILED
      +-- 4_OPTIMIZASYON_BEKLIYOR <- OPTI_DONE (kullanici optimizasyon yapacak)
      +-- 5_KESIME_GONDERILDI\    <- DELIVERED
      +-- 6_KESIM_TAMAMLANDI\     <- DONE
      +-- 7_TESLIM_EDILDI\        <- Manual teslim
      +-- _raporlar\              <- Siparis fisleri
      +-- _loglar\                <- Worker/collector loglari
"""

import logging
import os
import shutil
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# -- Konfigurasyon --
ENTEGRASYON_ROOT = os.environ.get(
    "OPTIPLAN_ENTEGRASYON_ROOT",
    r"C:\Optiplan360_Entegrasyon",
)

# OptiPlanning klasorleri
OPTIPLANNING_IMPORT = os.path.join(ENTEGRASYON_ROOT, "OptiPlanning", "Import")
OPTIPLANNING_IMPORT_ARCHIVE = os.path.join(ENTEGRASYON_ROOT, "OptiPlanning", "Import", "_archive")
OPTIPLANNING_EXPORT_SOL = os.path.join(ENTEGRASYON_ROOT, "OptiPlanning", "Export", "Sol")
OPTIPLANNING_EXPORT_ARCHIVE = os.path.join(ENTEGRASYON_ROOT, "OptiPlanning", "Export", "_archive")
OPTIPLANNING_LOGS = os.path.join(ENTEGRASYON_ROOT, "OptiPlanning", "Logs")

# OPTiPLAN takip klasorleri
OPTIPLAN_ROOT = os.path.join(ENTEGRASYON_ROOT, "OPTİPLAN")
OPTIPLAN_ISLENIYOR = os.path.join(OPTIPLAN_ROOT, "0_ISLENIYOR")
OPTIPLAN_GELEN = os.path.join(OPTIPLAN_ROOT, "1_GELEN_SIPARISLER")
OPTIPLAN_ISLENEN = os.path.join(OPTIPLAN_ROOT, "2_ISLENEN_SIPARISLER")
OPTIPLAN_HATALI = os.path.join(OPTIPLAN_ROOT, "3_HATALI_VERILER")
OPTIPLAN_OPT_BEKLIYOR = os.path.join(OPTIPLAN_ROOT, "4_OPTIMIZASYON_BEKLIYOR")
OPTIPLAN_KESIME = os.path.join(OPTIPLAN_ROOT, "5_KESIME_GONDERILDI")
OPTIPLAN_KESIM_TAMAM = os.path.join(OPTIPLAN_ROOT, "6_KESIM_TAMAMLANDI")
OPTIPLAN_TESLIM = os.path.join(OPTIPLAN_ROOT, "7_TESLIM_EDILDI")
OPTIPLAN_RAPORLAR = os.path.join(OPTIPLAN_ROOT, "_raporlar")
OPTIPLAN_LOGLAR = os.path.join(OPTIPLAN_ROOT, "_loglar")

# State -> Klasor eslesmesi
STATE_FOLDER_MAP = {
    "OPTI_IMPORTED": OPTIPLAN_GELEN,
    "OPTI_RUNNING": OPTIPLAN_ISLENIYOR,
    "OPTI_DONE": OPTIPLAN_OPT_BEKLIYOR,
    "XML_READY": OPTIPLAN_ISLENEN,
    "DELIVERED": OPTIPLAN_KESIME,
    "DONE": OPTIPLAN_KESIM_TAMAM,
    "FAILED": OPTIPLAN_HATALI,
}


# Tum klasorleri baslangicta olustur
def _ensure_dirs():
    for d in [
        OPTIPLANNING_IMPORT,
        OPTIPLANNING_IMPORT_ARCHIVE,
        OPTIPLANNING_EXPORT_SOL,
        OPTIPLANNING_EXPORT_ARCHIVE,
        OPTIPLANNING_LOGS,
        OPTIPLAN_ISLENIYOR,
        OPTIPLAN_GELEN,
        OPTIPLAN_ISLENEN,
        OPTIPLAN_HATALI,
        OPTIPLAN_OPT_BEKLIYOR,
        OPTIPLAN_KESIME,
        OPTIPLAN_KESIM_TAMAM,
        OPTIPLAN_TESLIM,
        OPTIPLAN_RAPORLAR,
        OPTIPLAN_LOGLAR,
    ]:
        os.makedirs(d, exist_ok=True)


try:
    _ensure_dirs()
except OSError:
    pass  # Docker ortaminda Windows yollari olmayabilir


def _safe_copy(src: str, dst_dir: str) -> Optional[str]:
    """Dosyayi hedef klasore kopyalar. Hata olursa None doner."""
    if not os.path.exists(src):
        return None
    try:
        os.makedirs(dst_dir, exist_ok=True)
        dst = os.path.join(dst_dir, os.path.basename(src))
        shutil.copy2(src, dst)
        return dst
    except OSError as e:
        logger.warning("Dosya kopyalama hatasi (%s -> %s): %s", src, dst_dir, e)
        return None


def _safe_move(src: str, dst_dir: str) -> Optional[str]:
    """Dosyayi hedef klasore tasir. Hata olursa None doner."""
    if not os.path.exists(src):
        return None
    try:
        os.makedirs(dst_dir, exist_ok=True)
        dst = os.path.join(dst_dir, os.path.basename(src))
        if os.path.exists(dst):
            os.remove(dst)
        shutil.move(src, dst)
        return dst
    except OSError as e:
        logger.warning("Dosya tasima hatasi (%s -> %s): %s", src, dst_dir, e)
        return None


def _cleanup_from_other_folders(filename: str, exclude_folder: str):
    """Bir dosyayi diger takip klasorlerinden siler (state degisince eski yerde kalmasin)."""
    for folder in STATE_FOLDER_MAP.values():
        if folder == exclude_folder:
            continue
        old_path = os.path.join(folder, filename)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass


def on_xlsx_created(xlsx_path: str, job_id: str, order_ts_code: str = ""):
    """
    XLSX olusturulunca cagirilir.
    1. XLSX'i OptiPlanning/Import/ klasorune kopyalar
    2. OPTiPLAN/1_GELEN_SIPARISLER/ klasorune kopyalar
    """
    fname = os.path.basename(xlsx_path)

    # OptiPlanning Import
    _safe_copy(xlsx_path, OPTIPLANNING_IMPORT)

    # OPTiPLAN takip
    _safe_copy(xlsx_path, OPTIPLAN_GELEN)

    logger.info("Tracking: XLSX olusturuldu -> Import + 1_GELEN: %s", fname)


def on_state_change(
    new_state: str,
    job_id: str,
    xlsx_path: Optional[str] = None,
    xml_path: Optional[str] = None,
    order_ts_code: str = "",
    error_message: str = "",
):
    """
    Job state degistiginde cagirilir.
    Dosyayi ilgili takip klasorune tasir/kopyalar.
    """
    target_folder = STATE_FOLDER_MAP.get(new_state)
    if not target_folder:
        return

    # Takip dosyasi: XLSX veya XML (hangisi mevcutsa)
    tracking_file = xml_path or xlsx_path
    if not tracking_file:
        return

    fname = os.path.basename(tracking_file)

    # Dosyayi hedef klasore kopyala
    result = _safe_copy(tracking_file, target_folder)

    # Eski klasorlerden temizle
    if result:
        _cleanup_from_other_folders(fname, target_folder)

    # Hata durumunda detay dosyasi olustur
    if new_state == "FAILED" and error_message:
        error_file = os.path.join(OPTIPLAN_HATALI, f"{os.path.splitext(fname)[0]}_HATA.txt")
        try:
            with open(error_file, "w", encoding="utf-8") as f:
                f.write(f"Job ID: {job_id}\n")
                f.write(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Hata: {error_message}\n")
        except OSError:
            pass

    logger.info("Tracking: %s -> %s (%s)", new_state, os.path.basename(target_folder), fname)


def on_receipt_created(
    job_id: str,
    order_ts_code: str,
    receipt_text: str,
):
    """
    Siparis fisi olusturulunca cagirilir.
    Fis detayini _raporlar/ klasorune yazar.
    """
    try:
        now = datetime.now().strftime("%Y%m%d_%H%M%S")
        fname = f"FIS_{order_ts_code or job_id[:8]}_{now}.txt"
        fpath = os.path.join(OPTIPLAN_RAPORLAR, fname)
        os.makedirs(OPTIPLAN_RAPORLAR, exist_ok=True)
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(receipt_text)
        logger.info("Tracking: Rapor yazildi -> %s", fname)
    except OSError as e:
        logger.warning("Rapor yazma hatasi: %s", e)


def write_daily_log(message: str, log_type: str = "worker"):
    """Gunluk log dosyasina yazar."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        log_file = os.path.join(OPTIPLAN_LOGLAR, f"{log_type}_{today}.log")
        os.makedirs(OPTIPLAN_LOGLAR, exist_ok=True)
        with open(log_file, "a", encoding="utf-8") as f:
            ts = datetime.now().strftime("%H:%M:%S")
            f.write(f"[{ts}] {message}\n")
    except OSError:
        pass
