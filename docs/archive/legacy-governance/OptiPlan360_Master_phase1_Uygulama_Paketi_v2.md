# OptiPlan 360 – Master Uygulama Paketi v2
## Kapsam Kapatılmış Uygulama / Teknik Sözleşme / Handoff / Test Paketi

> Bu dosya, konuşma boyunca kesinleşen ürün, mimari, UI/UX, iş kuralı ve uygulama kararlarını tek bir belgede toplar.  
> Amaç, kapsam kaymasını engellemek ve ekip/AI tarafından doğaçlama yapılmasını minimuma indirmektir.

---

# 1. Belgenin amacı

Bu belge aşağıdaki eksikleri kapatmak için hazırlanmıştır:

- ürün konumu ve faz sınırlarının tek yerde toplanması
- Phase 1, 2, 3 için bağlayıcı iş kurallarının sabitlenmesi
- Phase 1 API + DTO sözleşmesinin tanımlanması
- Phase 2 interaction matrix’in netleştirilmesi
- fazlar arası handoff sözleşmelerinin yazılması
- Phase 3 teknik uygulama spesifikasyonunun tamamlanması
- acceptance / QA senaryolarının yazılması
- canonical enum, state, audit ve hata modelinin sabitlenmesi

Bu belge, OptiPlan 360 için mevcut durumda **master implementation pack** olarak kullanılmalıdır.

---

# 2. Ürün konumu

## 2.1. Sistem tanımı
OptiPlan 360 bağımsız bir ERP değildir.

Bu sistem:
- Mikro Vr15
- Optiplanning

arasında çalışan:
- operasyonel köprü
- workflow katmanı
- veri hazırlama, doğrulama ve aktarım sistemi

olarak konumlanır.

## 2.2. Temel ilke
- Ticari kuralların sahibi Mikro Vr15’tir
- Cari, stok, sipariş ve ERP otoritesi Mikro’dadır
- OptiPlan 360 ERP yeniden yazmaz
- Fazlar arası kontrollü veri akışı sağlar

## 2.3. Faz sınırları
- **Phase 1:** OCR Havuzu
- **Phase 2:** OCR Kontrol
- **Phase 3:** Sipariş Kontrol & ERP Eşleştirme
- **Phase 4:** Export / Excel / Üretim çıktısı

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
- Hardcoded path yasak
- Hardcoded klasör mantığı yasak
- Faz geçişleri operatör aksiyonuna bağlı
- Audit zorunlu
- UI ve backend kuralları aynı iş mantığını uygular
- Graceful fallback zorunlu
- Desktop-first dense ERP tasarım dili korunur

---

# 4. Canonical enum ve state sözleşmesi

## 4.1. Phase record status enum
Aşağıdaki status listesi canonical kabul edilir:

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
- `COMPLETED`

## 4.2. Approval status enum
Phase 2 için:

- `UNREVIEWED`
- `LOW_CONFIDENCE`
- `APPROVED_AS_IS`
- `OVERRIDDEN`
- `READ_ONLY`

## 4.3. Folder health status enum
- `HEALTHY`
- `WARNING`
- `OFFLINE`
- `ERROR`

## 4.4. Audit event type enum
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

## 4.5. Error severity enum
- `INFO`
- `WARNING`
- `RETRYABLE`
- `FATAL`

## 4.6. Frontend page state enum
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

---

# 5. Phase 1 – bağlayıcı iş kuralları

## 5.1. Amaç
Sisteme gelen belgeleri güvenli biçimde almak, OCR pipeline’ından geçirmek ve Phase 2’ye hazır hale getirmek.

## 5.2. Kaynak klasörler
Mantıksal tipler:
- `whatsapp_raw`
- `scanner_raw`
- `manuel_raw`
- `email_raw`

Fiziksel path DB/config’den okunur.

## 5.3. Ana akış
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

## 5.4. Duplicate kuralı
Duplicate yalnız dosya adına göre yapılmaz.

Değerlendirilecek sinyaller:
- file_name
- file_size
- checksum
- source_type
- prior_records

Duplicate ise:
- akışa girmez
- status `DUPLICATE`
- audit üretilir
- normal Phase 2 akışına geçmez

## 5.5. Retry kuralı
Retry’a girebilecek örnek durumlar:
- timeout
- OCR servis hatası
- parse hatası
- kritik payload eksikliği

Retry ise:
- status `OCR_RETRY_PENDING`
- retry_count artar
- next_retry_at set edilir
- last_error_message set edilir

## 5.6. Fallback kuralı
- bbox yoksa kayıt saklanır
- confidence yoksa alan manual review olarak işaretlenir
- parse kısmi başarısızsa fatal değilse retryable işlenebilir

---

# 6. Phase 1 API + DTO sözleşmesi

## 6.1. GET /api/phase1/queue
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

## 6.2. GET /api/phase1/queue/{record_id}
### Response
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

## 6.3. GET /api/phase1/folder-health
### Response
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

## 6.4. GET /api/phase1/errors
### Response
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

