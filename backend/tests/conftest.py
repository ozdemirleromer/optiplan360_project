"""
Test konfigürasyonu — pytest conftest.

Türkçe Windows'ta encoding sorunlarını önlemek için
UTF-8 zorunlu kılınır.
"""

import os
import sys


def pytest_configure(config):
    """Pytest başlarken UTF-8 encoding'i zorla."""
    os.environ["PYTHONIOENCODING"] = "utf-8"
    os.environ["PYTHONUTF8"] = "1"

    # stdout/stderr reconfigure (Python 3.7+)
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
