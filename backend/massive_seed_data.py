"""
Massive Data Loading Script for OptiPlan360
Generates production-scale test data:
- 50 customers with Turkish company names
- 250 orders with varied specifications
- 3 users with different roles
- 5 active stations
- Simulated scan history
"""

import requests
import random
import string
from datetime import datetime, timedelta
import time

# Configuration
API_BASE = "http://localhost:8080"
USERNAME = "admin"
PASSWORD = "admin"

# Color codes for console output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log(msg, color=Colors.OKBLUE):
    print(f"{color}{msg}{Colors.ENDC}")

def log_success(msg):
    print(f"{Colors.OKGREEN}✓ {msg}{Colors.ENDC}")

def log_error(msg):
    print(f"{Colors.FAIL}✗ {msg}{Colors.ENDC}")

def log_warning(msg):
    print(f"{Colors.WARNING}⚠ {msg}{Colors.ENDC}")

def log_section(title):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}\n{title}\n{'='*60}{Colors.ENDC}\n")

# Turkish company name generator
COMPANY_PREFIXES = [
    "Elit", "Modern", "Prestij", "Lüks", "Premium", "Royal", "Mega", "Ultra",
    "Grand", "Nova", "Star", "Prime", "Öz", "Güven", "Birlik", "Zirve",
    "Atlas", "Asya", "Avrupa", "Kıta", "Global", "Dünya", "Ege", "Anadolu"
]

COMPANY_TYPES = [
    "Mobilya", "Mutfak", "Dekorasyon", "İnşaat", "Yapı", "Mimarlık",
    "Tasarım", "Ahşap", "Ağaç İşleri", "Marangoz", "Doğrama", "Ev Tekstili"
]

COMPANY_SUFFIXES = ["A.Ş.", "Ltd. Şti.", "San. Tic.", "Tic. Ltd. Şti.", "İnş. San. Tic."]

CITIES = [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep",
    "Konya", "Kayseri", "Mersin", "Eskişehir", "Diyarbakır", "Samsun"
]

DISTRICTS = {
    "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Ataşehir", "Maltepe", "Kartal", "Pendik"],
    "Ankara": ["Çankaya", "Keçiören", "Yenimahalle", "Etimesgut", "Mamak"],
    "İzmir": ["Konak", "Karşıyaka", "Bornova", "Buca", "Gaziemir"],
    "Bursa": ["Osmangazi", "Nilüfer", "Yıldırım", "Mudanya"],
    "Antalya": ["Muratpaşa", "Kepez", "Konyaaltı", "Alanya"]
}

STREET_TYPES = ["Sokak", "Cadde", "Bulvar"]
STREET_NAMES = [
    "Atatürk", "Cumhuriyet", "İstiklal", "İnönü", "Barbaros", "Vatan",
    "Hürriyet", "Şehit", "Gazi", "Fevzi Çakmak", "Menderes", "Fatih"
]

# Material specifications
MATERIALS = [
    "MDF Lam Beyaz Mat", "MDF Lam Beyaz Parlak", "MDF Lam Antrasit Mat",
    "MDF Lam Antrasit Parlak", "MDF Lam Gri Taş", "MDF Lam Bej",
    "Yonga Levha Meşe Rustik", "Yonga Levha Ceviz", "Yonga Levha Kayın",
    "Kontrplak Kayın", "Kontrplak Meşe", "Sunta Ceviz", "Sunta Akçaağaç",
    "Lamine Beyaz", "Lamine Gri", "Lamine Siyah", "Melamin Kaplama"
]

COLORS = [
    "Beyaz", "Gri", "Antrasit", "Siyah", "Ceviz", "Meşe", "Bej",
    "Krem", "Kahverengi", "Mavi", "Yeşil", "Kırmızı"
]

PART_TYPES = ["GOVDE", "ARKALIK", "KAPI", "CEKME", "RAF"]

ORDER_DIMENSIONS = [
    (120, 60, 2), (100, 50, 2), (150, 70, 2), (180, 80, 2),
    (200, 90, 2), (90, 45, 2), (160, 75, 2), (140, 65, 2),
    (80, 40, 1), (100, 100, 2), (50, 50, 1)
]

# Status distribution for 250 orders
STATUS_DISTRIBUTION = {
    "NEW": 30,          # 12%
    "HOLD": 25,         # 10%
    "IN_PRODUCTION": 100,  # 40%
    "READY": 50,        # 20%
    "DELIVERED": 40,    # 16%
    "CANCELLED": 5      # 2%
}

