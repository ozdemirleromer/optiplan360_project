#!/usr/bin/env python3

# -*- coding: utf-8 -*-

"""

Quality Control Script - Hızlı kod kontrol

Kullanım: python quality_check.py [--fast|--full|--security]



Not: Bu script backend/.venv içindeki araçları otomatik bulur.

     Encoding sorunlarını önlemek için UTF-8 zorlanır.

"""



import os

import re

import subprocess

import sys

import time

from pathlib import Path



# --- Yollar ---

PROJECT_ROOT = Path(__file__).parent

BACKEND_PATH = PROJECT_ROOT / "backend"

BACKEND_APP_PATH = BACKEND_PATH / "app"



# Backend venv'deki araç yollarını bul

_VENV_SCRIPTS = BACKEND_PATH / ".venv" / "Scripts"  # Windows

if not _VENV_SCRIPTS.exists():

    _VENV_SCRIPTS = BACKEND_PATH / ".venv" / "bin"  # Linux/Mac



def _tool(name: str) -> str:

    """Backend venv'deki aracın tam yolunu döndür."""

    exe = _VENV_SCRIPTS / (name + (".exe" if os.name == "nt" else ""))

    if exe.exists():

        return str(exe)

    # fallback: PATH'te ara

    return name



PYTHON = _tool("python")

FLAKE8 = _tool("flake8")

BLACK = _tool("black")

ISORT = _tool("isort")

MYPY = _tool("mypy")

PYLINT = _tool("pylint")

BANDIT = _tool("bandit")





class Colors:

    GREEN = "\033[92m"

    RED = "\033[91m"

    YELLOW = "\033[93m"

    BLUE = "\033[94m"

    RESET = "\033[0m"





def run_command(cmd, description, fail_fast=False, timeout_sec=120):

    """Komut çalıştır ve sonuç bildir (UTF-8 encoding zorunlu)."""

    print(f"\n{Colors.BLUE}🔍 {description}...{Colors.RESET}")

    cmd_str = " ".join(cmd) if isinstance(cmd, list) else cmd

    print(f"   $ {cmd_str}")



    env = os.environ.copy()

    env["PYTHONIOENCODING"] = "utf-8"

    env["PYTHONUTF8"] = "1"



    try:

        result = subprocess.run(

            cmd,

            capture_output=True,

            text=True,

            timeout=timeout_sec,

            encoding="utf-8",

            errors="replace",

            env=env,

        )



        if result.returncode == 0:

            print(f"   {Colors.GREEN}✅ PASSED{Colors.RESET}")

            if result.stdout and result.stdout.strip():

                # Sadece ilk birkaç satırı göster

                lines = result.stdout.strip().splitlines()

                for line in lines[:5]:

                    print(f"   {line}")

                if len(lines) > 5:

                    print(f"   ... (+{len(lines)-5} satır)")

            return True

        else:

            print(f"   {Colors.RED}❌ FAILED{Colors.RESET}")

            output = (result.stdout or "") + (result.stderr or "")

            if output.strip():

                lines = output.strip().splitlines()

                for line in lines[:15]:

                    print(f"   {line}")

                if len(lines) > 15:

                    print(f"   ... (+{len(lines)-15} satır daha)")

            if fail_fast:

                sys.exit(1)

            return False

    except FileNotFoundError:

        print(f"   {Colors.RED}❌ ARAÇ BULUNAMADI: {cmd[0]}{Colors.RESET}")

        print(f"   Çözüm: pip install {Path(cmd[0]).stem}")

        return False

    except subprocess.TimeoutExpired:

        print(f"   {Colors.RED}⏱️  TIMEOUT ({timeout_sec}s){Colors.RESET}")

        return False

    except Exception as e:

        print(f"   {Colors.RED}❌ ERROR: {e}{Colors.RESET}")

        return False





def _count_pattern_in_dir(pattern: str, directory: Path, label: str) -> bool:

    """Dizindeki dosyalarda regex pattern ara (grep alternatifi, cross-platform)."""

    print(f"\n{Colors.BLUE}🔍 {label}...{Colors.RESET}")

    count = 0

    matches = []

    for py_file in directory.rglob("*.py"):

        # __pycache__ ve .venv atla

        parts = py_file.parts

        if "__pycache__" in parts or ".venv" in parts:

            continue

        try:

            text = py_file.read_text(encoding="utf-8", errors="replace")

            for i, line in enumerate(text.splitlines(), 1):

                if re.search(pattern, line):

                    count += 1

                    if len(matches) < 10:

                        rel = py_file.relative_to(directory)

                        matches.append(f"   {rel}:{i}: {line.strip()[:80]}")

        except Exception:

            pass



    if count == 0:

        print(f"   {Colors.GREEN}✅ Bulunamadı (temiz){Colors.RESET}")

        return True

    else:

        print(f"   {Colors.YELLOW}⚠️  {count} adet bulundu:{Colors.RESET}")

        for m in matches:

            print(m)

        if count > 10:

            print(f"   ... (+{count-10} adet daha)")

        return True  # Bilgilendirme — fail değil





