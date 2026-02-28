#!/usr/bin/env python3
"""
ENCODING FIX v2 — Double-encoded UTF-8 (mojibake) duzeltici
=============================================================

Kullanim:
    python scripts/fix_encoding_v2.py                    # dry-run (sadece goster)
    python scripts/fix_encoding_v2.py --fix              # gercek duzeltme
    python scripts/fix_encoding_v2.py --fix --file X.py  # tek dosya

Sorun:
    Bazi dosyalarda Turkce karakterler double-encoded (UTF-8 -> Latin-1 -> UTF-8).
    Ornek: "oluşturma" -> hex c385 c5b8 (yanlis) yerine c59f (dogru)

Cozum:
    Bilinen mojibake byte dizilerini dogru UTF-8 karsiliklariyla degistirir.
    Binary seviyede calisir, metin seviyesinde degil.
"""

import argparse
import os
import sys
from pathlib import Path

# Windows console encoding fix
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ============================================================
# Bilinen mojibake -> dogru UTF-8 byte mapping
# Pattern: double-encoded UTF-8 bytes -> single UTF-8 bytes
# ============================================================
MOJIBAKE_FIXES: list[tuple[bytes, bytes]] = [
    # Turkce kucuk harfler
    (b"\xc3\x84\xc2\xb1", b"\xc4\xb1"),  # ı
    (b"\xc3\x85\xc2\x9f", b"\xc5\x9f"),  # ş (double-encoded: C5 9F -> C3 85 C2 9F)
    (b"\xc3\x85\xc5\xb8", b"\xc5\x9f"),  # ş (alt mojibake pattern)
    (b"\xc3\x84\xc2\x9f", b"\xc4\x9f"),  # ğ (double-encoded: C4 9F -> C3 84 C2 9F)
    (b"\xc3\x84\xc5\xb8", b"\xc4\x9f"),  # ğ (alt mojibake pattern)
    (b"\xc3\x84\xc2\xb0", b"\xc4\xb0"),  # İ
    (b"\xc3\x83\xc2\xa7", b"\xc3\xa7"),  # ç (double-encoded)
    (b"\xc3\x83\xc2\xbc", b"\xc3\xbc"),  # ü (double-encoded)
    (b"\xc3\x83\xc2\xb6", b"\xc3\xb6"),  # ö (double-encoded)
    # Turkce buyuk harfler
    (b"\xc3\x85\xc2\x9e", b"\xc5\x9e"),  # Ş (double-encoded: C5 9E -> C3 85 C2 9E)
    (b"\xc3\x85\xc5\x9e", b"\xc5\x9e"),  # Ş (alt mojibake pattern)
    (b"\xc3\x84\xc2\x9e", b"\xc4\x9e"),  # Ğ (double-encoded: C4 9E -> C3 84 C2 9E)
    (b"\xc3\x84\xc5\x9e", b"\xc4\x9e"),  # Ğ (alt mojibake pattern)
    (b"\xc3\x83\xc5\x93", b"\xc3\x9c"),  # Ü
    (b"\xc3\x83\xe2\x80\x93", b"\xc3\x96"),  # Ö
    (b"\xc3\x83\xc2\x87", b"\xc3\x87"),  # Ç
    # Ozel karakterler
    (b"\xc3\x82\xc2\xa7", b"\xc2\xa7"),  # §
    (b"\xc3\x82\xc2\xa0", b"\xc2\xa0"),  # nbsp
    # Akilli tirnaklar / dash mojibake
    (b"\xe2\x80\x93\xe2\x80\x9d", b"\xe2\x80\x93"),  # – (en-dash, fazladan " kaldir)
    (b"\xe2\x80\x98\xe2\x80\x99", b"\xe2\x80\x99"),  # ' (smart quote temizle)
    # Box-drawing / arrow double-encoded mojibake
    (b"\xc3\xa2\xe2\x80\x9d\xe2\x82\xac", b"\xe2\x94\x80"),  # ─ (box-drawing horizontal)
    (b"\xc3\xa2\xe2\x80\xa0\xe2\x80\x99", b"\xe2\x86\x92"),  # → (arrow right)
    (b"\xc3\xa2\xe2\x80\xa2\xc2\x90", b"\xe2\x96\x90"),  # ▐ (block element, 7-byte pattern)
]

# BOM bytes
UTF8_BOM = b"\xef\xbb\xbf"

