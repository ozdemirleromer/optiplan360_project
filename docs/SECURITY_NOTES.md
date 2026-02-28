# OptiPlan360 Orchestrator — Güvenlik Notları

> Bu belge, orchestrator servisinin güvenlik yüzeyini, risklerini ve alınan önlemleri tanımlar.
> **Hedef kitle:** DevOps, güvenlik denetçileri, sistem yöneticileri.

---

## 1. Mimari Güvenlik Özeti

Orchestrator şu anda **iç ağ (intranet)** ortamında çalışmak üzere tasarlanmıştır. İnternete doğrudan açık bir servis değildir. Bununla birlikte aşağıdaki güvenlik katmanları uygulanmaktadır.

---

## 2. Kimlik Doğrulama ve Yetkilendirme

### 2.1 Mevcut Durum

Orchestrator API'si şu anda **kimlik doğrulama (authentication) gerektirmez**. Bu, iç ağ dışına erişim sağlanmadığı varsayımına dayanır.

### 2.2 JWT Entegrasyon Planı

Ana OptiPlan360 backend'i JWT tabanlı kimlik doğrulama kullanır. Orchestrator için entegrasyon planı:

- **Token doğrulama:** Ana backend'den alınan JWT token'ı middleware ile doğrulanabilir
- **sub claim:** JWT `sub` alanı her zaman `str(user.id)` olmalıdır (string)
- **Rol kontrolü:** Orchestrator işlemleri için minimum `OPERATOR` rolü önerilir
- **Approve/Retry:** Bu işlemler minimum `OPERATOR` seviyesi gerektirir

### 2.3 Önerilen Middleware Yapısı

```typescript
// Gelecek entegrasyon için önerilen yapı
app.use("/jobs", verifyJwt);           // Tüm job endpoint'leri
app.use("/orders", verifyJwt);         // Import endpoint'leri
// /health ve /customers/lookup açık kalabilir
```

### 2.4 Admin UI Güvenliği

Admin UI şu anda doğrudan API'ye bağlanır. JWT entegrasyonu yapılırsa:
- Login ekranı eklenmeli
- Token localStorage'da saklanmalı (httpOnly cookie tercih edilebilir)
- API isteklerinde `Authorization: Bearer <token>` header'ı gönderilmeli

---

## 2.5 Konfig ve Secret Yonetimi

- Gercek sifre/token bilgileri config dosyalarina yazilmaz.
- Tercih: `VAULT:...` referansi veya ortam degiskeni.
- `config/system_config.json` icindeki `*_ref` alanlari sadece referans tutmalidir.
- `config/backup_config.json` icindeki `connection_string` yalnizca placeholder olmali,
  prod degerleri vault veya CI secret store uzerinden saglanmalidir.
- `config/whatsapp.json` icindeki `access_token` ve `webhook_verify_token`
  gercek deger olarak repo icinde bulunmamalidir.
- Mikro SQL konfiginde `read_only_mode` varsayilani `true` olmalidir.
- `MIKRO_READ_ONLY_MODE` env override degeri acikca tanimlanmadikca write acilmamalidir.
- Secret taramasi release oncesi zorunludur (token/sifre/plain-text desen kontrolu).

---

## 3. Giriş Validasyonu (Input Validation)

### 3.1 Zod Şema Validasyonu

Tüm API girdileri `zod@3.24` ile valide edilir. Bu, injection saldırılarına karşı birinci savunma hattıdır.

**Valide edilen alanlar:**

| Alan | Kısıtlama |
|------|-----------|
| `order_id` | string (boş olamaz) |
| `customer_phone` | string (boş olamaz) |
| `opti_mode` | literal `"A"` \| `"B"` \| `"C"` |
| `parts[].length_cm` | number, pozitif |
| `parts[].width_cm` | number, pozitif |
| `parts[].quantity` | integer, pozitif |
| `parts[].grain` | literal 0 \| 1 \| 2 \| 3 |
| `parts[].part_type` | literal `"GOVDE"` \| `"ARKALIK"` |
| `plate_size.width_mm` | number, pozitif |
| `plate_size.height_mm` | number, pozitif |

### 3.2 Request boyut sınırı

```typescript
app.use(express.json({ limit: "5mb" }));
```

5 MB üzerindeki payload'lar reddedilir (413 Payload Too Large).

### 3.3 SQL Injection koruması

SQLite sorguları **parametrize edilmiştir** (prepared statements):

```typescript
// DOĞRU — parametrize sorgu
this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);

// YANLIŞ — string interpolasyon (kullanılmıyor)
this.db.prepare(`SELECT * FROM jobs WHERE id = '${jobId}'`);
```

---

## 4. Dosya Sistemi Güvenliği

### 4.1 Şablon dosyası

- `Excel_sablon.xlsx` salt okunur olmalıdır
- Orchestrator servisi bu dosyayı yalnızca okur, değiştirmez
- Dosya izinleri: servis hesabı için `Read`, diğerleri için `Deny`

### 4.2 Geçici dosyalar

XLSX çıktı dosyaları `tempFolder` dizinine yazılır, ardından import klasörüne taşınır:

```
C:/OptiPlanning/temp/  → geçici yazma
C:/OptiPlanning/import/ → OptiPlanning okuma
```

**Öneri:** temp klasörünü periyodik olarak temizleyin (24 saat üzeri dosyalar).

### 4.3 Atomik dosya yazma

`copyFileAtomic()` fonksiyonu dosyaları önce `.tmp` uzantısıyla yazar, ardından `rename` ile hedef isme taşır. Bu, yarım kalan dosyaların işlenmesini önler.

