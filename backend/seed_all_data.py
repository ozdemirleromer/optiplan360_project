"""
OptiPlan360 - Kapsamli Veri Yukleme Script'i
=============================================
40 musteri, 100 siparis, CRM, Payment, Stock ve tum modüller icin test verisi uretir.

Kullanim:
  1. Backend calistir: uvicorn app.main:app --port 8000
  2. Script'i calistir: python seed_all_data.py
"""

import requests
import random
import sys
import os
import uuid
from datetime import datetime, timedelta
import time

# ── Yapilandirma ──────────────────────────────────────────────
API_BASE = "http://localhost:8080"
USERNAME = "admin"
PASSWORD = "admin"

# ── Renkli konsol ─────────────────────────────────────────────
class C:
    H = '\033[95m'; B = '\033[94m'; G = '\033[92m'; W = '\033[93m'
    F = '\033[91m'; E = '\033[0m'; BD = '\033[1m'

def ok(msg):  print(f"{C.G}  + {msg}{C.E}")
def err(msg): print(f"{C.F}  x {msg}{C.E}")
def warn(msg): print(f"{C.W}  ! {msg}{C.E}")
def section(t): print(f"\n{C.H}{C.BD}{'='*60}\n  {t}\n{'='*60}{C.E}")
def info(msg): print(f"{C.B}  {msg}{C.E}")

# ── Turk veri jeneratoru ─────────────────────────────────────
PREFIXES = ["Elit", "Modern", "Prestij", "Premium", "Royal", "Mega", "Grand",
            "Nova", "Star", "Oz", "Guven", "Birlik", "Zirve", "Atlas",
            "Global", "Ege", "Anadolu", "Marmara", "Karadeniz", "Akdeniz"]
TYPES = ["Mobilya", "Mutfak", "Dekorasyon", "Insaat", "Yapi", "Mimarlik",
         "Tasarim", "Ahsap", "Marangoz", "Dograma", "Tekstil", "Perde"]
SUFFIXES = ["A.S.", "Ltd. Sti.", "San. Tic.", "Tic. Ltd.", "Ins. San."]
CITIES = ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana",
          "Gaziantep", "Konya", "Kayseri", "Mersin", "Eskisehir", "Samsun", "Trabzon"]
MATERIALS = [
    "MDF Lam Beyaz Mat", "MDF Lam Antrasit", "MDF Lam Gri Tas",
    "Yonga Levha Mese", "Yonga Levha Ceviz", "Yonga Levha Kayin",
    "Kontrplak Kayin", "Kontrplak Mese", "Sunta Ceviz",
    "Lamine Beyaz", "Lamine Gri", "Lamine Siyah", "Melamin Kaplama",
    "MDF 18mm Beyaz Parlak", "MDF 16mm Bej", "Suntalam 25mm"
]
COLORS_LIST = ["Beyaz", "Gri", "Antrasit", "Siyah", "Ceviz", "Mese", "Bej", "Krem", "Kahve"]
PART_TYPES = ["GOVDE", "ARKALIK", "KAPI", "CEKME", "RAF"]
FIRST_NAMES = ["Ahmet", "Mehmet", "Ali", "Mustafa", "Fatma", "Ayse", "Emine",
               "Hasan", "Huseyin", "Ibrahim", "Zeynep", "Merve", "Elif", "Burak",
               "Emre", "Deniz", "Cem", "Serkan", "Ozlem", "Selin"]
LAST_NAMES = ["Yilmaz", "Kaya", "Demir", "Celik", "Sahin", "Yildiz", "Ozturk",
              "Aydin", "Arslan", "Dogan", "Kilic", "Aslan", "Erdogan", "Ozdemir",
              "Cinar", "Koc", "Kurt", "Ozkan", "Simsek", "Polat"]
INDUSTRIES = ["Mobilya", "Insaat", "Perakende", "Toptan", "Uretim", "Hizmet", "Teknoloji"]
DEPARTMENTS = ["Satis", "Satin Alma", "Uretim", "Muhasebe", "Yonetim", "Lojistik"]
TITLES = ["Genel Mudur", "Satis Muduru", "Satin Alma Sorumlusu", "Muhasebe Muduru",
          "Proje Yoneticisi", "Uretim Sefi", "Depo Sorumlusu"]

