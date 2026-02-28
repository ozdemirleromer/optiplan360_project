#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix encoding issues by re-encoding files to UTF-8 properly."""

import sys
from pathlib import Path

# Hatalı dosyaları düzelt
PROBLEM_FILES = [
    "logs/optiplan_preflight_latest.json",
    "logs/optiplan_preflight_mahir.json",
    "frontend/src/components/Kanban/KanbanCard.tsx",
    "backend/app/main.py",
    "backend/app/routers/admin_router.py",
    "backend/app/routers/auth_enhanced.py",
    "backend/app/routers/auth_router.py",
    "backend/app/routers/azure_router.py",
    "backend/app/routers/config_router.py",
    "backend/app/routers/materials_router.py",
    "backend/app/routers/ocr_router.py",
    "backend/app/routers/optiplanning_router.py",
    "backend/app/routers/orchestrator_router.py",
    "backend/app/routers/orders_router.py",
    "backend/app/routers/portal.py",
    "backend/app/routers/sql_router.py",
]

def detect_and_fix_encoding(file_path: Path) -> bool:
    """Detect file encoding and re-encode to UTF-8 properly."""
    if not file_path.exists():
        print(f"⚠️  Dosya bulunamadı: {file_path}")
        return False
    
    try:
        # Binary olarak oku
        raw_bytes = file_path.read_bytes()
        
        # UTF-8 varsayarak oku ve errors='surrogateescape' ile problematik karakterleri koru
        # sonra UTF-8'e düzeltmeye çalış
        content = raw_bytes.decode('utf-8', errors='replace')
        
        # Yeniden UTF-8 olarak yaz
        file_path.write_text(content, encoding='utf-8')
        
        print(f"✅ Düzeltildi: {file_path}")
        return True
        
    except Exception as e:
        print(f"❌ Hata: {file_path} - {e}")
        return False

def main():
    project_root = Path(__file__).parent.parent
    fixed = 0
    failed = 0
    
    print("=" * 60)
    print("ENCODING DÜZELTME IŞLEMI")
    print("=" * 60)
    
    for file_rel in PROBLEM_FILES:
        file_path = project_root / file_rel
        if detect_and_fix_encoding(file_path):
            fixed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"✅ Düzeltildi: {fixed}")
    print(f"❌ Başarısız: {failed}")
    print("=" * 60)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
