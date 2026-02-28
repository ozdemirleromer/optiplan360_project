# OptiPlan360 — Birleşik API Sözleşmesi

Bu belge projedeki tüm API endpoint'lerini tek merkezde tanımlar.

---

## 0. Ana Backend (FastAPI) API — Port 8080

> **Base URL:** `http://127.0.0.1:8080/api/v1`
> **Framework:** FastAPI + SQLAlchemy
> **Auth:** JWT Bearer token

### 0.1 Endpoint Listesi

| Metod | Yol | Açıklama |
|-------|-----|----------|
| POST | `/auth/login` | Kullanıcı girişi |
| GET | `/auth/me` | Aktif kullanıcı bilgisi |
| GET | `/orders` | Sipariş listesi (filtre destekli) |
| POST | `/orders` | Yeni sipariş oluştur |
| GET | `/orders/{id}` | Sipariş detayı |
| PUT | `/orders/{id}` | Sipariş güncelle |
| DELETE | `/orders/{id}` | Sipariş sil |
| POST | `/orders/{id}/parts` | Parça listesi güncelle |
| GET | `/stations` | İstasyon listesi |
| POST | `/stations` | İstasyon oluştur |
| PUT | `/stations/{id}` | İstasyon güncelle |
| DELETE | `/stations/{id}` | İstasyon sil |
| GET | `/admin/users` | Kullanıcı listesi |
| POST | `/admin/users` | Kullanıcı oluştur |
| PUT | `/admin/users/{id}` | Kullanıcı güncelle |
| GET | `/admin/logs` | Audit logları |
| GET | `/admin/stats` | Sistem istatistikleri |
| GET | `/whatsapp/config` | WhatsApp ayarları |
| PUT | `/whatsapp/config` | WhatsApp ayarları güncelle |
| GET | `/ocr/config` | OCR ayarları |
| PUT | `/ocr/config` | OCR ayarları güncelle |

### 0.2 Veri Modelleri

```typescript
interface Order {
  id: number;
  customer_id: number;
  ts_code: string;
  status: OrderStatus;
  thickness_mm: number;
  plate_w_mm: number;
  plate_h_mm: number;
  color: string;
  material_name: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: 'admin' | 'operator' | 'station' | 'viewer';
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}
```

### 0.3 Hata Formatı

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "details": [] } }
```

### 0.4 Ortam Değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL bağlantı string'i |
| `SECRET_KEY` | JWT imzalama anahtarı |
| `CORS_ORIGINS` | İzin verilen frontend origin'leri |
| `VITE_API_BASE_URL` | Frontend → Backend API URL |

---

## 1. Orchestrator API — Port 8090

> **Base URL:** `http://127.0.0.1:8090`
> **Format:** JSON — `Content-Type: application/json`
> **Limit:** Request body maks. 5 MB

---

## 1. Genel Yanıt Yapısı

### Başarılı yanıt

```json
{ "success": true, ...payload }
```

### Hata yanıtı

```json
{ "error": { "code": "E_XXX", "message": "Açıklama" } }
```

---

## 2. Endpoint Listesi

| Metod | Yol | Açıklama |
|-------|-----|----------|
| GET | `/health` | Sağlık kontrolü |
| GET | `/customers/lookup?phone=...` | Müşteri CRM araması |
| POST | `/jobs` | Yeni iş oluştur |
| GET | `/jobs` | İş listesi |
| GET | `/jobs/:id` | İş detayı + audit trail |
| POST | `/jobs/:id/retry` | Başarısız işi yeniden kuyruğa al |
| POST | `/jobs/:id/approve` | HOLD durumundaki işi onayla |
| POST | `/orders/:orderId/import/xlsx` | Sipariş için XLSX import işi oluştur |

---

## 3. Endpoint Detayları

### 3.1 GET /health

Yanıt `200 OK`:

```json
{
  "status": "ok",
  "service": "orchestrator",
  "timestamp": "2026-02-17T10:30:00.000Z"
}
```

---

### 3.2 GET /customers/lookup

**Query parametreleri:**

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `phone` | string | Evet | Telefon numarası (ham veya normalize) |

Yanıt `200 OK`:

```json
{
  "success": true,
  "phone_normalized": "+905551234567",
  "customer": {
    "id": "uuid",
    "name": "Ahmet Yılmaz",
    "phone_normalized": "+905551234567",
    "created_at": "2026-01-15T08:00:00.000Z"
  }
}
```

Hata `400`:

```json
{ "error": { "code": "E_PHONE_REQUIRED", "message": "phone query zorunlu" } }
```