def gen_company():
    return f"{random.choice(PREFIXES)} {random.choice(TYPES)} {random.choice(SUFFIXES)}"

def gen_phone():
    codes = ["212", "216", "312", "232", "224", "242", "322", "332", "352", "462"]
    return f"0{random.choice(codes)}{''.join(str(random.randint(0,9)) for _ in range(7))}"

def gen_email(name):
    clean = name.lower().replace(" ", "").replace(".", "")[:12]
    return f"info@{clean}{random.randint(1,99)}.com.tr"

def gen_address():
    city = random.choice(CITIES)
    no = random.randint(1, 150)
    streets = ["Ataturk", "Cumhuriyet", "Istiklal", "Inonu", "Barbaros", "Fevzi Cakmak"]
    return f"{random.choice(streets)} Cad. No:{no}, {city}"

# ── API istekleri ─────────────────────────────────────────────
session = requests.Session()
token = None

def api(method, path, json=None, ignore_err=False):
    url = f"{API_BASE}/api/v1{path}"
    try:
        r = session.request(method, url, json=json, timeout=15)
        if r.status_code in (200, 201):
            return r.json() if r.text else {}
        if not ignore_err:
            warn(f"{method} {path} -> {r.status_code}: {r.text[:120]}")
        return None
    except Exception as e:
        if not ignore_err:
            err(f"{method} {path} -> {e}")
        return None

