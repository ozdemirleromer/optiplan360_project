"""
Integration diagnostics CLI

Calisma:
    python scripts/run_integration_diagnostics.py
    python scripts/run_integration_diagnostics.py --fail-on warn
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _bootstrap_backend_imports() -> None:
    root = Path(__file__).resolve().parents[1]
    backend_dir = root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run OptiPlan360 integration diagnostics.")
    parser.add_argument(
        "--fail-on",
        choices=["none", "warn", "fail"],
        default="fail",
        help="Exit with non-zero when diagnostics status reaches this level.",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON output.",
    )
    return parser.parse_args()


def _should_fail(status: str, fail_on: str) -> bool:
    status_rank = {"PASS": 0, "WARN": 1, "FAIL": 2}
    threshold_rank = {"none": 3, "warn": 1, "fail": 2}
    return status_rank.get(status, 2) >= threshold_rank[fail_on]


def main() -> int:
    args = _parse_args()
    _bootstrap_backend_imports()

    from app.database import SessionLocal
    from app.services import integration_service

    db = SessionLocal()
    try:
        result = integration_service.run_diagnostics(db)
    finally:
        db.close()

    if args.compact:
        print(json.dumps(result, ensure_ascii=True))
    else:
        print(json.dumps(result, ensure_ascii=True, indent=2))

    status = str(result.get("status", "FAIL")).upper()
    if _should_fail(status, args.fail_on):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
