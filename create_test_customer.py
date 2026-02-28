import os
import sys

# Script'i backend klasöründen veya ana klasörden çalıştırmaya uygun hale getiriyoruz
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.database import SessionLocal
from app.models.core import User
from app.models.crm import CRMAccount
from app.auth import hash_password

def create_test_customer():
    db = SessionLocal()
    try:
        # Önce test için bir CRM hesabı (Şirket) oluşturalım veya bulalım
        crm_account = db.query(CRMAccount).filter(CRMAccount.company_name == "Test Müşteri A.Ş.").first()
        if not crm_account:
            import uuid
            crm_account = CRMAccount(
                id=str(uuid.uuid4()),
                company_name="Test Müşteri A.Ş.",
                email="iletisim@testmusteri.com",
                phone="05551112233",
                account_type="CUSTOMER",
                status="ACTIVE"
            )
            db.add(crm_account)
            db.commit()
            db.refresh(crm_account)
            print(f"CRM Hesabı oluşturuldu: {crm_account.company_name} (ID: {crm_account.id})")
        else:
            print(f"Yükleme: Mevcut CRM Hesabı bulundu: {crm_account.company_name}")

        # Şimdi bu CRM hesabına bağlı bir müşteri kullanıcısı oluşturalım
        user = db.query(User).filter(User.username == "musteri_test").first()
        if not user:
            user = User(
                username="musteri_test",
                email="iletisim@testmusteri.com",
                password_hash=hash_password("musteri123"),
                display_name="Test Müşteri",
                role="CUSTOMER",
                is_active=True,
                crm_account_id=crm_account.id
            )
            db.add(user)
            db.commit()
            print("Test müşteri kullanıcısı oluşturuldu!")
            print("--------------------------------------------------")
            print("Giriş Bilgileri:")
            print("Kullanıcı Adı: musteri_test")
            print("Şifre        : musteri123")
            print("--------------------------------------------------")
        else:
            print("Müşteri kullanıcısı (musteri_test) zaten mevcut. Şifresi: musteri123")

    except Exception as e:
        print(f"Hata: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_customer()