## 6.5. GET /api/phase1/status-summary
### Response
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

## 6.6. POST /api/phase1/manual-retry
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

## 6.7. POST /api/phase1/manual-rescan
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

## 6.8. Phase 1 DTO listesi
- `Phase1QueueRecordDto`
- `Phase1QueueDetailDto`
- `Phase1FolderHealthDto`
- `Phase1ErrorRecordDto`
- `Phase1StatusSummaryDto`
- `Phase1ManualRetryRequestDto`
- `Phase1ManualRetryResponseDto`

---

# 7. Phase 2 – bağlayıcı iş kuralları

## 7.1. Amaç
OCR çıktısını belge ile yan yana gösterip operatöre kritik alan onayı yaptırmak.

## 7.2. Ana doğrulama alanları
Kritik doğrulama alanları (7 alan):
- `BOY`
- `EN`
- `ADET`
- `U1`
- `U2`
- `K1`
- `K2`

## 7.3. Blocker kuralı
Eğer BOY, EN, ADET, U1, U2, K1 veya K2 alanlarından herhangi biri:
- `confidence_score < 80`
- ve operatör onayından geçmemişse

kayıt Phase 3’e gidemez.

## 7.4. Onay kuralı
Şüpheli hücre:
- override edilerek
- veya as-is onaylanarak

temizlenebilir.

## 7.5. Hatalı Görsel
Ayrı akıştır.
Tetiklenirse:
- kayıt `FAULTY`
- not alınabilir
- WhatsApp taslak modalı açılır

---

# 8. Phase 2 API + DTO sözleşmesi

## 8.1. GET /api/phase2/queue
### Response
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

## 8.2. GET /api/phase2/records/{record_id}
### Response
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
          "raw_value": "true",
          "normalized_value": "true",
          "confidence_score": 72,
          "bbox": null,
          "approval_status": "LOW_CONFIDENCE",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "U2",
          "raw_value": "false",
          "normalized_value": "false",
          "confidence_score": 95,
          "bbox": null,
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "K1",
          "raw_value": "true",
          "normalized_value": "true",
          "confidence_score": 68,
          "bbox": null,
          "approval_status": "LOW_CONFIDENCE",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        },
        {
          "field_name": "K2",
          "raw_value": "false",
          "normalized_value": "false",
          "confidence_score": 93,
          "bbox": null,
          "approval_status": "UNREVIEWED",
          "override_value": null,
          "approved_by": null,
          "approved_at": null
        }
      ]
    }
  ]
}
```

## 8.3. PATCH /api/phase2/records/{record_id}/cells/approve
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

## 8.4. PATCH /api/phase2/records/{record_id}/cells/override
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

## 8.5. POST /api/phase2/records/{record_id}/mark-faulty
### Request
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

## 8.6. POST /api/phase2/records/{record_id}/move-phase3
### Response success
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "PHASE3_PENDING"
}
```

### Response reject
```json
{
  "ok": false,
  "error_code": "PHASE2_BLOCKER_ACTIVE",
  "message": "Unapproved low confidence fields exist"
}
```

---

# 9. Phase 2 interaction matrix

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
- CTA blocker count 0 olduğunda anında aktifleşir; ek save butonu şart değildir
- bbox eksikliği blocker değildir

---

# 10. Phase 1 → Phase 2 handoff sözleşmesi

## 10.1. Giriş koşulu
Bir kayıt yalnızca şu durumda Phase 2’ye düşer:
- OCR parse tamamlanmış
- normalize veri DB’ye yazılmış
- status `PHASE2_PENDING`

## 10.2. Zorunlu alanlar
- `record_id`
- `status`
- `image_url` veya image reference
- `rows[]`
- her row içinde `BOY`, `EN`, `ADET`
- `confidence_score` alanı mümkünse
- `bbox` mümkünse

## 10.3. Opsiyonel alanlar
- diğer OCR alanları
- source_text
- upper metadata

