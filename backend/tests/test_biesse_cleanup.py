import os
import shutil
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
PROJECT_ROOT = BACKEND_DIR.parent

from app.services.biesse_integration_service import BiesseIntegrationService  # noqa: E402


class TestBiesseCleanup(unittest.TestCase):
    def test_cleanup_old_files_removes_only_expired_files(self):
        base_dir = PROJECT_ROOT / "tmp" / "unit_biesse_cleanup_case"
        shutil.rmtree(base_dir, ignore_errors=True)
        base_dir.mkdir(parents=True, exist_ok=True)
        try:
            service = BiesseIntegrationService(optiplanning_path=str(base_dir))

            old_file = service.xml_mat_path / "old_material.xml"
            new_file = service.xml_mat_path / "new_material.xml"
            old_file.write_text("<xml/>", encoding="utf-8")
            new_file.write_text("<xml/>", encoding="utf-8")

            old_ts = (datetime.now(timezone.utc) - timedelta(days=60)).timestamp()
            new_ts = (datetime.now(timezone.utc) - timedelta(days=2)).timestamp()
            os.utime(old_file, (old_ts, old_ts))
            os.utime(new_file, (new_ts, new_ts))

            result = service.cleanup_old_files(days_old=30)

            self.assertIn("cleaned_files", result)
            self.assertGreaterEqual(result["cleaned_files"], 1)
            self.assertFalse(old_file.exists())
            self.assertTrue(new_file.exists())
        finally:
            shutil.rmtree(base_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
