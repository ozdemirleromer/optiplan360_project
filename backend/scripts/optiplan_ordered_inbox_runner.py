#!/usr/bin/env python3
"""
Ordered inbox runner for OptiPlanning.

Rule model:
1) Rule file defines source folder and naming pattern baseline.
2) Matching XLSX files are processed one-by-one in strict order.
3) Success -> move to processed folder, failure -> move to failed folder.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_RULE_FILE = Path(
    "C:\\Optiplan360_Entegrasyon\\OPT\u0130PLAN\\1_GELEN_SIPARISLER\\EXCEL_TEST_1.xlsx"
)
DEFAULT_POLL_SEC = 5.0
DEFAULT_TIMEOUT_SEC = 60.0
DEFAULT_OPTIMIZE_TIMEOUT_SEC = 12.0
DEFAULT_STABLE_SECONDS = 2.0
DEFAULT_PROCESSING_FOLDER = "0_ISLENIYOR"


@dataclass
class RulePattern:
    prefix: str
    suffix: str
    number_re: re.Pattern[str] | None


def _now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _build_pattern(rule_file: Path) -> RulePattern:
    stem = rule_file.stem
    suffix = (rule_file.suffix or ".xlsx").lower()
    m = re.match(r"^(.*?)(\d+)$", stem)
    if not m:
        return RulePattern(prefix=stem, suffix=suffix, number_re=None)
    prefix = m.group(1)
    return RulePattern(
        prefix=prefix,
        suffix=suffix,
        number_re=re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE),
    )


def _extract_num(stem: str, number_re: re.Pattern[str] | None) -> int | None:
    if number_re is None:
        return None
    m = number_re.match(stem)
    if not m:
        return None
    return int(m.group(1))


def _list_candidates(inbox_dir: Path, pattern: RulePattern) -> list[Path]:
    files: list[Path] = []
    prefix_l = pattern.prefix.lower()
    for f in inbox_dir.iterdir():
        if not f.is_file():
            continue
        if f.suffix.lower() != pattern.suffix:
            continue
        if not f.stem.lower().startswith(prefix_l):
            continue
        files.append(f)

    def sort_key(p: Path) -> tuple[int, float, float, str]:
        seq = _extract_num(p.stem, pattern.number_re)
        seq_rank = seq if seq is not None else float("inf")
        try:
            mtime = p.stat().st_mtime
        except OSError:
            mtime = float("inf")
        has_seq = 0 if seq is not None else 1
        return (has_seq, seq_rank, mtime, p.name.lower())

    files.sort(key=sort_key)
    return files


def _unique_target(dest_dir: Path, name: str) -> Path:
    target = dest_dir / name
    if not target.exists():
        return target
    stem = Path(name).stem
    suffix = Path(name).suffix
    return dest_dir / f"{stem}_{_now_stamp()}{suffix}"


def _move_file(src: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = _unique_target(dest_dir, src.name)
    shutil.move(str(src), str(target))
    return target


def _is_file_stable(path: Path, stable_seconds: float) -> bool:
    if stable_seconds <= 0:
        return True
    try:
        s1 = path.stat()
    except OSError:
        return False
    time.sleep(stable_seconds)
    try:
        s2 = path.stat()
    except OSError:
        return False
    return s1.st_size == s2.st_size and s1.st_mtime == s2.st_mtime


def _run_command_stream(cmd: list[str], *, cwd: Path, log_path: Path) -> int:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as lf:
        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            lf.write(line)
            print(line.rstrip("\n"), flush=True)
        proc.wait()
        return int(proc.returncode or 0)


def _run_preflight_once(project_root: Path, *, report_dir: Path, rule_file: Path) -> dict[str, Any]:
    stamp = _now_stamp()
    preflight_json = report_dir / f"preflight_once_{stamp}.json"
    preflight_log = report_dir / f"preflight_once_{stamp}.log"
    cmd = [
        sys.executable,
        str(project_root / "scripts" / "optiplan_preflight_check.py"),
        "--json-out",
        str(preflight_json),
    ]
    if rule_file.exists():
        cmd.extend(["--xlsx", str(rule_file)])

    started = datetime.now().isoformat(timespec="seconds")
    rc = _run_command_stream(cmd, cwd=project_root, log_path=preflight_log)
    ended = datetime.now().isoformat(timespec="seconds")
    return {
        "started_at": started,
        "ended_at": ended,
        "exit_code": rc,
        "json_report": str(preflight_json),
        "log_file": str(preflight_log),
        "command": cmd,
    }


def _run_professional(
    *,
    project_root: Path,
    xlsx: Path,
    timeout_sec: float,
    optimize_timeout_sec: float,
    skip_preflight: bool,
    skip_ui_map: bool,
    skip_optimize: bool,
    report_dir: Path,
) -> dict[str, Any]:
    stamp = _now_stamp()
    run_report = report_dir / f"{xlsx.stem}_{stamp}.json"
    run_log = report_dir / f"{xlsx.stem}_{stamp}.log"

    cmd = [
        sys.executable,
        str(project_root / "scripts" / "optiplan_professional_run.py"),
        "--xlsx",
        str(xlsx),
        "--timeout",
        str(timeout_sec),
        "--optimize-timeout",
        str(optimize_timeout_sec),
        "--report-json",
        str(run_report),
    ]
    if skip_preflight:
        cmd.append("--skip-preflight")
    if skip_ui_map:
        cmd.append("--skip-ui-map")
    if skip_optimize:
        cmd.append("--skip-optimize")
    else:
        cmd.append("--run-optimize")

    started = datetime.now().isoformat(timespec="seconds")
    rc = _run_command_stream(cmd, cwd=project_root, log_path=run_log)
    ended = datetime.now().isoformat(timespec="seconds")

    return {
        "started_at": started,
        "ended_at": ended,
        "exit_code": rc,
        "command": cmd,
        "run_report": str(run_report),
        "run_log": str(run_log),
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="OptiPlanning ordered inbox runner")
    p.add_argument(
        "--rule-file",
        default=str(DEFAULT_RULE_FILE),
        help="Kural referans dosyasi (pattern + klasor bu dosyadan turetilir)",
    )
    p.add_argument("--inbox-dir", help="Gelen XLSX klasoru (varsayilan: rule-file parent)")
    p.add_argument("--processed-dir", help="Basarili dosya tasima klasoru")
    p.add_argument("--failed-dir", help="Hatali dosya tasima klasoru")
    p.add_argument("--processing-dir", help="Islenmekte olan dosyalar icin gecici klasor")
    p.add_argument("--once", action="store_true", help="Tek tur calis, yeni dosya bekleme")
    p.add_argument("--poll-sec", type=float, default=DEFAULT_POLL_SEC, help="Sonsuz mod bekleme suresi")
    p.add_argument("--max-files", type=int, default=0, help="Islenecek maksimum dosya sayisi (0=sizirsiz)")
    p.add_argument(
        "--stable-seconds",
        type=float,
        default=DEFAULT_STABLE_SECONDS,
        help="Dosya boyut/zaman stabilite kontrol suresi (sn)",
    )
    p.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SEC, help="Professional stage timeout")
    p.add_argument(
        "--optimize-timeout",
        type=float,
        default=DEFAULT_OPTIMIZE_TIMEOUT_SEC,
        help="Optimize tetikleme izleme suresi",
    )
    p.add_argument("--skip-preflight", action="store_true", help="Preflight adimini atla")
    p.set_defaults(preflight_once=True)
    p.add_argument(
        "--preflight-once",
        dest="preflight_once",
        action="store_true",
        help="Preflight kontrolunu sadece bir kez (baslangicta) calistir",
    )
    p.add_argument(
        "--no-preflight-once",
        dest="preflight_once",
        action="store_false",
        help="Preflight kontrolunu her dosya icin professional run icinde yap",
    )
    p.add_argument("--skip-ui-map", action="store_true", help="UI map adimini atla")
    p.add_argument("--skip-optimize", action="store_true", help="Optimize adimini atla")
    p.add_argument(
        "--quick",
        action="store_true",
        help="Hizli mod: skip-preflight + skip-ui-map",
    )
    p.add_argument("--dry-run", action="store_true", help="Sadece siralama/queue kontrolu, islem yapma")
    p.add_argument("--report-dir", default="logs/optiplan_queue", help="Queue rapor cikti klasoru")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(__file__).resolve().parent.parent

    if args.quick:
        args.skip_preflight = True
        args.skip_ui_map = True
        if args.stable_seconds == DEFAULT_STABLE_SECONDS:
            args.stable_seconds = 0.5

    rule_file = Path(args.rule_file)
    pattern = _build_pattern(rule_file)
    inbox_dir = Path(args.inbox_dir) if args.inbox_dir else rule_file.parent
    queue_root = inbox_dir.parent
    processed_dir = Path(args.processed_dir) if args.processed_dir else queue_root / "2_ISLENEN_SIPARISLER"
    failed_dir = Path(args.failed_dir) if args.failed_dir else queue_root / "3_HATALI_VERILER"
    processing_dir = Path(args.processing_dir) if args.processing_dir else queue_root / DEFAULT_PROCESSING_FOLDER
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)

    if not inbox_dir.exists():
        print(f"HATA: Inbox klasoru bulunamadi: {inbox_dir}", file=sys.stderr)
        return 2

    print("ORDERED_INBOX_RULE", flush=True)
    print(f"  rule_file : {rule_file}", flush=True)
    print(f"  inbox_dir : {inbox_dir}", flush=True)
    print(f"  pattern   : {pattern.prefix}*{pattern.suffix}", flush=True)
    print(f"  processing: {processing_dir}", flush=True)
    print(f"  processed : {processed_dir}", flush=True)
    print(f"  failed    : {failed_dir}", flush=True)
    if args.quick:
        print("  mode      : QUICK", flush=True)

    summary: dict[str, Any] = {
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "rule_file": str(rule_file),
        "inbox_dir": str(inbox_dir),
        "pattern_prefix": pattern.prefix,
        "pattern_suffix": pattern.suffix,
        "processing_dir": str(processing_dir),
        "processed_dir": str(processed_dir),
        "failed_dir": str(failed_dir),
        "dry_run": args.dry_run,
        "quick_mode": args.quick,
        "options": {
            "poll_sec": args.poll_sec,
            "max_files": args.max_files,
            "stable_seconds": args.stable_seconds,
            "timeout": args.timeout,
            "optimize_timeout": args.optimize_timeout,
            "skip_preflight": args.skip_preflight,
            "preflight_once": args.preflight_once,
            "skip_ui_map": args.skip_ui_map,
            "skip_optimize": args.skip_optimize,
        },
        "items": [],
    }

    processed_count = 0
    fail_count = 0
    skipped_count = 0

    if not args.dry_run and (not args.skip_preflight) and args.preflight_once:
        print("PREFLIGHT_ONCE: basladi", flush=True)
        preflight_once = _run_preflight_once(project_root, report_dir=report_dir, rule_file=rule_file)
        summary["preflight_once"] = preflight_once
        if preflight_once["exit_code"] != 0:
            summary["ended_at"] = datetime.now().isoformat(timespec="seconds")
            summary["processed_count"] = 0
            summary["fail_count"] = 1
            summary["skipped_count"] = 0
            summary["status"] = "FAIL"
            summary["error"] = "preflight_once_failed"
            summary_path = report_dir / f"ordered_inbox_summary_{_now_stamp()}.json"
            summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"SUMMARY_JSON: {summary_path}", flush=True)
            print("SUMMARY_STATUS: FAIL", flush=True)
            return 1
        print("PREFLIGHT_ONCE: tamam", flush=True)

    while True:
        candidates = _list_candidates(inbox_dir, pattern)
        if not candidates:
            if args.once:
                break
            time.sleep(max(0.5, args.poll_sec))
            continue

        round_processed = False
        for idx, file_path in enumerate(candidates, start=1):
            if args.max_files > 0 and processed_count >= args.max_files:
                break

            if not _is_file_stable(file_path, args.stable_seconds):
                print(f"BEKLEME: Dosya stabil degil, bu tur atlandi -> {file_path.name}", flush=True)
                skipped_count += 1
                continue

            print(f"SIRADAKI_DOSYA [{idx}/{len(candidates)}]: {file_path.name}", flush=True)
            item: dict[str, Any] = {
                "file": str(file_path),
                "queued_name": file_path.name,
                "queue_index": idx,
                "queue_total": len(candidates),
                "started_at": datetime.now().isoformat(timespec="seconds"),
            }

            if args.dry_run:
                item["result"] = "DRY_RUN"
                item["moved_to"] = None
                item["ended_at"] = datetime.now().isoformat(timespec="seconds")
                summary["items"].append(item)
                processed_count += 1
                round_processed = True
                continue

            try:
                claimed = _move_file(file_path, processing_dir)
                item["claimed_to"] = str(claimed)
            except Exception as exc:
                item["result"] = "SKIP_CLAIM_FAILED"
                item["error"] = str(exc)
                item["ended_at"] = datetime.now().isoformat(timespec="seconds")
                summary["items"].append(item)
                skipped_count += 1
                continue

            per_file_skip_preflight = args.skip_preflight or args.preflight_once
            result = _run_professional(
                project_root=project_root,
                xlsx=claimed,
                timeout_sec=args.timeout,
                optimize_timeout_sec=args.optimize_timeout,
                skip_preflight=per_file_skip_preflight,
                skip_ui_map=args.skip_ui_map,
                skip_optimize=args.skip_optimize,
                report_dir=report_dir,
            )
            item.update(result)

            try:
                if result["exit_code"] == 0:
                    moved = _move_file(claimed, processed_dir)
                    item["result"] = "PASS"
                    item["moved_to"] = str(moved)
                else:
                    moved = _move_file(claimed, failed_dir)
                    item["result"] = "FAIL"
                    item["moved_to"] = str(moved)
                    fail_count += 1
            except Exception as exc:
                item["result"] = "FAIL_MOVE"
                item["error"] = str(exc)
                fail_count += 1

            item["ended_at"] = datetime.now().isoformat(timespec="seconds")
            summary["items"].append(item)
            processed_count += 1
            round_processed = True

        if args.max_files > 0 and processed_count >= args.max_files:
            break
        if args.once:
            break
        if not round_processed:
            time.sleep(max(0.5, args.poll_sec))

    summary["ended_at"] = datetime.now().isoformat(timespec="seconds")
    summary["processed_count"] = processed_count
    summary["fail_count"] = fail_count
    summary["skipped_count"] = skipped_count
    summary["status"] = "PASS" if fail_count == 0 else "FAIL"

    summary_path = report_dir / f"ordered_inbox_summary_{_now_stamp()}.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"SUMMARY_JSON: {summary_path}", flush=True)
    print(f"SUMMARY_STATUS: {summary['status']}", flush=True)
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
