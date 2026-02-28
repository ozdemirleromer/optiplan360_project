"""
OptiPlan 360 - Log Rotation Konfigürasyonu

Üretim ortamında log dosyalarının boyutunu sınırlar ve eski logları arşivler.
"""

import logging
import logging.handlers
import os
from pathlib import Path

# Log dizini
LOG_DIR = Path(os.getenv("LOG_DIR", "./logs"))

# Log seviyesi
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def _ensure_log_dir() -> Path | None:
    """
    Log dizinini olusturmayi dener.
    Basarisiz olursa dosya handler yerine sadece console fallback kullanilir.
    """
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        return LOG_DIR
    except OSError:
        return None


def setup_logging() -> logging.Logger:
    """
    Uygulama loglama konfigürasyonunu ayarla.

    Özellikler:
    - RotatingFileHandler: 10MB'da bir yeni dosya oluşturur, 5 yedek tutar
    - TimedRotatingFileHandler: Günlük log döndürme (gece yarısı)
    - ConsoleHandler: Geliştirme ortamı için stdout
    """
    # Root logger
    root_logger = logging.getLogger()
    if getattr(root_logger, "_optiplan_logging_configured", False):
        return root_logger

    root_logger.setLevel(getattr(logging, LOG_LEVEL.upper()))

    # Formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )

    log_dir = _ensure_log_dir()
    if log_dir is not None:
        try:
            # 1. Rotating File Handler - Uygulama logları (10MB x 5 dosya)
            app_handler = logging.handlers.RotatingFileHandler(
                filename=log_dir / "app.log",
                maxBytes=10 * 1024 * 1024,  # 10MB
                backupCount=5,
                encoding="utf-8",
            )
            app_handler.setLevel(logging.INFO)
            app_handler.setFormatter(formatter)
            root_logger.addHandler(app_handler)
        except OSError:
            pass

        try:
            # 2. Timed Rotating File Handler - Günlük loglar (30 gün sakla)
            daily_handler = logging.handlers.TimedRotatingFileHandler(
                filename=log_dir / "daily.log",
                when="midnight",
                interval=1,
                backupCount=30,  # 30 gün sakla
                encoding="utf-8",
            )
            daily_handler.setLevel(logging.INFO)
            daily_handler.setFormatter(formatter)
            root_logger.addHandler(daily_handler)
        except OSError:
            pass

        try:
            # 3. Error Log Handler - Sadece hatalar
            error_handler = logging.handlers.RotatingFileHandler(
                filename=log_dir / "error.log",
                maxBytes=5 * 1024 * 1024,  # 5MB
                backupCount=10,
                encoding="utf-8",
            )
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(formatter)
            root_logger.addHandler(error_handler)
        except OSError:
            pass

    # 4. Console Handler - Geliştirme ortamı için
    if os.getenv("ENV", "development") == "development":
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    if not root_logger.handlers:
        fallback_handler = logging.StreamHandler()
        fallback_handler.setLevel(logging.INFO)
        fallback_handler.setFormatter(formatter)
        root_logger.addHandler(fallback_handler)

    setattr(root_logger, "_optiplan_logging_configured", True)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Modül için logger al."""
    return logging.getLogger(name)