---

## 5. UNC Yol Güvenliği

### 5.1 Makine drop klasörü

```json
"machineDropFolder": "\\\\MACHINE-SHARE\\opti-drop"
```

XML dosyaları bu UNC yolundaki `inbox/` klasörüne bırakılır.

### 5.2 Güvenlik kontrol listesi

| Kontrol | Açıklama |
|---------|----------|
| Paylaşım erişimi | Yalnızca orchestrator servis hesabı + makine hesabı |
| Yazma izni | Orchestrator: inbox'a yazma. Makine: inbox'tan okuma, processed/failed'e yazma |
| SMB imzalama | SMB signing aktif olmalı (MITM koruması) |
| Firewall | UNC erişim yalnızca ilgili IP'lerden |
| Antivirüs | XML dosyaları taranmalı (ExcludePath eklemeyin) |

### 5.3 ACK mekanizması

`ackMode: "file_move"` — makine XML'i işledikten sonra:
- Başarılı: `inbox/file.xml` → `processed/file.xml`
- Başarısız: `inbox/file.xml` → `failed/file.xml`

Orchestrator bu dosya hareketini izler ve duruma göre `DELIVERED` veya `E_OSI_ACK_FAILED` atar.

---

## 6. Veritabanı Güvenliği

### 6.1 SQLite dosya erişimi

- Veritabanı dosyası: `apps/orchestrator/orchestrator.db`
- WAL modu aktif — eşzamanlı okuma/yazma destekler
- Dosya izni: yalnızca orchestrator servis hesabı (NTFS ACL)

### 6.2 Hassas veri

| Tablo | Hassas alan | Koruma |
|-------|-------------|--------|
| `jobs` | `payload_json` | Müşteri telefon numarası, sipariş detayları |
| `customers` | `phone_normalized`, `name` | Kişisel bilgi (KVKK kapsamında) |
| `audit_events` | `details_json` | İşlem detayları |

**Öneri:** Üretimde SQLite dosyasını şifrelenmiş disk bölümünde (BitLocker) saklayın.

### 6.3 Payload hash

Her iş payload'ı SHA-256 ile hash'lenir ve `UNIQUE` kısıtla saklanır. Bu:
- Dedup sağlar (aynı sipariş iki kez gönderilmez)
- Payload bütünlük kontrolü için kullanılabilir

### 6.4 Mikro P1 Read-Only ve DB Ayrimi

- Production veri katmani: PostgreSQL.
- Local/Test ve edge senaryolari: SQLite (sadece gecici).
- Mikro SQL entegrasyonu P1 fazinda **read-only** calisir.
- SQL Server kullanicisi yalnizca SELECT yetkili olmali; write-back yoktur.
- Baglanti katmani `ApplicationIntent=ReadOnly` kullanir; kod seviyesinde read-only davranisi zorlanir.
- `backend/app/integrations/mikro_sql_client.py` icinde tum write metotlari
  (`create_*`, `update_*`, `delete_*`) read-only modda `PermissionError` ile bloklanir.
- `backend/app/services/mikro_sync_service.py` PUSH akislarinda read-only mod aktifse
  islem durdurulur, `E_MIKRO_READ_ONLY` kodu doner ve `IntegrationError` kaydi atilir.

---

## 7. Audit Trail

Tüm durum geçişleri `audit_events` tablosuna kaydedilir:

```sql
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);
```

Audit kaydı **silme veya güncelleme yapılmaz** — yalnızca INSERT. Bu, değişmezlik (immutability) sağlar.

**Kaydedilen olaylar:**
- `JOB_CREATED` — iş oluşturuldu (mode bilgisi dahil)
- `STATE_*` — her durum geçişi
- `JOB_DEDUP` — aynı payload hash tespit edildi
- `JOB_RETRY_SCHEDULED` — retry planlandı (retry_count, backoff bilgisi)
- `HOLD_APPROVED` — operatör onayı (mode_c_approved bilgisi)

---

## 8. Süreç Güvenliği

### 8.1 Sinyal yönetimi

```typescript
process.on("SIGINT", () => { runner.stop(); process.exit(0); });
process.on("SIGTERM", () => { runner.stop(); process.exit(0); });
```

Servis düzgün kapatılır; aktif job claim'leri temizlenir.

### 8.2 OptiPlanning çalıştırma

Mode A'da `spawnSync` ile çalıştırılır:

```typescript
spawnSync(exePath, importFiles, {
  shell: true,
  windowsHide: true,
  timeout: 60_000,    // 60 saniye timeout
  stdio: "ignore",    // stdout/stderr yakalanmaz
});
```

- `windowsHide: true` — pencere açılmaz
- `timeout` — sonsuz döngü koruması
- Çıkış kodu kontrol edilir (≠ 0 → `E_OPTI_RUNNER_FAILED`)

---

## 9. Güvenlik Önerileri (Yol Haritası)

| Öncelik | Öneri | Durum |
|---------|-------|-------|
| Yüksek | JWT middleware ekle | Planlandı |
| Yüksek | HTTPS (TLS) aktifleştir | Planlandı |
| Orta | Rate limiting ekle (express-rate-limit) | Planlandı |
| Orta | CORS kısıtlaması (yalnızca admin-ui origin) | Planlandı |
| Orta | Helmet.js middleware (güvenlik header'ları) | Planlandı |
| Düşük | SQLite veritabanı şifreleme (sqlcipher) | Değerlendirilecek |
| Düşük | Audit loglarını harici SIEM'e gönder | Değerlendirilecek |