---

### 3.3 POST /jobs

**Request body** — Zod ile valide edilir:

```typescript
// createJobSchema
{
  order_id: string,                          // Zorunlu
  customer_phone: string,                    // Zorunlu
  customer_snapshot_name?: string,           // Opsiyonel
  opti_mode?: "A" | "B" | "C",              // Varsayılan: rules.optiModeDefault
  plate_size?: {
    width_mm: number,   // > 0
    height_mm: number   // > 0
  },
  parts: Part[]                              // min 1 eleman
}
```

**Part şeması:**

```typescript
// partSchema
{
  id: string,
  part_type: "GOVDE" | "ARKALIK",
  material_code: string,
  length_cm: number,        // > 0
  width_cm: number,         // > 0
  quantity: number,          // int > 0
  grain: 0 | 1 | 2 | 3,
  color: string,
  thickness_mm: number,     // > 0
  edge_up?: string | null,
  edge_lo?: string | null,
  edge_sx?: string | null,
  edge_dx?: string | null,
  iidesc?: string,
  desc1?: string,
  delik_kodu?: string | null
}
```

Yanıt `201 Created`:

```json
{
  "job": {
    "id": "uuid",
    "order_id": "ORD-001",
    "state": "NEW",
    "opti_mode": "C",
    "retry_count": 0,
    "created_at": "2026-02-17T10:30:00.000Z",
    "updated_at": "2026-02-17T10:30:00.000Z"
  }
}
```

> **Dedup:** Aynı payload hash tekrar gönderilirse mevcut job döner (insert yerine).

Hata `422` — Validasyon:

```json
{ "error": { "code": "E_VALIDATION", "message": "parts.0.quantity: Expected number" } }
```

---

### 3.4 GET /jobs

**Query parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|-----------|-----|------------|----------|
| `limit` | number | 100 | Maks. kayıt sayısı |

Yanıt `200 OK`:

