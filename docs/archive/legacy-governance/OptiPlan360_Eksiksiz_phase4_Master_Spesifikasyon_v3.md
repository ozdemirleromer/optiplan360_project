# OptiPlan 360 – Eksiksiz Master Uygulama Spesifikasyonu v3
## Tek Dosyalık Nihai Ürün / Mimari / UI-UX / Teknik Sözleşme / Handoff / Test Paketi

> Bu dosya, konuşma boyunca kesinleşen OptiPlan 360 kararlarını tek belgede toplar.  
> Amaç, kapsam kaymasını engellemek, fazların sınırlarını korumak, ekip/AI tarafından doğaçlama yapılmasını minimuma indirmek ve uygulamayı tek referans set ile başlatmaktır.

---

# 1. Belgenin amacı

Bu belge aşağıdaki başlıkları tek yerde kapatır:

- ürün konumu ve sistem sınırı
- Phase 1 / 2 / 3 / 4 rol ve kapsamları
- bağlayıcı iş kuralları
- UI/UX kararları
- canonical enum / state / audit / hata modeli
- API ve DTO sözleşmeleri
- interaction matrix
- fazlar arası handoff sözleşmeleri
- acceptance criteria / test senaryoları
- geliştirme sıralaması ve teslim planı

Bu belge, mevcut durumda OptiPlan 360 için **master implementation pack** olarak kullanılmalıdır.

---

# 2. Ürün konumu

## 2.1. Sistem tanımı
OptiPlan 360 bağımsız ERP değildir.

Bu sistem:
- Mikro Vr15
- Optiplanning

arasında çalışan:
- operasyonel köprü
- workflow katmanı
- veri hazırlama, doğrulama ve çıktı üretim sistemi

olarak konumlanır.

## 2.2. Temel ilke
- Ticari kuralların sahibi Mikro Vr15’tir
- Cari, stok, sipariş ve ERP otoritesi Mikro’dadır
- OptiPlan 360 ERP’yi yeniden yazmaz
- Operasyonel hazırlık, doğrulama, eşleştirme ve çıktı üretimi yapar
- Faz geçişleri kontrollü ve izlenebilir olmak zorundadır

## 2.3. Kapsam sınırı
Bu sistemin bağlayıcı fazları:
- **Phase 1:** OCR Havuzu
- **Phase 2:** OCR Kontrol
- **Phase 3:** Sipariş Kontrol & ERP Eşleştirme
- **Phase 4:** OptiPlanning / Export / Manifest / Retry / Fire Kapanış Yüzeyi

---

# 3. Teknoloji yığını

## 3.1. Backend
- Python
- FastAPI
- SQLAlchemy Async
- PostgreSQL

## 3.2. OCR / Görsel İşleme
- OpenCV
- Google Gemini API

## 3.3. Frontend
- React
- Next.js (App Router)
- Tailwind CSS
- Lucide React ikonları

## 3.4. Mimari ilkeler
- hardcoded klasör yolu yasak
- hardcoded müşteri/evrak tipi kuralı yasak
- faz geçişleri operatör aksiyonuna bağlı
- audit zorunlu
- graceful fallback zorunlu
- UI ve backend aynı blocker mantığını uygular
- desktop-first dense ERP dili korunur

---

# 4. Canonical enum ve state sözleşmesi

## 4.1. Global record status enum
Aşağıdaki liste canonical kabul edilir:

- `RECEIVED`
- `DUPLICATE`
- `PROCESSING`
- `OCR_PROCESSING`
- `PHASE2_PENDING`
- `OCR_RETRY_PENDING`
- `FAULTY`
- `MANUAL_REVIEW_REQUIRED`
- `PHASE2_IN_PROGRESS`
- `PHASE3_PENDING`
- `PHASE3_IN_PROGRESS`
- `PHASE4_PENDING`
- `PHASE4_PREVIEW_READY`
- `PHASE4_EXPORT_RUNNING`
- `PHASE4_EXPORT_FAILED`
- `PHASE4_RETRY_PENDING`
- `COMPLETED`

## 4.2. Approval status enum
Phase 2 hücre onay durumu için:

- `UNREVIEWED`
- `LOW_CONFIDENCE`
- `APPROVED_AS_IS`
- `OVERRIDDEN`
- `READ_ONLY`

## 4.3. Match status enum
Phase 3 için:
- `UNMATCHED`
- `MATCHED`
- `MANUAL_MATCHED`
- `BLOCKED`

## 4.4. Folder health status enum
- `HEALTHY`
- `WARNING`
- `OFFLINE`
- `ERROR`

## 4.5. Audit event type enum
- `FILE_DETECTED`
- `DUPLICATE_DETECTED`
- `FILE_LOCKED`
- `FILE_MOVED_TO_PROCESSING`
- `PREPROCESS_STARTED`
- `PREPROCESS_COMPLETED`
- `OCR_REQUEST_STARTED`
- `OCR_REQUEST_COMPLETED`
- `OCR_PARSE_FAILED`
- `OCR_RETRY_SCHEDULED`
- `STATUS_CHANGED`
- `CELL_APPROVED`
- `CELL_OVERRIDDEN`
- `FAULTY_MARKED`
- `PHASE3_MOVE_ATTEMPTED`
- `PHASE3_MOVE_SUCCEEDED`
- `PHASE3_MOVE_REJECTED`
- `ERP_CUSTOMER_MATCHED`
- `ERP_STOCK_MATCHED`
- `ROWS_MERGED`
- `SCRAP_NOTE_ADDED`
- `PHASE4_PREVIEW_CREATED`
- `PHASE4_EXPORT_STARTED`
- `PHASE4_EXPORT_SUCCEEDED`
- `PHASE4_EXPORT_FAILED`
- `MANIFEST_CREATED`
- `RETRY_DECISION_TAKEN`

## 4.6. Error severity enum
- `INFO`
- `WARNING`
- `RETRYABLE`
- `FATAL`