# Station definitions
STATIONS = [
    {
        "name": "HAZIRLIK",
        "description": "Hazırlık İstasyonu - İlk okuma yapılır",
        "status": "ACTIVE"
    },
    {
        "name": "EBATLAMA",
        "description": "Ebatlama İstasyonu - İkinci okuma (min 30 dk sonra)",
        "status": "ACTIVE"
    },
    {
        "name": "BANTLAMA",
        "description": "Bantlama İstasyonu - Kenar işleme",
        "status": "ACTIVE"
    },
    {
        "name": "KONTROL",
        "description": "Kalite Kontrol İstasyonu",
        "status": "ACTIVE"
    },
    {
        "name": "TESLIM",
        "description": "Teslim İstasyonu - İkinci okuma (min 30 dk sonra)",
        "status": "ACTIVE"
    }
]

# Test users
TEST_USERS = [
    {
        "username": "operator1",
        "password": "operator123",
        "display_name": "Mehmet Yılmaz",
        "email": "mehmet.yilmaz@optiplan.com",
        "role": "operator"
    },
    {
        "username": "station1",
        "password": "station123",
        "display_name": "Ayşe Kaya",
        "email": "ayse.kaya@optiplan.com",
        "role": "operator"
    },
    {
        "username": "viewer1",
        "password": "viewer123",
        "display_name": "Fatma Demir",
        "email": "fatma.demir@optiplan.com",
        "role": "viewer"
    }
]

# Global session
session = requests.Session()
token = None

def login():
    """Authenticate and get token"""
    global token
    log_section("🔐 Kimlik Doğrulama")
    
    try:
        response = session.post(
            f"{API_BASE}/api/v1/auth/login",
            json={"username": USERNAME, "password": PASSWORD}
        )
        response.raise_for_status()
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        log_success(f"Giriş başarılı: {USERNAME}")
        return True
    except Exception as e:
        log_error(f"Giriş hatası: {str(e)}")
        try:
            log_error(f"Response: {response.text}")
        except:
            pass
        return False

def generate_company_name():
    """Generate random Turkish company name"""
    prefix = random.choice(COMPANY_PREFIXES)
    company_type = random.choice(COMPANY_TYPES)
    suffix = random.choice(COMPANY_SUFFIXES)
    return f"{prefix} {company_type} {suffix}"

def generate_address():
    """Generate random Turkish address"""
    city = random.choice(CITIES)
    district = random.choice(DISTRICTS.get(city, ["Merkez"]))
    street_type = random.choice(STREET_TYPES)
    street_name = random.choice(STREET_NAMES)
    building_no = random.randint(1, 150)
    postal_code = random.randint(10000, 99999)
    
    return {
        "address": f"{street_name} {street_type} No:{building_no}, {district}/{city}",
        "city": city,
        "postal_code": str(postal_code)
    }

def generate_phone():
    """Generate random Turkish phone number"""
    area_codes = ["212", "216", "312", "232", "224", "242", "322", "332"]
    area = random.choice(area_codes)
    number = ''.join([str(random.randint(0, 9)) for _ in range(7)])
    return f"0{area}{number}"

def create_users():
    """Create 3 test users"""
    log_section("👥 Kullanıcı Oluşturma (3 kullanıcı)")
    
    created = 0
    for user in TEST_USERS:
        try:
            response = session.post(f"{API_BASE}/api/v1/admin/users", json=user)
            if response.status_code == 201:
                log_success(f"Kullanıcı oluşturuldu: {user['display_name']} ({user['username']}) - {user['role']}")
                created += 1
            elif response.status_code == 400 and "already exists" in response.text:
                log_warning(f"Kullanıcı zaten mevcut: {user['username']}")
            else:
                log_error(f"Kullanıcı oluşturulamadı: {user['username']} - {response.text}")
        except Exception as e:
            log_error(f"Kullanıcı hatası ({user['username']}): {str(e)}")
    
    log(f"\n📊 Toplam oluşturulan: {created}/3", Colors.OKCYAN)
    return created

def create_stations():
    """Create 5 stations"""
    log_section("🏭 İstasyon Oluşturma (5 istasyon)")
    
    created = 0
    station_ids = []
    
    for station in STATIONS:
        try:
            response = session.post(f"{API_BASE}/api/v1/stations/", json=station)
            if response.status_code == 201:
                station_id = response.json()["id"]
                station_ids.append(station_id)
                log_success(f"İstasyon oluşturuldu: {station['name']} (ID: {station_id})")
                created += 1
            elif response.status_code == 400 and "already exists" in response.text.lower():
                # Get existing station
                resp_get = session.get(f"{API_BASE}/api/v1/stations/")
                stations_list = resp_get.json()
                for s in stations_list:
                    if s.get("name") == station["name"]:
                        station_ids.append(s["id"])
                        break
                log_warning(f"İstasyon zaten mevcut: {station['name']}")
            else:
                log_error(f"İstasyon oluşturulamadı: {station['name']} - {response.text}")
        except Exception as e:
            log_error(f"İstasyon hatası ({station['name']}): {str(e)}")
    
    log(f"\n📊 Toplam oluşturulan: {created}/5", Colors.OKCYAN)
    return station_ids

