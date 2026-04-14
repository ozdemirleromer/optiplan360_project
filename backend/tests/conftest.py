"""Pytest test altyapisi ve ortak fixture'lar."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

TEMP_ROOT = BACKEND_ROOT.parent / ".pytest_tmp"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)
os.environ["TMP"] = str(TEMP_ROOT)
os.environ["TEMP"] = str(TEMP_ROOT)
os.environ["TMPDIR"] = str(TEMP_ROOT)

from app.database import Base
import app.models  # noqa: F401


def pytest_configure(config):
    """Pytest baslarken UTF-8 encoding'i zorla."""
    os.environ["PYTHONIOENCODING"] = "utf-8"
    os.environ["PYTHONUTF8"] = "1"

    temp_root = BACKEND_ROOT.parent / ".pytest_tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    os.environ["TMP"] = str(temp_root)
    os.environ["TEMP"] = str(temp_root)
    os.environ["TMPDIR"] = str(temp_root)

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


@pytest.fixture
def workspace_tmp_path():
    with TemporaryDirectory(prefix="optiplan-tests-") as tmp_dir:
        yield Path(tmp_dir)


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
