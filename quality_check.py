#!/usr/bin/env python3
"""
Quality Control Script - Hızlı kod kontrol
Kullanım: python quality_check.py [--fast|--full|--security]
"""

import subprocess
import sys
import time
from pathlib import Path

BACKEND_PATH = Path(__file__).parent / "backend"
PROJECT_ROOT = Path(__file__).parent

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def run_command(cmd, description, fail_fast=False):
    """Komut çalıştır ve sonuç bildir"""
    print(f"\n{Colors.BLUE}🔍 {description}...{Colors.RESET}")
    print(f"   $ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    
    try:
        result = subprocess.run(
            cmd,
            shell=isinstance(cmd, str),
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print(f"   {Colors.GREEN}✅ PASSED{Colors.RESET}")
            return True
        else:
            print(f"   {Colors.RED}❌ FAILED{Colors.RESET}")
            if result.stdout:
                print(f"   {result.stdout[:500]}")
            if result.stderr:
                print(f"   Error: {result.stderr[:500]}")
            if fail_fast:
                sys.exit(1)
            return False
    except subprocess.TimeoutExpired:
        print(f"   {Colors.RED}⏱️  TIMEOUT{Colors.RESET}")
        return False
    except Exception as e:
        print(f"   {Colors.RED}❌ ERROR: {e}{Colors.RESET}")
        return False

def quick_check():
    """Hızlı kontrol (< 30 saniye)"""
    print(f"\n{Colors.BLUE}{'='*60}")
    print("HIZLI KOD KONTROL (Quick Check)")
    print(f"{'='*60}{Colors.RESET}")
    
    checks = [
        (["flake8", str(BACKEND_PATH), "--statistics", "--quiet"],
         "Flake8 linting"),
        (["black", "--check", str(BACKEND_PATH), "--quiet"],
         "Black code format"),
        (["python", "-m", "pytest", str(BACKEND_PATH), "-q"],
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
        (["flake8", str(BACKEND_PATH), "--max-line-length=100"],
         "Flake8 linting"),
        (["black", "--check", str(BACKEND_PATH), "--line-length=100"],
         "Black formatting"),
        (["isort", "--check-only", str(BACKEND_PATH), "--profile=black"],
         "isort import sorting"),
        (["mypy", str(BACKEND_PATH), "--ignore-missing-imports"],
         "MyPy type checking"),
        (["pylint", str(BACKEND_PATH), "--disable=all", "--enable=E,F"],
         "Pylint basic checks"),
        (["python", "-m", "pytest", str(BACKEND_PATH), "-q", "--tb=short"],
         "Unit tests"),
    ]
    
    results = []
    for cmd, desc in checks:
        results.append(run_command(cmd, desc))
    
    return all(results)

def security_check():
    """Güvenlik kontrolü"""
    print(f"\n{Colors.BLUE}{'='*60}")
    print("GÜVENLIK KONTROL (Security Check)")
    print(f"{'='*60}{Colors.RESET}")
    
    checks = [
        (["bandit", "-r", str(BACKEND_PATH), "-ll"],
         "Bandit security scan"),
        (["grep", "-r", "TODO", str(BACKEND_PATH)],
         "TODO comments check"),
        (["grep", "-r", "FIXME", str(BACKEND_PATH)],
         "FIXME comments check"),
    ]
    
    results = []
    for cmd, desc in checks:
        results.append(run_command(cmd, desc, fail_fast=False))
    
    return all(results)

def main():
    """Ana fonksiyon"""
    mode = sys.argv[1] if len(sys.argv) > 1 else "--fast"
    
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
        sys.exit(1)
    
    elapsed = time.time() - start_time
    
    print(f"\n{Colors.BLUE}{'='*60}")
    if success:
        print(f"{Colors.GREEN}✅ TÜM TESTLER GEÇTI!{Colors.RESET}")
    else:
        print(f"{Colors.RED}❌ BAZI TESTLER BAŞARISIZ OLDU{Colors.RESET}")
    print(f"⏱️  Süre: {elapsed:.2f}s")
    print(f"{'='*60}{Colors.RESET}\n")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
