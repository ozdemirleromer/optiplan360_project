#!/usr/bin/env python3
"""Validate OptiPlanning XLSX row-1/row-2 template contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from optiplan_template_contract import validate_template_contract


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Validate XLSX template contract (rows 1-2)")
    p.add_argument("--xlsx", required=True, help="Kontrol edilecek xlsx dosyasi")
    p.add_argument("--sheet", help="Sayfa adi (varsayilan: aktif sayfa)")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    xlsx = Path(args.xlsx)
    if not xlsx.exists():
        print(f"HATA: XLSX bulunamadi: {xlsx}")
        return 2

    res = validate_template_contract(xlsx, sheet_name=args.sheet)
    if res.ok:
        print(f"TAMAM: {res.message}. Kolon sayisi={res.column_count}")
        return 0

    print(f"HATA: {res.message}")
    for m in res.mismatches:
        print(f" - {m}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