## 4.7. Frontend page state enum
### Phase 1
- `LOADING`
- `EMPTY`
- `READY`
- `FILTERED_EMPTY`
- `DETAIL_OPEN`
- `ERROR_DRAWER_OPEN`

### Phase 2
- `LOADING`
- `EMPTY`
- `READY`
- `IMAGE_ERROR`
- `SAVE_ERROR`
- `FAULTY_MODAL_OPEN`

### Phase 3
- `LOADING`
- `READY`
- `BLOCKED`
- `DRAWER_OPEN`
- `MODAL_OPEN`

### Phase 4
- `LOADING`
- `EMPTY`
- `READY`
- `PREVIEW_READY`
- `EXPORT_RUNNING`
- `ERROR_QUEUE_OPEN`
- `MANIFEST_DRAWER_OPEN`
- `RETRY_DECISION_OPEN`

---

# 5. Ortak veri ve audit modeli

## 5.1. Audit object
```json
{
  "event_id": "evt_001",
  "event_type": "CELL_APPROVED",
  "record_id": "rec_010",
  "row_index": 0,
  "field_name": "BOY",
  "old_value": "2798",
  "new_value": "2800",
  "actor_id": "user_01",
  "actor_type": "human",
  "created_at": "2026-03-18T12:10:00Z",
  "note": "Approved after review"
}
```

## 5.2. Audit zorunlu alanları
- `event_type`
- `record_id`
- `actor_id`
- `created_at`

Opsiyonel:
- `row_index`
- `field_name`
- `old_value`
- `new_value`
- `note`

## 5.3. Error response canonical format
```json
{
  "ok": false,
  "error_code": "PHASE2_BLOCKER_ACTIVE",
  "message": "Unapproved low confidence fields exist",
  "severity": "WARNING",
  "details": {}
}
```

## 5.4. Örnek error code listesi
- `FOLDER_OFFLINE`
- `FILE_MOVE_FAILED`
- `DUPLICATE_CONFLICT`
- `OCR_TIMEOUT`
- `OCR_PARSE_FAILED`
- `DB_WRITE_FAILED`
- `PHASE2_BLOCKER_ACTIVE`
- `PHASE3_BLOCKER_ACTIVE`
- `PHASE4_EXPORT_BLOCKED`
- `MANIFEST_CREATION_FAILED`
- `CONCURRENT_UPDATE_DETECTED`

---

# 6. Phase 1 – OCR Havuzu

## 6.1. Amaç
Sisteme gelen belgeleri güvenli biçimde almak, OCR pipeline’ından geçirmek ve Phase 2’ye hazır hale getirmek.

## 6.2. Kapsam
- klasör izleme
- dosya alımı
- duplicate kontrolü
- lifecycle takibi
- preprocessing
- OCR çağrısı
- parse / normalize
- retry / hata yönetimi
- Phase 2’ye hazır kayıt üretimi

## 6.3. Kapsam dışı
- manuel veri düzeltme
- operatör hücre onayı
- cari/stok eşleştirme
- sipariş düzenleme
- export üretimi

## 6.4. Kaynak klasör modeli
Mantıksal tipler:
- `whatsapp_raw`
- `scanner_raw`
- `manuel_raw`
- `email_raw`

Fiziksel path DB/config’den okunur.

## 6.5. Ana akış
1. Dosya algılanır
2. Ön kayıt açılır
3. Duplicate kontrolü yapılır
4. İşleme kilidi oluşturulur
5. Processing alanına alınır
6. OpenCV preprocessing uygulanır
7. Gemini OCR çağrısı yapılır
8. OCR parse / normalize edilir
9. DB’ye yazılır
10. Status `PHASE2_PENDING` olur

## 6.6. Duplicate kuralı
Duplicate yalnız dosya adına göre yapılmaz.

Değerlendirilecek sinyaller:
- `file_name`
- `file_size`
- `checksum`
- `source_type`
- `prior_records`

Duplicate ise:
- akışa girmez
- status `DUPLICATE`
- audit üretilir
- normal Phase 2 akışına geçmez

## 6.7. Retry kuralı
Retry’a girebilecek örnek durumlar:
- timeout
- OCR servis hatası
- parse hatası
- kritik payload eksikliği

Retry ise:
- status `OCR_RETRY_PENDING`
- `retry_count` artar
- `next_retry_at` set edilir
- `last_error_message` set edilir

## 6.8. Fallback kuralı
- bbox yoksa kayıt saklanır
- confidence yoksa alan manual review olarak işaretlenir
- parse kısmi başarısızsa fatal değilse retryable işlenebilir

---

# 7. Phase 1 API + DTO sözleşmesi

## 7.1. GET /api/phase1/queue
### Query params
- `search?: string`
- `status?: string`
- `source_type?: string`
- `folder_type?: string`
- `duplicate?: boolean`
- `retry_only?: boolean`
- `phase2_ready?: boolean`
- `manual_review_only?: boolean`
- `date_from?: ISO8601`
- `date_to?: ISO8601`
- `page?: int`
- `page_size?: int`
- `sort_by?: created_at|updated_at|next_retry_at`
- `sort_dir?: asc|desc`