## 10.4. Handoff payload örneği
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
        }
      ]
    }
  ]
}
```

---

# 11. Phase 2 → Phase 3 handoff sözleşmesi

## 11.1. Giriş koşulu
Kayıt yalnızca şu durumda Phase 3’e gider:
- BOY/EN/ADET alanlarında aktif blocker yok
- record `FAULTY` değil
- operatör onayları kayıtlı

## 11.2. Zorunlu alanlar
- `record_id`
- `status = PHASE3_PENDING`
- Phase 2 approval trail
- normalize edilmiş final değerler
- override edilmiş alanlar
- audit summary

## 11.3. Handoff payload örneği
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

# 12. Phase 3 – teknik uygulama spesifikasyonu

## 12.1. Amaç
Phase 3 sistemin ana operasyon merkezidir.

## 12.2. Bağlayıcı kurallar
- Cari eşleşmesi hard blocker’dır
- Herhangi bir satırda stok eşleşmesi yoksa hard blocker’dır
- Çoklu plaka desteklenir
- Satır birleştirme desteklenir
- Fire açıklaması desteklenir
- Phase 4’e geçiş blocker temizlenmeden yapılamaz

## 12.3. Ana ekran parçaları
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

## 12.4. Phase 3 veri modeli
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

## 12.5. Phase 3 API sözleşmesi

### GET /api/phase3/records/{record_id}
Response:
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

### POST /api/phase3/customer-match
```json
{
  "record_id": "rec_010",
  "customer_code": "CARI-001"
}
```

### POST /api/phase3/stock-match
```json
{
  "record_id": "rec_010",
  "row_index": 0,
  "stock_code": "STK-001"
}
```

### POST /api/phase3/merge-rows
```json
{
  "record_id": "rec_010",
  "row_indexes": [2, 3]
}
```

### POST /api/phase3/scrap-note
```json
{
  "record_id": "rec_010",
  "row_index": 4,
  "note": "Fire nedeni: damar yönü nedeniyle kesim dışı"
}
```

### POST /api/phase3/move-phase4
Success:
```json
{
  "ok": true,
  "record_id": "rec_010",
  "status": "PHASE4_PENDING"
}
```

Reject:
```json
{
  "ok": false,
  "error_code": "PHASE3_BLOCKER_ACTIVE",
  "message": "Customer or stock blockers remain"
}
```

## 12.6. Phase 3 blocker matrix
Phase 4’e geçiş engellenir, eğer:
- customer_match_status != MATCHED
- herhangi bir line `stock_match_status != MATCHED`
- merge required satırlar çözülmemişse
- scrap_note_required olup açıklama eksikse

---

# 13. Phase 3 → Phase 4 handoff sözleşmesi

## 13.1. Giriş koşulu
- cari eşleşmiş
- tüm stoklar eşleşmiş
- merge gereksinimleri tamamlanmış
- scrap açıklamaları tamamlanmış

## 13.2. Handoff payload örneği
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

# 14. Tasarım tokenları

## 14.1. Genel tokenlar
- `app-bg`: `bg-slate-900`
- `panel-bg`: `bg-slate-800`
- `border-default`: `border-slate-700`
- `text-primary`: `text-slate-200`
- `text-secondary`: `text-slate-400`

## 14.2. State tokenları
- success text: `text-emerald-400`
- success icon: `text-emerald-500`
- success bg: `bg-emerald-900/30`

- warning text: `text-amber-300`
- warning bg: `bg-amber-900/30`

- danger text: `text-red-400`
- danger icon: `text-red-500`
- danger bg: `bg-red-900/40`

## 14.3. Ölçü tokenları
- header height: `56px`
- footer height: `52px`
- dense row height: `32px`
- table cell padding x: `12px`
- table cell padding y: `4px`
- badge radius: `4px`
- focus border width: `1px`
- split panel min width: `420px`
- resizer width: `6px`

## 14.4. Font scale
- page title: `16px / 700`
- section subtitle: `12px / 500`
- dense table header: `11px / 600`
- dense table body: `13px / 400`
- helper text: `12px / 400`

---

# 15. Audit modeli

## 15.1. Audit object
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

## 15.2. Audit zorunlu alanları
- event_type
- record_id
- actor_id
- created_at

Opsiyonel:
- row_index
- field_name
- old_value
- new_value
- note

---

# 16. Hata modeli

## 16.1. Error response canonical format
```json
{
  "ok": false,
  "error_code": "PHASE2_BLOCKER_ACTIVE",
  "message": "Unapproved low confidence fields exist",
  "severity": "WARNING",
  "details": {}
}
```

## 16.2. Örnek error code listesi
- `FOLDER_OFFLINE`
- `FILE_MOVE_FAILED`
- `DUPLICATE_CONFLICT`
- `OCR_TIMEOUT`
- `OCR_PARSE_FAILED`
- `DB_WRITE_FAILED`
- `PHASE2_BLOCKER_ACTIVE`
- `PHASE3_BLOCKER_ACTIVE`
- `CONCURRENT_UPDATE_DETECTED`

---

# 17. Acceptance criteria / test senaryoları

## 17.1. Phase 1
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

## 17.2. Phase 2
### Senaryo 4 – low confidence BOY
- Given BOY confidence 65 gelir
- When kayıt açılır
- Then BOY hücresi warning state alır
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

## 17.3. Phase 3
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

---

# 18. Uygulama sıralaması planı

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

## Aşama 9 – QA / acceptance
1. Given/When/Then pack
2. concurrency checks
3. stale state checks
4. audit completeness checks

---

# 19. Nihai hüküm

Bu belgeyle birlikte:
- ürün yönü
- faz sınırları
- ana iş kuralları
- teknik sözleşme katmanları
- interaction davranışları
- handoff yapıları
- test paketinin omurgası

tek dosyada toplanmıştır.

Bu paket, mevcut durumda OptiPlan 360 için **uygulamaya verilebilir en kapsamlı master paket** olarak kullanılabilir.

Kalan mikro kararlar olabilir; ancak bunlar artık:
- ana kapsam boşluğu
- kritik iş kuralı boşluğu
- faz karışıklığı
seviyesinde değildir.