def quick_check():

    """Hızlı kontrol (< 30 saniye)"""

    print(f"\n{Colors.BLUE}{'='*60}")

    print("HIZLI KOD KONTROL (Quick Check)")

    print(f"{'='*60}{Colors.RESET}")



    checks = [

        ([FLAKE8, str(BACKEND_APP_PATH), "--statistics", "--quiet",

          "--max-line-length=100"],

         "Flake8 linting"),

        ([BLACK, "--check", str(BACKEND_APP_PATH), "--quiet",

          "--line-length=100"],

         "Black code format"),

        ([PYTHON, "-m", "pytest", str(BACKEND_PATH), "-q", "--tb=line",

          "--no-header"],

         "Unit tests"),

    ]



    results = []

    for cmd, desc in checks:

        results.append(run_command(cmd, desc))



    return all(results)





def full_check():

    """Tam kontrol (< 2 dakika)"""

    print(f"\n{Colors.BLUE}{'='*60}")

    print("TAM KOD KONTROL (Full Check)")

    print(f"{'='*60}{Colors.RESET}")



    checks = [

        ([FLAKE8, str(BACKEND_APP_PATH), "--max-line-length=100",

          "--exclude=__pycache__,.venv,alembic"],

         "Flake8 linting"),

        ([BLACK, "--check", str(BACKEND_APP_PATH), "--line-length=100"],

         "Black formatting"),

        ([ISORT, "--check-only", str(BACKEND_APP_PATH), "--profile=black",

          "--line-length=100"],

         "isort import sorting"),

        ([MYPY, str(BACKEND_APP_PATH), "--ignore-missing-imports",

          "--no-error-summary"],

         "MyPy type checking"),

        ([PYLINT, str(BACKEND_APP_PATH), "--disable=all", "--enable=E,F",

          "--recursive=y"],

         "Pylint basic checks"),

        ([PYTHON, "-m", "pytest", str(BACKEND_PATH), "-q", "--tb=short",

          "--no-header"],

         "Unit tests"),

    ]



    results = []

    for cmd, desc in checks:

        results.append(run_command(cmd, desc))



    return all(results)





def security_check():

    """Güvenlik kontrolü"""

    print(f"\n{Colors.BLUE}{'='*60}")

    print("GÜVENLİK KONTROL (Security Check)")

    print(f"{'='*60}{Colors.RESET}")



    results = []



    # Bandit güvenlik taraması

    results.append(run_command(

        [BANDIT, "-r", str(BACKEND_APP_PATH), "-ll", "-q"],

        "Bandit security scan",

    ))



    # Isaretleyici taramasi (cross-platform, Python tabanli tarayici)

    _count_pattern_in_dir(r"\bTODO\b", BACKEND_APP_PATH, "TODO comments check")

    _count_pattern_in_dir(r"\bFIXME\b", BACKEND_APP_PATH, "FIXME comments check")



    # Hardcoded secret taraması

    _count_pattern_in_dir(

        r'(?i)(password|secret|api_key|token)\s*=\s*["\'][^"\']{4,}',

        BACKEND_APP_PATH,

        "Hardcoded secret check",

    )



    return all(results)





def main():

    """Ana fonksiyon"""

    mode = sys.argv[1] if len(sys.argv) > 1 else "--fast"



    # UTF-8 stdout/stderr zorla

    if sys.stdout.encoding != "utf-8":

        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if sys.stderr.encoding != "utf-8":

        sys.stderr.reconfigure(encoding="utf-8", errors="replace")



    start_time = time.time()



    if mode == "--fast":

        success = quick_check()

    elif mode == "--full":

        success = full_check()

    elif mode == "--security":

        success = security_check()

    else:

        print(f"{Colors.YELLOW}Kullanım:{Colors.RESET}")

        print("  python quality_check.py [--fast|--full|--security]")

        print("    --fast     Hızlı kontrol (flake8 + black + pytest)")

        print("    --full     Tam kontrol (+ isort + mypy + pylint)")

        print("    --security Güvenlik taraması (bandit + secret scan)")

        sys.exit(1)



    elapsed = time.time() - start_time



    print(f"\n{'='*60}")

    if success:

        print(f"{Colors.GREEN}✅ TÜM TESTLER GEÇTİ!{Colors.RESET}")

    else:

        print(f"{Colors.RED}❌ BAZI TESTLER BAŞARISIZ OLDU{Colors.RESET}")

    print(f"⏱️  Süre: {elapsed:.2f}s")

    print(f"{'='*60}\n")



    sys.exit(0 if success else 1)





if __name__ == "__main__":

    main()

