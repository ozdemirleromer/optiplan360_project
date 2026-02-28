# OptiPlan360 Runbook (Backend + Integrations)

Tarih: 2026-02-18
Kapsam: backend/*, integrations/*, config/*

---

## 1. Hızlı Kontrol (On-Call)

1. Backend saglik kontrolu:
   - `GET /health` cevabi: `overall=healthy`
   - `database=healthy` olmalı
2. DB baglantisi:
   - Production: PostgreSQL
   - Local/Test: SQLite (yalnizca gecici)
3. Mikro SQL read-only baglanti:
   - Admin panel test connection PASS
   - Read-only flag aktif

---

## 2. Servis Baslatma / Durdurma

### 2.1 Local / Dev

```powershell
cd C:\PROJE\optiplan360_project\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```

Varsayilan: `http://127.0.0.1:8080`

### 2.2 Production

- Uvicorn/Gunicorn ile servis baslatilir.
- Port ve worker sayisi ortama gore ayarlanir.
- Loglar OS servis sistemi veya process manager uzerinden toplanir.

---

## 3. DB Migration

- Alembic migration kullanilir.
- Ilk kurulumda tablolar otomatik olusur (`auto_migrate_on_startup: true`).
- Manuel uygulama gerekiyorsa:

```powershell
cd C:\PROJE\optiplan360_project\backend
alembic upgrade head
```

---

## 4. Mikro SQL Entegrasyonu (P1 Read-Only)

- Konfig dosyasi: `config/mikro_connection.json`
- Template: `config/sql_config.template.json`
- `read_only` veya `read_only_mode` **true** kalmalidir.
- SQL Server kullanicisi yalnizca **SELECT** yetkili olmalidir.
- Test sorgusu: `SELECT 1`

### 4.1 Runtime Read-Only Dogrulama

Beklenen: PUSH cagrilari write yapmadan `E_MIKRO_READ_ONLY` donmelidir.

Ornek dogrulama (PowerShell):

```powershell
$env:PYTHONPATH="backend"
@'
from app.services.mikro_sync_service import MikroSyncService

class FakeDB:
    def add(self, obj): pass
    def commit(self): pass

class FakeClient:
    read_only_mode = True

svc = MikroSyncService(FakeDB(), mikro_client=FakeClient())
print(svc.sync_account_to_mikro("ACC-001", {"company_name":"Test"}))
'@ | .\backend\.venv\Scripts\python.exe -
```

---

## 5. WhatsApp Entegrasyonu

- Konfig: `config/system_config.json` ve `config/whatsapp.json`
- Token ve secret degerleri repo icinde **bulunmamalidir**.
- Tercih: `VAULT:...` referanslari veya ortam degiskenleri.
- Webhook verify token uretim ortaminda farkli ve guclu olmali.

---

## 6. Yedekleme

- Konfig: `config/backup_config.json`
- `connection_string` degeri **placeholder** olmali,
  prod degeri vault/CI secret store uzerinden saglanmalidir.
- PostgreSQL yedekleri gunluk alinmali.

---

## 7. Incident Playbook

- **DB down:**
  1. /health ile DB durumu dogrula
  2. PostgreSQL servisini kontrol et
  3. DB tekrar ayaga kalkinca yeniden dene

- **Mikro SQL baglanti hatasi:**
  1. SQL Server erisilebilir mi?
  2. Read-only user yetkileri dogru mu?
  3. Admin panel test connection

- **WhatsApp mesaj gonderim hatasi:**
  1. Token gecerliligi ve expire kontrol
  2. Meta API status
  3. Template onay durumu

---

## 8. Operasyon Notu

- Mikro P1 fazinda **write-back yoktur**.
- Her entegrasyon degisikligi audit log ile izlenmelidir.
- Production DB: PostgreSQL; SQLite sadece local/test icindir.

---

## 9. Integration Diagnostics Checklist

1. Otomatik diagnostics:
   - `GET /api/v1/integration/diagnostics` => `status` alanini PASS/WARN/FAIL olarak kontrol et
   - `python scripts/run_integration_diagnostics.py --fail-on warn` ile CI/ops dogrulamasi yap
2. Backend health:
   - `GET /health` => `status=healthy`
3. Mikro health:
   - `GET /api/v1/mikro/health` basarili donmeli
4. Read-only garanti:
   - PUSH denemesi => `E_MIKRO_READ_ONLY`
5. SQL Board varsayimlari:
   - SQL user role: SELECT-only
   - `ApplicationIntent=ReadOnly` aktif
6. DB ayrimi:
   - Prod: PostgreSQL
   - Local/test: SQLite
7. Config guvenligi:
   - Secret degerler repo icinde plain-text olmamali
   - Vault/env referansi kullanilmali