### Response
```json
{
  "items": [
    {
      "record_id": "rec_001",
      "uuid": "4c8c4f7a-9d08-4f5c-9f20-11d71a0f9001",
      "file_name": "belge_001.jpg",
      "source_type": "scanner",
      "folder_type": "scanner_raw",
      "status": "PHASE2_PENDING",
      "duplicate_flag": false,
      "duplicate_reason": null,
      "retry_count": 0,
      "last_error_message": null,
      "created_at": "2026-03-18T10:00:00Z",
      "updated_at": "2026-03-18T10:02:00Z",
      "next_retry_at": null,
      "phase2_ready": true
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

## 7.2. GET /api/phase1/queue/{record_id}
```json
{
  "record": {
    "record_id": "rec_001",
    "uuid": "4c8c4f7a-9d08-4f5c-9f20-11d71a0f9001",
    "file_name": "belge_001.jpg",
    "source_type": "scanner",
    "folder_type": "scanner_raw",
    "status": "PHASE2_PENDING",
    "duplicate_flag": false,
    "duplicate_reason": null,
    "retry_count": 0,
    "last_error_message": null,
    "last_attempt_at": "2026-03-18T10:01:30Z",
    "next_retry_at": null,
    "created_at": "2026-03-18T10:00:00Z",
    "updated_at": "2026-03-18T10:02:00Z",
    "phase2_ready": true
  },
  "folder_health": {
    "folder_type": "scanner_raw",
    "is_active": true,
    "health_status": "HEALTHY",
    "last_scan_at": "2026-03-18T10:02:00Z",
    "last_file_at": "2026-03-18T10:00:00Z"
  },
  "lifecycle": [
    {
      "from_status": null,
      "to_status": "RECEIVED",
      "triggered_at": "2026-03-18T10:00:00Z",
      "triggered_by": "system",
      "note": "File detected"
    }
  ]
}
```

## 7.3. GET /api/phase1/folder-health
```json
{
  "items": [
    {
      "folder_type": "scanner_raw",
      "is_active": true,
      "health_status": "HEALTHY",
      "last_scan_at": "2026-03-18T10:02:00Z",
      "last_file_at": "2026-03-18T10:00:00Z",
      "record_count": 12
    }
  ]
}
```

## 7.4. GET /api/phase1/errors
```json
{
  "items": [
    {
      "record_id": "rec_002",
      "file_name": "belge_002.jpg",
      "status": "OCR_RETRY_PENDING",
      "error_severity": "RETRYABLE",
      "error_type": "OCR_TIMEOUT",
      "last_error_message": "Gemini timeout",
      "retry_count": 2,
      "last_attempt_at": "2026-03-18T10:10:00Z",
      "next_retry_at": "2026-03-18T10:20:00Z"
    }
  ]
}
```

## 7.5. GET /api/phase1/status-summary
```json
{
  "total_count": 120,
  "duplicate_count": 5,
  "retry_count": 7,
  "error_count": 3,
  "phase2_ready_count": 80,
  "manual_review_count": 4,
  "active_folder_count": 4
}
```

## 7.6. POST /api/phase1/manual-retry
### Request
```json
{
  "record_id": "rec_002"
}
```

### Response
```json
{
  "ok": true,
  "record_id": "rec_002",
  "status": "OCR_RETRY_PENDING",
  "message": "Retry scheduled"
}
```

## 7.7. POST /api/phase1/manual-rescan
### Request
```json
{
  "folder_type": "scanner_raw"
}
```

### Response
```json
{
  "ok": true,
  "folder_type": "scanner_raw",
  "message": "Manual scan started"
}
```

## 7.8. Phase 1 DTO listesi
- `Phase1QueueRecordDto`
- `Phase1QueueDetailDto`
- `Phase1FolderHealthDto`
- `Phase1ErrorRecordDto`
- `Phase1StatusSummaryDto`
- `Phase1ManualRetryRequestDto`
- `Phase1ManualRetryResponseDto`

---

# 8. Phase 1 UI/UX sözleşmesi

## 8.1. Ana ekran parçaları
- header
- summary cards
- filter panel
- main queue table
- detail drawer
- error records view
- folder health view
- empty state

## 8.2. Summary cards
Asgari:
- Toplam Kayıt
- Duplicate Kayıt
- Retry Bekleyen
- OCR Hatası
- Phase 2 Bekliyor
- Aktif Klasör
- Manuel Müdahale Gerekli

## 8.3. Filtreler
- arama
- durum
- kaynak tipi
- klasör tipi
- duplicate
- retry gereken
- tarih aralığı
- Phase 2 bekliyor
- manuel müdahale gerekli

## 8.4. Queue tablosu
Kolonlar:
- Kayıt UUID
- Dosya Adı
- Kaynak Tipi
- Kaynak Klasör
- Durum
- Duplicate
- Retry Sayısı
- Son Hata
- Oluşturulma Zamanı
- Son Güncelleme
- Sonraki Retry
- Phase 2 Durumu

## 8.5. Kayıt detail drawer
İçerik:
- metadata
- lifecycle geçmişi
- duplicate sinyalleri
- retry geçmişi
- son hata
- OCR işlem özeti
- Phase 2’ye hazır mı

---

# 9. Phase 2 – OCR Kontrol

## 9.1. Amaç
OCR çıktısını belge ile yan yana gösterip operatöre kritik alan onayı yaptırmak.

## 9.2. Kapsam
- split-screen kontrol alanı
- görsel ile veri eşleme
- düşük confidence hücre onayı
- hatalı görsel ayrıştırma
- kontrollü Phase 3 geçişi

## 9.3. Ana doğrulama alanları
Kritik doğrulama alanları:
- `BOY`
- `EN`
- `ADET`
- `U1`
- `U2`
- `K1`
- `K2`

Bu 7 alanın tamamı blocker ve operatör onay mantığına tabidir.

## 9.4. Blocker kuralı
Eğer BOY, EN, ADET, U1, U2, K1 veya K2 alanlarından herhangi biri:
- `confidence_score < 80`
- ve operatör onayından geçmemişse

kayıt Phase 3’e gidemez.

## 9.5. Onay kuralı
Şüpheli hücre:
- override edilerek
- veya as-is onaylanarak

temizlenebilir.

## 9.6. Hatalı Görsel
Tetiklenirse:
- kayıt `FAULTY`
- not alınabilir
- WhatsApp taslak modalı açılır

---

# 10. Phase 2 API + DTO sözleşmesi

## 10.1. GET /api/phase2/queue
```json
{
  "items": [
    {
      "record_id": "rec_010",
      "status": "PHASE2_PENDING",
      "source_type": "scanner",
      "created_at": "2026-03-18T10:00:00Z",
      "blocker_count": 2
    }
  ]
}
```

## 10.2. GET /api/phase2/records/{record_id}
```json
{
  "record": {
    "record_id": "rec_010",
    "status": "PHASE2_PENDING",
    "source_type": "scanner",
    "image_url": "/files/rec_010/original.jpg",
    "created_at": "2026-03-18T10:00:00Z",
    "blocker_count": 2
  },
  "rows": [
    {
      "row_index": 0,
      "fields": [
        {
          "field_name": "BOY",
          "raw_value": "2798",
          "normalized_value": "2800",
          "confidence_score": 65,
          "bbox": { "x": 100, "y": 120, "w": 80, "h": 20 },
          "approval_status": "LOW_CONFIDENCE",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "EN",
          "raw_value": "600",
          "normalized_value": "600",
          "confidence_score": 96,
          "bbox": { "x": 200, "y": 120, "w": 60, "h": 20 },
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "ADET",
          "raw_value": "4",
          "normalized_value": "4",
          "confidence_score": 99,
          "bbox": null,
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "U1",
          "raw_value": "1",
          "normalized_value": "1",
          "confidence_score": 92,
          "bbox": null,
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "U2",
          "raw_value": "1",
          "normalized_value": "1",
          "confidence_score": 88,
          "bbox": null,
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "K1",
          "raw_value": "1",
          "normalized_value": "1",
          "confidence_score": 90,
          "bbox": null,
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "K2",
          "raw_value": "0",
          "normalized_value": "0",
          "confidence_score": 71,
          "bbox": null,
          "approval_status": "LOW_CONFIDENCE",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        }
      ]
    }
  ]
}
```

## 10.3. PATCH /api/phase2/records/{record_id}/cells/approve
### Request
```json
{
  "row_index": 0,
  "field_name": "BOY",
  "mode": "APPROVE_AS_IS"
}
```

### Response
```json
{
  "ok": true,
  "row_index": 0,
  "field_name": "BOY",
  "approval_status": "APPROVED_AS_IS",
  "blocker_count": 1
}
```

## 10.4. PATCH /api/phase2/records/{record_id}/cells/override
### Request
```json
{
  "row_index": 0,
  "field_name": "BOY",
  "override_value": "2800"
}
```

### Response
```json
{
  "ok": true,
  "row_index": 0,
  "field_name": "BOY",
  "approval_status": "OVERRIDDEN",
  "normalized_value": "2800",
  "blocker_count": 1
}
```

## 10.5. POST /api/phase2/records/{record_id}/mark-faulty
```json
{
  "note": "Belge okunamayacak kadar bozuk"
}
```

### Response
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "FAULTY",
  "message": "Record marked as faulty"
}
```

