from datetime import datetime, timezone
import unittest
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.exceptions import ValidationError  # noqa: E402
from app.models import User  # noqa: E402
from app.routers.admin_router import _normalize_user_role, _to_user_out  # noqa: E402


class TestAdminUserRouterHelpers(unittest.TestCase):
    def test_to_user_out_converts_numeric_id_to_string(self):
        user = User(
            id=7,
            username="admin",
            email="admin@example.com",
            display_name="Admin User",
            role="ADMIN",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )

        out = _to_user_out(user)

        self.assertEqual(out.id, "7")
        self.assertEqual(out.role, "ADMIN")

    def test_to_user_out_fallbacks_display_name(self):
        user = User(
            id=3,
            username="operator1",
            email="operator@example.com",
            display_name=None,
            name=None,
            role="operator",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )

        out = _to_user_out(user)

        self.assertEqual(out.display_name, "operator1")
        self.assertEqual(out.role, "OPERATOR")

    def test_normalize_role_accepts_case_insensitive_values(self):
        self.assertEqual(_normalize_user_role("admin"), "ADMIN")
        self.assertEqual(_normalize_user_role("Station"), "STATION")

    def test_normalize_role_rejects_unknown_values(self):
        with self.assertRaises(ValidationError):
            _normalize_user_role("INVALID_ROLE")


if __name__ == "__main__":
    unittest.main()
