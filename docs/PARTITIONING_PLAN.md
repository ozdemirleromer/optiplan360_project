# OptiPlan360 — Kapsamli Parcalama / Bolumleme Plani

**Tarih:** 2025-07-15  
**Tip:** Mimari Karar Dokumani (ADR-010)  
**Revizyon:** v2 — Derinlestirilmis Kantitatif Analiz  
**Durum:** TASLAK — Takim onayina acik

---

## Icindekiler

1. [Mevcut Durum Analizi](#1-mevcut-durum-analizi)
2. [Mimari Saglik Degerlendirmesi (Kantitatif)](#2-mimari-saglik-degerlendirmesi)
3. [Parcalama Stratejisi](#3-parcalama-stratejisi)
4. [Dikey Dilimler — 8 Bounded Context](#4-dikey-dilimler--8-bounded-context)
5. [Router Is Mantigi Cikarma Plani](#5-router-is-mantigi-cikarma-plani)
6. [Yatay Katmanlar](#6-yatay-katmanlar)
7. [Frontend Parcalama Plani](#7-frontend-parcalama-plani)
8. [Hedef Backend Dizin Yapisi](#8-hedef-backend-dizin-yapisi)
9. [Domain Arasi Iletisim (Port Desenleri)](#9-domain-arasi-iletisim)
10. [Test Kapsam Bosluk Analizi](#10-test-kapsam-bosluk-analizi)
11. [Goc Plani — 6 Faz](#11-goc-plani--6-faz)
12. [Basari Kriterleri](#12-basari-kriterleri)
13. [Risk Analizi](#13-risk-analizi)
14. [Ozet Karar Tablosu](#14-ozet-karar-tablosu)

---

## 1. Mevcut Durum Analizi

### 1.1 Proje Boyut Metrikleri

| Metrik | Deger |
|--------|-------|
| **Backend toplam** | **25,527 satir** |
| — Router dosyasi | 32 dosya, 9,851 satir |
| — Service dosyasi | 49 dosya, 13,559 satir |
| — Model dosyasi | 8 dosya, 1,348 satir (61 tablo) |
| — Schema sinifi | 90 sinif, 769 satir (tek dosya) |
| — Permission enum | 49 deger |
| — Rol tanimi | 6 (ADMIN, OPERATOR, STATION, KIOSK, SALES, VIEWER) |
| **Frontend toplam** | **43,365 satir** |
| — Kaynak dosya | 210 dosya (.ts/.tsx) |
| — Tip dosyasi | 1 dosya (types/index.ts) |
| **Backend test** | 26 dosya, 263 test fonksiyonu |
| **Docker** | backend:8080, frontend:3001, postgres:5432 |

### 1.2 Katman Boyut Orani (Backend)

```
Router    ████████████████████████████░░░░░░░░░░░░░░░  9,851 satir  (38.6%)
Service   ████████████████████████████████████████████  13,559 satir (53.1%)
Model     ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  1,348 satir  (5.3%)
Schema    ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  769 satir    (3.0%)
```

**Saglikli moda oran:** Router %15-20, Service %50-60, Model %15-20, Schema %10-15.
**Gercek durum:** Router katmani %38.6 — bu, modele kiyasla 7.3x buyuk. Router'a siznis
is mantigi oldugunu kanitlar.

### 1.3 Tespit Edilen 14 Yapisal Sorun

| # | Sorun | Kantitatif Olcu | Ciddiyet |
|---|-------|-----------------|----------|
| S1 | Router katmaninda dogrudan DB erisimi | 239+ db.query/add/delete/commit cagirisi | **KRITIK** |
| S2 | Router'da 80+ satirlik fonksiyonlar | Top 20 fonksiyon toplam ~6,500 satir | **KRITIK** |
| S3 | `order_service.py` 5 domain'e cross-import | crm, finance, integrations, order, core | **KRITIK** |
| S4 | `schemas.py` tek dosya | 90 sinif, 769 satir | YUKSEK |
| S5 | `integrations.py` model 19 tablo (5 alt-domain) | God Module | YUKSEK |
| S6 | `order.py` model 12 tablo (4 farkli domain) | God Module | YUKSEK |
| S7 | Finance → CRM cift yonlu FK baglantisi | invoices.account_id → crm_accounts | YUKSEK |
| S8 | `users` tablosu 30+ FK referans | Gravity well | ORTA |
| S9 | Frontend `types/index.ts` tek dosya | Tum domain tipleri icice | ORTA |
| S10 | Frontend page-state routing | react-router yok, URL yonetimi yok | ORTA |
| S11 | `portal.py` 4 model domain'inden import | crm, finance, order, core | ORTA |
| S12 | OCR/WhatsApp/Stock domainlerinde SIFIR test | 0 test fonksiyonu | ORTA |
| S13 | 10+ feature dizini sadece barrel re-export | Yaniltici yapi | DUSUK |
| S14 | Frontend `components/Admin` 17,593 satir | Parcalanmamis monolith | DUSUK |

### 1.4 Bagimlilik Grafigi — Mevcut FK Akisi

```
                        ┌──────────┐
                        │  users   │ ← Gravity Well (30+ FK)
                        └────┬─────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
      ┌───────▼──────┐ ┌────▼────┐  ┌──────▼──────┐
      │   orders     │ │   CRM   │  │ integrations│
      │  customers   │ │accounts │  │  OCR/WA/    │
      │  parts       │ │contacts │  │  sync/stock │
      │  opti_jobs   │ │quotes   │  └─────────────┘
      └───┬───┬──────┘ └────┬────┘
          │   │              │
          │   │    ┌─────────▼────────┐
          │   └────► finance          │
          │        │ invoices/payments│
          │        └──────────────────┘
          │
      ┌───▼──────────┐
      │  product     │  ← Iyi izole (tek yonlu FK)
      │  catalog     │
      └──────────────┘
```

---

## 2. Mimari Saglik Degerlendirmesi (Kantitatif)

Bu bolum, gercek kod taramasi ile elde edilen kantitatif metriklere dayalidir.

### 2.1 Mimari Ihlal Skorkaarti

| Metrik | Gercek Deger | Hedef Deger | SaglikDurumu |
|--------|-------------|-------------|------|
| Router'da dogrudan DB islemleri | 239+ adet | 0 | 🔴 KRITIK |
| Router katman orani | %38.6 | %15-20 | 🔴 KRITIK |
| 80+ satirlik router fonksiyonu | 20+ adet | 0 | 🔴 KRITIK |
| Cross-domain servis import'u | 3 servis | 0 | 🟡 UYARI |
| Cross-domain router import'u | 3 router | 0 | 🟡 UYARI |
| Schema tek dosya sinif sayisi | 90 sinif | max 15/dosya | 🟡 UYARI |
| Model tek dosya tablo sayisi | 19 (integrations) | max 6/dosya | 🟡 UYARI |
| Test kapsamindaki domain orani | 5/8 (%62) | 8/8 (%100) | 🟡 UYARI |
| Port interface sayisi | 0 | 8 | 🔴 KRITIK |
| Frontend monolith bilesen (>1000 satir) | 9 dosya | 0 | 🟡 UYARI |

### 2.2 Router Katmaninda DB Erisim Yogunlugu (En Kotu 15)

Her satirda `db.query()`, `db.add()`, `db.delete()`, `db.commit()`, `db.execute()` vb. sayisi:

| Router Dosyasi | Satir | DB Islem | Yogunluk (islem/100satir) |
|----------------|------:|:--------:|:-------------------------:|
| `admin_router.py` | 1,146 | 50 | 4.36 |
| `orders_router.py` | 1,045 | 34 | 3.25 |
| `ocr_router.py` | 596 | 31 | 5.20 |
| `stations_router.py` | 286 | 19 | 6.64 |
| `portal.py` | 209 | 14 | 6.70 |
| `sql_router.py` | 365 | 13 | 3.56 |
| `azure_router.py` | 328 | 11 | 3.35 |
| `email_ocr_router.py` | 192 | 11 | 5.73 |
| `google_vision_router.py` | 230 | 10 | 4.35 |
| `aws_textract_router.py` | 255 | 9 | 3.53 |
| `scanner_device_router.py` | 97 | 9 | 9.28 |
| `optiplanning_router.py` | 215 | 9 | 4.19 |
| `telegram_ocr_router.py` | 158 | 9 | 5.70 |
| `config_router.py` | 374 | 5 | 1.34 |
| `auth_router.py` | 131 | 5 | 3.82 |
| **TOPLAM** | **5,627** | **239** | **4.25 ort.** |

**Yorum:** `scanner_device_router.py` ve `portal.py` en yuksek yogunluga sahip —
97 satirda 9 DB islem (her ~11 satirda bir DB cagirisi). Bu, router'in tamamen
repository/service gorevi gordugunu gosterir.

### 2.3 Cross-Domain Baglanti Matrisi (Model Import'lari)

Hangi service/router hangi model domain'lerinden import yapiyor:

```
                      core  order  crm  finance  integrations  product
order_service.py        -     ✓     ✓      ✓         ✓           -       ← 4 cross-domain!
production_receipt.py   -     -     ✓      ✓         -           -       ← 2 cross-domain
portal.py (router)      ✓     ✓     ✓      ✓         -           -       ← 4 cross-domain!
mikro_router.py         -     -     ✓      -         -           -       ← 1 cross-domain
```

**En Kritik Hotspot:** `order_service.py` — 4 farkli domain'den model import eder:
- `app.models.crm.CRMOpportunity` (CRM domain)
- `app.models.finance.Invoice` (Finance domain)
- `app.models.integrations.OCRJob` (Integration domain)
- `app.models.order.OptiJob, OptiAuditEvent, Message` (Orchestrator domain)

Bu servisi ayirmadan modular monolith'e gecis mumkun degildir.

### 2.4 Service-to-Service Import Grafigi

```
ai_assistant_service ──── gemini_service
crm_service ──── base_service, email_service
integration_service ──── mikro_sync_service
optiplanning_service ──── export, order_service         ← Cross-domain!
order_service ──── optimization                         ← Cross-domain!
payment_service ──── base_service, email_service
price_tracking_service ──── price_tracking_helpers, price_tracking_ocr, price_tracking_ai
stock_card_service ──── integration_settings_service, base_service
whatsapp_scheduler ──── whatsapp_service
```

**Iyi haberler:** Cogu servis iyi izole. Sadece 3 cross-domain bagimlilik var:
1. `optiplanning_service → order_service` (Orchestrator → Orders)
2. `order_service → optimization` (Orders → Orchestrator)
3. `stock_card_service → integration_settings_service` (Stock → Integrations)

**Kotu haber:** `order_service ↔ optiplanning_service` karisimli bagimlilik, circular risk tasir.

### 2.5 Router-to-Service Bagimlilik Grafigi

```
ocr_router ──── orchestrator_service   ← Cross-domain!
            ├── order_service          ← Cross-domain!
            ├── azure_service
            └── ocr_order_mapper

admin_router ──── predictive_ai

optiplanning_router ──── optiplan_csv_otomasyon
                     └── optiplanning_service

orders_router ──── export
               └── order_service
```

**Kritik:** `ocr_router` tek basina 4 servisi tuketir (3 farkli domain).
Bu, Integration Gateway'in tam olarak ayrilmasini zorunlu kilar.

---

## 3. Parcalama Stratejisi

### 3.1 Genel Yaklasim

**Modular Monolith** mimarisi uygulanacak. Tam mikro-servis gecisi yerine:

1. **Dikey Dilimler (Vertical Slices):** Her domain kendi router + service + model + schema grubuna sahip
2. **Yatay Katmanlar (Horizontal Layers):** Her dilim icinde sabit katman sirasi korunur
3. **Bounded Context Sinirlari:** Domain'ler arasi iletisim sadece tanimli Port interface'leri uzerinden
4. **Bagimsiz Deploy Potansiyeli:** Her dilim ileride mikro-servis olarak cikarilabilir

### 3.2 Neden Modular Monolith?

| Kriter | Mikro-Servis | Modular Monolith | Agirlik |
|--------|-------------|------------------|---------|
| Takim boyutu (3-5 kisi) | Asiri yuk, DevOps gereksinimi | Uygun | **x3** |
| DB transaction gereksinimleri | Zor (saga pattern) | Kolay (tek DB) | **x2** |
| Deploy karmasikligi | Yuksek (K8s/orchestration) | Dusuk (tek proses) | **x2** |
| Domain olgunlugu | Sinirlar net olmali | Oncelik: sinirlari netles | **x3** |
| Gecis maliyeti | Cok yuksek (3-6 ay) | Kademeli (~6 hafta) | **x2** |
| Mevcut coupling seviyesi | Oncesinde decoupling sart | Kademeli decoupling | **x3** |

**Agirlikli Skor:** Modular Monolith **12/15** vs Mikro-Servis **3/15**

### 3.3 Mimari Gecis Yol Haritasi

```
MEVCUT                    FAZ 1-3               FAZ 4-5               GELECEK
┌──────────┐         ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Monolith │  ────>  │   Modular    │ ───> │   Modular    │ ───> │  Mikro-      │
│ (karisik │         │   Monolith   │      │   Monolith   │      │  Servis      │
│  katman) │         │   (domain    │      │   (port +    │      │  (opsiyonel) │
│          │         │    klasor)   │      │    event)    │      │              │
└──────────┘         └──────────────┘      └──────────────┘      └──────────────┘
  ~25K satir          Dosya tasima +         Port interface        Her domain
  karma import        schema/model           + domain event        ayri deploy
                      ayirma                 + lazy loading        (gerekirse)
```

---

## 4. Dikey Dilimler — 8 Bounded Context

### 4.0 Dilim Haritasi (Genel Bakis)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OptiPlan360 Modular Monolith                        │
├────────────┬──────────┬───────────┬──────────┬──────────┬─────────────────┤
│  IDENTITY  │  ORDER   │ ORCHESTR. │ FINANCE  │   CRM    │   INTEGR.      │
│  & ACCESS  │  MGMT    │  ENGINE   │          │          │   GATEWAY      │
│            │          │           │          │          │                │
│ users      │ orders   │ opti_job  │ invoices │ accounts │ ocr_*          │
│ sessions   │ customer │ audit_ev  │ payments │ contacts │ whatsapp_*     │
│ auth       │ parts    │ machine_  │ pay_prom │ opportun │ email_*        │
│ roles      │ stations │  config   │ price_*  │ quotes   │ telegram_*     │
│ audit_log  │ messages │ reports   │          │ tasks    │ sync_jobs      │
│ activity   │ notes    │           │          │ tickets  │ outbox/inbox   │
│            │ status_l │           │          │ activiti │ azure/goog/aws │
├────────────┼──────────┼───────────┼──────────┼──────────┼────────────────┤
│  PRODUCT   │  STOCK   │           │          │          │                │
│  CATALOG   │  MGMT    │           │          │          │                │
│            │          │           │          │          │                │
│ brands     │ stock_c  │           │          │          │                │
│ colors     │ stock_m  │           │          │          │                │
│ prod_type  │          │           │          │          │                │
│ mat_spec   │          │           │          │          │                │
│ supplier   │          │           │          │          │                │
│ items      │          │           │          │          │                │
└────────────┴──────────┴───────────┴──────────┴──────────┴────────────────┘
```

---

### 4.1 Dilim 1: IDENTITY & ACCESS (Cekirdek)

**Sorumluluk:** Kimlik dogrulama, yetkilendirme, oturum yonetimi, denetim

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `auth_router.py` | 131 |
| Router | `auth_enhanced.py` | 370 |
| Router | `admin_router.py` (kullanici CRUD kismi) | ~600 |
| Service | `token_service.py` | ~120 |
| Service | `base_service.py` (auth metotlari) | ~150 |
| Model | `core.py` — users, sessions, audit_logs, user_activities, audit_records, logs | 147 (6 tablo) |
| Schema | Login*, User* semalari (schemas.py icinden) | ~80 |
| Config | `permissions.py` (49 perm degeri), `security.py`, `rate_limit.py` | ~300 |
| **Toplam** | | **~1,898** |

#### DB Ihlal Analizi
- `admin_router.py`: **50 DB islem** (kullanici CRUD, device yonetimi icice)
- `auth_router.py`: **5 DB islem** (kabul edilebilir)
- **Cikarilmasi gereken:** `admin_router.py`'daki device yonetimi → Integration Gateway

#### Cross-Domain Import'lar
- `admin_router.py` import'lari: `predictive_ai` servisi (AI domain — kabul edilebilir)
- `users.crm_account_id` FK → CRM domain'e ters bagimlilik (**cikarilacak**)

#### Hedef Yapi

```
domains/identity/
├── __init__.py
├── routers.py          # auth + admin user endpoints
├── services.py         # token, session, permission logic
├── models.py           # User, Session, AuditLog, Activity (6 tablo)
├── schemas.py          # Login*, UserCreate, UserUpdate, UserResponse
├── permissions.py      # Permission enum + ROLE_PERMISSIONS
├── security.py         # JWT utils, password hashing
├── ports.py            # IdentityPort interface
└── tests/
    └── test_auth.py
```

#### Port Interface

```python
class IdentityPort:
    def get_current_user(token: str) -> UserInfo           # Readonly DTO
    def check_permission(user_id: int, perm: str) -> bool
    def log_audit(actor_id: int, action: str, target: str) -> None
    def get_user_by_id(user_id: int) -> UserInfo | None
```

#### Kritik Kararlar
- `users.crm_account_id` FK kaldirilacak → CRM tarafinda `crm_accounts.user_id` tek yonlu
- `admin_router.py`'daki device yonetimi kodu → Integration Gateway'e tasinacak
- auth_enhanced.py'deki `login()` fonksiyonu (370 satir) → service'e cikarilacak

#### Test Durumu
- Mevcut: `test_auth_security.py` (9 test), `test_admin_users_router.py` (4 test) = **13 test**
- Gerekli ekleme: login edge case'leri, permission hierarchy, token refresh = **+15 test**

---

### 4.2 Dilim 2: ORDER MANAGEMENT (Ana Is Akisi)

**Sorumluluk:** Siparis CRUD, parca yonetimi, musteri bilgisi, istasyon yonetimi

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `orders_router.py` | 1,045 |
| Router | `customers_router.py` | ~250 |
| Router | `stations_router.py` | 286 |
| Service | `order_service.py` | 448 |
| Model | `order.py` (12 tablo — 4 domain karisik!) | 221 |
| Schema | Order*, Customer*, Station* (schemas.py icinden) | ~200 |
| **Toplam** | | **~2,450** |

#### DB Ihlal Analizi
- `orders_router.py`: **34 DB islem** (2. en kotu)
- `stations_router.py`: **19 DB islem** + `scan_barcode()` 330 satir
- **Toplam router DB ihlali:** 53 islem

#### Cross-Domain Import'lar — KRITIK HOTSPOT

`order_service.py` su domain'lerden import yapar:

```python
# order_service.py (448 satir) icindeki cross-domain import'lar:
from app.models.crm import CRMOpportunity          # ← CRM domain!
from app.models.finance import Invoice              # ← Finance domain!
from app.models.integrations import OCRJob          # ← Integration domain!
from app.models.order import OptiJob, OptiAuditEvent, Message  # ← Orchestrator domain!
from app.services.optimization import MergeService  # ← Orchestrator domain!
```

Bu **5 cross-domain import**, order_service.py'yi projenin en bagimli dosyasi yapar.

#### Cikarilmasi Gereken Kaynaklar

| Kaynak | Mevcut Yer | Hedef Domain |
|--------|-----------|--------------|
| `OptiJob`, `OptiAuditEvent` tablosu | `order.py` | → Orchestrator |
| `Message` tablosu | `order.py` | → Orchestrator |
| `IncomingSpec`, `ProductRequest` tablosu | `order.py` | → Product Catalog |
| `CRMOpportunity` import | `order_service.py` | → CRM Port uzerinden |
| `Invoice` import | `order_service.py` | → Finance Port uzerinden |
| `OCRJob` import | `order_service.py` | → Integration Port uzerinden |

#### Hedef Yapi

```
domains/orders/
├── __init__.py
├── routers.py          # orders + customers + stations endpoints
├── services.py         # order CRUD, status transitions, merge
├── models.py           # Order, OrderPart, Customer, Station, StatusLog, OrderNote
├── schemas.py          # OrderCreate, OrderUpdate, OrderListItem, OrderOut...
├── ports.py            # OrderPort interface
└── tests/
    └── test_orders.py
```

#### Port Interface

```python
class OrderPort:
    def get_order(order_id: int) -> OrderInfo                 # Readonly DTO
    def get_parts_for_order(order_id: int) -> list[PartInfo]
    def update_order_status(order_id: int, status: str) -> None
    def list_orders(filters: dict) -> list[OrderSummary]
    def get_customer(customer_id: int) -> CustomerInfo | None
```

#### Test Durumu
- Mevcut: `test_orders_crud.py` (28 test) = **28 test** (Orta)
- Gerekli ekleme: station scan_barcode, customer merge, status transition edge = **+12 test**

---

### 4.3 Dilim 3: ORCHESTRATOR ENGINE (Optimizasyon Motoru)

**Sorumluluk:** OptiJob yasam dongusu, state machine, Biesse/CSV/XLSX export, optimizasyon

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `orchestrator_router.py` | ~250 |
| Router | `biesse_router.py` | ~150 |
| Router | `optiplanning_router.py` | 215 |
| Service | `orchestrator_service.py` | 503 |
| Service | `optiplanning_service.py` | 367 |
| Service | `optiplan_worker_service.py` | 358 |
| Service | `export.py` + `export_service.py` + `export_validator.py` | ~600 |
| Service | `grain_matcher.py` | ~200 |
| Service | `optiplan_csv_otomasyon.py` | 413 |
| Service | `optiplan_tam_otomasyon.py` | ~300 |
| Service | `optiplan_txt_exporter.py` | ~150 |
| Service | `xml_collector_service.py` | 423 |
| Service | `production_receipt_service.py` | ~250 |
| Service | `drop_optimization.py` + `optimization.py` | ~600 |
| Service | `biesse_integration_service.py` | 430 |
| Model | `optiplanning.py` (3 tablo: MachineConfig, OptimizationJob, Report) | 54 |
| Model | OptiJob, OptiAuditEvent (order.py'den tasinacak) | ~50 |
| Constants | `excel_schema.py` (LEGACY_GRAIN_MAP) | ~200 |
| **Toplam** | | **~5,513** |

**Bu, projenin en buyuk domain'i.** 5,500+ satir ile tek basina backend'in %21.6'si.

#### DB Ihlal Analizi
- `optiplanning_router.py`: **9 DB islem** + `run_advanced_optimization()` 560 satir!
- Buyuk fonksiyon servis'e cikarilmali

#### Cross-Domain Import'lar
- `orchestrator_service.py`: `from ..models import Customer, Order, OrderPart` (Order domain)
- `optiplanning_service.py`: `from .order_service import OrderService` (Order domain)
- `production_receipt_service.py`: `from app.models.crm` + `from app.models.finance` (2 domain)
- **Sonuc:** readoonly Order erisimi → Port uzerinden, CRM/Finance → kaldirilacak

#### Hedef Yapi

```
domains/orchestrator/
├── __init__.py
├── routers.py              # /jobs/* + /biesse/* + /optiplanning/*
├── services/
│   ├── orchestrator.py     # Job lifecycle, state machine
│   ├── export.py           # XLSX generation
│   ├── export_validator.py # Export validation rules
│   ├── grain_matcher.py    # Grain detection logic
│   ├── csv_automation.py   # CSV otomasyon
│   ├── worker.py           # OptIPlan.exe integration
│   ├── biesse.py           # Biesse integration
│   ├── xml_collector.py    # XML collection
│   ├── optimization.py     # Drop optimization + merge
│   └── receipt.py          # Production receipt
├── models.py               # OptiJob, OptiAuditEvent, MachineConfig, OptimizationJob, Report
├── schemas.py              # OptiJob*, MachineConfig*, Optimization*
├── constants.py            # excel_schema, LEGACY_GRAIN_MAP
├── ports.py                # OrchestratorPort interface
└── tests/
    ├── test_orchestrator.py
    ├── test_export.py
    └── test_grain_matcher.py
```

#### Port Interface

```python
class OrchestratorPort:
    def create_job(order_id: int, parts: list, params: dict) -> JobInfo
    def get_job_state(job_id: int) -> JobStateInfo
    def approve_job(job_id: int) -> None
    def cancel_job(job_id: int) -> None
    def get_export_file(job_id: int) -> bytes
    def list_jobs(filters: dict) -> list[JobSummary]
```

#### Test Durumu
- Mevcut: `test_orchestrator_compliance.py` + `test_orchestrator_service.py` (41 test),
  `test_export_validator.py` (29 test), `test_grain_matcher.py` (27 test) = **97 test** (IYI)
- Gerekli ekleme: CSV automation, XML collector, Biesse integration = **+20 test**

---

### 4.4 Dilim 4: FINANCE (Fatura & Odeme)

**Sorumluluk:** Fatura, tahsilat, odeme vaadi, fiyat takibi, hatirlatma sistemi

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `payment_router.py` | ~300 |
| Router | `price_tracking_router.py` | ~250 |
| Service | `payment_service.py` | 526 |
| Service | `price_tracking_service.py` | 610 |
| Service | `price_tracking_ai.py` | ~200 |
| Service | `price_tracking_ocr.py` | ~200 |
| Service | `price_tracking_helpers.py` | ~150 |
| Service | `reminders.py` | ~200 |
| Model | `finance.py` (5 tablo: invoices, payments, payment_promises, price_upload_jobs, price_items) | 176 |
| Schema | Price*, Payment*, Invoice* (schemas.py icinden) | ~120 |
| **Toplam** | | **~2,732** |

#### Cross-Domain Import'lar
- `payment_service.py`: `from app.models import CRMAccount` ← CRM domain!
- **Cozum:** CRM account bilgisini Port uzerinden alacak, dogrudan import kaldirilacak

#### FK Degisiklik Kararlari
- `invoices.account_id` → `invoices.customer_id` (CRM bagimliligi yerine Order.customers'a isaret)
- VEYA: `account_id` integer kalir, FK constraint kaldirilir, CRM Port ile resolve edilir
- **Onerilen:** Ikinci yaklasim (FK kaldir, Port ekle) — migration riski daha dusuk

#### Hedef Yapi

```
domains/finance/
├── __init__.py
├── routers.py           # /payments/* + /price-tracking/*
├── services/
│   ├── payment.py       # Invoice + Payment CRUD
│   ├── price_tracking.py # Price upload + analysis
│   ├── price_ai.py      # AI-based price analysis
│   └── reminders.py     # Payment reminder scheduler
├── models.py            # Invoice, Payment, PaymentPromise, PriceUploadJob, PriceItem
├── schemas.py           # Payment*, Price*, Invoice*
├── ports.py             # FinancePort interface
└── tests/
    └── test_finance.py
```

#### Test Durumu
- Mevcut: `test_finance_service.py` (5 test) = **5 test** (DUSUK)
- Gerekli ekleme: invoice CRUD, payment status, reminder logic, price tracking = **+25 test**

---

### 4.5 Dilim 5: CRM (Musteri Iliskileri)

**Sorumluluk:** Hesaplar, firsatlar, teklifler, destek ticketlari, aktiviteler

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `crm_router.py` | ~800 |
| Router | `portal.py` (musteri portali) | 209 |
| Service | `crm_service.py` | 700 |
| Model | `crm.py` (10 tablo) | 244 |
| Schema | Portal*, CRM* semalari | ~150 |
| **Toplam** | | **~2,103** |

#### Cross-Domain Import'lar — PORTAL DIKKAT
- `portal.py`: 4 model domain'inden import → crm, finance, order, core
- `crm_service.py`: `from .base_service import BaseService`, `from .email_service import EmailService`
- **Cozum:** `portal.py` composite endpoint'tir — sayfa kompozisyon katmanina (BFF) tasinabilir
  veya mevcut haliyle multi-domain facade router olarak kalabilir

#### FK Degisikligi
- `crm_accounts.customer_id` kalir (Order domain'e referans, tek yonlu — sorunsuz)
- `users.crm_account_id` kaldirilir (Identity → CRM ters bagimlilik kesilir)

#### Hedef Yapi

```
domains/crm/
├── __init__.py
├── routers.py           # /crm/* + /portal/* (portal = composite)
├── services.py          # Account, Opportunity, Ticket CRUD
├── models.py            # CRMAccount, Contact, Opportunity, Quote, QuoteLine, Task, Activity, Note, Ticket, TicketMessage (10 tablo)
├── schemas.py           # CRM*, Portal*
├── ports.py             # CRMPort interface
└── tests/
    └── test_crm.py
```

#### Test Durumu
- Mevcut: `test_crm_service.py` (5 test) = **5 test** (DUSUK)
- Gerekli ekleme: account lifecycle, opportunity pipeline, ticket flow, portal = **+20 test**

---

### 4.6 Dilim 6: INTEGRATION GATEWAY (Dis Sistem Entegrasyonlari)

**Sorumluluk:** OCR (Azure/Google/AWS/Tesseract), WhatsApp, Email, Telegram, Mikro ERP, sync

**Bu, projenin en genis ve en karmasik domain'i — dosya sayisi acisindan.**

#### Mevcut Dosya Envanteri

| Alt-Domain | Dosya | Satir |
|------------|-------|------:|
| **OCR** | `ocr_router.py`, `azure_router.py`, `google_vision_router.py`, `aws_textract_router.py`, `telegram_ocr_router.py`, `email_ocr_router.py`, `scanner_device_router.py` | ~1,856 |
| **OCR Services** | `azure_service.py`, `google_vision_service.py`, `aws_textract_service.py`, `ocr_order_mapper.py` | ~850 |
| **WhatsApp** | `whatsapp_router.py`, `whatsapp_service.py`, `whatsapp_scheduler.py` | ~650 |
| **Mikro ERP** | `mikro_router.py`, `sql_router.py`, `mikro_service.py`, `mikro_sync_service.py` | ~1,200 |
| **Genel** | `integration_router.py`, `integration_service.py`, `integration_health_service.py`, `integration_settings_service.py`, `bridge_service.py`, `tracking_folder_service.py`, `websocket_manager.py`, `email_service.py`, `gemini_service.py` | ~1,800 |
| **Model** | `integrations.py` (19 tablo!) | 271 |
| **Adapters** | `integrations/mikro_sql_client.py`, `integrations/whatsapp/` | ~500 |
| **Toplam** | | **~7,127** |

**En buyuk domain: Backend'in %27.9'u bu dilimde!**

#### integrations.py Model Dosyasi — 19 Tablo Dagitimi

| Alt-Domain | Tablolar |
|------------|----------|
| OCR | telegram_ocr_configs, email_ocr_configs, device_ocr_configs, ocr_jobs, ocr_lines |
| Cloud Config | azure_configs, google_vision_configs, aws_textract_configs |
| WhatsApp | whatsapp_messages, whatsapp_settings |
| Sync | integration_entity_map, integration_sync_jobs, integration_outbox, integration_inbox, integration_errors, integration_audit, integration_settings |
| Stock | stock_cards, stock_movements (**→ Stock dilimine tasinacak**) |

#### DB Ihlal Analizi (EN KOTU DOMAIN)
| Router | DB Islem |
|--------|:--------:|
| `ocr_router.py` | 31 |
| `azure_router.py` | 11 |
| `email_ocr_router.py` | 11 |
| `google_vision_router.py` | 10 |
| `scanner_device_router.py` | 9 |
| `telegram_ocr_router.py` | 9 |
| `aws_textract_router.py` | 9 |
| `sql_router.py` | 13 |
| **Alt-toplam** | **103** |

**Integration Gateway router'lari toplam DB ihlalinin %43'unu olusturur!**

#### Buyuk Router Fonksiyonlari

| Fonksiyon | Satir | Neden Tehlikeli |
|-----------|------:|-----------------|
| `ocr_router._process_ocr_job()` | 842 | Tam is akisi: OCR → parse → order olustur |
| `azure_router.azure_ocr_upload()` | 570 | Upload + Azure API + DB kayit + response |
| `aws_textract_router.process_with_aws_textract()` | 456 | AWS API + parse + DB |
| `google_vision_router.process_with_google_vision()` | 397 | Google API + parse + DB |
| `ocr_router.upload_image()` | 455 | Multi-provider routing + validation |
| `ocr_router.lookup_customer_by_phone()` | 390 | CRM-like logic in OCR router |
| `ocr_router.update_ocr_config()` | 350 | Admin config in OCR router |
| `sql_router.get_table_schema()` | 350 | Raw SQL introspection |
| `sql_router.execute_query()` | 320 | Raw SQL execution |
| `email_ocr_router.fetch_now()` | 328 | Email fetch + OCR trigger |

**Bu 10 fonksiyonun toplami: ~4,458 satir** — hepsi service katmanina cikarilacak.

#### Hedef Yapi — Alt-Domain Bolumu

```
domains/integrations/
├── __init__.py
├── routers/
│   ├── ocr.py              # Azure/Google/AWS/Telegram/Email/Scanner
│   ├── whatsapp.py         # WhatsApp mesajlasma
│   ├── mikro.py            # Mikro ERP + SQL bridge
│   └── sync.py             # Integration health + settings
├── services/
│   ├── ocr/
│   │   ├── azure.py        # Azure OCR service
│   │   ├── google_vision.py
│   │   ├── aws_textract.py
│   │   ├── order_mapper.py # OCR sonucu → Order olusturma
│   │   └── processor.py    # _process_ocr_job cikarilmis hali
│   ├── messaging/
│   │   ├── whatsapp.py
│   │   ├── whatsapp_scheduler.py
│   │   └── email.py
│   ├── erp/
│   │   ├── mikro.py
│   │   ├── mikro_sync.py
│   │   └── bridge.py
│   └── shared/
│       ├── health.py
│       ├── settings.py
│       └── tracking_folder.py
├── models/
│   ├── ocr.py              # ocr_jobs, ocr_lines, *_ocr_configs (5 tablo)
│   ├── cloud.py            # azure/google/aws_configs (3 tablo)
│   ├── whatsapp.py         # whatsapp_messages, whatsapp_settings (2 tablo)
│   └── sync.py             # integration_entity_map, sync_jobs, outbox, inbox, errors, audit, settings (7 tablo)
├── adapters/
│   ├── mikro_sql_client.py
│   └── whatsapp_templates.json
├── schemas.py
├── ports.py
└── tests/
    ├── test_ocr.py
    ├── test_whatsapp.py
    └── test_mikro.py
```

#### Test Durumu
- Mevcut: **0 test** (SIFIR KAPSAM!)
- Gerekli: OCR flow, provider switching, WhatsApp send/receive, Mikro sync = **+40 test**

---

### 4.7 Dilim 7: PRODUCT CATALOG (Urun Katalogu)

**Sorumluluk:** Marka, renk, urun tipi, malzeme ozelligi, tedarikci, materyal eslestirme

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `materials_router.py` | ~800 |
| Router | `product_router.py` | ~200 |
| Service | `product_service.py` | 367 |
| Service | `stock_matcher.py` | ~150 |
| Model | `product.py` (6 tablo: brands, colors, product_types, material_specs, suppliers, items) | 87 |
| Model | IncomingSpec, ProductRequest (order.py'den tasinacak) | ~40 |
| Schema | Brand*, Color*, ProductType*, MaterialSpec*, Item* | ~100 |
| **Toplam** | | **~1,744** |

#### DB Ihlal Analizi
- `materials_router.py`'de buyuk fonksiyonlar:
  - `get_alternative_materials()` 290 satir
  - `list_materials()` 240 satir
  - `match_materials()` 240 satir

#### Hedef Yapi

```
domains/catalog/
├── __init__.py
├── routers.py          # /materials/* + /products/*
├── services/
│   ├── product.py      # Product CRUD
│   └── matcher.py      # Material matching logic
├── models.py           # Brand, Color, ProductType, MaterialSpec, Supplier, Item, IncomingSpec, ProductRequest (8 tablo)
├── schemas.py
├── ports.py            # CatalogPort interface
└── tests/
    └── test_catalog.py
```

#### Test Durumu
- Mevcut: **0 test** (SIFIR KAPSAM — materials_router tamamen test edilmemis)
- Gerekli: material matching, alternative search, product CRUD = **+15 test**

---

### 4.8 Dilim 8: STOCK MANAGEMENT (Stok Yonetimi)

**Sorumluluk:** Stok karti, stok hareketi, envanter takibi

#### Mevcut Dosya Envanteri

| Katman | Dosya | Satir |
|--------|-------|------:|
| Router | `stock_cards_router.py` | ~200 |
| Service | `stock_card_service.py` | 335 |
| Model | stock_cards, stock_movements (integrations.py icinde — **tasinacak**) | ~40 |
| Schema | StockCard*, StockMovement* | ~60 |
| **Toplam** | | **~635** |

**En kucuk domain.** Ileride Catalog ile birlestirilmesi dusunulebilir.

#### Cross-Domain Import'lar
- `stock_card_service.py` → `integration_settings_service, base_service` (Integration domain)
- **Cozum:** Integration settings'e Port uzerinden erisim

#### Hedef Yapi

```
domains/stock/
├── __init__.py
├── routers.py          # /stock/*
├── services.py         # StockCard CRUD, movement tracking
├── models.py           # StockCard, StockMovement (2 tablo)
├── schemas.py
├── ports.py            # StockPort interface
└── tests/
    └── test_stock.py
```

#### Test Durumu
- Mevcut: **0 test** (SIFIR KAPSAM)
- Gerekli: stock card CRUD, movement tracking, balance calculation = **+10 test**

---

### 4.9 Domain Boyut Karsilastirmasi

| # | Domain | Satir | Oran | Tablo | Router DB Ihlal | Test |
|---|--------|------:|-----:|------:|:---------------:|-----:|
| 1 | Integration Gateway | 7,127 | 27.9% | 17 | 103 | 0 |
| 2 | Orchestrator Engine | 5,513 | 21.6% | 6 | 9 | 97 |
| 3 | Finance | 2,732 | 10.7% | 5 | ~5 | 5 |
| 4 | Order Management | 2,450 | 9.6% | 6 | 53 | 28 |
| 5 | CRM | 2,103 | 8.2% | 10 | ~5 | 5 |
| 6 | Identity & Access | 1,898 | 7.4% | 6 | 55 | 13 |
| 7 | Product Catalog | 1,744 | 6.8% | 8 | ~10 | 0 |
| 8 | Stock Management | 635 | 2.5% | 2 | ~3 | 0 |
| | **TOPLAM** | **~25,202** | | **60** | **~243** | **148** |

**Insight:** Integration Gateway + Orchestrator = %49.5 (yarim backend). En buyuk iki
domain'in ayrilmasi, projenin yarisini modularize eder.

---

## 5. Router Is Mantigi Cikarma Plani

Bu bolum, router katmanindaki en buyuk 20 fonksiyonu listeler ve her birinin
hedef servisini belirler. Tum fonksiyonlar icindeki is mantigi tamamen ilgili
service katmanina cikarilmalidir.

### 5.1 Oncelik Siralamasina Gore Top-20 Router Fonksiyon

| # | Router | Fonksiyon | Satir | Hedef Servis | Domain | Oncelik |
|---|--------|-----------|------:|--------------|--------|---------|
| 1 | `ocr_router` | `_process_ocr_job()` | 842 | `integrations.services.ocr.processor` | Integration | P0 |
| 2 | `azure_router` | `azure_ocr_upload()` | 570 | `integrations.services.ocr.azure` | Integration | P0 |
| 3 | `optiplanning_router` | `run_advanced_optimization()` | 560 | `orchestrator.services.orchestrator` | Orchestrator | P1 |
| 4 | `aws_textract_router` | `process_with_aws_textract()` | 456 | `integrations.services.ocr.aws_textract` | Integration | P1 |
| 5 | `ocr_router` | `upload_image()` | 455 | `integrations.services.ocr.processor` | Integration | P0 |
| 6 | `google_vision_router` | `process_with_google_vision()` | 397 | `integrations.services.ocr.google_vision` | Integration | P1 |
| 7 | `ocr_router` | `lookup_customer_by_phone()` | 390 | `orders.services` (customer lookup) | Orders | P1 |
| 8 | `auth_enhanced` | `login()` | 370 | `identity.services` | Identity | P0 |
| 9 | `ocr_router` | `update_ocr_config()` | 350 | `integrations.services.shared.settings` | Integration | P2 |
| 10 | `sql_router` | `get_table_schema()` | 350 | `integrations.services.erp.bridge` | Integration | P2 |
| 11 | `stations_router` | `scan_barcode()` | 330 | `orders.services` (station logic) | Orders | P1 |
| 12 | `email_ocr_router` | `fetch_now()` | 328 | `integrations.services.ocr.email` | Integration | P1 |
| 13 | `sql_router` | `execute_query()` | 320 | `integrations.services.erp.bridge` | Integration | P2 |
| 14 | `materials_router` | `get_alternative_materials()` | 290 | `catalog.services.matcher` | Catalog | P2 |
| 15 | `sql_router` | `export_query_result()` | 285 | `integrations.services.erp.bridge` | Integration | P2 |
| 16 | `compliance_router` | `quick_compliance_check()` | 260 | `shared.services.compliance` | Shared | P2 |
| 17 | `materials_router` | `list_materials()` | 240 | `catalog.services.product` | Catalog | P2 |
| 18 | `materials_router` | `match_materials()` | 240 | `catalog.services.matcher` | Catalog | P2 |
| 19 | `sql_router` | `get_table_data()` | 235 | `integrations.services.erp.bridge` | Integration | P2 |
| 20 | `admin_router` | (birden fazla CRUD fonksiyonu) | ~600 | `identity.services` + diger | Identity | P1 |

**Toplam cikarilacak kod:** ~7,858 satir router'dan service'e tasinacak.

### 5.2 Cikarma Sablonu

Her fonksiyon su adimlarla cikarilir:

```python
# ONCE (router'da):
@router.post("/ocr/process")
async def process_ocr(request: Request, file: UploadFile, db: Session = Depends(get_db)):
    # ... 842 satir is mantigi ...
    return {"result": result}

# SONRA (service'de):
class OCRProcessorService:
    @staticmethod
    def process_ocr_job(file_bytes: bytes, config: OCRConfig, db: Session) -> OCRResult:
        # ... 842 satir is mantigi buraya ...
        return result

# SONRA (router'da):
@router.post("/ocr/process")
async def process_ocr(request: Request, file: UploadFile, db: Session = Depends(get_db)):
    result = OCRProcessorService.process_ocr_job(await file.read(), config, db)
    return {"result": result}
```

### 5.3 Cikarma Sira Plani

| Faz | Domain | Fonksiyon Sayisi | Toplam Satir | Sure |
|-----|--------|:----------------:|:------------:|:----:|
| P0 | Integration (OCR core) | 3 | ~1,867 | 3 gun |
| P0 | Identity (login) | 1 | ~370 | 1 gun |
| P1 | Integration (OCR others) | 4 | ~1,571 | 3 gun |
| P1 | Orders (barcode + lookup) | 2 | ~720 | 2 gun |
| P1 | Orchestrator | 1 | ~560 | 2 gun |
| P1 | Identity (admin) | 1 | ~600 | 2 gun |
| P2 | Integration (sql/config) | 4 | ~1,240 | 2 gun |
| P2 | Catalog | 3 | ~770 | 2 gun |
| P2 | Shared (compliance) | 1 | ~260 | 1 gun |

---

## 6. Yatay Katmanlar (Horizontal Layers)

### 6.1 Katman Mimarisi (Her Dilim Icin Gecerli)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 0: PRESENTATION (HTTP Gateway)                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                     │
│  │   Router 1  │ │   Router 2  │ │   Router N  │                     │
│  │  (FastAPI)  │ │  (FastAPI)  │ │  (FastAPI)  │                     │
│  │ Max 100 sat │ │ per endpoint│ │             │                     │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                     │
├─────────┼───────────────┼───────────────┼─────────────────────────────┤
│  Layer 1: APPLICATION (Use Case Orchestration)                        │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐                    │
│  │  Service 1  │ │  Service 2  │ │  Service N  │                    │
│  │ (UseCase)   │ │ (UseCase)   │ │ (UseCase)   │                    │
│  │ Is Mantigi  │ │ Validasyon  │ │ Yetki       │                    │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                    │
├─────────┼───────────────┼───────────────┼─────────────────────────────┤
│  Layer 2: DOMAIN (Business Rules & Entities)                          │
│  ┌──────▼──────┐ ┌──────▼──────┐                                     │
│  │   Model     │ │   Enum      │  State Machine, Validation Rules    │
│  │   Entity    │ │   ValueObj  │  Permission Checking, FK Relations  │
│  └──────┬──────┘ └──────┬──────┘                                     │
├─────────┼───────────────┼─────────────────────────────────────────────┤
│  Layer 3: INFRASTRUCTURE (External I/O)                               │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Database   │ │   HTTP      │ │  File I/O   │ │  Cloud SDK  │   │
│  │  (SQLAlch)  │ │  (httpx)    │ │  (XLSX/CSV) │ │  (Azure..)  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  CROSS-CUTTING (Shared / Horizontal)                                   │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Auth MW │ │ Logging  │ │ Errors  │ │ Rate Lim │ │ Cache MW │    │
│  └─────────┘ └──────────┘ └─────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Katman Kurallari (ZORUNLU)

```
Router  →  Service  →  Model
  ↓           ↓          ↓
  HTTP       Port      Entity
  only       calls     pure

✅ Router → Service (dogrudan veya DI)
✅ Service → Model (ORM erisimleri)
✅ Service A → PortB.public_method()
✅ Router → Schema (request/response validation)

❌ ASLA: Router → Model (dogrudan DB erisimi)
❌ ASLA: Router → db.query() / db.add() / db.commit()
❌ ASLA: Service A → Service B private method
❌ ASLA: Model → Service (ters bagimlilik)
```

### 6.3 Router Endpoint Kuralari

Her router endpoint fonksiyonu:
1. **Max 30 satir** (if/else dahil)
2. **Sadece:** request parse → service cagir → response dondur
3. **DB session:** `Depends(get_db)` ile alinir, service'e gecilir
4. **Hata yakalama yok** — global exception handler halleder

```python
# DOGRU — 15 satir
@router.post("/orders", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.create(db, data, current_user)

# YANLIS — 200+ satir is mantigi
@router.post("/orders")
async def create_order(...):
    # validation logic...
    # permission check...
    # business rules...
    # DB queries...
    # notification send...
```

### 6.4 Cross-Cutting Concerns Tasima Plani

| Concern | Mevcut Konum | Hedef Konum |
|---------|-------------|-------------|
| Exception hiyerarsisi | `app/exceptions.py` | `shared/exceptions.py` |
| Rate limiting | `app/rate_limit.py` | `shared/rate_limit.py` |
| Logging config | `app/logging_config.py` | `shared/logging.py` |
| Cache middleware | `app/middleware/cache_middleware.py` | `shared/middleware/cache.py` |
| Text normalization | `app/utils/text_normalize.py` | `shared/utils/text_normalize.py` |
| Database session | `app/database.py` | `shared/database.py` |
| Base service | `app/services/base_service.py` | `shared/base_service.py` |
| WebSocket manager | `app/services/websocket_manager.py` | `shared/websocket.py` |

---

## 7. Frontend Parcalama Plani

### 7.1 Mevcut Frontend Boyut Dagilimi

| Grup | Satir | Dosya | En Buyuk Dosya |
|------|------:|------:|----------------|
| `components/Admin` | 17,593 | 19 | DeviceManagement.tsx (3,449) |
| `components/Shared` | 11,793 | 24 | FormComponents.tsx (2,862) |
| `features/Integrations` | 10,458 | 15 | MikroConfigModal.tsx (2,040) |
| `components/Stock` | 5,569 | 4 | StockCardComponent.tsx (2,268) |
| `components/CRM` | 3,639 | 3 | CRMPage.tsx (2,967) |
| `features/Operations` | 3,617 | 12 | — |
| `components/Orders` | 3,366 | 10 | — |
| `components/WhatsApp` | 3,413 | 1 | WhatsAppBusinessPage.tsx (3,413) |
| `features/Orchestrator` | 2,727 | 2 | OrchestratorPage.tsx (2,724) |

### 7.2 Monolith Bilesen Parcalama Detayi

#### 7.2.1 DeviceManagement.tsx (3,449 satir) → 7 Parca

| Hedef Bilesen | Tahmini Satir | Sorumluluk |
|---------------|:------------:|------------|
| `DeviceList.tsx` | 500 | Device table + filter |
| `DeviceForm.tsx` | 400 | Create/edit form |
| `DeviceConfigPanel.tsx` | 500 | OCR config per device |
| `DeviceHealthDashboard.tsx` | 400 | Status monitoring |
| `DeviceBulkActions.tsx` | 300 | Bulk enable/disable |
| `useDeviceManagement.ts` (hook) | 600 | Data fetching + state |
| `deviceTypes.ts` | 200 | Device-specific types |

#### 7.2.2 WhatsAppBusinessPage.tsx (3,413 satir) → 6 Parca

| Hedef Bilesen | Tahmini Satir | Sorumluluk |
|---------------|:------------:|------------|
| `WAConversationList.tsx` | 500 | Conversation sidebar |
| `WAMessageThread.tsx` | 500 | Message display |
| `WATemplateManager.tsx` | 400 | Template CRUD |
| `WABroadcast.tsx` | 400 | Broadcast messaging |
| `WASettingsPanel.tsx` | 300 | Configuration |
| `useWhatsApp.ts` (hook) | 500 | WS connection + data |

#### 7.2.3 StationsPage.tsx (3,273 satir) → 5 Parca

| Hedef Bilesen | Tahmini Satir | Sorumluluk |
|---------------|:------------:|------------|
| `StationGrid.tsx` | 500 | Station list/grid view |
| `StationDetail.tsx` | 500 | Single station view |
| `StationScanner.tsx` | 400 | Barcode scanning UI |
| `StationMetrics.tsx` | 400 | Production metrics |
| `useStations.ts` (hook) | 500 | Data + polling logic |

#### 7.2.4 OrchestratorPage.tsx (2,724 satir) → 7 Parca

| Hedef Bilesen | Tahmini Satir | Sorumluluk |
|---------------|:------------:|------------|
| `JobListPanel.tsx` | 500 | Job table + filters |
| `JobDetailPanel.tsx` | 600 | Job detail view |
| `StateTimeline.tsx` | 300 | State machine visualization |
| `ExportPanel.tsx` | 400 | Export XLSX/CSV controls |
| `AuditLogPanel.tsx` | 300 | Audit event history |
| `FilterBar.tsx` | 200 | Filter sidebar |
| `useJobsData.ts` (hook) | 400 | Data fetching + polling |

#### 7.2.5 CRMPage.tsx (2,967 satir) → 5 Parca

| Hedef Bilesen | Tahmini Satir | Sorumluluk |
|---------------|:------------:|------------|
| `AccountList.tsx` | 500 | Account table |
| `OpportunityBoard.tsx` | 500 | Pipeline/kanban view |
| `TicketPanel.tsx` | 400 | Support tickets |
| `ContactDetail.tsx` | 400 | Contact management |
| `useCRM.ts` (hook) | 400 | Data fetching |

#### 7.2.6 MikroConfigModal.tsx (2,040 satir) → 5 Parca

| Hedef Bilesen | Tahmini Satir | Sorumluluk |
|---------------|:------------:|------------|
| `MikroConnectionForm.tsx` | 400 | SQL connection settings |
| `MikroFieldMapper.tsx` | 500 | Field mapping UI |
| `MikroSyncSettings.tsx` | 400 | Sync schedule config |
| `MikroTestPanel.tsx` | 300 | Connection test UI |
| `useMikroConfig.ts` (hook) | 400 | Config state management |

#### 7.2.7 useAIOpsData.ts (810 satir) → Domain-Bazli Hook Bolme

Mevcut: 5 servis'ten veri toplar → **tek hook**
```
useAIOpsData imports:
  - adminService (Identity domain)
  - integrationService (Integration domain)
  - ordersService (Orders domain)
  - paymentService (Finance domain)
  - apiClient (Shared)
```

Hedef: Her domain kendi hook'unu saglar
```typescript
// domains/orders/hooks/useOrderStats.ts
export function useOrderStats() { ... }

// domains/finance/hooks/usePaymentStats.ts
export function usePaymentStats() { ... }

// domains/integrations/hooks/useIntegrationStats.ts
export function useIntegrationStats() { ... }

// pages/DashboardPage.tsx — composites
function DashboardPage() {
    const orders = useOrderStats();
    const payments = usePaymentStats();
    const integrations = useIntegrationStats();
    return <AIOrchestratorDashboard {...orders} {...payments} {...integrations} />;
}
```

### 7.3 Hedef Frontend Dizin Yapisi

```
frontend/src/
├── app/                          # Uygulama kabugu
│   ├── App.tsx                   # Router + Layout
│   ├── routes.tsx                # react-router-dom v6 route tanimlari
│   └── providers.tsx             # Theme, Auth, Notification
│
├── domains/                      # Dikey dilimler (backend ile 1:1)
│   ├── identity/
│   │   ├── components/           # LoginPage, UserProfile, UserManagement
│   │   ├── hooks/                # useAuth, usePermissions
│   │   ├── services/             # authService.ts
│   │   ├── stores/               # authStore.ts
│   │   └── types.ts
│   │
│   ├── orders/
│   │   ├── components/           # OrderList, OrderEditor, Kanban, StatusBadge
│   │   ├── hooks/                # useOrders, useOrderFilters, useOrderStats
│   │   ├── services/             # ordersService.ts
│   │   ├── stores/               # ordersStore.ts
│   │   └── types.ts
│   │
│   ├── orchestrator/
│   │   ├── components/           # JobListPanel, JobDetailPanel, StateTimeline, ExportPanel
│   │   ├── hooks/                # useJobs, useJobState
│   │   ├── services/             # orchestratorService.ts
│   │   └── types.ts
│   │
│   ├── finance/
│   │   ├── components/           # InvoiceList, PaymentForm, PriceTracking
│   │   ├── hooks/                # usePayments, usePriceTracking, usePaymentStats
│   │   ├── services/             # paymentService.ts, priceTrackingService.ts
│   │   └── types.ts
│   │
│   ├── crm/
│   │   ├── components/           # AccountList, OpportunityBoard, TicketPanel, ContactDetail
│   │   ├── hooks/                # useCRM, useTickets
│   │   ├── services/             # crmService.ts
│   │   └── types.ts
│   │
│   ├── integrations/
│   │   ├── components/           # IntegrationDashboard, ConfigModals, MikroConfig
│   │   ├── hooks/                # useIntegrationHealth, useIntegrationStats
│   │   ├── services/             # integrationService.ts, mikroService.ts
│   │   └── types.ts
│   │
│   ├── catalog/
│   │   ├── components/           # SpecSearch, MaterialBrowser
│   │   ├── services/             # productService.ts
│   │   └── types.ts
│   │
│   └── stock/
│       ├── components/           # StockCardList, MovementHistory
│       ├── services/             # stockService.ts
│       └── types.ts
│
├── shared/                       # Yatay paylasilan
│   ├── components/               # Button, Modal, Badge, DataTable, Icon, FormComponents
│   ├── hooks/                    # useDebounce, useMediaQuery, usePagination
│   ├── services/                 # apiClient.ts, webSocketService.ts
│   ├── stores/                   # uiStore.ts, notificationStore.ts
│   ├── types/                    # ApiResponse<T>, PaginatedResponse<T>, Nullable<T>
│   └── utils/                    # formatters, validators
│
└── pages/                        # Kompozisyon katmani (domain parcalarini birlestirir)
    ├── DashboardPage.tsx          # orders + orchestrator + finance + integrations
    ├── OperationsPage.tsx         # orders + orchestrator + AI
    └── PublicTrackingPage.tsx     # orders (public, auth-free)
```

### 7.4 Routing Gecisi Detayi

**Mevcut:** `useState<Page>` + switch/case (App.tsx icinde)
**Hedef:** `react-router-dom v6` lazy routes + domain-based code splitting

```tsx
// app/routes.tsx
const routes = [
  { path: "/",               element: <DashboardPage /> },
  { path: "/login",          element: lazy(() => import("../domains/identity/components/LoginPage")) },
  { path: "/orders",         element: lazy(() => import("../domains/orders/components/OrderList")) },
  { path: "/orders/:id",     element: lazy(() => import("../domains/orders/components/OrderEditor")) },
  { path: "/jobs",           element: lazy(() => import("../domains/orchestrator/components/JobListPanel")) },
  { path: "/jobs/:id",       element: lazy(() => import("../domains/orchestrator/components/JobDetailPanel")) },
  { path: "/finance/*",      element: lazy(() => import("../domains/finance/components/FinanceLayout")) },
  { path: "/crm/*",          element: lazy(() => import("../domains/crm/components/CRMLayout")) },
  { path: "/integrations/*", element: lazy(() => import("../domains/integrations/components/IntegrationDashboard")) },
  { path: "/catalog/*",      element: lazy(() => import("../domains/catalog/components/CatalogLayout")) },
  { path: "/stock/*",        element: lazy(() => import("../domains/stock/components/StockLayout")) },
  { path: "/admin/*",        element: lazy(() => import("../domains/identity/components/AdminLayout")) },
  { path: "/portal/*",       element: lazy(() => import("../domains/crm/components/PortalLayout")) },
];
```

### 7.5 Frontend Parcalama Sirasi

| Faz | Is | Dosya Sayisi | Etki |
|-----|---|:------------:|------|
| FE-0 | react-router-dom kurulumu + route tanimlari | 3 | URL destegiEkle |
| FE-1 | `types/index.ts` → domain-based `.ts` dosyalari | 8+1 | Tip izolasyonu |
| FE-2 | OrchestratorPage.tsx parcalama | 7 | En cok kullanilan sayfa |
| FE-3 | DeviceManagement.tsx parcalama | 7 | En buyuk monolith |
| FE-4 | WhatsAppBusinessPage.tsx parcalama | 6 | Tek-dosya monolith |
| FE-5 | CRMPage.tsx + MikroConfigModal.tsx parcalama | 10 | Domain bazli |
| FE-6 | useAIOpsData hook bolme | 3+1 | Cross-domain hook temizligi |
| FE-7 | Barrel re-export temizligi + Shared tasima | ~20 | Final cleanup |

---

## 8. Hedef Backend Dizin Yapisi

```
backend/app/
├── main.py                        # App factory + domain router kaydi
├── shared/
│   ├── database.py                # Engine + SessionLocal
│   ├── base_model.py              # DeclarativeBase + AuditMixin
│   ├── exceptions.py              # AppError hiyerarsisi
│   ├── rate_limit.py              # slowapi singleton
│   ├── logging.py                 # Logging config
│   ├── middleware/
│   │   ├── cache.py
│   │   └── cors.py
│   └── utils/
│       └── text_normalize.py
│
├── domains/
│   ├── identity/
│   │   ├── __init__.py
│   │   ├── routers.py             # auth + admin user endpoints (~300 satir hedef)
│   │   ├── services.py            # token, session, permission, user CRUD
│   │   ├── models.py              # User, Session, AuditLog, Activity (6 tablo)
│   │   ├── schemas.py             # Login*, User*
│   │   ├── permissions.py         # Permission enum + ROLE_PERMISSIONS
│   │   ├── security.py            # JWT utils
│   │   └── ports.py               # IdentityPort
│   │
│   ├── orders/
│   │   ├── __init__.py
│   │   ├── routers.py             # orders + customers + stations (~400 satir hedef)
│   │   ├── services.py            # order CRUD, status, merge, customer
│   │   ├── models.py              # Order, OrderPart, Customer, Station, StatusLog, OrderNote
│   │   ├── schemas.py             # Order*, Customer*, Station*
│   │   └── ports.py               # OrderPort
│   │
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   ├── routers.py             # /jobs/* + /biesse/* + /optiplanning/*
│   │   ├── services/
│   │   │   ├── orchestrator.py    # Job lifecycle, state machine
│   │   │   ├── export.py          # XLSX generation
│   │   │   ├── export_validator.py
│   │   │   ├── grain_matcher.py   # Grain detection
│   │   │   ├── csv_automation.py  # CSV otomasyon
│   │   │   ├── worker.py          # OptIPlan.exe integration
│   │   │   ├── biesse.py          # Biesse integration
│   │   │   ├── xml_collector.py   # XML collection
│   │   │   ├── optimization.py    # Drop optimization + merge
│   │   │   └── receipt.py         # Production receipt
│   │   ├── models.py              # OptiJob, AuditEvent, MachineConfig, OptimizationJob, Report
│   │   ├── schemas.py             # OptiJob*, MachineConfig*
│   │   ├── constants.py           # excel_schema, LEGACY_GRAIN_MAP
│   │   └── ports.py               # OrchestratorPort
│   │
│   ├── finance/
│   │   ├── __init__.py
│   │   ├── routers.py             # /payments/* + /price-tracking/*
│   │   ├── services/
│   │   │   ├── payment.py
│   │   │   ├── price_tracking.py
│   │   │   └── reminders.py
│   │   ├── models.py              # Invoice, Payment, PaymentPromise, PriceUploadJob, PriceItem
│   │   ├── schemas.py             # Payment*, Price*, Invoice*
│   │   └── ports.py               # FinancePort
│   │
│   ├── crm/
│   │   ├── __init__.py
│   │   ├── routers.py             # /crm/* + /portal/*
│   │   ├── services.py
│   │   ├── models.py              # 10 tablo: Account, Contact, Opportunity, Quote...
│   │   ├── schemas.py             # CRM*, Portal*
│   │   └── ports.py               # CRMPort
│   │
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── routers/
│   │   │   ├── ocr.py             # Azure/Google/AWS/Telegram/Email/Scanner (~200 satir hedef)
│   │   │   ├── whatsapp.py
│   │   │   ├── mikro.py
│   │   │   └── sync.py
│   │   ├── services/
│   │   │   ├── ocr/
│   │   │   │   ├── azure.py
│   │   │   │   ├── google_vision.py
│   │   │   │   ├── aws_textract.py
│   │   │   │   ├── order_mapper.py
│   │   │   │   └── processor.py   # _process_ocr_job EXTRACTED
│   │   │   ├── messaging/
│   │   │   │   ├── whatsapp.py
│   │   │   │   ├── scheduler.py
│   │   │   │   └── email.py
│   │   │   ├── erp/
│   │   │   │   ├── mikro.py
│   │   │   │   ├── mikro_sync.py
│   │   │   │   └── bridge.py
│   │   │   └── shared/
│   │   │       ├── health.py
│   │   │       ├── settings.py
│   │   │       └── tracking_folder.py
│   │   ├── models/
│   │   │   ├── ocr.py             # 5 tablo
│   │   │   ├── cloud.py           # 3 tablo
│   │   │   ├── whatsapp.py        # 2 tablo
│   │   │   └── sync.py            # 7 tablo
│   │   ├── adapters/
│   │   │   ├── mikro_sql_client.py
│   │   │   └── whatsapp_templates.json
│   │   ├── schemas.py
│   │   └── ports.py
│   │
│   ├── catalog/
│   │   ├── __init__.py
│   │   ├── routers.py             # /materials/* + /products/*
│   │   ├── services/
│   │   │   ├── product.py
│   │   │   └── matcher.py
│   │   ├── models.py              # Brand, Color, ProductType, MaterialSpec, Supplier, Item, IncomingSpec, ProductRequest (8 tablo)
│   │   ├── schemas.py
│   │   └── ports.py               # CatalogPort
│   │
│   └── stock/
│       ├── __init__.py
│       ├── routers.py             # /stock/*
│       ├── services.py            # StockCard CRUD, movement
│       ├── models.py              # StockCard, StockMovement (2 tablo)
│       ├── schemas.py
│       └── ports.py               # StockPort
│
└── tests/
    ├── conftest.py
    ├── identity/
    ├── orders/
    ├── orchestrator/
    ├── finance/
    ├── crm/
    ├── integrations/
    ├── catalog/
    └── stock/
```

---

## 9. Domain Arasi Iletisim (Port Desenleri)

### 9.1 Port Interface Tasarimi (In-Process)

Her domain `ports.py` dosyasinda soyut bir interface tanimlar. Diger domain'ler bu
interface'i kullanarak erisim saglar — dogrudan import yerine.

```python
# domains/orders/ports.py
from dataclasses import dataclass

@dataclass(frozen=True)
class OrderInfo:
    id: int
    customer_id: int
    status: str
    total_amount: float
    part_count: int

@dataclass(frozen=True)
class PartInfo:
    id: int
    order_id: int
    material: str
    width: float
    height: float
    quantity: int
    grain: str | None

class OrderPort:
    """Order domain'e dis erisim icin tek giris noktasi."""
    
    def get_order(self, order_id: int) -> OrderInfo:
        raise NotImplementedError
    
    def get_parts_for_order(self, order_id: int) -> list[PartInfo]:
        raise NotImplementedError
    
    def update_order_status(self, order_id: int, status: str) -> None:
        raise NotImplementedError
    
    def get_customer(self, customer_id: int) -> "CustomerInfo | None":
        raise NotImplementedError


# domains/orders/services.py — Port implementasyonu
class OrderPortImpl(OrderPort):
    def __init__(self, db: Session):
        self.db = db
    
    def get_order(self, order_id: int) -> OrderInfo:
        order = self.db.query(Order).get(order_id)
        if not order:
            raise NotFoundError("Order", order_id)
        return OrderInfo(
            id=order.id,
            customer_id=order.customer_id,
            status=order.status,
            total_amount=order.total_amount,
            part_count=len(order.parts),
        )
```

### 9.2 Port Kullanim Ornegi

```python
# domains/orchestrator/services/orchestrator.py
from domains.orders.ports import OrderPort

class OrchestratorService:
    def __init__(self, order_port: OrderPort, db: Session):
        self.order_port = order_port
        self.db = db

    def create_job(self, order_id: int, params: dict) -> OptiJob:
        # Order domain'den bilgi al — Port uzerinden, dogrudan DB degil
        order_info = self.order_port.get_order(order_id)
        parts = self.order_port.get_parts_for_order(order_id)
        
        # Kendi domain'inin DB'sine yaz
        job = OptiJob(
            order_id=order_info.id,
            state=OptiJobStateEnum.NEW,
            params=params,
        )
        self.db.add(job)
        self.db.commit()
        return job
```

### 9.3 Gercek Import Grafiginden Port Donusumu

Mevcut cross-domain import'lar ve donusecekleri port:

| Mevcut Import | Kim Kullaniyor | Donusecegi Port |
|---------------|----------------|-----------------|
| `from app.models.crm import CRMOpportunity` | `order_service.py` | `CRMPort.get_opportunity()` |
| `from app.models.finance import Invoice` | `order_service.py` | `FinancePort.get_invoice()` |
| `from app.models.integrations import OCRJob` | `order_service.py` | `IntegrationPort.get_ocr_job()` |
| `from app.models.order import OptiJob` | `order_service.py` | `OrchestratorPort.get_job()` |
| `from app.services.optimization import MergeService` | `order_service.py` | `OrchestratorPort.suggest_merge()` |
| `from app.models import CRMAccount` | `payment_service.py` | `CRMPort.get_account()` |
| `from app.models.crm import *` | `portal.py` | `CRMPort.*()` |
| `from app.models.finance import *` | `portal.py` | `FinancePort.*()` |
| `from app.services.order_service import OrderService` | `ocr_router.py` | `OrderPort.create_order()` |
| `from app.services.orchestrator_service import *` | `ocr_router.py` | `OrchestratorPort.*()` |
| `from app.models.crm import *` | `production_receipt_service.py` | `CRMPort.*()` |
| `from app.models.finance import *` | `production_receipt_service.py` | `FinancePort.*()` |
| `from .integration_settings_service import *` | `stock_card_service.py` | `IntegrationPort.get_settings()` |

**Toplam:** 13 cross-domain import → 13 Port metodu

### 9.4 Async Events (Gelecek Faz)

```python
# Domain event yayinlama (suan in-process, ileride message broker)
@dataclass
class DomainEvent:
    event_type: str
    payload: dict
    timestamp: datetime
    source_domain: str

# Ornek: Job tamamlandiginda Order durumu guncellenir
@event_handler("orchestrator.job.completed")
def on_job_completed(event: DomainEvent):
    order_port = get_order_port()
    order_port.update_order_status(
        event.payload["order_id"],
        "DELIVERED"
    )
```

### 9.5 Hedef Bagimlilik Matrisi

```
                 Identity  Orders  Orchestr  Finance  CRM  Integr  Catalog  Stock
Identity           -         -        -         -      -      -       -       -
Orders             R         -        -         -      -      -       -       -
Orchestrator       R         R        -         -      -      -       R       -
Finance            R         R        -         -      R*     -       -       -
CRM                R         R*       -         -      -      -       -       -
Integrations       R         R        R*        -      -      -       -       R*
Catalog            R         -        -         -      -      -       -       -
Stock              R         -        -         -      -      R*      R       -

R  = Port uzerinden readonly erisim (zorunlu)
R* = Opsiyonel / zayif bagimlilik (FK yerine event/port)
-  = Bagimlilik yok (dogrudan import YASAK)
```

**Bagimlilik Sayilari:**
- Identity: 0 dis bagimlilik (cekirdek — hic bir domain'e bagimli degil)
- Orchestrator: 3 (Identity, Orders, Catalog)
- Integration Gateway: 4 (Identity, Orders, Orchestrator, Stock)
- Orders, Finance, CRM, Catalog, Stock: 1-2

---

## 10. Test Kapsam Bosluk Analizi

### 10.1 Domain Bazinda Test Durumu

| Domain | Test Dosyasi | Test Fonk. | Kapsam | Hedef |
|--------|-------------|:----------:|:------:|:-----:|
| Orchestrator | `test_orchestrator_*.py` (2), `test_export_validator.py`, `test_grain_matcher.py` | **97** | IYI | 120 |
| Orders | `test_orders_crud.py` | **28** | ORTA | 50 |
| Permissions | `test_permissions*.py` (2) | **38** | IYI | 45 |
| Price Tracking | `test_price_tracking.py` | **14** | ORTA | 25 |
| Identity (Auth) | `test_auth_security.py`, `test_admin_users_router.py` | **13** | DUSUK | 35 |
| CRM | `test_crm_service.py` | **5** | DUSUK | 25 |
| Finance | `test_finance_service.py` | **5** | DUSUK | 30 |
| Portal | `test_portal.py` | **3** | DUSUK | 15 |
| **Integration/OCR** | **(yok)** | **0** | **SIFIR** | **40** |
| **WhatsApp** | **(yok)** | **0** | **SIFIR** | **15** |
| **Stock** | **(yok)** | **0** | **SIFIR** | **10** |
| **Catalog** | **(yok)** | **0** | **SIFIR** | **15** |
| Diger (compliance, system) | Cesitli | **60** | YETERLI | 60 |
| **TOPLAM** | **26 dosya** | **263** | | **485** |

### 10.2 Test Borcunun Boyutu

```
Mevcut test:  263 fonksiyon
Hedef test:   485 fonksiyon
Test borcu:   222 fonksiyon (%84.4 artis gerekli)

En acil bosluklar (satirla orantili):
  Integration/OCR:  7,127 satir kod — 0 test    ← EN KRITIK
  WhatsApp:         ~650 satir kod — 0 test
  Stock:            ~635 satir kod — 0 test
  Catalog:          ~1,744 satir kod — 0 test
  Finance:          2,732 satir kod — 5 test     ← 1 test / 546 satir
  CRM:              2,103 satir kod — 5 test     ← 1 test / 420 satir
```

### 10.3 Test Ekleme Oncelik Sirasi

| Oncelik | Domain | Neden | Hedef Artis |
|---------|--------|-------|:-----------:|
| P0 | Integration/OCR | En buyuk domain + sifir kapsam | +40 |
| P0 | Orders | Ana is akisi + cross-domain hotspot | +22 |
| P1 | Identity/Auth | Guvenlik kritik | +22 |
| P1 | Finance | Odeme/fatura is kurali | +25 |
| P1 | CRM | Musteri veri butunlugu | +20 |
| P2 | Catalog | Material matching dogrulugu | +15 |
| P2 | WhatsApp | Mesajlasma akisi | +15 |
| P2 | Stock | Stok tutarliligi | +10 |
| P2 | Portal | Multi-domain composite | +12 |

---

## 11. Goc (Migration) Plani — 6 Faz

### Genel Zaman Cizelgesi

```
Hafta 1        Hafta 2        Hafta 3        Hafta 4        Hafta 5        Hafta 6
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  FAZ 0   │  │  FAZ 1   │  │  FAZ 2   │  │  FAZ 3   │  │  FAZ 4   │  │  FAZ 5   │
│ Hazirlik │  │ Schema + │  │  Model   │  │ Service  │  │ Frontend │  │ Dogrula  │
│ + Shared │  │  Model   │  │ + Router │  │ + Port   │  │ Parcala  │  │ + Temiz  │
│ tasima   │  │  bolme   │  │  extract │  │ pattern  │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
    ↑              ↑              ↑              ↑              ↑              ↑
 Testler      Testler       Testler        Testler       FE build      Full
 baseline     gecmeli       gecmeli        gecmeli       lint=0        regresyon
```

### Faz 0: Hazirlik + Shared Ayirma (Hafta 1, 5 gun)

| # | Gorev | Efor | Risk |
|---|-------|:----:|:----:|
| F0.1 | `shared/` klasoru olustur | 0.5 gun | Dusuk |
| F0.2 | `exceptions.py`, `database.py`, `rate_limit.py`, `logging_config.py` → shared/ | 1 gun | Dusuk |
| F0.3 | `base_service.py`, `websocket_manager.py`, `text_normalize.py` → shared/ | 0.5 gun | Dusuk |
| F0.4 | `domains/` ust dizini + 8 domain icin bos `__init__.py` | 0.5 gun | Dusuk |
| F0.5 | `main.py`'de domain-based router import altyapisi hazirla | 1 gun | Orta |
| F0.6 | Tum mevcut testleri calistir → baseline al (263 test) | 0.5 gun | Dusuk |
| F0.7 | CI lint kurali: `no-cross-domain-import` (uyari modu) | 1 gun | Orta |

**Dogrulama:** 263 test gecmeli, 0 regresyon. `shared/` import'lari calismali.

### Faz 1: Schema + Model Bolme (Hafta 2, 5 gun)

| # | Gorev | Efor | Risk |
|---|-------|:----:|:----:|
| F1.1 | `schemas.py`'den 8 domain schema dosyasi cikar (90 sinif dagitimi) | 2 gun | Dusuk |
| F1.2 | Eski `schemas.py`'de re-export barrel birak | 0.5 gun | Dusuk |
| F1.3 | `order.py`'den OptiJob/AuditEvent → `domains/orchestrator/models.py` | 0.5 gun | Orta |
| F1.4 | `order.py`'den IncomingSpec/ProductRequest → `domains/catalog/models.py` | 0.5 gun | Orta |
| F1.5 | `integrations.py`'den StockCard/StockMovement → `domains/stock/models.py` | 0.5 gun | Orta |
| F1.6 | `integrations.py`'yi 4 alt-dosyaya bol (ocr, whatsapp, cloud, sync) | 1 gun | Orta |
| F1.7 | `models/__init__.py`'de import uyumluluk katmani | Otomatik | — |
| F1.8 | Alembic `autogenerate` ile diff kontrolu (0 degisiklik olmali) | Otomatik | YUKSEK |

**Dogrulama:** 263 test gecmeli. `alembic check` → temiz. Tablo degisikligi YOK.

### Faz 2: Router Is Mantigi Cikarma (Hafta 3, 5 gun)

| # | Gorev | Efor | Risk |
|---|-------|:----:|:----:|
| F2.1 | P0 router extraction: `_process_ocr_job` (842 sat) → service | 1.5 gun | Orta |
| F2.2 | P0 router extraction: `azure_ocr_upload` (570 sat) → service | 1 gun | Orta |
| F2.3 | P0 router extraction: `upload_image` (455 sat) → service | 1 gun | Orta |
| F2.4 | P0 router extraction: `login` (370 sat) → service | 0.5 gun | Dusuk |
| F2.5 | P0 test ekleme: OCR flow tests (en az 10 test) | 1 gun | Dusuk |

**Dogrulama:** Cikarilan fonksiyonlar service'de calisiyor. API davranisi degismemis.
En az 10 yeni test eklenmis.

### Faz 3: Service + Port Pattern (Hafta 4, 5 gun)

| # | Gorev | Efor | Risk |
|---|-------|:----:|:----:|
| F3.1 | 8 domain icin Port interface (`ports.py`) tanimla | 1 gun | Dusuk |
| F3.2 | Port implementasyonlarini yaz (PortImpl sinifi) | 1 gun | Orta |
| F3.3 | `order_service.py` cross-domain import'larini Port'a donustur (5 import) | 1 gun | YUKSEK |
| F3.4 | `payment_service.py` CRMAccount import'unu Port'a donustur | 0.5 gun | Orta |
| F3.5 | `portal.py` multi-domain import'larini Port'a donustur | 0.5 gun | Orta |
| F3.6 | Service dosyalarini ilgili domain klasorune tasi | 0.5 gun | Dusuk |
| F3.7 | Router dosyalarini ilgili domain klasorune tasi | 0.5 gun | Dusuk |

**Dogrulama:** 0 cross-domain dogrudan import. Tum testler gecmeli. Port lint kurali aktif.

### Faz 4: Frontend Parcalama (Hafta 5, 5 gun)

| # | Gorev | Efor | Risk |
|---|-------|:----:|:----:|
| F4.1 | `react-router-dom` kurulumu + route tanimlari | 1 gun | Orta |
| F4.2 | `types/index.ts` → domain-based tip dosyalari | 0.5 gun | Dusuk |
| F4.3 | OrchestratorPage.tsx → 7 parca | 1 gun | Orta |
| F4.4 | DeviceManagement.tsx → 7 parca | 1 gun | Orta |
| F4.5 | useAIOpsData.ts → domain-bazli hook'lar | 0.5 gun | Orta |
| F4.6 | Feature barrel re-export temizligi | 0.5 gun | Dusuk |
| F4.7 | Frontend build + lint dogrulamasi | 0.5 gun | — |

**Dogrulama:** `npm run build` → 0 hata. `npm run lint` → 0 hata. Tum sayfalar calisiyor.

### Faz 5: Dogrulama + Temizlik (Hafta 6, 5 gun)

| # | Gorev | Efor | Risk |
|---|-------|:----:|:----:|
| F5.1 | P1 router extraction (remaining 8 functions) | 2 gun | Orta |
| F5.2 | Test borcu kapatma: Integration +20, Finance +10, CRM +10 | 1.5 gun | Dusuk |
| F5.3 | Geriye uyumluluk barrel dosyalarini kaldir | 0.5 gun | Orta |
| F5.4 | Full regresyon: 263+ test + yeni eklemeler | 0.5 gun | — |
| F5.5 | Dokumantasyon guncellemesi (README, API_CONTRACT) | 0.5 gun | Dusuk |

**Dogrulama:** 350+ test gecmeli. 0 regresyon. 0 cross-domain import. Domain lint temiz.

---

## 12. Basari Kriterleri

| # | Kriter | Olcum Yontemi | Kabul Esigi |
|---|--------|---------------|-------------|
| K1 | Router'da DB erisimi yok | `grep -c 'db\.\(query\|add\|delete\|commit\)' routers/` | **0** |
| K2 | Router fonksiyonu max 30 satir | Script ile fonksiyon boyutu kontrolu | Max 30 satir |
| K3 | Cross-domain dogrudan import yok | Lint kurali `no-cross-domain-import` | **0 ihlal** |
| K4 | Her domain icin Port interface | `ls domains/*/ports.py` | **8 dosya** |
| K5 | Schema tek dosya bolunmus | `schemas.py` bos veya silinmis | 0 sinif |
| K6 | Model tek dosya bolunmus | `order.py` max 6 tablo, `integrations.py` max 7 tablo | Kontrol |
| K7 | Frontend monolith < 500 satir | En buyuk bilesen < 500 satir | Kontrol |
| K8 | Alembic migration fark yok | `alembic check` | Temiz |
| K9 | Tum mevcut testler gecmeye devam | Full test suite | **0 regresyon** |
| K10 | Test sayisi artmis | Test fonksiyon sayimi | **350+** (simdi: 263) |
| K11 | Frontend build temiz | `npm run build` | 0 hata |
| K12 | react-router calisiyor | URL'ler calisiyor, deep link destegi | Kontrol |

---

## 13. Risk Analizi

| # | Risk | Olasilik | Etki | Onlem | Telafi |
|---|------|:--------:|:----:|-------|--------|
| R1 | Circular import (Python) — domain'ler arasi | YUKSEK | Bloklayici | `TYPE_CHECKING` import + Port pattern | Barrel re-export geri yukle |
| R2 | Alembic migration kirilmasi | ORTA | Yuksek | Her faz sonunda `alembic check` | Geri al, barrel kaldir |
| R3 | `order_service` cross-domain ayirma sirasinda regresyon | YUKSEK | Yuksek | 5 import'u Port'a tek tek donustur, her birinde test | Geri al |
| R4 | `_process_ocr_job` cikarma sirasinda davranis degisikligi | ORTA | Orta | Fonksiyonu olduugu gibi tasi, sonra refactor et | Geri al |
| R5 | Frontend routing gecisi sirasinda mevcut page-state kirilmasi | ORTA | Orta | Paralel routing: eski + yeni birlikte calissin | Eski sisteme geri don |
| R6 | Schema bolme sirasinda import yolu kirilmasi | DUSUK | Orta | Barrel re-export ile uyumluluk katmani | — |
| R7 | Takim uyumu — yeni dizin yapisina alisma | DUSUK | Dusuk | Convention doc + PR review | — |
| R8 | Port overhead — performans kaybi | DUSUK | Dusuk | Port'lar in-process, DB sorgulari ayni | Bypass + optimize |
| R9 | Test borcu — 222 eksik test | YUKSEK | Orta | Her faz'a minimum test ekleme zorunlulugu | — |

### Risk Azaltma Stratejisi

**Rollback Plani:** Her faz sonu bir git tag'i olusturulur. Faz basarisiz olursa
onceki tag'e geri donulur. Barrel re-export dosyalari Faz 5'e kadar kaldirilmaz.

```
Rollback noktalari:
  v2-faz0-complete  → Shared ayrilmis, 263 test gecmeli
  v2-faz1-complete  → Schema + Model bolunmus, 263 test gecmeli
  v2-faz2-complete  → P0 router extraction, 273+ test gecmeli
  v2-faz3-complete  → Port pattern, 0 cross-import, 280+ test gecmeli
  v2-faz4-complete  → Frontend parcalanmis, build temiz
  v2-faz5-complete  → Final, 350+ test, tum kriterler karsilandi
```

---

## 14. Ozet Karar Tablosu

| Karar | Secim | Gerekce |
|-------|-------|---------|
| Mimari stil | Modular Monolith | Kucuk takim, tek DB, domain sinirlari olgunlastirilmali |
| Domain sayisi | 8 bounded context | Is mantigi ayirimi + takim kapasitesi |
| On-celik domain | Integration Gateway + Orchestrator | %49.5 backend, en yuksek coupling |
| Cross-domain iletisim | Port interface (in-process) | 13 cross-import → 13 Port metodu |
| Router refactoring | ~7,858 satir service'e cikarilacak | Top 20 fonksiyon oncelikli |
| Frontend routing | react-router-dom v6 | Deep link, code splitting, URL paylasimi |
| Frontend monolith | 9 dosya parcalanacak (>1000 satir) | Top 6 dosya = 17,866 satir |
| DB stratejisi | Tek PostgreSQL, tablo sahipligi domain bazli | Transaction kolayligi |
| Schema bolme | 90 sinif → 8 dosya | Merge conflict azaltma |
| Model bolme | 61 tablo → 8 dosya (max 10 tablo/dosya) | God Module cozumu |
| Test hedefi | 263 → 350+ (%33 artis) | Sifir kapsam domain'leri kapatma |
| Goc suresi | 6 faz, ~6 hafta | Her faz sonunda rollback noktasi |
| Otomasyon | Lint kurali: no-cross-import | Mimari bozulmayi onle |

---

## Ek A: Hizli Referans — Domain Sahiplik Tablosu

| Domain | Tablo Sayisi | Router | Service | En Buyuk Dosya |
|--------|:-----------:|:------:|:-------:|----------------|
| Identity | 6 | auth_router, auth_enhanced, admin_router (kismen) | token_service, base_service | admin_router (1,146) |
| Orders | 6 | orders_router, customers_router, stations_router | order_service | orders_router (1,045) |
| Orchestrator | 6 | orchestrator_router, biesse_router, optiplanning_router | orchestrator_service + 14 service | orchestrator_service (503) |
| Finance | 5 | payment_router, price_tracking_router | payment_service, price_tracking_service | price_tracking_service (610) |
| CRM | 10 | crm_router, portal | crm_service | crm_service (700) |
| Integration | 17 | ocr_router + 7 router | integration_service + 15 service | integration_service (702) |
| Catalog | 8 | materials_router, product_router | product_service, stock_matcher | product_service (367) |
| Stock | 2 | stock_cards_router | stock_card_service | stock_card_service (335) |

---

## Ek B: Hizli Referans — Frontend Bilesen Sahiplik

| Domain | Hedef Konum | En Buyuk Mevcut Dosya | Satir |
|--------|-------------|----------------------|------:|
| Identity | `domains/identity/components/` | — | — |
| Orders | `domains/orders/components/` | `components/Orders/*` (10 dosya) | 3,366 |
| Orchestrator | `domains/orchestrator/components/` | `features/Orchestrator/OrchestratorPage.tsx` | 2,724 |
| Finance | `domains/finance/components/` | — | — |
| CRM | `domains/crm/components/` | `components/CRM/CRMPage.tsx` | 2,967 |
| Integration | `domains/integrations/components/` | `features/Integrations/MikroConfigModal.tsx` | 2,040 |
| Admin (Identity) | `domains/identity/components/Admin/` | `components/Admin/DeviceManagement.tsx` | 3,449 |
| WhatsApp (Integ.) | `domains/integrations/components/WA/` | `components/WhatsApp/WhatsAppBusinessPage.tsx` | 3,413 |
| Stock | `domains/stock/components/` | `components/Stock/StockCardComponent.tsx` | 2,268 |
| Shared | `shared/components/` | `components/Shared/FormComponents.tsx` | 2,862 |

---

*Bu dokuman takim tartisilmasina aciktir. Onay sonrasi Faz 0'dan baslanacaktir.*
*v2 — Kantitatif analiz gercek kod taramasi ile desteklenmistir.*