## 10.6. POST /api/phase2/records/{record_id}/move-phase3
### Success
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "PHASE3_PENDING"
}
```

### Reject
```json
{
  "ok": false,
  "error_code": "PHASE2_BLOCKER_ACTIVE",
  "message": "Unapproved low confidence fields exist"
}
```

---

# 11. Phase 2 interaction matrix

| Trigger | Precondition | UI Davranışı | Backend Call | Sonuç |
|---|---|---|---|---|
| Hücre tek tık | kayıt açık | hücre seçilir, focus border görünür | yok | selected cell güncellenir |
| Hücre tek tık + bbox var | selected cell | sol panel bbox’a zoom yapar | yok | sarı highlight görünür |
| Hücre tek tık + bbox yok | selected cell | zoom yapılmaz | yok | UI bozulmaz |
| Hücre çift tık | editable field | edit mode açılır | yok | input aktif olur |
| Tab | editable cell | sağ hücreye gider | yok | focus sağa ilerler |
| Shift+Tab | editable cell | sola gider | yok | focus sola ilerler |
| ArrowDown | grid ready | alt hücreye iner | yok | focus değişir |
| Enter, edit mode yok, low confidence | field blocker | approve aksiyonu tetiklenir | approve endpoint | field approved olur |
| Enter, edit mode açık | input aktif | değeri kaydeder ve alta iner | override endpoint gerekiyorsa | hücre override veya approve olur |
| F2 | low confidence veya selected | approve-as-is | approve endpoint | warning kalkar |
| Override save | valid input | hücre normalleşir | override endpoint | blocker count yeniden hesaplanır |
| Hatalı Görsel | record open | modal açılır | yok | modal state active |
| Hatalı Görsel onay | note verildi / opsiyonel | record kapanır | mark-faulty endpoint | queue’den çıkar |
| Phase 3’e Aktar | blocker_count = 0 | loading state | move-phase3 endpoint | başarıysa Phase 3’e geçer |
| Phase 3’e Aktar | blocker_count > 0 | CTA disabled | yok | geçiş olmaz |

### Canonical davranış kararları
- Enter low-confidence selected hücrede approve-as-is davranır
- F2 explicit approve tuşudur
- Override sonrası focus aynı satırdaki bir sonraki blocker alana geçer; yoksa alt satıra iner
- CTA blocker count 0 olduğunda anında aktifleşir
- bbox eksikliği blocker değildir

---

# 12. Phase 2 UI/UX sözleşmesi

## 12.1. Ana layout
- header
- split-screen main area
- footer/action bar

## 12.2. Split-screen
### Sol panel
- belge/görsel önizleme
- zoom
- pan
- bbox highlight
- selected cell odaklama

### Sağ panel
- dense OCR grid
- BOY / EN / ADET / U1 / U2 / K1 / K2 odaklı doğrulama
- hücresel warning / approval state

### Orta ayraç
- resizer
- varsayılan yaklaşık 50/50

## 12.3. Header
- ekran adı: `OCR Kontrol`
- kısa açıklama
- kuyruk bilgisi
- Yenile
- Hatalı Görsel
- Phase 3’e Aktar

## 12.4. Footer
- blocker mesajı
- onay bekleyen hücre sayısı
- seçili kayıt bilgisi
- ana CTA

## 12.5. Empty state
Boş ekran şunları anlatmalıdır:
- burada hangi kayıtların görüneceği
- hangi alanların doğrulandığı
- confidence mantığı
- kayıt gelince split-screen çalışma alanının açılacağı

---

# 13. Phase 1 → Phase 2 handoff sözleşmesi

## 13.1. Giriş koşulu
Bir kayıt yalnızca şu durumda Phase 2’ye düşer:
- OCR parse tamamlanmış
- normalize veri DB’ye yazılmış
- status `PHASE2_PENDING`

## 13.2. Zorunlu alanlar
- `record_id`
- `status`
- `image_url` veya image reference
- `rows[]`
- her row içinde `BOY`, `EN`, `ADET`, `U1`, `U2`, `K1`, `K2`
- `confidence_score` alanı mümkünse
- `bbox` mümkünse (toggle alanlar için opsiyonel)

## 13.3. Handoff payload örneği
```json
{
  "record_id": "rec_010",
  "status": "PHASE2_PENDING",
  "image_url": "/files/rec_010/original.jpg",
  "rows": [
    {
      "row_index": 0,
      "fields": [
        {
          "field_name": "BOY",
          "normalized_value": "2800",
          "confidence_score": 65,
          "bbox": { "x": 100, "y": 120, "w": 80, "h": 20 }
        },
        {
          "field_name": "EN",
          "normalized_value": "600",
          "confidence_score": 96,
          "bbox": { "x": 200, "y": 120, "w": 60, "h": 20 }
        },
        {
          "field_name": "ADET",
          "normalized_value": "4",
          "confidence_score": 99,
          "bbox": null
        },
        {
          "field_name": "U1",
          "normalized_value": "1",
          "confidence_score": 92,
          "bbox": null
        },
        {
          "field_name": "U2",
          "normalized_value": "1",
          "confidence_score": 88,
          "bbox": null
        },
        {
          "field_name": "K1",
          "normalized_value": "1",
          "confidence_score": 90,
          "bbox": null
        },
        {
          "field_name": "K2",
          "normalized_value": "0",
          "confidence_score": 71,
          "bbox": null
        }
      ]
    }
  ]
}
```

---

# 14. Phase 3 – Sipariş Kontrol & ERP Eşleştirme

## 14.1. Amaç
Phase 3 sistemin ana operasyon merkezidir.

## 14.2. Bağlayıcı kurallar
- Cari eşleşmesi hard blocker’dır
- Herhangi bir satırda stok eşleşmesi yoksa hard blocker’dır
- Çoklu plaka desteklenir
- Satır birleştirme desteklenir
- Fire açıklaması desteklenir
- Phase 4’e geçiş blocker temizlenmeden yapılamaz

## 14.3. Ana ekran parçaları
- header
- cari eşleşmesi kartı
- üst aksiyon toolbar’ı
- sipariş özet bandı
- plaka grup alanı
- dense ana grid
- stok arama drawer
- cari arama modalı
- fire açıklaması modalı / drawer
- satır detay drawer
- validation summary box
- footer

## 14.4. Phase 3 veri modeli
### OrderHeaderDto
- `record_id`
- `customer_match_status`
- `customer_code`
- `customer_name`
- `source_type`
- `operator_name`
- `updated_at`

### OrderLineDto
- `row_index`
- `plate_id`
- `material_text`
- `stock_match_status`
- `stock_code`
- `boy`
- `en`
- `adet`
- `yon`
- `aciklama`
- `bant_ust`
- `bant_alt`
- `bant_sol`
- `bant_sag`
- `ilave_aciklama`
- `aciklama1`
- `merge_candidate`
- `scrap_note_required`
- `status`

### PlateGroupDto
- `plate_id`
- `label`
- `line_count`
- `blocker_count`
- `active`

---

# 15. Phase 3 API + DTO sözleşmesi

## 15.1. GET /api/phase3/records/{record_id}
```json
{
  "header": {
    "record_id": "rec_010",
    "customer_match_status": "MATCHED",
    "customer_code": "CARI-001",
    "customer_name": "Özdemirler Orman Ürünleri",
    "source_type": "scanner",
    "operator_name": "Operatör 1",
    "updated_at": "2026-03-18T12:00:00Z"
  },
  "plate_groups": [
    {
      "plate_id": "p1",
      "label": "MDF-18",
      "line_count": 2,
      "blocker_count": 1,
      "active": true
    }
  ],
  "lines": [
    {
      "row_index": 0,
      "plate_id": "p1",
      "material_text": "MDF-18MM",
      "stock_match_status": "UNMATCHED",
      "stock_code": null,
      "boy": "2800",
      "en": "600",
      "adet": 4,
      "yon": "D",
      "aciklama": "Kapak",
      "bant_ust": "1.00 PVC",
      "bant_alt": "1.00 PVC",
      "bant_sol": "1.00 PVC",
      "bant_sag": "1.00 PVC",
      "ilave_aciklama": "",
      "aciklama1": "",
      "merge_candidate": false,
      "scrap_note_required": false,
      "status": "BLOCKED"
    }
  ],
  "summary": {
    "customer_blocker": false,
    "stock_blocker_count": 1,
    "merge_pending_count": 0,
    "scrap_note_missing_count": 0,
    "phase4_ready": false
  }
}
```

## 15.2. POST /api/phase3/customer-match
```json
{
  "record_id": "rec_010",
  "customer_code": "CARI-001"
}
```

## 15.3. POST /api/phase3/stock-match
```json
{
  "record_id": "rec_010",
  "row_index": 0,
  "stock_code": "STK-001"
}
```

## 15.4. POST /api/phase3/merge-rows
```json
{
  "record_id": "rec_010",
  "row_indexes": [2, 3]
}
```

## 15.5. POST /api/phase3/scrap-note
```json
{
  "record_id": "rec_010",
  "row_index": 4,
  "note": "Fire nedeni: damar yönü nedeniyle kesim dışı"
}
```

## 15.6. POST /api/phase3/move-phase4
### Success
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "PHASE4_PENDING"
}
```

