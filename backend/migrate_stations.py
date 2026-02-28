#!/usr/bin/env python3
"""
Stations tablosuna eksik kolonları ekle (idempotent).
SQLite: ALTER TABLE ... ADD COLUMN (IF NOT EXISTS desteklenmiyor, try/except kullan)
"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, engine
from sqlalchemy import text, inspect

db = SessionLocal()
try:
    inspector = inspect(engine)
    existing_cols = {c["name"] for c in inspector.get_columns("stations")}
    print(f"Mevcut kolonlar: {sorted(existing_cols)}")

    # (kolon_adı, SQL tipi, varsayılan değer)
    needed = [
        ("active",                "BOOLEAN",   "1"),
        ("last_scan_at",          "TIMESTAMP", "NULL"),
        ("scan_count_today",      "INTEGER",   "0"),
        ("istasyon_durumu",       "VARCHAR",   "'Hazır'"),
        ("device_type",           "VARCHAR",   "NULL"),
        ("device_model",          "VARCHAR",   "NULL"),
        ("device_serial_number",  "VARCHAR",   "NULL"),
        ("ip_address",            "VARCHAR",   "NULL"),
        ("connection_type",       "VARCHAR",   "NULL"),
        ("installation_date",     "TIMESTAMP", "NULL"),
        ("last_maintenance_date", "TIMESTAMP", "NULL"),
    ]

    added = []
    for col, dtype, default in needed:
        if col in existing_cols:
            print(f"  ✓ {col} (mevcut)")
            continue
        try:
            db.execute(text(f"ALTER TABLE stations ADD COLUMN {col} {dtype} DEFAULT {default}"))
            added.append(col)
            print(f"  + {col} eklendi")
        except Exception as e:
            print(f"  ✗ {col} eklenemedi: {e}")

    db.commit()
    if added:
        print(f"\n✅ {len(added)} kolon eklendi: {added}")
    else:
        print("\n✅ Tüm kolonlar zaten mevcuttu.")

except Exception as e:
    print(f"\n❌ Hata: {e}")
    db.rollback()
    sys.exit(1)
finally:
    db.close()
