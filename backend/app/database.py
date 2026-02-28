"""
OptiPlan 360 — Veritabanı Bağlantısı (SQLAlchemy)
Handoff §10: PostgreSQL sistem ekibi tarafından kurulur.
Backend ilk çalışmada Alembic veya create_all ile tabloları oluşturabilir.
"""
import os
import time
import logging
from sqlalchemy import create_engine, text, pool
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import OperationalError

# Configure logging
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./optiplan.db")

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Production PostgreSQL için optimize connection pooling
    engine_kwargs.update(
        {
            "poolclass": pool.QueuePool,  # Connection pooling
            "pool_pre_ping": True,  # Bağlantı sağlığını kontrol et
            "pool_size": 10,  # Sabit bağlantı sayısı (artırıldı)
            "max_overflow": 20,  # Ekstra bağlantı limiti
            "pool_timeout": 30,  # Bağlantı bekleme süresi
            "pool_recycle": 3600,  # Bağlantı yenileme süresi (1 saat)
            "pool_use_lifo": True,  # Son kullanılan bağlantıyı tekrar kullan
        }
    )

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Tüm SQLAlchemy modelleri bu sınıftan türetilir."""
    pass


def get_db():
    """FastAPI Depends için session generator."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connected() -> bool:
    """Health check için veritabanı bağlantısını test eder."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_db_stats() -> dict:
    """Connection pool istatistiklerini döndür."""
    if hasattr(engine, 'pool'):
        return {
            'size': engine.pool.size(),
            'checked_in': engine.pool.checkedin(),
            'checked_out': engine.pool.checkedout(),
            'overflow': engine.pool.overflow(),
        }
    return {}


def wait_for_db(max_retries: int = 30, retry_delay: float = 1.0) -> bool:
    """Veritabanı bağlantısını bekle ve dene."""
    for i in range(max_retries):
        if check_db_connected():
            logger.info(f"Veritabanı bağlantısı kuruldu (deneme {i + 1})")
            return True
        logger.warning(f"Veritabanı bağlantısı bekleniyor... ({i + 1}/{max_retries})")
        time.sleep(retry_delay)
    return False