### Reject
```json
{
  "ok": false,
  "error_code": "PHASE3_BLOCKER_ACTIVE",
  "message": "Customer or stock blockers remain"
}
```

---

# 16. Phase 3 interaction ve blocker matrix

## 16.1. Cari eşleşmesi
- eşleşme yoksa header danger state
- footer CTA disabled
- backend move-phase4 reject eder

## 16.2. Stok eşleşmesi
- eşleşmeyen satır material cell danger state
- satır status blocked
- footer CTA disabled

## 16.3. Çoklu plaka
- plaka grupları ayrı görünür
- blocker sayıları plaka bazlı hesaplanır
- aktif plaka filtrelenebilir

## 16.4. Satır birleştirme
- merge candidate satırlar işaretlenir
- kullanıcı merge aksiyonu başlatır
- merge öncesi özet gösterilir
- onay sonrası audit kaydı oluşur

## 16.5. Fire açıklaması
- scrap_note_required satırlar warning taşır
- not girilmeden move-phase4 reddedilir

---

# 17. Phase 2 → Phase 3 handoff sözleşmesi

## 17.1. Giriş koşulu
Kayıt yalnızca şu durumda Phase 3’e gider:
- BOY, EN, ADET, U1, U2, K1, K2 alanlarının tamamında aktif blocker yok
- record `FAULTY` değil
- operatör onayları kayıtlı

