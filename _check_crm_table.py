import sqlite3

conn = sqlite3.connect("optiplan.db")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", " | ".join(tables))

if "crm_quotes" in tables:
    cur.execute("PRAGMA table_info(crm_quotes)")
    cols = cur.fetchall()
    print("\ncrm_quotes columns:")
    for col in cols:
        print(f"  {col[1]} ({col[2]})")
else:
    print("\ncrm_quotes: NOT FOUND")

conn.close()
