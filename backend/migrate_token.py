import sqlite3
import os
import uuid

db_path = os.path.join(os.path.dirname(__file__), "..", "..", "optiplan.db")
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}!")
else:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE orders ADD COLUMN tracking_token VARCHAR(36);")
        cur.execute("CREATE UNIQUE INDEX ix_orders_tracking_token ON orders(tracking_token);")
        print("Column added successfully.")
        
        # Populate existing rows with tokens
        cur.execute("SELECT id FROM orders WHERE tracking_token IS NULL")
        rows = cur.fetchall()
        for row in rows:
            cur.execute("UPDATE orders SET tracking_token = ? WHERE id = ?", (str(uuid.uuid4()), row[0]))
        conn.commit()
        print(f"Updated {len(rows)} old rows with tracking tokens.")
        
    except Exception as e:
        print("Migration error:", e)
    finally:
        conn.close()