## 17.2. Zorunlu alanlar
- `record_id`
- `status = PHASE3_PENDING`
- Phase 2 approval trail
- normalize edilmiş final değerler
- override edilen alanlar
- audit summary

## 17.3. Handoff payload örneği
```json
{
  "record_id": "rec_010",
  "status": "PHASE3_PENDING",
  "rows": [
    {
      "row_index": 0,
      "fields": [
        {
          "field_name": "BOY",
          "final_value": "2800",
          "approval_status": "OVERRIDDEN"
        },
        {
          "field_name": "EN",
          "final_value": "600",
          "approval_status": "UNREVIEWED"
        },
        {
          "field_name": "ADET",
          "final_value": "4",
          "approval_status": "UNREVIEWED"
        },
        {
          "field_name": "U1",
          "final_value": "1",
          "approval_status": "UNREVIEWED"
        },
        {
          "field_name": "U2",
          "final_value": "1",
          "approval_status": "UNREVIEWED"
        },
        {
          "field_name": "K1",
          "final_value": "1",
          "approval_status": "UNREVIEWED"
        },
        {
          "field_name": "K2",
          "final_value": "0",
          "approval_status": "APPROVED_AS_IS"
        }
      ]
    }
  ],
  "audit_summary": {
    "approved_cell_count": 1,
    "overridden_cell_count": 1
  }
}
```

---

# 18. Phase 4 – OptiPlanning / Export / Manifest / Retry / Fire Kapanış Yüzeyi

## 18.1. Amaç
Phase 4, preview, manifest, export, retry kararı, fire takibi ve çıktı klasörü kapanışının yapıldığı bağımsız operasyon yüzeyidir.

## 18.2. Bağlayıcı kurallar
- yalnız Phase 3’ten temiz gelen kayıtlar export-ready olur
- export readiness backend’de tekrar doğrulanır
- manifest izi zorunludur
- retry kararı ayrı operasyon akışıdır
- fire takip eksikse export engellenebilir
- çıktı klasörü yazımı izlenebilir olmalıdır
- export mapping bağlayıcıdır ve kullanıcı tarafından değiştirilemez

## 18.3. Mapping sözleşmesi
Aşağıdaki mapping kilitli kabul edilir:
- Malzeme → `[P_CODE_MAT]`
- BOY → `[P_LENGTH]`
- EN → `[P_WIDTH]`
- ADET → `[P_MINQ]`
- GRAIN → `[P_GRAIN]`
- BİLGİ → `[P_IDESC]`
- U1 → `[P_EDGE_MAT_UP]`
- U2 → `[P_EGDE_MAT_LO]`
- K1 → `[P_EDGE_MAT_SX]`
- K2 → `[P_EDGE_MAT_DX]`
- DELİK-1 → `[P_IIDESC]`
- DELİK-2 → `[P_DESC1]`

UI bu mapping’in:
- görünür
- readonly
- locked

olduğunu göstermelidir.

## 18.4. Phase 4 ana ekran parçaları
- header
- summary cards
- queue tablosu
- export detail drawer
- manifest detail drawer
- retry decision panel
- fire takip paneli
- klasör sağlık / çıktı hedef paneli
- mapping summary drawer

## 18.5. Summary cards
Asgari:
- Phase-4 Hazır
- Preview Hazır
- Export Başarılı
- Export Hatalı
- Retry Bekleyen
- Manifest Oluşturulan
- Fire Takip Gereken
- Manuel Karar Bekleyen

## 18.6. Queue tablosu
Kolonlar:
- Belge / Kayıt ID
- Cari / Sipariş
- Faz
- Export Tipi
- Manifest ID
- Dosya Adı
- Durum
- Retry
- Son Hata
- Fire
- Operatör
- Son Güncelleme

---

# 19. Phase 4 API + DTO sözleşmesi

## 19.1. GET /api/phase4/queue
```json
{
  "items": [
    {
      "record_id": "rec_010",
      "status": "PHASE4_PENDING",
      "customer_code": "CARI-001",
      "document_name": "siparis_001",
      "export_type": "XLSX",
      "manifest_id": null,
      "retry_count": 0,
      "last_error_message": null,
      "fire_required": false,
      "updated_at": "2026-03-18T12:30:00Z"
    }
  ]
}
```

