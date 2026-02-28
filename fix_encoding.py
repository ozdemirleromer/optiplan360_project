#!/usr/bin/env python3
"""Fix known mojibake sequences in Admin TSX files.

Usage:
    python fix_encoding.py
    python fix_encoding.py --path frontend/src/components/Admin
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


DEFAULT_PATH = "frontend/src/components/Admin"

# Explicit unicode escapes keep this file ASCII-only.
REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("\\u00c4\\u00b1", "\\u0131"),
    ("\\u00c3\\u00bc", "\\u00fc"),
    ("\\u00c3\\u00b6", "\\u00f6"),
    ("\\u00c3\\u00a7", "\\u00e7"),
    ("\\u00c5\\u0178", "\\u015f"),
    ("\\u00c4\\u0178", "\\u011f"),
    ("\\u00c4\\u00b0", "\\u0130"),
    ("\\u00c3\\u20ac", "\\u00c0"),
    ("\\u00e2\\u20ac\\u201d", "\\u2013"),
    ("\\u00e2\\u20ac\\u02dc", "'"),
    ("\\u00e2\\u20ac\\u2122", "'"),
    ("\\u00c3\\u00a2", "\\u00e2"),
    ("\\u00c2", ""),
    ("\\u00e2\\u201a\\u00ba", "\\u20ba"),
    ("//\\u00e2\\"\\u20ac\\u00e2\\"\\u20ac", "// \\u2500\\u2500"),
    ("/\\\\*\\u00e2\\"\\u20ac\\u00e2\\"\\u20ac", "/* \\u2500\\u2500"),
    ("\\u00c3\\u00b4", "\\u00f4"),
    ("\\u00c2\\u00b7", "\\u00b7"),
)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        default=DEFAULT_PATH,
        help="Directory containing TSX files to fix.",
    )
    return parser.parse_args(argv)


def process_file(file_path: Path) -> bool:
    content = file_path.read_text(encoding="utf-8")
    original = content

    for old, new in REPLACEMENTS:
        content = content.replace(old, new)

    if content == original:
        print(f"{file_path.name}: no changes")
        return False

    file_path.write_text(content, encoding="utf-8")
    print(f"{file_path.name}: fixed")
    return True


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    target = Path(args.path)

    if not target.exists() or not target.is_dir():
        print(f"Path not found or not a directory: {target}")
        return 1

    changed = 0
    files = sorted(target.glob("*.tsx"))
    for file_path in files:
        if process_file(file_path):
            changed += 1

    print(f"\nDone. changed_files={changed} scanned_files={len(files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
