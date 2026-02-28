#!/usr/bin/env python3
"""Detect mojibake-style encoding artifacts in project source files.

Usage:
    python scripts/check_encoding.py
    python scripts/check_encoding.py --root backend --root frontend/src
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


DEFAULT_ROOTS: tuple[str, ...] = (".",)
DEFAULT_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".py",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".md",
        ".yml",
        ".yaml",
        ".ini",
        ".txt",
    }
)
IGNORE_DIR_NAMES: frozenset[str] = frozenset(
    {
        ".git",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        "node_modules",
        "dist",
        "build",
        ".npm-cache",
        ".vs",
        ".vscode",
    }
)

# Character code points commonly seen in UTF-8 mojibake.
SUSPECT_CODEPOINTS: frozenset[int] = frozenset(
    {
        0x00C2,  # C2 marker
        0x00C3,  # C3 marker
        0x00C4,  # C4 marker
        0x00C5,  # C5 marker
        0x00E2,  # E2 marker
        0x0090,  # control char seen in broken box-drawing sequences
        0xFFFD,  # Unicode replacement character
    }
)


@dataclass(frozen=True)
class Finding:
    path: Path
    line_no: int
    line: str


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        action="append",
        default=[],
        help="Root directory to scan. Can be provided multiple times.",
    )
    parser.add_argument(
        "--max-output",
        type=int,
        default=200,
        help="Maximum number of findings to print (default: 200).",
    )
    return parser.parse_args(argv)


def is_ignored(path: Path) -> bool:
    return any(part in IGNORE_DIR_NAMES for part in path.parts)


def has_mojibake_markers(line: str) -> bool:
    return any(ord(ch) in SUSPECT_CODEPOINTS for ch in line)


def scan_file(path: Path) -> Iterable[Finding]:
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ()

    findings: list[Finding] = []
    for line_no, line in enumerate(content.splitlines(), start=1):
        if has_mojibake_markers(line):
            findings.append(Finding(path=path, line_no=line_no, line=line))
    return findings


def iter_source_files(roots: Sequence[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in DEFAULT_EXTENSIONS:
                continue
            if is_ignored(path):
                continue
            yield path


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    roots = [Path(p) for p in (args.root or list(DEFAULT_ROOTS))]

    findings: list[Finding] = []
    for path in iter_source_files(roots):
        findings.extend(scan_file(path))

    if not findings:
        print("Encoding check passed: no mojibake markers found.")
        return 0

    print(f"Encoding check failed: {len(findings)} potential issue(s) found.")
    print()
    for finding in findings[: args.max_output]:
        escaped = finding.line.encode("unicode_escape").decode("ascii")
        print(f"{finding.path}:{finding.line_no}: {escaped}")

    remaining = len(findings) - args.max_output
    if remaining > 0:
        print()
        print(f"... {remaining} more finding(s) not shown.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