## 19.2. GET /api/phase4/records/{record_id}
```json
{
  "record": {
    "record_id": "rec_010",
    "status": "PHASE4_PENDING",
    "customer_code": "CARI-001",
    "export_type": "XLSX",
    "output_file_name": null,
    "preview_ready": false,
    "manifest_id": null,
    "retry_count": 0,
    "last_error_message": null,
    "fire_required": false,
    "phase4_ready": true
  },
  "mapping_summary": {
    "locked": true,
    "profile_name": "Optiplanning Default Mapping"
  },
  "folder_health": {
    "output_folder_status": "HEALTHY",
    "preview_folder_status": "HEALTHY",
    "manifest_archive_status": "HEALTHY",
    "last_write_at": null
  }
}
```

## 19.3. GET /api/phase4/manifests
```json
{
  "items": [
    {
      "manifest_id": "man_001",
      "record_id": "rec_010",
      "export_type": "XLSX",
      "file_name": "manifest_001.json",
      "created_at": "2026-03-18T12:40:00Z",
      "status": "CREATED"
    }
  ]
}
```

## 19.4. POST /api/phase4/preview
```json
{
  "record_id": "rec_010"
}
```

### Response
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "PHASE4_PREVIEW_READY"
}
```

## 19.5. POST /api/phase4/export
```json
{
  "record_id": "rec_010"
}
```

### Success
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "COMPLETED",
  "manifest_id": "man_001",
  "output_file_name": "siparis_001.xlsx"
}
```

### Reject
```json
{
  "ok": false,
  "error_code": "PHASE4_EXPORT_BLOCKED",
  "message": "Record is not export-ready"
}
```

## 19.6. POST /api/phase4/retry
```json
{
  "record_id": "rec_010",
  "decision": "RETRY_NOW"
}
```

## 19.7. GET /api/phase4/folder-health
```json
{
  "items": [
    {
      "folder_type": "phase4_output",
      "health_status": "HEALTHY",
      "last_write_at": "2026-03-18T12:45:00Z"
    }
  ]
}
```

---

# 20. Phase 4 blocker matrix

Export engellenir, eğer:
- customer match tamam değilse
- stock match tamam değilse
- merge pending varsa
- scrap note required olup not eksikse
- export target invalid ise
- mapping required field missing ise
- manifest creation failed ise

Retry panelinde karar gerekir, eğer:
- export hata ile kapanmışsa
- output klasörüne yazılamamışsa
- manifest oluşturulamamışsa

---

# 21. Phase 3 → Phase 4 handoff sözleşmesi

## 21.1. Giriş koşulu
- cari eşleşmiş
- tüm stoklar eşleşmiş
- merge gereksinimleri tamamlanmış
- scrap açıklamaları tamamlanmış

## 21.2. Handoff payload örneği
```json
{
  "record_id": "rec_010",
  "status": "PHASE4_PENDING",
  "customer_code": "CARI-001",
  "lines": [
    {
      "row_index": 0,
      "stock_code": "STK-001",
      "boy": "2800",
      "en": "600",
      "adet": 4,
      "yon": "D",
      "aciklama": "Kapak",
      "bant_ust": "1.00 PVC",
      "bant_alt": "1.00 PVC",
      "bant_sol": "1.00 PVC",
      "bant_sag": "1.00 PVC",
      "ilave_aciklama": "",
      "aciklama1": ""
    }
  ],
  "audit_summary": {
    "customer_matched_by": "user_01",
    "stock_match_count": 1,
    "merged_row_count": 0,
    "scrap_note_count": 0
  }
}
```

---

# 22. Ortak UI/UX tokenları

## 22.1. Genel tokenlar
- `app-bg`: `bg-slate-900`
- `panel-bg`: `bg-slate-800`
- `border-default`: `border-slate-700`
- `text-primary`: `text-slate-200`
- `text-secondary`: `text-slate-400`

## 22.2. State tokenları
- success text: `text-emerald-400`
- success icon: `text-emerald-500`
- success bg: `bg-emerald-900/30`

- warning text: `text-amber-300`
- warning bg: `bg-amber-900/30`

- danger text: `text-red-400`
- danger icon: `text-red-500`
- danger bg: `bg-red-900/40`

## 22.3. Ölçü tokenları
- header height: `56px`
- footer height: `52px`
- dense row height: `32px`
- table cell padding x: `12px`
- table cell padding y: `4px`
- badge radius: `4px`
- focus border width: `1px`
- split panel min width: `420px`
- resizer width: `6px`

## 22.4. Font scale
- page title: `16px / 700`
- section subtitle: `12px / 500`
- dense table header: `11px / 600`
- dense table body: `13px / 400`
- helper text: `12px / 400`

## 22.5. Tasarım karakteri
Olmalı:
- keskin çizgiler
- kompakt spacing
- yüksek veri yoğunluğu
- düz operasyonel görünüm
- klavye dostu kullanım

Olmamalı:
- büyük radius
- kalın shadow
- modern SaaS kart dili
- fazla whitespace
- dekoratif animasyon

---

# 23. Acceptance criteria / test senaryoları

## 23.1. Phase 1
### Senaryo 1 – duplicate kayıt
- Given aynı checksum ile ikinci dosya gelir
- When Phase 1 duplicate kontrolü yapar
- Then kayıt `DUPLICATE` olur
- And Phase 2 akışına girmez

### Senaryo 2 – retry planlama
- Given OCR timeout olur
- When sistem retryable error algılar
- Then status `OCR_RETRY_PENDING` olur
- And `next_retry_at` dolar

### Senaryo 3 – folder offline
- Given klasör erişilemez
- When watcher tarama yapar
- Then folder health `OFFLINE` olur
- And UI warning gösterir

