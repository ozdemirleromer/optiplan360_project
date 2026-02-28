#!/usr/bin/env python3
"""
OptiPlanning preflight checks for reliable automation.

Checks:
- Registry key and core folder settings
- Folder existence and write permission
- Presence of .opf import rule files
- Windows locale separators (for import numeric parsing)
- Optional XLSX existence
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from optiplan_template_contract import validate_template_contract

REG_KEY = r"HKCU\Software\Selco S.p.A.\OptiPlanning\1.0"
REQ_REG = [
    "Language",
    "Path",
    "JobDir",
    "OpfDir",
    "SrcDir",
    "LisDir",
    "CpoDir",
]


@dataclass
class CheckResult:
    status: str
    name: str
    detail: str


def _run_reg_query() -> str:
    proc = subprocess.run(
        ["reg", "query", REG_KEY],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "reg query failed")
    return proc.stdout


def _parse_reg(stdout: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for ln in stdout.splitlines():
        line = ln.strip()
        if not line or line.startswith("HKEY_"):
            continue
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        name, _, value = parts
        out[name] = value.strip()
    return out


def _check_writeable(path: Path) -> bool:
    if not path.exists() or not path.is_dir():
        return False
    try:
        fd, tmp = tempfile.mkstemp(prefix="_optiplan_preflight_", suffix=".tmp", dir=str(path))
        os.close(fd)
        Path(tmp).unlink(missing_ok=True)
        return True
    except Exception:
        return False


def _locale_separators() -> tuple[str, str]:
    proc = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "$n=(Get-Culture).NumberFormat; Write-Output ($n.NumberDecimalSeparator + '|' + $n.NumberGroupSeparator)",
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return ("", "")
    s = (proc.stdout or "").strip()
    if "|" not in s:
        return ("", "")
    dec, grp = s.split("|", 1)
    return (dec.strip(), grp.strip())


def run_checks(xlsx_path: Path | None) -> tuple[list[CheckResult], dict[str, Any]]:
    checks: list[CheckResult] = []
    details: dict[str, Any] = {}

    try:
        reg_raw = _run_reg_query()
        reg = _parse_reg(reg_raw)
        details["registry"] = reg
        checks.append(CheckResult("PASS", "registry_key", REG_KEY))
    except Exception as exc:
        checks.append(CheckResult("FAIL", "registry_key", str(exc)))
        return checks, details

    missing = [k for k in REQ_REG if k not in reg]
    if missing:
        checks.append(CheckResult("FAIL", "registry_required_values", f"Eksik: {', '.join(missing)}"))
    else:
        checks.append(CheckResult("PASS", "registry_required_values", "Tum gerekli keyler mevcut"))

    # Path checks
    dir_keys = ["JobDir", "OpfDir", "SrcDir", "LisDir", "CpoDir"]
    for k in dir_keys:
        p = Path(reg.get(k, ""))
        if p.exists() and p.is_dir():
            checks.append(CheckResult("PASS", f"path_exists:{k}", str(p)))
        else:
            checks.append(CheckResult("FAIL", f"path_exists:{k}", str(p)))
            continue
        if _check_writeable(p):
            checks.append(CheckResult("PASS", f"path_write:{k}", str(p)))
        else:
            checks.append(CheckResult("FAIL", f"path_write:{k}", str(p)))

    exe = Path(reg.get("Path", ""))
    if exe.exists() and exe.is_file():
        checks.append(CheckResult("PASS", "optiplan_exe", str(exe)))
    else:
        checks.append(CheckResult("FAIL", "optiplan_exe", str(exe)))

    opf_dir = Path(reg.get("OpfDir", ""))
    opf_count = len(list(opf_dir.glob("*.opf"))) if opf_dir.exists() else 0
    details["opf_count"] = opf_count
    if opf_count > 0:
        checks.append(CheckResult("PASS", "opf_files", f"{opf_count} adet .opf bulundu"))
    else:
        checks.append(CheckResult("WARN", "opf_files", "Opf klasorunde .opf yok"))

    src_dir = Path(reg.get("SrcDir", ""))
    src_items = len(list(src_dir.glob("*"))) if src_dir.exists() else 0
    details["src_items"] = src_items
    checks.append(CheckResult("PASS", "import_data_folder", f"ImpFile dosya sayisi: {src_items}"))

    lang = reg.get("Language", "")
    if lang:
        checks.append(CheckResult("PASS", "ui_language", lang))
    else:
        checks.append(CheckResult("WARN", "ui_language", "Language registry degeri bos"))

    dec, grp = _locale_separators()
    details["locale_decimal"] = dec
    details["locale_group"] = grp
    if dec and grp:
        checks.append(CheckResult("PASS", "windows_locale", f"decimal='{dec}' group='{grp}'"))
    else:
        checks.append(CheckResult("WARN", "windows_locale", "Locale separator okunamadi"))

    if xlsx_path:
        if not xlsx_path.exists():
            checks.append(CheckResult("FAIL", "xlsx_exists", str(xlsx_path)))
        else:
            checks.append(CheckResult("PASS", "xlsx_exists", str(xlsx_path)))
            contract = validate_template_contract(xlsx_path)
            if contract.ok:
                checks.append(CheckResult("PASS", "xlsx_template_contract", contract.message))
            else:
                checks.append(
                    CheckResult(
                        "FAIL",
                        "xlsx_template_contract",
                        contract.message + " | " + " ; ".join(contract.mismatches),
                    )
                )

    return checks, details


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="OptiPlanning preflight check")
    p.add_argument("--xlsx", help="Kontrol edilecek xlsx dosyasi")
    p.add_argument("--json-out", help="JSON rapor dosyasi")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    xlsx = Path(args.xlsx) if args.xlsx else None
    checks, details = run_checks(xlsx)

    for c in checks:
        print(f"[{c.status}] {c.name}: {c.detail}")

    summary = {
        "fail": sum(1 for c in checks if c.status == "FAIL"),
        "warn": sum(1 for c in checks if c.status == "WARN"),
        "pass": sum(1 for c in checks if c.status == "PASS"),
    }
    print(f"SUMMARY fail={summary['fail']} warn={summary['warn']} pass={summary['pass']}")

    payload = {
        "summary": summary,
        "checks": [c.__dict__ for c in checks],
        "details": details,
    }

    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"JSON: {out}")

    return 1 if summary["fail"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