# Taranacak dosya uzantilari
EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml"}

# Atlanacak klasorler
IGNORE_DIRS = {".git", ".venv", "__pycache__", "node_modules", "dist", "build", ".pytest_cache"}

# Bilinen sorunlu dosyalar (oncelikli tarama)
KNOWN_PROBLEM_FILES = [
    "backend/app/main.py",
    "backend/app/routers/admin_router.py",
    "backend/app/routers/biesse_router.py",
    "backend/app/services/biesse_integration_service.py",
]


def fix_file_bytes(filepath: Path, dry_run: bool = True) -> int:
    """Dosyadaki mojibake byte pattern'larini duzelt. Fix sayisini dondur."""
    raw = filepath.read_bytes()
    original = raw

    # BOM kaldir
    if raw.startswith(UTF8_BOM):
        raw = raw[3:]

    # Mojibake pattern'lari degistir (uzun pattern'lar once)
    total_fixes = 0
    for bad, good in sorted(MOJIBAKE_FIXES, key=lambda x: len(x[0]), reverse=True):
        count = raw.count(bad)
        if count > 0:
            raw = raw.replace(bad, good)
            total_fixes += count

    if total_fixes == 0:
        return 0

    # Dogrulama: sonuc gecerli UTF-8 mi?
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError as e:
        print(f"  UYARI: {filepath} — duzeltme sonrasi UTF-8 decode hatasi: {e}")
        print(f"  ATLANIR (dosya degistirilmedi)")
        return 0

    if dry_run:
        print(f"  TESPIT: {filepath} — {total_fixes} mojibake pattern bulundu")
        # Ornekleri goster
        orig_text = original.decode("utf-8", errors="replace")
        fixed_text = raw.decode("utf-8")
        orig_lines = orig_text.splitlines()
        fixed_lines = fixed_text.splitlines()
        shown = 0
        for i, (ol, fl) in enumerate(zip(orig_lines, fixed_lines)):
            if ol != fl and shown < 3:
                print(f"    Satir {i+1}: {ol.strip()[:60]}")
                print(f"    Duzelt: {fl.strip()[:60]}")
                shown += 1
    else:
        filepath.write_bytes(raw)
        print(f"  DUZELT: {filepath} — {total_fixes} mojibake duzeltildi")

    return total_fixes


def iter_files(root: Path) -> list[Path]:
    """Taranacak dosyalari listele."""
    files = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in EXTENSIONS:
            continue
        if any(part in IGNORE_DIRS for part in path.parts):
            continue
        files.append(path)
    return files


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--fix", action="store_true", help="Gercek duzeltme yap (varsayilan: dry-run)"
    )
    parser.add_argument("--file", type=str, help="Sadece belirtilen dosyayi duzelt")
    parser.add_argument("--root", type=str, default=".", help="Proje kok klasoru")
    args = parser.parse_args()

    dry_run = not args.fix
    root = Path(args.root)

    print("=" * 60)
    if dry_run:
        print("ENCODING FIX v2 — DRY RUN (degisiklik yapilmaz)")
        print("Gercek duzeltme icin: python scripts/fix_encoding_v2.py --fix")
    else:
        print("ENCODING FIX v2 — DUZELTME MODU")
    print("=" * 60)
    print()

    if args.file:
        files = [Path(args.file)]
    else:
        # Once bilinen sorunlu dosyalar
        files = [root / f for f in KNOWN_PROBLEM_FILES if (root / f).exists()]
        # Sonra geri kalan
        all_files = iter_files(root)
        known_set = set(f.resolve() for f in files)
        files.extend(f for f in all_files if f.resolve() not in known_set)

    total_fixes = 0
    fixed_files = 0

    for filepath in files:
        if not filepath.exists():
            continue
        count = fix_file_bytes(filepath, dry_run=dry_run)
        if count > 0:
            total_fixes += count
            fixed_files += 1

    print()
    print("=" * 60)
    mode = "TESPIT" if dry_run else "DUZELT"
    print(f"SONUC [{mode}]: {fixed_files} dosya, {total_fixes} mojibake pattern")
    if dry_run and total_fixes > 0:
        print()
        print("Duzeltmek icin:")
        print("  python scripts/fix_encoding_v2.py --fix")
    print("=" * 60)

    return 0 if total_fixes == 0 or not dry_run else 1


if __name__ == "__main__":
    sys.exit(main())