def create_customers(count=50):
    """Create customers with random Turkish company data"""
    log_section(f"🏢 Müşteri Oluşturma ({count} müşteri)")
    
    created = 0
    customer_ids = []
    
    for i in range(count):
        company_name = generate_company_name()
        address_data = generate_address()
        phone = generate_phone()
        
        customer = {
            "name": company_name,
            "phone": phone,
            "email": f"info@{company_name.lower().replace(' ', '').replace('.', '')[:15]}.com.tr",
            "address": address_data["address"],
            "notes": f"Toplu test verisi - {i+1}/{count}"
        }
        
        try:
            response = session.post(f"{API_BASE}/api/v1/customers/", json=customer)
            if response.status_code == 201:
                customer_id = response.json()["id"]
                customer_ids.append(customer_id)
                created += 1
                if created % 10 == 0:
                    log(f"✓ {created}/{count} müşteri oluşturuldu...", Colors.OKGREEN)
            elif response.status_code == 400:
                # Phone already exists, generate new one
                customer["phone"] = generate_phone()
                response = session.post(f"{API_BASE}/api/v1/customers/", json=customer)
                if response.status_code == 201:
                    customer_id = response.json()["id"]
                    customer_ids.append(customer_id)
                    created += 1
                else:
                    log_warning(f"Müşteri oluşturulamadı: {company_name}")
            else:
                log_warning(f"Müşteri hatası: {company_name} - {response.status_code}")
        except Exception as e:
            log_error(f"Müşteri hatası: {str(e)}")
            
        # Small delay to avoid overwhelming the server
        if i % 25 == 0 and i > 0:
            time.sleep(0.5)
    
    log_success(f"\n📊 Toplam oluşturulan: {created}/{count}")
    return customer_ids

def create_orders(customer_ids, count=250):
    """Create orders with varied specifications and statuses"""
    log_section(f"📦 Sipariş Oluşturma ({count} sipariş)")
    
    if not customer_ids:
        log_error("Müşteri bulunamadı, sipariş oluşturulamıyor!")
        return []
    
    # Generate status list according to distribution
    status_list = []
    for status, qty in STATUS_DISTRIBUTION.items():
        status_list.extend([status] * qty)
    random.shuffle(status_list)
    
    created = 0
    order_ids = []
    
    for i in range(count):
        customer_id = random.choice(customer_ids)
        status = status_list[i] if i < len(status_list) else "NEW"
        
        # Generate order date based on status
        days_ago = {
            "NEW": random.randint(0, 2),
            "HOLD": random.randint(3, 7),
            "IN_PRODUCTION": random.randint(1, 5),
            "READY": random.randint(5, 10),
            "DELIVERED": random.randint(10, 30),
            "CANCELLED": random.randint(1, 15)
        }
        
        order_date = datetime.now() - timedelta(days=days_ago.get(status, 0))
        due_date = order_date + timedelta(days=random.randint(7, 21))
        
        # Generate parts (1-3 parts per order)
        num_parts = random.randint(1, 3)
        parts = []
        
        for _ in range(num_parts):
            width, height, quantity = random.choice(ORDER_DIMENSIONS)
            material = random.choice(MATERIALS)
            color = random.choice(COLORS)
            part_type = random.choice(PART_TYPES)
            
            parts.append({
                "piece_type": part_type,
                "width": width,
                "height": height,
                "quantity": quantity,
                "material": material,
                "color": color,
                "notes": f"Test sipariş parçası #{i+1}"
            })
        
        order = {
            "customer_id": customer_id,
            "status": status,
            "order_date": order_date.isoformat(),
            "due_date": due_date.isoformat(),
            "notes": f"Toplu test sipariş #{i+1} - Durum: {status}",
            "parts": parts
        }
        
        try:
            response = session.post(f"{API_BASE}/api/v1/orders/", json=order)
            if response.status_code == 201:
                order_id = response.json()["id"]
                order_ids.append({
                    "id": order_id,
                    "status": status,
                    "parts": [p["id"] for p in response.json()["parts"]]
                })
                created += 1
                if created % 25 == 0:
                    log(f"✓ {created}/{count} sipariş oluşturuldu...", Colors.OKGREEN)
            else:
                log_warning(f"Sipariş oluşturulamadı: #{i+1} - {response.status_code}")
        except Exception as e:
            log_error(f"Sipariş hatası: {str(e)}")
        
        # Small delay
        if i % 50 == 0 and i > 0:
            time.sleep(0.5)
    
    log_success(f"\n📊 Toplam oluşturulan: {created}/{count}")
    
    # Status breakdown
    status_counts = {}
    for order in order_ids:
        status_counts[order["status"]] = status_counts.get(order["status"], 0) + 1
    
    log("\n📈 Durum Dağılımı:", Colors.OKCYAN)
    for status, count in sorted(status_counts.items()):
        percentage = (count / len(order_ids)) * 100 if order_ids else 0
        log(f"  {status}: {count} (%{percentage:.1f})", Colors.OKBLUE)
    
    return order_ids