## 23.2. Phase 2
### Senaryo 4 – low confidence kritik alan
- Given BOY, EN, ADET, U1, U2, K1 veya K2 alanlarından herhangi birinde confidence 80'in altı gelir
- When kayıt açılır
- Then ilgili hücre warning state alır
- And CTA disabled olur

### Senaryo 5 – approve as is
- Given low confidence BOY seçilidir
- When kullanıcı F2 basar
- Then hücre `APPROVED_AS_IS` olur
- And blocker count azalır

### Senaryo 6 – override
- Given BOY değeri yanlıştır
- When kullanıcı 2798 yerine 2800 yazar
- Then hücre `OVERRIDDEN` olur
- And final value 2800 saklanır

### Senaryo 7 – bbox missing
- Given ADET alanında bbox yoktur
- When kullanıcı ADET hücresini seçer
- Then UI bozulmaz
- And zoom-sync çalışmaz
- And field yine edit/approve edilebilir

### Senaryo 8 – faulty image
- Given belge okunamayacak kadar bozuktur
- When kullanıcı Hatalı Görsel akışını onaylar
- Then kayıt `FAULTY` olur
- And queue’den çıkar

## 23.3. Phase 3
### Senaryo 9 – customer blocker
- Given cari eşleşmesi yoktur
- When kullanıcı Phase 4’e Aktar’a basar
- Then backend `PHASE3_BLOCKER_ACTIVE` döner

### Senaryo 10 – stock blocker
- Given bir satırda stok eşleşmesi yoktur
- When Phase 4’e Aktar denenir
- Then işlem reddedilir

### Senaryo 11 – multi-plate
- Given kayıt iki plaka içerir
- When ekran açılır
- Then plaka grupları ayrı görünür
- And blocker sayıları plaka bazında izlenir

### Senaryo 12 – merge
- Given iki satır merge candidate’dır
- When kullanıcı merge aksiyonunu uygular
- Then satırlar birleşir
- And audit kaydı oluşur

### Senaryo 13 – scrap note required
- Given satır scrap note required taşır
- When note girilmez
- Then Phase 4’e geçiş engellenir

## 23.4. Phase 4
### Senaryo 14 – export hazır kayıt
- Given kayıt Phase 3’ten temiz gelmiştir
- When Phase 4 kuyruğuna düşer
- Then status export-ready görünür

### Senaryo 15 – preview oluşturma
- Given kayıt export-ready’dir
- When kullanıcı Önizleme Oluştur’a basar
- Then preview oluşur
- And preview detail’i görünür olur

### Senaryo 16 – export başarılı
- Given preview ve readiness tamamdır
- When kullanıcı Export’u Çalıştırır
- Then çıktı dosyası oluşur
- And manifest kaydı oluşur
- And kayıt başarıyla kapanır

### Senaryo 17 – export hatası
- Given export sırasında yazma hatası olur
- When işlem tamamlanamaz
- Then kayıt hata kuyruğuna düşer
- And retry kararı bekler

### Senaryo 18 – retry kararı
- Given kayıt hata kuyruğundadır
- When kullanıcı yeniden dene der
- Then retry geçmişi artar
- And yeni deneme planlanır veya başlatılır

### Senaryo 19 – fire blocker
- Given kayıt fire note required taşır
- When fire bilgisi eksikse
- Then export engellenir

### Senaryo 20 – manifest geçmişi
- Given kayıt daha önce export edilmiştir
- When kullanıcı detail açar
- Then geçmiş manifest’ler listelenir

---

# 24. Uygulama sıralaması planı

## Aşama 1 – çekirdek veri ve backend
1. enum’lar
2. DB şeması
3. audit modeli
4. error modeli
5. base DTO’lar

## Aşama 2 – Phase 1 backend
1. watcher
2. duplicate
3. preprocessing
4. OCR adapter
5. retry scheduler
6. status transitions

## Aşama 3 – Phase 1 UI
1. summary cards
2. filters
3. queue table
4. detail drawer
5. errors view
6. folder health

## Aşama 4 – Phase 2 backend ve handoff
1. record detail endpoint
2. approval endpoints
3. override endpoint
4. faulty endpoint
5. Phase 1→2 handoff

## Aşama 5 – Phase 2 UI shell
1. split-screen
2. image viewer
3. grid shell
4. footer
5. empty/error states

## Aşama 6 – Phase 2 interaction
1. low-confidence states
2. approve flow
3. override flow
4. zoom-sync
5. blocker summary
6. move to Phase 3

## Aşama 7 – Phase 3 backend + handoff
1. customer match
2. stock match
3. merge
4. scrap note
5. Phase 2→3 handoff
6. Phase 3→4 handoff

## Aşama 8 – Phase 3 UI
1. header
2. toolbar
3. summary band
4. plate groups
5. dense grid
6. drawers/modals
7. footer

## Aşama 9 – Phase 4 backend
1. queue/detail
2. preview
3. export
4. manifests
5. folder health
6. retry decision

## Aşama 10 – Phase 4 UI
1. summary cards
2. queue table
3. export detail
4. manifest drawer
5. retry panel
6. fire tracking panel
7. mapping summary

## Aşama 11 – QA / acceptance
1. Given/When/Then pack
2. concurrency checks
3. stale state checks
4. audit completeness checks

---

# 25. Nihai hüküm

Bu belgeyle birlikte:
- ürün yönü
- faz sınırları
- ana iş kuralları
- teknik sözleşme katmanları
- UI/UX kararları
- interaction davranışları
- handoff yapıları
- acceptance test omurgası
- uygulama sıralaması

tek dosyada toplanmıştır.

Bu paket, mevcut durumda OptiPlan 360 için **uygulamaya verilebilir en kapsamlı tek dosyalık master spesifikasyon** olarak kullanılabilir.

Kalan kararlar varsa, bunlar artık:
- ana kapsam boşluğu
- kritik iş kuralı boşluğu
- faz karışıklığı

seviyesinde değildir; daha çok mikro operasyonel / UX detayları seviyesindedir.