```json
{
  "jobs": [
    {
      "id": "uuid",
      "order_id": "ORD-001",
      "state": "DONE",
      "error_code": null,
      "retry_count": 0,
      "opti_mode": "C",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### 3.5 GET /jobs/:id

Yanıt `200 OK`:

```json
{
  "job": { ... },
  "audit": [
    {
      "id": 1,
      "job_id": "uuid",
      "event_type": "JOB_CREATED",
      "message": "Job olusturuldu",
      "details_json": "{\"mode\":\"C\"}",
      "created_at": "2026-02-17T10:30:00.000Z"
    }
  ]
}
```

Hata `404`:

```json
{ "error": { "code": "E_JOB_NOT_FOUND", "message": "Job bulunamadi" } }
```

---

### 3.6 POST /jobs/:id/retry

Yanıt `200 OK`:

```json
{ "success": true, "retry_count": 2 }
```

Retry backoff süresi `rules.json → retry_backoff_minutes` dizisinden alınır: `[1, 3, 9]` dakika.
Maksimum retry sayısı: `retry_count_max` (varsayılan 3).

Hata `400` — permanent error veya limit aşıldığında:

```json
{ "error": { "code": "E_RETRY_LIMIT_REACHED", "message": "E_RETRY_LIMIT_REACHED" } }
```

---

### 3.7 POST /jobs/:id/approve

HOLD durumundaki işi onaylar ve state'i `NEW` yapar. Mode C işlerinde `manual_trigger_approved = 1` set edilir.

Yanıt `200 OK`:

```json
{ "success": true, "job": { ...updatedJob } }
```

Hata `400`:

```json
{ "error": { "code": "E_JOB_NOT_IN_HOLD", "message": "E_JOB_NOT_IN_HOLD" } }
```

---

### 3.8 POST /orders/:orderId/import/xlsx

`POST /jobs` ile aynı body yapısı; `order_id` URL'den alınır.

---

## 4. Hata Kodları

### 4.1 Kalıcı Hatalar (permanent — retry anlamsız)

| Kod | Açıklama |
|-----|----------|
| `E_TEMPLATE_INVALID` | Excel_sablon.xlsx bulunamadı veya ŞABLON sayfası / 12 tag sütunu uyumsuz |
| `E_CRM_NO_MATCH` | Telefon numarasına ait müşteri CRM'de bulunamadı |
| `E_PLATE_SIZE_MISSING` | Levha boyutu ne payload'da ne de defaultPlateSize'da tanımlı |
| `E_XML_INVALID` | OptiPlanning çıktı XML'i ayrıştırılamadı |

### 4.2 HOLD Hataları (operatör müdahalesi gerekir)

| Kod | Açıklama |
|-----|----------|
| `E_OPERATOR_TRIGGER_REQUIRED` | Mode C: Operatör OptiPlanning'i el ile tetiklemeli |
| `E_BACKING_THICKNESS_UNKNOWN` | Arkalık kalınlığı `backingThicknesses` listesinde tanımlı değil |
| `E_TRIM_RULE_MISSING` | Kalınlık için `trimByThickness` kuralı eksik |

### 4.3 Geçici Hatalar (retry yapılabilir)

| Kod | Açıklama |
|-----|----------|
| `E_OPTI_XML_TIMEOUT` | OptiPlanning XML çıktısı beklenen sürede gelmedi |
| `E_OSI_ACK_TIMEOUT` | OSI makinesi ACK vermedi (dosya processed'e taşınmadı) |
| `E_OSI_ACK_FAILED` | OSI makinesi dosyayı failed klasörüne taşıdı |
| `E_RETRY_LIMIT_REACHED` | Maks. retry sayısına ulaşıldı |

### 4.4 Yapılandırma / Çalıştırma Hataları

| Kod | Açıklama |
|-----|----------|
| `E_OPTI_MODE_A_RUNNER_MISSING` | Mode A: OptiPlanning.exe yolu bulunamadı |
| `E_OPTI_MODE_B_MACRO_MISSING` | Mode B: RunOptiPlanning.xls macro dosyası bulunamadı |
| `E_OPTI_RUNNER_FAILED` | OptiPlanning.exe sıfır olmayan çıkış koduyla sonlandı |
| `E_EDGE_MAPPING_UNKNOWN` | Kenar bant değeri `edgeMapping`'de tanımlı değil |
| `E_INVALID_GRAIN` | Doku değeri `grainMapping`'de tanımlı değil |

### 4.5 API Hataları

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `E_PHONE_REQUIRED` | 400 | `phone` query parametresi boş |
| `E_JOB_NOT_FOUND` | 404 | Job ID veritabanında yok |
| `E_JOB_NOT_IN_HOLD` | 400 | Approve çağrısında job HOLD durumunda değil |
| `E_VALIDATION` | 422 | Zod şema validasyonu başarısız |
| `E_UNKNOWN` | 400 | Beklenmeyen hata |

---

## 5. Zod Validasyon Şemaları

Tüm giriş validasyonu `zod@3.24` ile yapılır. Şemalar `src/api/server.ts` dosyasında tanımlıdır.

- `partSchema`: 16 alan — `id`, `part_type`, `material_code`, `length_cm`, `width_cm`, `quantity`, `grain`, `color`, `thickness_mm`, `edge_up/lo/sx/dx`, `iidesc`, `desc1`, `delik_kodu`
- `createJobSchema`: `order_id`, `customer_phone`, `customer_snapshot_name?`, `opti_mode?`, `plate_size?`, `parts[]`

Validasyon hatası durumunda her issue birleştirilir: `path.join("."): message` formatında.

---

## 6. Şablon Sütun Eşleştirmesi (ŞABLON Sayfası)

Excel_sablon.xlsx → ŞABLON sayfasında 12 kilitli tag sütunu:

| Sıra | Tag | Açıklama |
|------|-----|----------|
| 1 | `[P_CODE_MAT]` | Malzeme kodu |
| 2 | `[P_LENGTH]` | Uzunluk (mm) |
| 3 | `[P_WIDTH]` | Genişlik (mm) |
| 4 | `[P_MINQ]` | Adet |
| 5 | `[P_GRAIN]` | Doku yönü (0–3) |
| 6 | `[P_IDESC]` | İç açıklama (trim bilgisi dahil) |
| 7 | `[P_EDGE_MAT_UP]` | Üst kenar bant (mm) |
| 8 | `[P_EGDE_MAT_LO]` | Alt kenar bant (mm) |
| 9 | `[P_EDGE_MAT_SX]` | Sol kenar bant (mm) |
| 10 | `[P_EDGE_MAT_DX]` | Sağ kenar bant (mm) |
| 11 | `[P_IIDESC]` | Parça iç açıklaması |
| 12 | `[P_DESC1]` | Ek açıklama |

## 2.1 Canonical API Notu (2026-02-17)

Bu projede orchestrator cekirdek endpoint standardi `/jobs` ailesidir.
`/orders/:orderId/import/xlsx` endpointi, uyumluluk/facade amacli bir giris noktasi olup
isleyis olarak `POST /jobs` payload modeliyle ayni semantigi izler.
