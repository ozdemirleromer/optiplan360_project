import json
import os

from app.services.mikro_service import test_connection


def main() -> int:
    if os.environ.get("MIKRO_HEALTH_FORCE_OK", "").strip() == "1":
        print(json.dumps({"ok": False, "error": "Disable MIKRO_HEALTH_FORCE_OK for real verification"}, ensure_ascii=False))
        return 2

    result = test_connection()
    ok = result.get("status") == "ok"
    print(json.dumps({"ok": ok, "result": result}, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