def simulate_station_scans(order_ids, station_ids):
    """Simulate station scans for IN_PRODUCTION orders"""
    log_section("🔄 İstasyon Tarama Simülasyonu")
    
    if not station_ids:
        log_error("İstasyon bulunamadı, tarama simülasyonu yapılamıyor!")
        return
    
    # Filter IN_PRODUCTION orders
    production_orders = [o for o in order_ids if o["status"] == "IN_PRODUCTION"]
    
    if not production_orders:
        log_warning("IN_PRODUCTION durumunda sipariş bulunamadı!")
        return
    
    scan_count = 0
    
    # Simulate different production stages
    for order in production_orders[:20]:  # Limit to first 20 for demo
        try:
            # Random station progress (1-3 stations)
            num_stations = random.randint(1, min(3, len(station_ids)))
            
            for i in range(num_stations):
                station_id = station_ids[i]
                
                # Scan first part of the order
                if order["parts"]:
                    part_id = order["parts"][0]
                    
                    scan_data = {
                        "order_part_id": part_id,
                        "station_id": station_id,
                        "qr_code": f"QR{order['id']}P{part_id}",
                        "scan_type": "FIRST_SCAN" if i == 0 else "SECOND_SCAN"
                    }
                    
                    response = session.post(f"{API_BASE}/api/v1/stations/scan", json=scan_data)
                    if response.status_code == 200:
                        scan_count += 1
                    else:
                        log_warning(f"Tarama hatası: Sipariş #{order['id']}, İstasyon #{station_id}")
                    
                    # Small delay between scans
                    time.sleep(0.1)
        except Exception as e:
            log_error(f"Tarama simülasyon hatası: {str(e)}")
    
    log_success(f"\n📊 Toplam tarama: {scan_count}")

def print_summary(user_count, station_count, customer_count, order_count):
    """Print final summary"""
    log_section("📊 ÖZET RAPOR")
    
    print(f"""
{Colors.OKGREEN}✓ Kullanıcılar:{Colors.ENDC}      {user_count}/3 oluşturuldu
{Colors.OKGREEN}✓ İstasyonlar:{Colors.ENDC}      {station_count}/5 oluşturuldu
{Colors.OKGREEN}✓ Müşteriler:{Colors.ENDC}       {customer_count}/50 oluşturuldu
{Colors.OKGREEN}✓ Siparişler:{Colors.ENDC}       {order_count}/250 oluşturuldu

{Colors.OKCYAN}Sistem durumu:{Colors.ENDC}
- Backend API: {API_BASE}
- Frontend: http://localhost:3001
- Admin Giriş: admin / admin

{Colors.OKBLUE}Test için öneriler:{Colors.ENDC}
1. Roller ve Yetkiler sayfasında kullanıcı dağılımını kontrol edin
2. İstasyonlar sayfasında akış şemasını inceleyin
3. Siparişler sayfasında filtreleme ve arama yapın
4. Dashboard istatistiklerini kontrol edin
5. Performansı gözlemleyin (sayfa yükleme süreleri)
    """)

def main():
    """Main execution"""
    log(f"\n{Colors.HEADER}{Colors.BOLD}")
    print("╔" + "═" * 58 + "╗")
    print("║" + " " * 10 + "OptiPlan360 - Massive Data Loader" + " " * 10 + "║")
    print("╚" + "═" * 58 + "╝")
    print(Colors.ENDC)
    
    # Login
    if not login():
        log_error("Giriş başarısız, işlem sonlandırılıyor!")
        return
    
    # Create users
    user_count = create_users()
    
    # Create stations
    station_ids = create_stations()
    
    # Create customers
    customer_ids = create_customers(50)
    
    # Create orders
    order_ids = create_orders(customer_ids, 250)
    
    # Simulate station scans
    if station_ids and order_ids:
        simulate_station_scans(order_ids, station_ids)
    
    # Print summary
    print_summary(user_count, len(station_ids), len(customer_ids), len(order_ids))
    
    log(f"\n{Colors.OKGREEN}{Colors.BOLD}✓ İşlem tamamlandı!{Colors.ENDC}\n")

if __name__ == "__main__":
    main()
