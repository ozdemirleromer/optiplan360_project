import os
import sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password

def ensure_admin():
    db = SessionLocal()
    admin = db.query(User).filter_by(username="admin").first()
    if admin:
        print("Admin zaten mevcut!")
        return
    user = User(
        username="admin",
        email="admin@optiplan360.local",
        display_name="Admin",
        password_hash=hash_password("admin"),
        role="ADMIN",
        is_active=True
    )
    db.add(user)
    db.commit()
    print("Admin kullanıcı başarıyla eklendi!")
    db.close()

if __name__ == "__main__":
    ensure_admin()
