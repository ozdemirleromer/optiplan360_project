import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect


REQUIRED_TABLES = [
    "order_notes",
    "price_upload_jobs",
    "price_items",
]


def run(cmd: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, env=env)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify external DB migration readiness")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    args = parser.parse_args()

    if not args.database_url:
        print(json.dumps({"ok": False, "error": "DATABASE_URL missing"}, ensure_ascii=False))
        return 2

    env = os.environ.copy()
    env["DATABASE_URL"] = args.database_url

    alembic_upgrade = run(["alembic", "upgrade", "head"], env)
    if alembic_upgrade.returncode != 0:
        print(
            json.dumps(
                {
                    "ok": False,
                    "step": "alembic upgrade head",
                    "stderr": alembic_upgrade.stderr[-2000:],
                },
                ensure_ascii=False,
            )
        )
        return 1

    alembic_current = run(["alembic", "current"], env)
    head_line = (alembic_current.stdout or "").splitlines()[0] if alembic_current.stdout else "unknown"

    engine = create_engine(args.database_url)
    insp = inspect(engine)
    missing_tables = [t for t in REQUIRED_TABLES if not insp.has_table(t)]

    result = {
        "ok": len(missing_tables) == 0,
        "database_url": args.database_url,
        "alembic_current": head_line,
        "missing_tables": missing_tables,
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
