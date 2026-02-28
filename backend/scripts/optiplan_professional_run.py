#!/usr/bin/env python3
"""
One-click professional OptiPlanning run:
1) Preflight (optional)
2) Stage-1: New + Save + New Worklist
3) Stage-2: Parcalar -> Sec -> Yapistir
4) Save
5) Optional Stage-3: Yurut -> Optimize Et / Devam et
6) Optional UI map snapshot
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

warnings.filterwarnings(
    "ignore",
    message=r"32-bit application should be automated using 32-bit Python.*",
    category=UserWarning,
)

from pywinauto import Application, Desktop


def _py_cmd(*args: str) -> list[str]:
    return [sys.executable, *args]


def _clean_stderr(stderr_text: str) -> str:
    if not stderr_text:
        return ""
    noisy_markers = (
        "pywinauto\\application.py:1085: UserWarning:",
        "32-bit application should be automated using 32-bit Python",
        "warnings.warn(",
    )
    kept: list[str] = []
    for line in stderr_text.splitlines():
        if any(marker in line for marker in noisy_markers):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.stdout.strip():
        print(proc.stdout.strip())
    cleaned_stderr = _clean_stderr(proc.stderr)
    if cleaned_stderr:
        print(cleaned_stderr, file=sys.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"Komut basarisiz ({proc.returncode}): {' '.join(cmd)}")
    return proc


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _append_step(
    report: dict[str, Any],
    *,
    name: str,
    status: str,
    started_at: str,
    started_monotonic: float,
    command: list[str] | None = None,
    error: str | None = None,
) -> None:
    step = {
        "name": name,
        "status": status,
        "started_at": started_at,
        "ended_at": _now_iso(),
        "duration_sec": round(time.monotonic() - started_monotonic, 3),
    }
    if command is not None:
        step["command"] = command
    if error:
        step["error"] = error
    report["steps"].append(step)


def _run_step(report: dict[str, Any], name: str, cmd: list[str]) -> None:
    started_at = _now_iso()
    started_monotonic = time.monotonic()
    try:
        _run(cmd)
    except Exception as exc:
        _append_step(
            report,
            name=name,
            status="FAIL",
            started_at=started_at,
            started_monotonic=started_monotonic,
            command=cmd,
            error=str(exc),
        )
        raise
    _append_step(
        report,
        name=name,
        status="PASS",
        started_at=started_at,
        started_monotonic=started_monotonic,
        command=cmd,
    )


def _run_action_step(report: dict[str, Any], name: str, action) -> None:
    started_at = _now_iso()
    started_monotonic = time.monotonic()
    try:
        action()
    except Exception as exc:
        _append_step(
            report,
            name=name,
            status="FAIL",
            started_at=started_at,
            started_monotonic=started_monotonic,
            error=str(exc),
        )
        raise
    _append_step(
        report,
        name=name,
        status="PASS",
        started_at=started_at,
        started_monotonic=started_monotonic,
    )


def _write_report(report_path: Path, report: dict[str, Any]) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def _save_active_optiplan() -> None:
    mains = [
        w
        for w in Desktop(backend="win32").windows()
        if w.is_visible() and "Optiplanning - [" in (w.window_text() or "")
    ]
    if not mains:
        raise RuntimeError("Kaydet adimi icin acik OptiPlanning penceresi bulunamadi")
    main = mains[-1]
    app = Application(backend="win32").connect(process=main.process_id())
    win = app.window(handle=main.handle)
    try:
        win.menu_select("Dosya->Kaydet\tCtrl+S")
    except Exception:
        win.type_keys("^s")


def parse_args():
    p = argparse.ArgumentParser(description="OptiPlanning professional full run")
    p.set_defaults(run_optimize=True)
    p.add_argument("--xlsx", required=True, help="Islenecek xlsx dosyasi")
    p.add_argument("--timeout", type=float, default=30.0, help="Aksiyon timeout suresi")
    p.add_argument(
        "--skip-preflight",
        action="store_true",
        help="On kontrol asamasini atla",
    )
    p.add_argument(
        "--skip-ui-map",
        action="store_true",
        help="Islem sonunda UI haritasi uretimini atla",
    )
    p.add_argument(
        "--run-optimize",
        dest="run_optimize",
        action="store_true",
        help="Stage-2 sonrasinda Yurut->Optimize Et / Devam et adimini calistir (varsayilan: acik)",
    )
    p.add_argument(
        "--skip-optimize",
        dest="run_optimize",
        action="store_false",
        help="Optimize adimini atla",
    )
    p.add_argument(
        "--optimize-timeout",
        type=float,
        default=8.0,
        help="Optimize tetikleme sonrasi izleme suresi (sn)",
    )
    p.add_argument(
        "--optimize-trigger",
        choices=["button", "menu", "f5", "auto"],
        default="button",
        help="Optimize komutunu hangi yontemle tetikleyecegi",
    )
    p.add_argument(
        "--report-json",
        help="Calisma adimlarini JSON rapor dosyasina yaz",
    )
    return p.parse_args()


def main():
    args = parse_args()
    xlsx = Path(args.xlsx).resolve()
    report_path = Path(args.report_json) if args.report_json else None
    report: dict[str, Any] = {
        "started_at": _now_iso(),
        "ended_at": None,
        "status": "RUNNING",
        "exit_code": None,
        "xlsx": str(xlsx),
        "options": {
            "timeout": args.timeout,
            "skip_preflight": args.skip_preflight,
            "skip_ui_map": args.skip_ui_map,
            "run_optimize": args.run_optimize,
            "optimize_timeout": args.optimize_timeout,
            "optimize_trigger": args.optimize_trigger,
        },
        "steps": [],
        "error": None,
    }

    if not xlsx.exists():
        err = f"HATA: XLSX bulunamadi: {xlsx}"
        print(err, file=sys.stderr)
        report["status"] = "FAIL"
        report["error"] = err
        report["exit_code"] = 2
        report["ended_at"] = _now_iso()
        if report_path:
            try:
                _write_report(report_path, report)
            except Exception as exc:
                print(f"UYARI: Rapor yazilamadi: {exc}", file=sys.stderr)
        return 2

    exit_code = 1
    try:
        if not args.skip_preflight:
            _run_step(
                report,
                "preflight_check",
                _py_cmd(
                    "scripts/optiplan_preflight_check.py",
                    "--xlsx",
                    str(xlsx),
                    "--json-out",
                    "logs/optiplan_preflight_latest.json",
                ),
            )

        _run_step(
            report,
            "stage1_new_save_worklist",
            _py_cmd(
                "scripts/optiplan_stage1_automation.py",
                "--xlsx",
                str(xlsx),
                "--timeout",
                str(args.timeout),
            ),
        )

        _run_step(
            report,
            "stage2_select_paste",
            _py_cmd(
                "scripts/optiplan_stage2_select_paste.py",
                "--xlsx",
                str(xlsx),
                "--timeout",
                str(args.timeout),
            ),
        )
        _run_action_step(report, "save_active_optiplan", _save_active_optiplan)

        if args.run_optimize:
            _run_step(
                report,
                "stage3_optimize",
                _py_cmd(
                    "scripts/optiplan_stage3_optimize.py",
                    "--timeout",
                    str(args.optimize_timeout),
                    "--trigger",
                    args.optimize_trigger,
                ),
            )

        if not args.skip_ui_map:
            _run_step(
                report,
                "ui_map_snapshot",
                _py_cmd(
                    "scripts/optiplan_ui_mapper.py",
                    "--output",
                    "docs/optiplanning/generated_ui_map.json",
                ),
            )

        print("TAMAM: Professional run tamamlandi.")
        report["status"] = "PASS"
        exit_code = 0
        return exit_code
    except Exception as exc:
        report["status"] = "FAIL"
        report["error"] = str(exc)
        print(f"HATA: Professional run basarisiz: {exc}", file=sys.stderr)
        return 1
    finally:
        report["ended_at"] = _now_iso()
        report["exit_code"] = exit_code
        if report_path:
            try:
                _write_report(report_path, report)
                print(f"RAPOR: {report_path}")
            except Exception as exc:
                print(f"UYARI: Rapor yazilamadi: {exc}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
