import requests
import json
import random

BASE_URL = "http://localhost:8000/api/v1"

# 1. Login
print("Logging in...")
resp = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "admin"})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    exit(1)

token = resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print("Logged in!")

# 2. Kanonik İstasyonları Oluştur (MASTER_HANDOFF §0.6)
print("\nSeeding canonical stations...")
canonical_stations = [
    {"name": "Hazırlık", "description": "Malzeme hazırlama ve kesim hazırlığı (İki okutmalı: 1. okutma başlangıç)"},
    {"name": "Ebatlama", "description": "Parçaların boyutlandırılması (İki okutmalı: 2. okutma tamamlandı)"},
    {"name": "Bantlama", "description": "Kenar bantı uygulanması"},
    {"name": "Kontrol",  "description": "Kalite kontrolü (İki okutmalı: 1. okutma teslimata hazır)"},
    {"name": "Teslim",   "description": "Teslimat ve paketleme (İki okutmalı: 2. okutma teslimat yapıldı)"},
]
for st in canonical_stations:
    # Zaten varsa oluşturma
    existing = requests.get(f"{BASE_URL}/stations/", headers=headers)
    names = [s["name"] for s in existing.json()] if existing.ok else []
    if st["name"] in names:
        print(f"  → Mevcut: {st['name']}")
        continue
    r = requests.post(f"{BASE_URL}/stations/", json=st, headers=headers)
    if r.status_code == 201:
        print(f"  ✓ Oluşturuldu: {st['name']}")
    else:
        print(f"  ✗ Hata ({st['name']}): {r.text}")

# 3. Create Customers
customers = [
    {"phone_norm": "5551112233", "name": "Yılmaz Mobilya", "address": "Sanayi Mah. 1. Cad."},
    {"phone_norm": "5429876543", "name": "Demir Mutfak", "address": "Organize Sanayi Bölgesi"},
    {"phone_norm": "5334445566", "name": "Kaya Tasarım", "address": "Merkez Çarşı No:5"},
]

customer_ids = []
for c in customers:
    # Check if exists
    r = requests.get(f"{BASE_URL}/customers/lookup?phone={c['phone_norm']}", headers=headers)
    if r.status_code == 200:
        cid = r.json()["id"]
        print(f"Customer exists: {c['name']}")
        customer_ids.append((cid, c["phone_norm"]))
    else:
        # Create
        r = requests.post(f"{BASE_URL}/customers", json=c, headers=headers)
        if r.status_code == 201:
            cid = r.json()["id"]
            print(f"Created customer: {c['name']}")
            customer_ids.append((cid, c["phone_norm"]))
        else:
            print(f"Failed to create customer {c['name']}: {r.text}")

# 3. Create Orders
materials = ["MDF Lam Beyaz", "MDF Lam Antrasit", "Yonga Levha Meşe"]
colors = ["Parlak Beyaz", "Mat Antrasit", "Doğal Meşe"]

for i in range(5):
    cid, phone = random.choice(customer_ids)
    
    parts = []
    # Govde parts
    for _ in range(random.randint(2, 5)):
        parts.append({
            "part_group": "GOVDE",
            "boy_mm": random.randint(300, 2000),
            "en_mm": random.randint(200, 1000),
            "adet": random.randint(1, 10),
            "grain_code": "0-Material",
            "u1": random.choice([True, False]),
            "u2": random.choice([True, False]),
            "k1": random.choice([True, False]),
            "k2": random.choice([True, False]),
            "part_desc": f"Parça {random.randint(1, 100)}"
        })
    
    # Arkalik parts
    if random.choice([True, False]):
        for _ in range(random.randint(1, 3)):
            parts.append({
                "part_group": "ARKALIK",
                "boy_mm": random.randint(300, 2000),
                "en_mm": random.randint(200, 1000),
                "adet": random.randint(1, 5),
                "grain_code": "0-Material"
            })

    order_payload = {
        "customer_id": cid,
        "phone_norm": phone,
        "thickness_mm": 18,
        "plate_w_mm": 2800,
        "plate_h_mm": 2070,
        "color": random.choice(colors),
        "material_name": random.choice(materials),
        "band_mm": 0.8,
        "grain_default": "0-Material",
        "parts": parts
    }

    r = requests.post(f"{BASE_URL}/orders", json=order_payload, headers=headers)
    if r.status_code == 201:
        data = r.json()
        print(f"Created order: {data['ts_code']} for {data['crm_name_snapshot']}")
        
        # Randomly advance status
        if random.random() > 0.5:
             requests.post(f"{BASE_URL}/orders/{data['id']}/approve", headers=headers)
             print(f"  -> Approved (IN_PRODUCTION)")
             
             if random.random() > 0.5:
                 requests.patch(f"{BASE_URL}/orders/{data['id']}/status?new_status=READY", headers=headers)
                 print(f"  -> Marked READY")
    else:
        print("Failed to create order:", r.text)

# 4. Create Integration Settings
print("\nSeeding integration settings...")

integration_configs = [
    {
        "integration_type": "MIKRO",
        "category": "SQL",
        "settings": {
            "host": "localhost",
            "port": 1433,
            "database": "MikroDB_V15",
            "username": "sa",
            "password": "",
            "driver": "ODBC Driver 17 for SQL Server",
            "trust_server_certificate": True
        },
        "is_active": True,
        "auto_sync_enabled": False,
        "sync_interval_minutes": 60
    },
    {
        "integration_type": "MIKRO",
        "category": "ORDER",
        "settings": {
            "table_name": "SIPARISLER",
            "detail_table": "SIPARIS_DETAY",
            "auto_sync": True
        },
        "is_active": True,
        "auto_sync_enabled": True,
        "sync_interval_minutes": 30
    },
    {
        "integration_type": "EINVOICE",
        "category": None,
        "settings": {},
        "is_active": False,
        "auto_sync_enabled": False,
        "sync_interval_minutes": 0
    },
    {
        "integration_type": "CARGO",
        "category": None,
        "settings": {},
        "is_active": False,
        "auto_sync_enabled": False,
        "sync_interval_minutes": 0
    },
    {
        "integration_type": "SMTP",
        "category": None,
        "settings": {
            "host": "smtp.gmail.com",
            "port": 587,
            "username": "noreply@optiplan360.com",
            "password": "",
            "use_tls": True,
            "sender_name": "OptiPlan360"
        },
        "is_active": False,
        "auto_sync_enabled": False,
        "sync_interval_minutes": 0
    },
    {
        "integration_type": "SMS",
        "category": None,
        "settings": {
            "provider": "İleti Merkezi",
            "api_key": "",
            "secret_key": "",
            "sender_name": "OPTIPLAN"
        },
        "is_active": False,
        "auto_sync_enabled": False,
        "sync_interval_minutes": 0
    }
]

for config in integration_configs:
    r = requests.put(f"{BASE_URL}/mikro/settings", json=config, headers=headers)
    if r.status_code == 200:
        print(f"  ✓ {config['integration_type']} {config.get('category', '')} settings created")
    else:
        print(f"  ✗ Failed to create {config['integration_type']}: {r.text}")

print("\nDone! Please refresh the frontend.")