def login():
    section("Kimlik Dogrulama")
    global token
    r = session.post(f"{API_BASE}/api/v1/auth/login",
                     json={"username": USERNAME, "password": PASSWORD}, timeout=10)
    r.raise_for_status()
    data = r.json()
    token = data.get("access_token") or data.get("token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    ok(f"Giris basarili: {USERNAME}")
    return True

# ── 1) Kullanicilar ───────────────────────────────────────────
def create_users():
    section("Kullanici Olusturma (3)")
    users = [
        {"username": "operator1", "password": "operator123", "display_name": "Mehmet Yilmaz",
         "email": "mehmet@optiplan.com", "role": "operator"},
        {"username": "station1", "password": "station123", "display_name": "Ayse Kaya",
         "email": "ayse@optiplan.com", "role": "operator"},
        {"username": "viewer1", "password": "viewer123", "display_name": "Fatma Demir",
         "email": "fatma@optiplan.com", "role": "viewer"},
    ]
    c = 0
    for u in users:
        res = api("POST", "/admin/users", u, ignore_err=True)
        if res:
            ok(f"{u['display_name']} ({u['role']})")
            c += 1
        else:
            warn(f"Zaten mevcut veya hata: {u['username']}")
    info(f"Toplam: {c}/3")
    return c

# ── 2) Istasyonlar ────────────────────────────────────────────
def create_stations():
    section("Istasyon Olusturma (5)")
    stations_def = [
        {"name": "HAZIRLIK", "description": "Hazirlik Istasyonu", "status": "ACTIVE"},
        {"name": "EBATLAMA", "description": "Ebatlama Istasyonu", "status": "ACTIVE"},
        {"name": "BANTLAMA", "description": "Bantlama Istasyonu", "status": "ACTIVE"},
        {"name": "KONTROL", "description": "Kalite Kontrol", "status": "ACTIVE"},
        {"name": "TESLIM", "description": "Teslim Istasyonu", "status": "ACTIVE"},
    ]
    ids = []
    for s in stations_def:
        res = api("POST", "/stations/", s, ignore_err=True)
        if res and "id" in res:
            ids.append(res["id"])
            ok(f"{s['name']} (ID: {res['id']})")
        else:
            # Mevcut istasyonu bul
            existing = api("GET", "/stations/", ignore_err=True)
            if existing:
                for ex in existing:
                    if ex.get("name") == s["name"]:
                        ids.append(ex["id"])
                        break
            warn(f"Zaten mevcut: {s['name']}")
    info(f"Toplam: {len(ids)}/5")
    return ids

# ── 3) Musteriler ─────────────────────────────────────────────
def create_customers(count=40):
    section(f"Musteri Olusturma ({count})")
    ids = []
    for i in range(count):
        name = gen_company()
        cust = {
            "name": name,
            "phone": gen_phone(),
            "email": gen_email(name),
            "address": gen_address(),
            "notes": f"Test musteri #{i+1}"
        }
        res = api("POST", "/customers/", cust, ignore_err=True)
        if res and "id" in res:
            ids.append(res["id"])
        else:
            cust["phone"] = gen_phone()
            res = api("POST", "/customers/", cust, ignore_err=True)
            if res and "id" in res:
                ids.append(res["id"])
        if (i + 1) % 10 == 0:
            info(f"  {i+1}/{count} musteri...")
    ok(f"Toplam: {len(ids)}/{count}")
    return ids

# ── 4) Siparisler ─────────────────────────────────────────────
def create_orders(customer_ids, count=100):
    section(f"Siparis Olusturma ({count})")
    if not customer_ids:
        err("Musteri yok!")
        return []

    dist = {"NEW": 10, "HOLD": 5, "IN_PRODUCTION": 35, "READY": 20, "DELIVERED": 25, "CANCELLED": 5}
    status_list = []
    for s, n in dist.items():
        status_list.extend([s] * n)
    random.shuffle(status_list)

    orders = []
    for i in range(count):
        cid = random.choice(customer_ids)
        status = status_list[i] if i < len(status_list) else "NEW"
        days_map = {"NEW": (0, 2), "HOLD": (3, 7), "IN_PRODUCTION": (1, 5),
                    "READY": (5, 10), "DELIVERED": (10, 30), "CANCELLED": (1, 15)}
        d = days_map.get(status, (0, 2))
        order_date = datetime.now() - timedelta(days=random.randint(*d))

        num_parts = random.randint(1, 3)
        parts = []
        for _ in range(num_parts):
            w, h = random.choice([(120,60),(100,50),(150,70),(180,80),(200,90),(90,45),(80,40)])
            parts.append({
                "piece_type": random.choice(PART_TYPES),
                "width": w, "height": h, "quantity": random.randint(1, 4),
                "material": random.choice(MATERIALS),
                "color": random.choice(COLORS_LIST),
            })

        order = {
            "customer_id": cid,
            "status": status,
            "order_date": order_date.isoformat(),
            "due_date": (order_date + timedelta(days=random.randint(7, 21))).isoformat(),
            "notes": f"Test siparis #{i+1}",
            "parts": parts
        }
        res = api("POST", "/orders/", order, ignore_err=True)
        if res and "id" in res:
            part_ids = [p["id"] for p in res.get("parts", [])] if res.get("parts") else []
            orders.append({"id": res["id"], "status": status, "parts": part_ids, "customer_id": cid})
        if (i + 1) % 25 == 0:
            info(f"  {i+1}/{count} siparis...")

    ok(f"Toplam: {len(orders)}/{count}")
    # Durum dagilimi
    from collections import Counter
    sc = Counter(o["status"] for o in orders)
    for s, n in sorted(sc.items()):
        info(f"  {s}: {n}")
    return orders

# ── 5) Istasyon Taramalari ────────────────────────────────────
def simulate_scans(orders, station_ids):
    section("Istasyon Tarama Simulasyonu")
    if not station_ids:
        warn("Istasyon yok, atlaniyor")
        return
    prod = [o for o in orders if o["status"] == "IN_PRODUCTION"]
    c = 0
    for o in prod[:20]:
        if o["parts"]:
            for si in range(min(random.randint(1, 3), len(station_ids))):
                scan = {
                    "order_part_id": o["parts"][0],
                    "station_id": station_ids[si],
                    "qr_code": f"QR{o['id'][:8]}",
                    "scan_type": "FIRST_SCAN" if si == 0 else "SECOND_SCAN"
                }
                if api("POST", "/stations/scan", scan, ignore_err=True):
                    c += 1
                time.sleep(0.05)
    ok(f"Toplam tarama: {c}")

# ── 6) CRM Hesaplari ─────────────────────────────────────────
def create_crm_accounts(customer_ids):
    section("CRM Hesap Olusturma (40)")
    ids = []
    for i, cid in enumerate(customer_ids[:40]):
        acc = {
            "company_name": gen_company(),
            "account_type": random.choice(["CORPORATE", "INDIVIDUAL"]),
            "industry": random.choice(INDUSTRIES),
            "phone": gen_phone(),
            "email": gen_email(f"crm{i}"),
            "city": random.choice(CITIES),
            "credit_limit": random.randint(10, 500) * 1000,
            "payment_term_days": random.choice([15, 30, 45, 60]),
            "customer_id": cid,
            "notes": f"CRM hesap #{i+1}"
        }
        res = api("POST", "/crm/accounts", acc, ignore_err=True)
        if res and "id" in res:
            ids.append(res["id"])
        if (i + 1) % 10 == 0:
            info(f"  {i+1}/40 hesap...")
    ok(f"Toplam: {len(ids)}/40")
    return ids

# ── 7) CRM Kisiler ───────────────────────────────────────────
def create_crm_contacts(account_ids):
    section("CRM Kisi Olusturma (60)")
    ids = []
    for i in range(60):
        aid = account_ids[i % len(account_ids)] if account_ids else None
        if not aid:
            break
        contact = {
            "account_id": aid,
            "first_name": random.choice(FIRST_NAMES),
            "last_name": random.choice(LAST_NAMES),
            "title": random.choice(TITLES),
            "department": random.choice(DEPARTMENTS),
            "phone": gen_phone(),
            "email": gen_email(f"kisi{i}"),
            "is_primary": i < len(account_ids),
        }
        res = api("POST", "/crm/contacts", contact, ignore_err=True)
        if res and "id" in res:
            ids.append(res["id"])
        if (i + 1) % 20 == 0:
            info(f"  {i+1}/60 kisi...")
    ok(f"Toplam: {len(ids)}/60")
    return ids

# ── 8) CRM Firsatlar ─────────────────────────────────────────
def create_crm_opportunities(account_ids, contact_ids):
    section("CRM Firsat Olusturma (30)")
    stages = (["LEAD"] * 8 + ["QUALIFIED"] * 6 + ["PROPOSAL"] * 5 +
              ["NEGOTIATION"] * 5 + ["CLOSED_WON"] * 4 + ["CLOSED_LOST"] * 2)
    random.shuffle(stages)
    ids = []
    for i in range(30):
        aid = random.choice(account_ids) if account_ids else None
        if not aid:
            break
        opp = {
            "account_id": aid,
            "title": f"{random.choice(['Mutfak','Dolap','Banyo','Ofis','Yatak Odasi'])} Projesi #{i+1}",
            "contact_id": random.choice(contact_ids) if contact_ids else None,
            "stage": stages[i] if i < len(stages) else "LEAD",
            "amount": random.randint(5, 200) * 1000,
            "probability": random.choice([10, 25, 50, 75, 90]),
            "source": random.choice(["WEB", "REFERANS", "FUAR", "TELEFON", "ZIYARET"]),
            "description": f"Test firsat #{i+1}",
        }
        res = api("POST", "/crm/opportunities", opp, ignore_err=True)
        if res and "id" in res:
            ids.append(res["id"])
    ok(f"Toplam: {len(ids)}/30")
    return ids

# ── 9) CRM Teklifler ─────────────────────────────────────────
def create_crm_quotes(account_ids, opportunity_ids):
    section("CRM Teklif Olusturma (20)")
    ids = []
    for i in range(20):
        aid = random.choice(account_ids) if account_ids else None
        if not aid:
            break
        lines = []
        for j in range(random.randint(2, 5)):
            lines.append({
                "description": f"{random.choice(MATERIALS)} - {random.choice(['Kesim','Bantlama','Montaj'])}",
                "quantity": random.randint(1, 20),
                "unit": random.choice(["ADET", "m2", "TAKIM"]),
                "unit_price": random.randint(50, 500) * 10,
                "tax_rate": 20.0,
            })
        quote = {
            "account_id": aid,
            "title": f"Teklif #{i+1} - {random.choice(['Mutfak','Dolap','Banyo'])} Projesi",
            "opportunity_id": random.choice(opportunity_ids) if opportunity_ids and random.random() > 0.3 else None,
            "lines": lines,
            "tax_rate": 20.0,
            "discount_rate": random.choice([0, 5, 10, 15]),
            "valid_until": (datetime.now() + timedelta(days=random.randint(15, 60))).isoformat(),
            "notes": f"Test teklif #{i+1}",
        }
        res = api("POST", "/crm/quotes", quote, ignore_err=True)
        if res and "id" in res:
            ids.append(res["id"])
    ok(f"Toplam: {len(ids)}/20")
    return ids

# ── 10) CRM Gorevler ─────────────────────────────────────────
def create_crm_tasks(account_ids, opportunity_ids):
    section("CRM Gorev Olusturma (15)")
    task_titles = [
        "Musteri ziyareti planla", "Teklif guncelle", "Numune gonder",
        "Odeme takibi yap", "Proje toplantisi", "Kalite raporu hazirla",
        "Teslimat koordinasyonu", "Stok kontrolu", "Fiyat listesi guncelle",
        "Satis raporu hazirla", "Musteri geri bildirimi al", "Fuar katilimi",
        "Uretim planlama", "Tedarikci gorusmesi", "Sistem bakimi"
    ]
    priorities = ["LOW"] * 3 + ["MEDIUM"] * 7 + ["HIGH"] * 4 + ["URGENT"] * 1
    random.shuffle(priorities)
    c = 0
    for i in range(15):
        task = {
            "title": task_titles[i],
            "description": f"Test gorev aciklamasi #{i+1}",
            "priority": priorities[i] if i < len(priorities) else "MEDIUM",
            "account_id": random.choice(account_ids) if account_ids and random.random() > 0.3 else None,
            "opportunity_id": random.choice(opportunity_ids) if opportunity_ids and random.random() > 0.5 else None,
            "due_date": (datetime.now() + timedelta(days=random.randint(-5, 30))).isoformat(),
        }
        if api("POST", "/crm/tasks", task, ignore_err=True):
            c += 1
    ok(f"Toplam: {c}/15")

# ── 11) CRM Aktiviteler ──────────────────────────────────────
def create_crm_activities(account_ids, contact_ids, opportunity_ids):
    section("CRM Aktivite Olusturma (25)")
    types = ["CALL"] * 8 + ["EMAIL"] * 7 + ["MEETING"] * 6 + ["NOTE"] * 4
    random.shuffle(types)
    c = 0
    for i in range(25):
        act = {
            "activity_type": types[i] if i < len(types) else "CALL",
            "subject": f"{types[i] if i < len(types) else 'CALL'} - {random.choice(['Satis gorusmesi','Takip','Bilgilendirme','Sikayet','Teklif'])}",
            "body": f"Test aktivite detayi #{i+1}",
            "duration_minutes": random.choice([15, 30, 45, 60, 90]),
            "account_id": random.choice(account_ids) if account_ids else None,
            "contact_id": random.choice(contact_ids) if contact_ids and random.random() > 0.4 else None,
            "opportunity_id": random.choice(opportunity_ids) if opportunity_ids and random.random() > 0.5 else None,
        }
        if api("POST", "/crm/activities", act, ignore_err=True):
            c += 1
    ok(f"Toplam: {c}/25")

# ── 12) CRM Notlar ───────────────────────────────────────────
def create_crm_notes(account_ids, contact_ids, opportunity_ids):
    section("CRM Not Olusturma (20)")
    entities = []
    for aid in account_ids[:10]:
        entities.append(("account", aid))
    for cid in contact_ids[:5]:
        entities.append(("contact", cid))
    for oid in opportunity_ids[:5]:
        entities.append(("opportunity", oid))
    random.shuffle(entities)

    c = 0
    note_texts = [
        "Musteri cok memnun, referans verebilir",
        "Fiyat konusunda hassas, indirim beklentisi var",
        "Hizli teslimat onemli",
        "Kalite standartlari yuksek",
        "Duzensiz odeme gecmisi var, dikkatli ol",
        "Buyuk proje potansiyeli var",
        "Rakip firmalarla da calisiyor",
        "Yillik sozlesme teklif edildi",
        "Ozel uretim talepleri olabilir",
        "Periyodik siparis potansiyeli",
    ]
    for i in range(min(20, len(entities))):
        etype, eid = entities[i % len(entities)]
        note = {
            "entity_type": etype,
            "entity_id": eid,
            "content": random.choice(note_texts) + f" (Not #{i+1})",
        }
        if api("POST", "/crm/notes", note, ignore_err=True):
            c += 1
    ok(f"Toplam: {c}/20")

# ── 13) Faturalar ─────────────────────────────────────────────
def create_invoices(account_ids, orders):
    section("Fatura Olusturma (30)")
    ids = []
    for i in range(30):
        aid = random.choice(account_ids) if account_ids else None
        if not aid:
            break
        subtotal = random.randint(2000, 50000)
        tax = subtotal * 0.20
        total = subtotal + tax
        due_days = random.randint(-30, 30)

        inv = {
            "account_id": aid,
            "subtotal": subtotal,
            "total_amount": total,
            "tax_rate": 20.0,
            "due_date": (datetime.now() + timedelta(days=due_days)).isoformat(),
            "invoice_type": "SALES",
            "notes": f"Test fatura #{i+1}",
        }
        # Bazi faturalari siparislere bagla
        if orders and i < 15:
            inv["order_id"] = None  # order_id integer bekliyorsa, None gonder
        res = api("POST", "/payments/invoices", inv, ignore_err=True)
        if res and "id" in res:
            ids.append({"id": res["id"], "account_id": aid, "total": total})
        if (i + 1) % 10 == 0:
            info(f"  {i+1}/30 fatura...")
    ok(f"Toplam: {len(ids)}/30")
    return ids

# ── 14) Odemeler ──────────────────────────────────────────────
def create_payments(invoices):
    section("Odeme Olusturma (40)")
    methods = ["CASH"] * 10 + ["TRANSFER"] * 15 + ["CARD"] * 8 + ["CHECK"] * 5 + ["DEBIT"] * 2
    random.shuffle(methods)
    c = 0
    for i in range(min(40, len(invoices) * 2)):
        inv = invoices[i % len(invoices)]
        amount = inv["total"] * random.uniform(0.3, 1.0)
        pay = {
            "invoice_id": inv["id"],
            "account_id": inv["account_id"],
            "payment_method": methods[i % len(methods)],
            "amount": round(amount, 2),
            "payment_date": (datetime.now() - timedelta(days=random.randint(0, 20))).isoformat(),
            "notes": f"Test odeme #{i+1}",
        }
        if methods[i % len(methods)] == "CHECK":
            pay["check_number"] = f"CK{random.randint(100000, 999999)}"
            pay["check_bank"] = random.choice(["Garanti", "Is Bankasi", "Yapi Kredi", "Akbank", "Ziraat"])
        if methods[i % len(methods)] == "CARD":
            pay["card_last_4"] = f"{random.randint(1000, 9999)}"
        if api("POST", "/payments/payments", pay, ignore_err=True):
            c += 1
    ok(f"Toplam: {c}/40")

# ── 15) Odeme Sozleri ────────────────────────────────────────
def create_promises(invoices):
    section("Odeme Sozu Olusturma (15)")
    c = 0
    for i in range(min(15, len(invoices))):
        inv = invoices[i % len(invoices)]
        promise = {
            "invoice_id": inv["id"],
            "account_id": inv["account_id"],
            "promised_amount": round(inv["total"] * random.uniform(0.5, 1.0), 2),
            "promise_date": (datetime.now() + timedelta(days=random.randint(-10, 20))).isoformat(),
            "payment_method": random.choice(["CASH", "TRANSFER", "CARD"]),
            "contact_person": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "notes": f"Test odeme sozu #{i+1}",
        }
        if api("POST", "/payments/promises", promise, ignore_err=True):
            c += 1
    ok(f"Toplam: {c}/15")

# ── 16) Stok Kartlari (Direct DB) ────────────────────────────
def seed_stock_cards():
    section("Stok Karti Yukleme (20 - Direct DB)")
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))
        from app.database import SessionLocal
        from app.models import StockCard, StockMovement
    except ImportError as e:
        warn(f"DB import hatasi: {e} - Stok kartlari atlaniyor")
        return

    db = SessionLocal()
    try:
        existing = db.query(StockCard).count()
        if existing >= 15:
            warn(f"Zaten {existing} stok karti var, atlaniyor")
            return

        stock_data = [
            ("MDF-18-BYZ", "MDF 18mm Beyaz Mat", "m2", 85.0, 120.0, "18mm", "Beyaz"),
            ("MDF-18-ANT", "MDF 18mm Antrasit", "m2", 92.0, 135.0, "18mm", "Antrasit"),
            ("MDF-18-GRI", "MDF 18mm Gri Tas", "m2", 88.0, 128.0, "18mm", "Gri"),
            ("MDF-16-BEJ", "MDF 16mm Bej", "m2", 75.0, 110.0, "16mm", "Bej"),
            ("MDF-18-PRL", "MDF 18mm Beyaz Parlak", "m2", 105.0, 155.0, "18mm", "Beyaz"),
            ("YNG-25-MSE", "Yonga 25mm Mese Rustik", "m2", 65.0, 95.0, "25mm", "Mese"),
            ("YNG-25-CVZ", "Yonga 25mm Ceviz", "m2", 68.0, 98.0, "25mm", "Ceviz"),
            ("YNG-18-KYN", "Yonga 18mm Kayin", "m2", 55.0, 82.0, "18mm", "Kayin"),
            ("KNT-12-KYN", "Kontrplak 12mm Kayin", "m2", 120.0, 175.0, "12mm", "Kayin"),
            ("KNT-12-MSE", "Kontrplak 12mm Mese", "m2", 135.0, 195.0, "12mm", "Mese"),
            ("SUN-18-CVZ", "Sunta 18mm Ceviz", "m2", 45.0, 68.0, "18mm", "Ceviz"),
            ("LAM-18-BYZ", "Lamine 18mm Beyaz", "m2", 110.0, 160.0, "18mm", "Beyaz"),
            ("LAM-18-GRI", "Lamine 18mm Gri", "m2", 108.0, 158.0, "18mm", "Gri"),
            ("LAM-18-SYH", "Lamine 18mm Siyah", "m2", 115.0, 168.0, "18mm", "Siyah"),
            ("MLM-18-KPL", "Melamin 18mm Kaplama", "m2", 48.0, 72.0, "18mm", "Krem"),
            ("BNT-ABS-2", "ABS Kenar Bandi 2mm", "m", 3.5, 6.0, "2mm", "Beyaz"),
            ("BNT-PVC-1", "PVC Kenar Bandi 1mm", "m", 2.0, 3.5, "1mm", "Antrasit"),
            ("VDA-35-BYZ", "Vida 3.5x16 Beyaz", "adet", 0.05, 0.12, None, "Beyaz"),
            ("MNT-DBL-35", "Dubel 35mm", "adet", 0.08, 0.18, "35mm", None),
            ("TKM-KLC-A", "Kulp Model A Krom", "adet", 12.0, 25.0, None, "Krom"),
        ]

        cards = []
        for code, name, unit, pp, sp, thick, color in stock_data:
            total = round(random.uniform(50, 500), 2)
            reserved = round(total * random.uniform(0.05, 0.2), 2)
            card = StockCard(
                id=str(uuid.uuid4()),
                stock_code=code,
                stock_name=name,
                unit=unit,
                purchase_price=pp,
                sale_price=sp,
                total_quantity=total,
                available_quantity=round(total - reserved, 2),
                reserved_quantity=reserved,
                thickness=thick,
                color=color,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.add(card)
            cards.append(card)

        db.commit()
        ok(f"{len(cards)} stok karti eklendi")

        # Stok hareketleri
        move_count = 0
        for card in cards:
            for _ in range(random.randint(2, 5)):
                mv_type = random.choice(["IN", "OUT", "IN", "ADJUSTMENT"])
                qty = round(random.uniform(5, 50), 2)
                mv = StockMovement(
                    id=str(uuid.uuid4()),
                    stock_card_id=card.id,
                    movement_type=mv_type,
                    quantity=qty if mv_type == "IN" else -qty,
                    reference_type=random.choice(["ORDER", "MANUAL", "SYNC"]),
                    reference_id=str(random.randint(1, 100)),
                    notes=f"Test hareket",
                    created_at=datetime.now() - timedelta(days=random.randint(0, 30)),
                )
                db.add(mv)
                move_count += 1
        db.commit()
        ok(f"{move_count} stok hareketi eklendi")

    except Exception as e:
        db.rollback()
        err(f"Stok hatasi: {e}")
    finally:
        db.close()

# ── 17) Sistem & Org Config ──────────────────────────────────
def seed_config():
    section("Sistem/Organizasyon Yapilandirmasi")
    # Sistem config
    config = api("GET", "/admin/config", ignore_err=True)
    if config:
        ok("Sistem config mevcut")
    else:
        warn("Sistem config okunamadi")

    # Organizasyon
    org = {
        "company_name": "OptiPlan360 Mobilya Uretim A.S.",
        "tax_id": "1234567890",
        "tax_office": "Kadikoy VD",
        "address": "Organize Sanayi Bolgesi 3. Cadde No:42, Pendik/Istanbul",
        "phone": "02163001234",
        "email": "info@optiplan360.com.tr",
        "website": "www.optiplan360.com.tr",
    }
    res = api("PUT", "/admin/organization", org, ignore_err=True)
    if res:
        ok("Organizasyon bilgileri guncellendi")
    else:
        warn("Organizasyon guncelenemedi (endpoint olmayabilir)")

# ── Ana Islem ─────────────────────────────────────────────────
def main():
    print(f"\n{C.H}{C.BD}")
    print("+" + "=" * 58 + "+")
    print("|" + " " * 8 + "OptiPlan360 - Kapsamli Veri Yukleme" + " " * 8 + "|")
    print("|" + " " * 5 + "40 Musteri | 100 Siparis | CRM | Payment | Stock" + " " * 2 + "|")
    print("+" + "=" * 58 + "+")
    print(C.E)

    start = time.time()

    if not login():
        err("Giris basarisiz!")
        return

    # Sirayla olustur
    create_users()
    station_ids = create_stations()
    customer_ids = create_customers(40)
    orders = create_orders(customer_ids, 100)
    simulate_scans(orders, station_ids)

    # CRM
    account_ids = create_crm_accounts(customer_ids)
    contact_ids = create_crm_contacts(account_ids)
    opportunity_ids = create_crm_opportunities(account_ids, contact_ids)
    quote_ids = create_crm_quotes(account_ids, opportunity_ids)
    create_crm_tasks(account_ids, opportunity_ids)
    create_crm_activities(account_ids, contact_ids, opportunity_ids)
    create_crm_notes(account_ids, contact_ids, opportunity_ids)

    # Payment
    invoices = create_invoices(account_ids, orders)
    create_payments(invoices)
    create_promises(invoices)

    # Stock (direct DB)
    seed_stock_cards()

    # Config
    seed_config()

    elapsed = time.time() - start

    section("OZET RAPOR")
    print(f"""
  Musteriler:      {len(customer_ids)}/40
  Siparisler:      {len(orders)}/100
  Istasyonlar:     {len(station_ids)}/5
  CRM Hesaplar:    {len(account_ids)}/40
  CRM Kisiler:     {len(contact_ids)}/60
  CRM Firsatlar:   {len(opportunity_ids)}/30
  CRM Teklifler:   {len(quote_ids)}/20
  Faturalar:       {len(invoices)}/30
  Stok Kartlari:   20 (direct DB)

  Sure: {elapsed:.1f} saniye
  API: {API_BASE}
  Kullanici: admin / admin
""")
    print(f"{C.G}{C.BD}  Islem tamamlandi!{C.E}\n")


if __name__ == "__main__":
    main()
