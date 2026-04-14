# Phase 2 OCR Kontrol — Kapsamlı Tasarım ve Uygulama Raporu

**Versiyon:** 2.0 (Detaylı Tasarım Aşaması)  
**Tarih:** 18 Mart 2026  
**Odak:** Hız, Doğruluk, Denetlenebilirlik, Phase 3'e Temiz Geçiş  

---

## 1. Yönetici Özeti

Phase 2 OCR Kontrol, OptiPlan360 iş akışının **kritik doğrulama kapısı**dır. Mevcut implementasyon temel işlevleri yerine getirse de, operatör verimliliği, karar izlenebilirliği ve hata oranlarında iyileştirme fırsatları vardır.

### Hedef KPI'lar
- **Doğrulama Süresi:** ↓%30 (kayıt başına)
- **Phase 3 Geçiş Başarı Oranı:** ↑%20 (ilk denemede)
- **Tekrar İşleme Düşüşü:** ↓%25 (hata oranında)
- **Operatör Verimliliği:** ↑%40 (toplu işlem ve kısayollar)

### Kritik Başarı Faktörleri
1. **Doğruluk katmanı**: Alan bazlı eşikler + çok adımlı validasyon + blocker açıklaması
2. **Hız katmanı**: Toplu onay + akıllı sıralama + hızlı karar UI
3. **İzlenebilirlik**: Olay tabanlı audit + reason_code + undo penceresi
4. **Dayanıklılık**: Sanallaştırma + retry mekanizması + idempotency

---

## 2. Kapsam

### Phase 2 Sorumluluğu (Sadece Bu)
- ✅ BOY, EN, ADET alan doğrulaması
- ✅ Confidence skorlarına göre operatör incelemesi
- ✅ Düşük güvenli hücreler için manuel onay/reddetme
- ✅ Blocker yönetimi ve Phase 3 gate kontrolü

### Phase 2 Dışında (Phase 3'te ve sonrası)
- ❌ Cari/Stok eşleştirmesi
- ❌ Sipariş detayı düzenleme
- ❌ Fiyat veya para hesaplaması
- ❌ Teslim verilerinin doldurulması

[DOKUMAN] Referans: `Vr15_mikrokur.docx` — Phase 2 alan listesi ve scope sınırları

---

## 3. Kullanılan Referanslar

1. **Mevcut Kod**: `OCRKontrolPage.tsx` (~1850 satır, mevcut state)
2. **Backend Servisi**: `optiplanWorkflowService` — Phase 2 API sözleşmesi
3. **Veri Modeli**: `WorkflowRecord` + `WorkflowRow` tipi tanımları
4. **İş Kuralları Repository**: `Vr15_mikrokur.docx` (Phase 2-3 boundary)

---

## 4. Mevcut Durum Analizi

### Mevcut Yetenekler ✅
| Alan | Durum | Detay |
|------|-------|-------|
| **Temel UI** | ✅ | Split-screen: görsel + tablo |
| **Klavye Nav.** | ✅ | Tab, Enter, F2, Arrow keys |
| **Confidence Görsel** | ✅ | 4-renk skoru (kırmızı/turuncu/sarı/yeşil) |
| **Bbox Overlay** | ✅ | Canvas-based OCR alan çizimleri |
| **Audit Trail** | ✅ | Son 3 kaydı gösterir |
| **Phase 3 Gate** | ✅ | Düşük güvenli alan blocker kontrolü |
| **Hata Modal** | ✅ | Operatör notu ile hata işaretleme |

### Mevcut Kısıtlamalar ❌
| Alan | Problem | Etki |
|------|---------|------|
| **Blocker Açıklaması** | Yok — sadece sayı | Operatör neden blocker var, ne yapması gerektiğini bilmiyor |
| **Toplu Onay** | Tümü (all-record) — seçici değil | Benzer risk hücreler toplu onaylanamıyor |
| **Sıralama** | Sabit liste sırası | Riskli kayıtlar otomatik önceliklenmez |
| **Hızlı Karar UI** | Yaygın modeller yok | Her karar için modal veya butona klik gerekli |
| **Kısayol Kapsamı** | 4 tuş sınırlı | Undo, batch, focus mode yok |
| **Zoom Skalası** | Bbox statik kalınlık | Yüksek zoom'da okunamıyor, düşük zoom'da eksik görülüyor |
| **Görsel Fallback** | Temel | "Görsel yüklenemedi" — tanı kodu yok |
| **Undo Mekanizması** | Yok | Yanlış onay sonrası Rel değiştirme zor |
| **Performans** | Büyük kayıtlarda lag | 1000+ satırda scroll hissedilir |
| **ORM/Idempotency** | Yok — retry → double insert riski | Ağ kopması sonrası tutarsızlık |
| **KPI Tracking** | Yok | Operatör hızı, override oranı ölçülmüyor |

---

## 5. İyileştirme Alanlarının Detaylı Analizi

### 5.1 KURAL MOTORU (Doğruluk Katmanı)

#### Mevcut Durum
```typescript
// Tek, global eşik
const CONFIDENCE_THRESHOLD = 80; // BOY/EN/ADET hepsi için

// Blocker var/yok ama açıklanması yok
function isLowConfidence(score: number) { return score < 80; }
```

#### Hedef Tasarım
```typescript
// Alan bazlı eşikler (standart tolerans farklıdır)
const CONFIDENCE_THRESHOLDS = {
  boy:  75,   // Boy ±10% tolerans, daha hoşgörülü
  en:   80,   // En daha hassas
  adet: 85,   // Adet "teksi" olması gerek, daha sıkı
};

// Blocker Nedeni Kodları
type BlockerReasonCode = 
  | "CONFIDENCE_LOW"           // Güven < eşik
  | "TYPE_INVALID"             // Sayı değil (metin/karakterler)
  | "RANGE_OUT_OF_BOUNDS"      // Beklenen aralık dışı (Boy < 100, En > 3000, Adet > 999)
  | "UNIT_MISMATCH"            // Birim hatası (mm vs cm tahmini yanlış)
  | "CONSISTENCY_MISMATCH"     // Satır içi tutuşmazlık (Boy > En iken alan boşluk yok)
  | "OCR_COMMON_ERROR";        // Sık OCR hatası (O → 0, I → 1, virgül → nokta)

interface CellBlocker {
  reasonCode: BlockerReasonCode;
  operatorMessage: string;    // Dil: Türkçe, okunabilir
  suggestedValue?: number;    // Opsiyonel — öneri
  score: number;              // Confidence skoru
  category: "critical" | "warning"; // Gate'ye etki etmesi
}
```

#### Validasyon Akışı (Çok-adımlı)
1. **Tip Kontrolü**: Sayı mı? Hayır → TYPE_INVALID
2. **Aralık Kontrolü**: Min/Max sınırları var mı? → RANGE_OUT_OF_BOUNDS
3. **Birim Tahmini**: mm mi, cm mi, inch mi? → UNIT_MISMATCH (tahmins değilse)
4. **Tutarlılık**: Satır içi mantık (Boy > En, Alan hesap eşleş) → CONSISTENCY_MISMATCH
5. **Güven Skoru**: Alan-spesifik eşik? → CONFIDENCE_LOW

#### Öneriler (Sadece Görüş, Otomatik Commit Yok)
```typescript
interface SuggestionLayer {
  commonOCRErrors: Map<string, {original: string, likely: string}>;
  // Örn: "O" → "0", "I" → "1", "," → "."
  // İnsan karar vermeli — otomatik uygulansın ancak "uygula" butonu ile
}
```

#### Kabul Kriteri
- ✅ Her blocker hücresi ≥1 reason_code taşır
- ✅ Tüm mesajlar Türkçe, operatöre okunabilir
- ✅ Öneriler sadece UI'da gösterilir, commit için tıklanmalı
- ✅ Test: 500+ sayı çeşidinde 100% sonuç taşıyıcılığı

[EKLENMESI-GEREKLI] Yeni API endpoint: `validateCell(fieldType, value)` → `{reasons, score, suggestions}`

---

### 5.2 OPERATÖR AKIŞI (Hız Katmanı)

#### Mevcut Durum
- Tab, Enter, F2 ile hücre geçma + satır seçim
- "Tümü Onayla" — tüm düşük güvenli hücreler (ayrım yok)
- Her karar sonra "Phase 3'e Aktar" butonuna el koyma

#### Hedef Tasarım

##### A. Toplu Onay Modu (Smart Batch)
```typescript
interface BatchApprovalQuery {
  field?: "boy" | "en" | "adet";        // Belirtilen kolon
  confidenceRange?: [number, number];   // Örn: [70, 80] — sadece bu bandaki
  reason?: BlockerReasonCode;            // Örn: sadece OCR_COMMON_ERROR
}

// Operatör akışı:
// 1. Aynı kolon + benzer confidence bandı seç
// 2. Dry-run ile 15 kaydı etkileyeceğini gör
// 3. "Onayla" — işlem yapılır
```

##### B. Akıllı Sıralama (Risk-Based Sequencing)
```typescript
function prioritizeRecords(records: WorkflowRecord[]): WorkflowRecord[] {
  // Sıralama: 
  // 1. Üst kritik blocker (adet, boy → en)
  // 2. Blocker sayısı (çok → az)
  // 3. Toplam confidence ortalama (düşük → yüksek)
  // 4. FIFO (aynı risk → ilk gelen hızlı biter)
}

// Aktif kayıt işlemi bittiğinde → otomatik sonraki risk kaydına fokus
```

##### C. Hızlı Karar Paneli (One-liner Actions)
```
┌─────────────────────────────────────┐
│ Satır 3 — BOY=800 (Confidence 65%)  │
├─────────────────────────────────────┤
│ ✓ Onayla [Enter]  →  Suggestion Uygula [Ctrl+Y]  →  Hatalı [Shift+Backspace]  ✕ │
└─────────────────────────────────────┘
```
Tek satırda, en sık 3 aksiyon + kısayol

##### D. Genişletilmiş Kısayollar
| Tuş | İşlem | Hedef |
|-----|-------|-------|
| `Tab` | Sonraki hücre | Var |
| `Shift+Tab` | Önceki hücre | Var |
| `Enter` | Onayla + bir satır aşağı | Var |
| `F2` | Hücre onayla (başka alana geçme) | Var |
| `Ctrl+Enter` | Satırı onayla (tümü aynızaman) | **YENİ** |
| `Shift+Enter` | Önceki kaydına dön | **YENİ** |
| `Ctrl+Z` | Undo (kısa süreli, son 5 işlem) | **YENİ** |
| `Ctrl+Y` | Önerileri uygula | **YENİ** |
| `Shift+Backspace` | Hatalı işaretle (modal aç) | **YENİ** |
| `Esc` | Seçim temizle / Modal kapat | Kısmü var |

#### Kabul Kriteri
- ✅ Tam akış (5 satır × 3 alan) **sadece klavye** ile tamamlanabilir
- ✅ Toplu onay dry-run etkilenen sayı gösterir
- ✅ Undo son 5 işlem içinde çalışır, UI geri düğmesi vardır
- ✅ Aktif → risk kaydı seçim otomatik <300ms

[EKLENMESI-GEREKLI] `KeyboardShortcutManager` servis — tüm kısayollar merkezi
[EKLENMESI-GEREKLI] `BatchApprovalService` API — toplu onay + dry-run

---

### 5.3 GÖRSEL ÇALIŞMA ALANI (Okunabilirlik Katmanı)

#### Mevcut Durum
- 0.75x–2.5x sabit zoom aralığı
- Bbox çizgi kalınlığı ve etiket ölçeği sabit
- Seçili satır dışı kutular normal kontrast
- Split oranı her session sıfırlanıyor

#### Hedef Tasarım

##### A. Zoom-Reactive Bbox Rendering
```typescript
function getBboxRenderParams(zoomLevel: number) {
  return {
    lineWidth: Math.max(1, Math.ceil(zoomLevel * 1.5)),  // 2–4px
    fontSize: `${Math.round(zoomLevel * 11)}px`,          // 8–24px
    labelPadding: Math.round(zoomLevel * 2),              // 1–5px
    shadowBlur: Math.max(2, Math.ceil(zoomLevel * 3)),   // 2–10px
  };
}
```

##### B. Odak Satır Modu (Focus Row → Dim Others)
```typescript
interface FocusMode {
  enabled: boolean;
  selectedRowId: string;
  // Render: seçili satır bbox → normal, diğerleri → opacity: 0.3
  // UI tablosu: seçili → highlight, diğerleri → muted
}
```

##### C. Split Oranı Saklama (LocalStorage + User Preference)
```typescript
const SPLIT_RATIO_KEY = "phase2-split-ratio";
// Session başında localStorage'dan oku
// Değiştirme sonra kaydet
// Profili karşı kalmış oranı kullan
```

##### D. Görsel Fallback Standartlaştırması
| Durum | Şimdiki | Yeni |
|-------|---------|-----|
| Görsel yüklenmedi | Generic mesaj | `ERROR_CODE: IMG_LOAD_FAILED` + Hint |
| Bbox yok | "Satırda bbox yok" | `ERROR_CODE: NO_BBOX_DATA` + "Bu satırın OCR alanları kaydedilmemiş" |
| Düşük çözünürlük | (Üretilmiyor) | `ERROR_CODE: LOW_RESOLUTION` + "Görsel 100dpi altında — kalibre edin" |
| Rotasyon sorunu | (Yok) | `ERROR_CODE: IMAGE_ROTATED` + "90°-270° döndürü tespit — kontrol et" |

#### Kabul Kriteri
- ✅ 80%–300% zoom aralığında bbox hiçbir zaman taş maz
- ✅ Odak mod açılı → seçili satır bbox crystal clear, diğerleri yarı saydam
- ✅ Split oranı (en az 3 session) korunur, 3 session sonra default
- ✅ Her fallback durumu unique error_code + kullanıcı notu taşır

[EKLENMESI-GEREKLI] Canvas rendering refactor — zoom-responsive sizing
[EKLENMESI-GEREKLI] `LocalStoragePreferences` — split ratio + zoom default
[EKLENMESI-GEREKLI] Visual error catalog — 8+ fallback durum tanı kodları

---

### 5.4 KARAR VE HATA YÖNETİMİ (İzlenebilirlik Katmanı)

#### Mevcut Durum
- "Hatalı İşaretle" modalı "neden" opsiyonel not üret
- Karar logu tutuşturulmuyor (sadece endpoint çağrısı)
- Undo yok — yapılan karar kesindir

#### Hedef Tasarım

##### A. Zorunlu Neden Kategorisi
```typescript
type ErrorReasonCategory =
  | "OCR_MISREAD"       // OCR yanış okudu (O→0, O→8)
  | "CONFIDENCE_FALSE"  // Güven hatalı (yüksek ama yanlış)
  | "SUPPLIER_DATA"     // Fornisseur dökümen hatalı
  | "MEASUREMENT_ERROR" // Ölçüm hatası (cihaz ayarı, ölçü tekniği)
  | "SPEC_CHANGE"       // Spesifikasyon güncellemesi (yeni ölçü norm)
  | "SYSTEM_ERROR"      // Sistem/OCR altyapı hatası
  | "OTHER";            // Diğer (not zorunlu)

interface ErrorMarkingInput {
  reasonCategory: ErrorReasonCategory; // ZORUNLU
  operatorNote?: string;                // Opsiyonel, 200 char max
  severity: "data_quality" | "process" | "system"; // ZORUNLU
}
```

##### B. Undo Penceresi (Kısa-Süreli Reversal)
```typescript
interface UndoRecord {
  timestamp: number;
  action: "CELL_APPROVED" | "CELL_APPROVAL_REMOVED" | "ERROR_MARKED" | "ERROR_UNMARKED";
  oldState: CellState;
  newState: CellState;
  userName: string;
}

// Son 5 işlem tutulur, 5 dakika geçerse silinir
// UI'da "Geri Al" butonu (Ctrl+Z ile aynı işlem)
// Bağımlı veri (Phase 3 gate durumu) geri hesaplanır
```

##### C. Olay Tabanlı Audit (Event Sourcing)
```typescript
// Append-only tablo yerine event log
interface DecisionEvent {
  id: UUID;
  timestamp: ISO8601;
  recordUuid: UUID;
  rowId: string;
  fieldType: "boy" | "en" | "adet";
  eventType: "CELL_DECIDED" | "CELL_UNDONE" | "ROW_APPROVED" | "ERROR_MARKED";
  
  // Karar içeriği
  oldValue: number | null;
  newValue: number | null;
  oldApprovalStatus: boolean;
  newApprovalStatus: boolean;
  
  // Karar karakteri
  actor: {userId, userName, role};
  confidenceBeforeDecision: number;
  decisionReason?: BlockerReasonCode | ErrorReasonCategory;
  decisionOverride: boolean; // Operatör manuel müdahale mi
  
  // Bağlam
  suggestedValue?: number;
  ocrContext: {originalOcrValue, ...};
  competingHypotheses?: string[];  // "O vs 0", "8 vs B"
}
```

##### D. Denetlenebilirlik Raporu
```typescript
// View: Tüm karar altında "Denetim İzi" linki
-> "Bu karar kim tarafından ne zaman alındı"
   - İşlem tarihi/saati
   - Operatör adı + rol
   - Sebep (OCR_MISREAD / CONFIDENCE_FALSE / vb)
   - Not (varsa)
   - Undo miydi (geri alındı mı)
```

#### Kabul Kriteri
- ✅ Her "Hatalı" işleminde kategori seçimi ZORUNLU
- ✅ Undo son 5 işlem için her zaman mögün (<5 dakika)
- ✅ Tüm kararlar event log'a kaydediliş, sorgulanabilir
- ✅ "Kim, neyi, neden, ne zaman" kalitesi 100% tetiklenir

[SQL-TEKNIK] Audit tablo: `decision_events` (append-only) şema:
```sql
CREATE TABLE decision_events (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  record_uuid UUID,
  field_type TEXT,
  event_type TEXT,
  old_value NUMERIC,
  new_value NUMERIC,
  actor_user_id UUID,
  actor_user_name TEXT,
  decision_reason TEXT,
  suggestion_value NUMERIC,
  operator_note TEXT,
  INDEX (record_uuid), INDEX (timestamp), INDEX (actor_user_id)
);
```

[API] Endpoint: `GET /api/decisions/{recordUuid}/audit` → `{events: DecisionEvent[]}`

---

### 5.5 API VE SÖZLEŞME İYİLEŞTİRMELERİ

#### Mevcut Contract
```typescript
// updatePhase2(recordUuid, {rows, ...}) → Promise<void>
// approvePhase2(recordUuid) → Promise<void>
// markError(recordUuid, phase, reason, note) → Promise<void>
```

#### Hedef Contract

##### A. Hücre Karar Endpoint (Yeni)
```typescript
POST /api/workflow/cell-decide
Request {
  recordUuid: string;
  rowId: string;
  fieldType: "boy" | "en" | "adet";
  action: "APPROVE" | "APPLY_SUGGESTION" | "OVERRIDE_WITH_VALUE";
  value?: number;        // value action için
  reason?: BlockerReasonCode; // Audit için
}
Response {
  approved: boolean;
  message: string;
  nextBlockingCell?: {rowId, fieldType}; // Sonraki blocker cell
  gateStatus: "BLOCKED" | "READY"; // Anlık gate durumu
  // Idempotency: aynı isteğe 2× aynı response
}
```

##### B. Toplu Onay Endpoint (Yeni)
```typescript
// Dry-run
POST /api/workflow/batch-approve-dry-run
Request {
  recordUuid: string;
  query: {field?: string, confidenceRange?: [min, max]};
}
Response {
  affectedCount: number;
  affectedCells: [{rowId, fieldType, oldScore, newScore}];
  estimatedImpact: {blockersRemaining: number, gateReadyAfter: boolean};
}

// Commit
POST /api/workflow/batch-approve-commit
Request {
  recordUuid: string;
  query: {...};
  dryRunId?: string; // İsteğe bağlı, önceki dry-run referansı
}
Response {
  appliedCount: number;
  gateStatus: "BLOCKED" | "READY";
}
```

##### C. Phase 3 Gate Endpoint
```typescript
GET /api/workflow/{recordUuid}/phase3-gate-status
Response {
  canProceed: boolean;
  blockerReasons: [{
    rowId: string,
    fieldType: string,
    reasonCode: BlockerReasonCode,
    operatorMessage: string,
    suggestedAction?: string
  }];
  summary: {
    totalBlockers: number,
    criticalCount: number,
    warningCount: number
  };
}
```

##### D. Idempotency Key
```typescript
// Tüm POST isteklerine Idempotency-Key header
POST /api/workflow/cell-decide
Headers {
  "Idempotency-Key": "<recordUuid-rowId-timestamp-random>";
  // Sunucu: gelen key kaydedilir, 2. kez aynı key → cache response
}
Response {
  idempotencyId: string;
  cached: boolean; // İlk request false, tekrar true
}
```

#### Cabul Kriteri
- ✅ Aynı isteğin 2×, 3× tekrarı veri tutarsızlığı üretemediy
- ✅ Dry-run commit öncesi gerçek sayı ile eşleşir
- ✅ Gate status anlık (<100ms), cacheable (10s TTL)
- ✅ Cell-decide response < 200ms, p95

[API] `optiplanWorkflowService` extend et — 6 yeni endpoint
[BACKEND] Idempotency store — in-memory cache (default) veya Redis

---

### 5.6 SQL VE TEKNİK ENTEGRASYON

#### Mevcut Durum
- Karar logu basit veri güncellemesi
- Bulk queries olmuyor
- Büyük kayıt setinde sayfalandırma yok

#### Hedef Tasarım

##### A. Olay Tabanlı Audit Modeli
```sql
-- Yeni tablo: append-only event log
CREATE TABLE phase2_decision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Kimlemi
  record_uuid UUID NOT NULL,
  row_id VARCHAR(50) NOT NULL,
  field_type VARCHAR(10) NOT NULL, -- 'boy', 'en', 'adet'
  
  -- Ne oldu
  event_type VARCHAR(30) NOT NULL, -- CELL_DECIDED, ERROR_MARKED, UNDONE
  old_value NUMERIC(10, 2),
  new_value NUMERIC(10, 2),
  old_approval_status BOOLEAN,
  new_approval_status BOOLEAN,
  
  -- Kim ve neden
  actor_user_id UUID NOT NULL,
  actor_user_name VARCHAR(255),
  actor_role VARCHAR(50),
  decision_reason VARCHAR(50),          -- BlockerReasonCode
  error_category VARCHAR(50),            -- ErrorReasonCategory
  operator_note TEXT,
  suggested_value NUMERIC(10, 2),
  
  -- Bağlam
  confidence_before NUMERIC(5, 2),
  is_override BOOLEAN DEFAULT false,
  ocr_original_value VARCHAR(100),
  
  INDEX idx_record (record_uuid),
  INDEX idx_timestamp (created_at),
  INDEX idx_actor (actor_user_id),
  INDEX idx_field (field_type),
  INDEX idx_event_type (event_type)
);

-- Undo record'ı için "reversion" event
-- Örn: CELL_DECIDED → CELL_UNDONE (same IDs, reversed values)
```

##### B. Riskli Kayıt View (Materialized / Incremental)
```sql
-- Real-time query (Incremental update)
CREATE MATERIALIZED VIEW phase2_record_risk_summary AS
SELECT
  r.record_uuid,
  COUNT(*) FILTER (WHERE s.field_type = 'adet' AND s.confidence < 85) as critical_adet_blockers,
  COUNT(*) FILTER (WHERE s.field_type IN ('boy', 'en') AND s.confidence < 80) as warning_size_blockers,
  SUM(CASE WHEN s.confidence < 50 THEN 1 ELSE 0 END) as very_low_count,
  AVG(s.confidence) FILTER (WHERE s.confidence < 80) as avg_low_confidence,
  CASE WHEN COUNT(*) FILTER (WHERE (...)) > 0 THEN 'CRITICAL'
       WHEN COUNT(*) FILTER (WHERE (...)) > 5 THEN 'HIGH'
       ELSE 'NORMAL' END as risk_level,
  MAX(r.updated_at) as last_decision_at
FROM workflow_records r
LEFT JOIN workflow_rows s ON r.record_uuid = s.record_uuid
WHERE r.phase_status = 'PHASE_2'
GROUP BY r.record_uuid;

-- Güncellenme trigger
CREATE TRIGGER update_risk_summary AFTER INSERT ON phase2_decision_events
  EXECUTE FUNCTION refresh_risk_summary_incremental();
```

##### C. Sayfalandırma + Server-Side Sıralama
```sql
-- List endpoint (büyük setler için)
SELECT
  r.record_uuid,
  r.file_name,
  COUNT(row_id) as row_count,
  AVG(COALESCE((SELECT confidence FROM ...))) as avg_confidence,
  risk.risk_level
FROM workflow_records r
LEFT JOIN phase2_record_risk_summary risk ON r.record_uuid = risk.record_uuid
WHERE phase_status = 'PHASE_2'
  AND (? = '' OR file_name ILIKE ?)  -- Search
ORDER BY
  CASE WHEN ? = 'risk_desc' THEN risk_level END DESC,
  CASE WHEN ? = 'confidence_asc' THEN avg_confidence END ASC,
  created_at DESC
LIMIT ? OFFSET ?;  -- Sayfalandırma: limit 50, offset (page-1)*50
```

##### D. Increment Güncelleme (Batch yerine)
```sql
-- Gece batch yerine, karar alındığında incremental güncelleme
UPDATE workflow_rows SET
  confidence_score_adet = COALESCE(?, confidence_score_adet),
  approved_by = COALESCE(?, approved_by),
  approval_timestamp = COALESCE(?, approval_timestamp),
  approval_reason_code = ?
WHERE record_uuid = ? AND row_id = ? AND field_type = 'adet'
  RETURNING *;

-- Change log'a event insert edilir
INSERT INTO phase2_decision_events (...) VALUES (...);
```

#### Kabul Kriteri
- ✅ 5.000+ satır record listesi <500ms
- ✅ Karar kaydı (<50ms)
- ✅ Undo, gate status sorgulama (<100ms)
- ✅ Hiçbir double-insert, batch tutarsızlığı

[SQL-TEKNIK] Migration: yeni tablolar + view oluştur, indexler
[BACKEND] Service layer: `DecisionEventService` — insert/query

---

### 5.7 PERFORMANS VE DAYANIKLILIK

#### Mevcut Durum
- Büyük tablolarda scroll lag
- Ağ kopması sonrası recovery yok
- Bbox render throttling yok

#### Hedef Tasarım

##### A. Sanallaştırma (Virtualized Rows)
```typescript
// react-window veya TanStack Virtual kullanım
import { useVirtual } from '@tanstack/react-virtual';

function TableBody({rows}: {rows: WorkflowRow[]}) {
  const parentRef = useRef(null);
  const {getVirtualItems} = useVirtual({
    size: rows.length,
    parentRef,
    estimateSize: () => 65, // 65px per row
    overscan: 10, // 10 row buffer
  });

  return (
    <tbody ref={parentRef} style={{height: 600, overflow: 'auto'}}>
      {getVirtualItems().map(vrow => (
        <TableRow key={rows[vrow.index].id} row={rows[vrow.index]} />
      ))}
    </tbody>
  );
}
// Sonuç: 1000 satırlı tablo bile smooth
```

##### B. Bbox Render İyileştirmesi
```typescript
// Throttling + requestAnimationFrame
const bboxRef = useRef<HTMLCanvasElement>(null);
const renderQueueRef = useRef<() => void | null>(null);

useEffect(() => {
  // Render isleri queue'ya gir
  const scheduleRender = () => {
    if (renderQueueRef.current === null) {
      renderQueueRef.current = () => {
        const canvas = bboxRef.current;
        // ... bbox render logic
        renderQueueRef.current = null;
      };
      requestAnimationFrame(renderQueueRef.current);
    }
  };

  // Zoom/pan değiştiğinde
  const handleZoom = () => scheduleRender();
  window.addEventListener('wheel', handleZoom);
  return () => window.removeEventListener('wheel', handleZoom);
}, []);
```

##### C. Retry + "Kaldığın Yerden Devam Et"
```typescript
interface SessionState {
  lastSuccessfulRecordUuid: string;
  lastSuccessfulRowId: string;
  lastOperationTimestamp: number;
  pendingDecisions: DecisionEvent[]; // Local cache
}

// Network error sonrası
async function handleNetworkError(error: Error) {
  if (error instanceof NetworkError) {
    // 1. Local sessionStorage'a karar kaydedilir
    saveSessionState({
      lastSuccessfulRecordUuid,
      pendingDecisions: [currentDecision]
    });
    
    // 2. "Ağ bağlantısı koptu. Kaydedildi. Bağlantı tamam olunca devamı yapılacak." mesajı
    showNotification("CONNECTION_LOST");
    
    // 3. Bağlantı geri gelince
    onConnectionRestored(async () => {
      const pending = sessionStorage.getItem('pendingDecisions');
      if (pending) {
        // Retry, idempotency key ile
        await retryPendingDecisions(JSON.parse(pending));
        sessionStorage.removeItem('pendingDecisions');
      }
      // Focus eski yere dön
      navigateToRecord(savedState.lastSuccessfulRecordUuid);
    });
  }
}
```

##### D. Optimistic UI Yerine Güvenli Commit
```typescript
// YANLIŞ: optimistic update — bağlantı kopsa data uçar
// setApprovedCells({...}); // Görsel update
// api.approveCell(...); // Sonra request

// DOĞRU: güvenli commit + açık durum feedback
async function handleCellApprove(rowId, field) {
  setCellState('PENDING'); // UI "işleniyor..." gösterir
  try {
    const response = await api.approveCell({...}, {idempotencyKey});
    setCellState('APPROVED');
    // nextBlockingCell göster
  } catch (error) {
    setCellState('APPROVAL_FAILED'); // "tekrar deneyin" butonu
  }
}
```

#### Kabul Kriteri
- ✅ Hücre geçiş gecikmesi < 100ms (local state)
- ✅ Bbox render jank free (>60 FPS)
- ✅ İlk etkileşim < 1.5s (page load → kullanabilir)
- ✅ Ağ kopması sonrası recovery automatic, veri kaybı yok
- ✅ 5.000+ satır scroll smooth (<16ms frame time)

[FRONTEND] Dependency: `react-window` veya `@tanstack/react-virtual`
[OPTIMIZE] Canvas render: RAF + throttle pattern, event delegation

---

### 5.8 ERİŞİLEBİLİK VE KULLANILABILIRLIK

#### Mevcut Durum
- ARIA labels var
- Separator, zoom Controls, tablo hücreleri klavye erişimli
- Renk-only state var (az)

#### Hedef Tasarım

##### A. Aria-Live Blocker Announcement
```typescript
function BlockerWarningAlert() {
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    if (!canApprove && blockerSummary?.pendingApprovals) {
      // Ekran okuyucu duyacak
      setLiveMessage(
        `${blockerSummary.pendingApprovals} onay bekleyen hücre var. ` +
        `Blocker türü: ${blockerSummary.blockingFields.join(', ')}.`
      );
    }
  }, [blockerSummary]);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      {/* Görsel warning */}
    </>
  );
}
```

##### B. Klavye Erişimi (Tümü)
| Eleman | Tab-accessible | Oku-/Yaz-able |
|--------|-----------------|----------------|
| Separator | ✅ `tabIndex={0}` | ✅ Arrow keys |
| Zoom ±, 1:1 | ✅ | ✅ |
| Table cells | ✅ | ✅ Edit mode |
| Split handle | ✅ | ✅ Arrow keys |
| Buttons | ✅ | ✅ Space / Enter |
| Modal | ✅ Focus trap | ✅ Esc |

##### C. Metin + İkon (Renk Bağımsız)
```typescript
// YANLIŞ:
<span style={{color: '#d97706'}}>Uyarı</span>

// DOĞRU:
<span style={{color: '#d97706'}}>
  ⚠️ <span>Turuncu uyarı</span>
</span>

// Veya:
<Badge severity="warning" icon={AlertIcon}>
  Uyarı
</Badge>
```

##### D. Ekran Okuyucu Test
```
Scenario 1: Kullanıcı sayfaya girer
✅ "OCR Kontrol, 5 kayıt sırasında Phase 2 doğrulama. Kuyruk gözükü ..."

Scenario 2: Düşük güvenli hücre seçer
✅ "Boy sütunu, Satır 3, Confidence %65, Turuncu blocker. Onayla düğmesi, F2"

Scenario 3: Blocker değişir
✅ (aria-live) "2 onay bekleyen hücre var"

Scenario 4: Phase 3 gate hazır
✅ (alert role) "Blocker temizlendi, Phase 3'e aktarım hazır"
```

#### Kabul Kriteri
- ✅ Tam iş akışı **hiç** mouse kullanmadan tamamlanabilir
- ✅ Ekran okuyucu tam sayfa oku + navigate
- ✅ Hiçbir renk-only state, metin/ikon çifti
- ✅ WCAG 2.1 AA standard compliance

[A11Y] Tools: aXe DevTools, jest-axe test automation
[TEST] Screen reader (NVDA / JAWS) E2E doğrulama

---

### 5.9 TEST STRATEJİSİ

#### Mevcut Durum
- 26 tests, temel akış coverage
- Senaryo matrisi yok (çeşitli kombinasyon eksik)

#### Hedef Tasarım

##### A. Test Senaryo Matrisi
```
┌─────────────────────────────────────────────────────┐
│ Sınavlar: Düşük Confidence × Toplu Onay × Undo │
├──────────┬──────────────────┬──────────┬──────────┐
│ Scenario │ Input State      │ Action   │ Expected │
├──────────┼──────────────────┼──────────┼──────────┤
│ 1-LC     │ 1 cell <threshold│ F2       │ Approved │
│ 2-LC-2X  │ 2 cells <thresh  │ Batch    │ Both OK  │
│ 3-LC-UR  │ 1 cell <80 + BOX │ Undo     │ Restored │
│ 4-GW     │ Gate READY       │ Phase3   │ OK       │
│ 5-GW-BK  │ 1 cell left      │ Phase3   │ BLOCKED  │
│ 6-BBOX   │ Zero bbox data   │ Show Img │ Fallback │
│ 7-ZOOM   │ Zoom 200%        │ Render   │ Clear    │
│ 8-RETRY  │ Network error    │ Retry    │ Recover  │
└──────────┴──────────────────┴──────────┴──────────┘

Test: 15+ senaryo × 3 platform (desktop/tablet/mobile) = 45+ test case
```

##### B. Klavye Odaklı Entegrasyon Testleri
```typescript
describe("OCRKontrol — Keyboard-Only Workflow", () => {
  test("5 satırı Tab/Enter/F2 ile tamamen doğrula", async () => {
    // 1. Tab → Satır 1, Hücre 1
    // 2. Enter → Onayla
    // 3. Tab → Hücre 2
    // 4. F2 → Onayla
    // ... Satır 4'e kadar
    // 5. Ctrl+Enter → Satırı onayla
    // 6. Tab → Satır 2, Hücre 1
    // ... Tüm satırlar işin
    // 7. Ctrl+Enter (tümü) → Phase 3'e Aktar
    // ✅ Başarılı
  });

  test("Undo (Ctrl+Z) 3. hücreyi ilk durumua geri döndürür", async () => {
    // ... onay işlemleri
    // Ctrl+Z → Son onay geri alınır
    // ✅ Hücre turuncu (unapprov)
    // ✅ Gate BLOCKED döner (eğer kritik ise)
  });
});
```

##### C. Kontrat Testleri (API / Gate)
```typescript
describe("API Contracts", () => {
  test("baca-approve-dry-run — etkilenen sayı doğru", async () => {
    const dryRun = await api.batchApproveDryRun({
      recordUuid: 'uuid1',
      query: {field: 'boy', confidenceRange: [70, 80]}
    });
    expect(dryRun.affectedCount).toBe(3);
    expect(dryRun.affectedCells).toHaveLength(3);
    expect(dryRun.gateReadyAfter).toBe(true);
  });

  test("gate-status endpoint — blocker nedenleri açık", async () => {
    const gateStatus = await api.gate({recordUuid: 'uuid2'});
    expect(gateStatus.canProceed).toBe(false);
    expect(gateStatus.blockerReasons).toEqual([
      {rowId: '1', fieldType: 'adet', reasonCode: 'RANGE_OUT_OF_BOUNDS', ...}
    ]);
  });

  test("Idempotency — 2. istek cache response döner", async () => {
    const req = {recordUuid: 'uuid', ...};
    const key = "uuid-row1-timestamp-random";
    
    const r1 = await api.cellDecide(req, {idempotencyKey: key});
    const r2 = await api.cellDecide(req, {idempotencyKey: key});
    
    expect(r1.idempotencyId).toBe(r2.idempotencyId);
    expect(r2.cached).toBe(true);
  });
});
```

##### D. Performans Smoke Testi
```typescript
describe("Performance", () => {
  test("Hücre geçmiş <100ms (local state)", async () => {
    const t0 = performance.now();
    // Tab → sonraki hücre
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(100);
  });

  test("Bbox render jank-free (canvas FPS check)", async () => {
    // Zoom 100% → 200% → render frame times toplama
    // Tüm frame < 16ms olmalı (60 FPS + headroom)
  });

  test("Large table (1000 rows) scroll smooth", async () => {
    // 1000 satırlılı tablo, scrolling, FPS meter
    // Average > 50 FPS
  });
});
```

#### Kabul Kriteri
- ✅ Senaryo matrisi 45+ test case
- ✅ Kritik akışlarda kırmızı test yok (CI pass)
- ✅ Performans smoke testi passing
- ✅ Kontrat test (API, gate, idempotency) 100% pass

[TEST] Framework: Vitest + React Testing Library (mevcut)
[TEST] Add: `@testing-library/user-event` (keyboard interaction)
[TEST] Fixture: 500+ row test data, bbox JSON sample

---

### 5.10 ÖLÇÜMLEME VE YÖNETIM PANOSU

#### Mevcut Durum
- KPI tracking yok
- Operatör hızı ölçülmüyor

#### Hedef Tasarım

##### A. KPI Seti
```typescript
interface Phase2Metrics {
  // Zaman
  avgVerificationTimePerRecord: number;           // ms
  avgVerificationTimePerRow: number;              // ms
  avgTimeToPhase3Transition: number;              // sn
  bottleneckFieldType: 'boy' | 'en' | 'adet';   // En çok duran alan

  // Doğruluk
  overrideRatio: number;                          // % (operatör düzeltme)
  firstPassGateSuccessRate: number;               // % (ilk denemede hazır)
  reprocessingNeededRate: number;                 // % (hatalı işaretle)
  blocker_reasonCode_distribution: Map<code, count>; // Boy vs En vs Adet

  // Kalite
  avgConfidenceBeforeDecision: number;            // Ex: 72.5%
  avgConfidenceAfterDecision: number;             // Ex: 92.1%
  undoFrequency: number;                          // Saatte Undo sayısı

  // Operatör
  operatorThroughput: number;                     // Kayıt/saat
  logoffTimeoutRate: number;                      // % (idle timeout)
}
```

##### B. Operatör Bazlı Işı Haritası (Heat Map)
```typescript
// View: Grid
// Rows: operator names → Columns: field types (boy, en, adet)
// Cell color + value: bu operatör bu alana kaç kez müdahale
//
// Örn:
// ┌──────────────┬──────┬──────┬──────┐
// │ Operator     │ Boy  │ En   │ Adet │
// ├──────────────┼──────┼──────┼──────┤
// │ Ali          │ 23   │ 5    │ 31   │  (ADET sütununa sık müdahale)
// │ Fatma        │ 8    │ 14   │ 2    │  (EN çok sorun)
// │ Mehmet       │ 3    │ 6    │ 5    │  (Consistent)
// └──────────────┴──────┴──────┴──────┘
//
// Insight: "ADET alanı, Ali operatör + OCR sık yanılıyor"
//         → Remediation: OCR model retraining, Ali eğitimi
```

##### C. Haftalık Kalite Raporu
```typescript
interface WeeklyQualityReport {
  weekOf: Date;
  totalRecordsProcessed: number;
  avgVerificationTime: number;
  topBlockerReasons: [
    {reasonCode: 'CONFIDENCE_LOW', countFraction: 0.42},
    {reasonCode: 'RANGE_OUT_OF_BOUNDS', countFraction: 0.31},
    {reasonCode: 'OCR_COMMON_ERROR', countFraction: 0.17},
    {reasonCode: 'OTHER', countFraction: 0.10}
  ];
  trendAnalysis: {
    avgTimeChangePercent: -12,  // Geçen haftaya göre
    successRateChangePercent: +8,
    topReasonTrend: 'stable'  // vs. increasing, decreasing
  };
  recommendations: string[]; // "CONFIDENCE_LOW sık, eşik gözden geçir"
}
```

##### D. Dashboard UI (Admin View)
```
┌──────────────────────────────────────────────────────────┐
│ Phase 2 Kalite Panosu                           📊 🔄   │
├──────────────────────────────────────────────────────────┤
│ [Son 7 gün] [Son 30 gün]                                 │
├──────────────────────────────────────────────────────────┤
│ KPI'lar                    │ Trend                        │
│ └─ Ort. Süre: 145s        │ ▼ -12% (hedef: 100s)       │
│ └─ Phase 3 Başarısı: 87%  │ ▲ +8% (hedef: 95%)         │
│ └─ Override Oranı: 23%    │ ▼ -5% (hedef: <15%)        │
│                            │                             │
│ En Sık Blocker:            │ Operatör Isı Haritası:      │
│ [CONFIDENCE_LOW] 42%       │ [Grid: operator×field]      │
│ [RANGE_OUT...] 31%         │ (renkler, sayılar)          │
│ [OCR_COMMON...] 17%        │                             │
│ [OTHER] 10%                │                             │
├──────────────────────────────────────────────────────────┤
│ Haftalık Trend                                          |
│ ▁▃▅▇▆▅▃  (zaman grafiği)                               |
└──────────────────────────────────────────────────────────┘
```

#### Kabul Kriteri
- ✅ Tüm KPI günlük otomatik hesaplanır ve saklı
- ✅ 7-günlük trend grafiği ✓
- ✅ Operatör ısı haritası 8+ operatör için visualize
- ✅ Haftalık rapor Sprint sonunda email
- ✅ Sprint 4 sonunda %measurable iyileşme gösterilebilir

[BACKEND] Service: `MetricsCollectionService` — KPI hesaplayıcı
[FRONTEND] Component: `Phase2DashboardPanel` — admin view
[DB] Aggregation table: `phase2_metrics_daily` (materialized view)

---

## 6. Alan Matrisi (Current ↔ Target)

| Alan | Mevcut | Hedef | Başarı Ölçütü |
|------|--------|-------|----------------|
| **Confidence Eşiği** | Tekil (80) | Alan-bazlı (Boy:75, En:80, Adet:85) | 3 ayrı eşik |
| **Blocker Açıklaması** | Yok | reason_code + operatorMessage | 100% açıklanmış |
| **Toplu Onay** | Tümü (indiscreet) | Akıllı (kolon+band) | Dry-run ile onay |
| **Sıralama** | FIFO | Risk-based (adet>boy>en, blocker count) | Aktif kayıt bitince risk kaydında |
| **Hızlı Karar UI** | Modal/buton | 1-satır aksiyonlar | 3 klik/button max |
| **Kısayollar** | 4 tuş | 10 tuş (Ctrl+Z undo, Ctrl+Enter batch) | Tam klavye akışı |
| **Bbox Zoom** | Statik | Responsive (zoom-reactive) | Tüm zoom seviyesi clear |
| **Odak Modu** | Yok | Seçili satır highlight, diğer dim | Toggle ile |
| **Split Oranı** | Her session sıfır | Saklı (localStorage) | 3 session korunur |
| **Görsel Fallback** | Generic | Kodlu (IMG_LOAD_FAILED, NO_BBOX_DATA) | 8+ kod |
| **Undo Mekanizması** | Yok | 5 işlem, 5 dakika | Ctrl+Z + UI butonu |
| **Audit Log** | Basit update | Event-sourced (append-only) | Tüm karar sorgulanabilir |
| **Idempotency** | Yok | Key-based cache | Tekrar submit — double insert yok |
| **Sanallaştırma** | Yok | react-window (virtual rows) | 1000 satır smooth |
| **Bbox Render** | Continuous | Throttled + RAF | >60 FPS |
| **Aria-Live** | Var | Blocker değişimi announce | Ekran okuyucu duyuyor |
| **A11Y Coverage** | Temel | WCAG 2.1 AA | Screen reader test pass |
| **Test Coverage** | 26 test | 45+ test (scenario matrisi) | Senaryo × platform |
| **KPI Tracking** | Yok | 10 metrik (zaman, doğruluk, kalite) | Dashboard + rapor |
| **Performance** | Baseline | <100ms cell switch, >60FPS | Smoke test pass |

---

## 7. UI / Bilgi Mimarisi Önerileri

### Mevcut UI Düzeni
```
┌────────────────────────────────────────────────┐
│  TopBar: OCR Kontrol                           │
├────────────────────────────────────────────────┤
│ [MasterSpecBanner — Kayıt detayı + Yenile]    │
├────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Sol: Kuyruk │  │ Sağ: Split-panel       │  │
│  │ 260px       │  │ Görsel (50% ─ Tablo)   │  │
│  │ [Kayıt-1]  │  │                         │  │
│  │ [Kayıt-2]  │  │ [Zoom ±] [1:1] [Pan]  │  │
│  │ [Kayıt-3]  │  │ ┌──────────────────────┐ │  │
│  │             │  │ │ Görsel + Bbox       │ │  │
│  │             │  │ │                      │ │  │
│  │             │  │ └──────────────────────┘ │  │
│  │             │  │ ─── Separator ────────   │  │
│  │             │  │ ┌──────────────────────┐ │  │
│  │             │  │ │ Tablo (Boy/En/Adet) │ │  │
│  │             │  │ │ Audit İzi            │ │  │
│  │             │  │ └──────────────────────┘ │  │
│  └─────────────┘  └─────────────────────────┘  │
│  Sağ panel (3. kolon): Phase 2 Özeti          │
│  ┌──────────────────────────────────────────┐  │
│  │ Status + KPI badges + Help + Phase 3 btn │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Hedef UI İyileştirmeler

#### 1. Blocker Açıklaması Entegrasyonu
```
Tablo satırı:
┌─────────────────────────────────────────────────┐
│ Boy=800    En=600    Adet=2                     │
│ Score: 65% Score: 92% Score: 95%               │
│ ⚠️ CONFIDENCE_LOW      ✅     ✅                │
│ "Algılanan değer kredi kartı yanlış oku"      │
│ [Onayla]  [Önerileri Uygula]  [Hatalı]        │
└─────────────────────────────────────────────────┘
```

#### 2. Toplu Onay Paneli (Modal)
```
┌──────────────────────────────────────┐
│ Toplu Onay                           │
├──────────────────────────────────────┤
│ Aşağıdaki hücreler onaylanacak:      │
│                                      │
│ Kolon: [Boy ▼]                      │
│ Güven Bandı: [70-80%] ▼             │
│                                      │
│ Etkilenecek: 3 hücre                │
│ ✓ Satır 1 Boy                       │
│ ✓ Satır 3 Boy                       │
│ ✓ Satır 5 Boy                       │
│                                      │
│ Sonrasında Blockers: 1 kalır        │
│                                      │
│ [Iptal]  [Onayla] (Ctrl+Y)          │
└──────────────────────────────────────┘
```

#### 3. Hızlı Karar Paneli (Context-sensitive)
```
Seçili hücrede:
┌─────────────────────────────────────┐
│ Boy=800 (OCR: Confidence 65%)        │
├─────────────────────────────────────┤
│ [✓ Onayla] [→ Öneri Uygula] [✕ Hatalı] │
│  Enter            Ctrl+Y            Shift+BS │
│                                     │
│ Öneri: 800 (aynı)                  │
│ Neden: İyi okunan değer             │
└─────────────────────────────────────┘
```

#### 4. Undo Paneli (Minimal)
```
Belgede sonraki açılış:
┌────────────────────────┐
│ Son 5 İşlem:           │
│ 1. Boy=800 onaylı ↶    │
│ 2. En=600 onaylı ↶     │
│ 3. Adet hatalı ↶       │
│ ...                    │
│ [Tümünü Geri Al]       │
└────────────────────────┘
```

#### 5. Gate Status Paneli (Detailed Blocker List)
```
┌──────────────────────────────────────┐
│ Phase 3'e Geçiş Durumu               │
├──────────────────────────────────────┤
│ ✓ Hazır / ✗ Engellendi               │
│                                      │
│ Pend Blockers (2):                  │
│ Satır 3 — Adet=0 (RANGE_OUT...)     │
│   "Adet 1+ olmalı"                   │
│   [Onayla] [Öneri] [Hatalı]         │
│ Satır 7 — Boy=30 (RANGE_OUT...)     │
│   "Boy 100-3000mm aralığında"        │
│   [Onayla] [Hatalı]                 │
│                                      │
│ [Phase 3'e Aktar] (engellenen)      │
└──────────────────────────────────────┘
```

---

## 8. İş Kuralları ve Validasyonlar

### Doğrulama Kuralları
```
1. BOY (Body / Height)
   - Tip: Numeric, mm birim
   - Aralık: 100–3000 mm
   - Confidence Eşiği: 75%
   - Tutarlılık: BOY ≤ EN (body height ≤ width)

2. EN (Width / Length)
   - Tip: Numeric, mm birim
   - Aralık: 100–3000 mm
   - Confidence Eşiği: 80%
   - Tutarlılık: EN ≥ BOY

3. ADET (Quantity)
   - Tip: Integer, birim yok
   - Aralık: 1–999
   - Confidence Eşiği: 85%
   - Tutarlılık: Hiçbir

### Phase 3 Gate Kuralları
```
Geçmek için:
- Tüm ADET hücreleri ≥85% confidence VE onaylı
- Tüm BOY/EN hücreleri ≥75%/80% confidence VE onaylı
- Veya operatör tarafından açıkça onaylanmış

Engellemek için:
- ≥1 ADET hücresi <85% confidence VE onaysız
- ≥2 BOY/EN hücresi toplam <eşik
```

### Blocker Karar Kuralları
```
Operatör → APPROVE:
  - UI'dan "Onayla" basılı
  - reasonCode: null / OPERATOR_APPROVED
  - event: CELL_DECIDED (old=blocked, new=approved)

Operatör → APPLY_SUGGESTION:
  - "Önerileri Uygula" basılı
  - reasonCode: OCR_COMMON_ERROR
  - event: CELL_DECIDED (old score, new suggestion value)

Operatör → MARK_ERROR:
  - "Hatalı" basılı + neden kategorisi
  - reasonCode: (operatörün seçtiği kategori)
  - event: ROW_ERROR_MARKED
  - Tüm field'lar bu satır için reddedilir

Operatör → UNDO:
  - Ctrl+Z / "Geri Al" basılı
  - reasonCode: UNDO
  - event: CELL_UNDONE (reverse of previous)
```

---

## 9. API Entegrasyon Analizi

### Yeni Endpoint'ler (6)
1. **POST /api/workflow/cell-decide** — Hücre karar
2. **POST /api/workflow/batch-approve-dry-run** — Toplu onay preview
3. **POST /api/workflow/batch-approve-commit** — Toplu onay execute
4. **GET /api/workflow/{uuid}/phase3-gate-status** — Gate durumu detaylı
5. **GET /api/decisions/{uuid}/audit** — Audit log query
6. **POST /api/workflow/undo** — Geri al (optional)

### Örnek İstekler / Cevapları

#### 1. Cell Decide
```typescript
POST /api/workflow/cell-decide
{
  "idempotencyKeyId": "uuid-row1-timestamp-random",
  "recordUuid": "record-123",
  "rowId": "row-5",
  "fieldType": "adet",
  "action": "APPROVE", // | "APPLY_SUGGESTION" | "MARK_ERROR"
  "value": null,
  "reason": "OPERATOR_APPROVED"
}

Response:
{
  "success": true,
  "idempotencyId": "uuid-row1-timestamp-random",
  "cached": false, // true eğer tekrarlandı
  "cellState": {"approved": true, "confidence": 85, "value": 2},
  "message": "Adet onaylandı",
  "nextBlockingCell": {"rowId": "row-7", "fieldType": "boy"},
  "gateStatus": "BLOCKED" // 1 blocker kaldı
}
```

#### 2. Batch Approve Dry-Run
```typescript
POST /api/workflow/batch-approve-dry-run
{
  "recordUuid": "record-123",
  "query": {
    "fieldType": "boy",
    "confidenceRange": [70, 80]
  }
}

Response:
{
  "dryRunId": "dry-123",
  "affectedCount": 3,
  "affectedCells": [
    {"rowId": "row-1", "fieldType": "boy", "oldScore": 75, "newScore": 100},
    {"rowId": "row-3", "fieldType": "boy", "oldScore": 78, "newScore": 100},
    {"rowId": "row-5", "fieldType": "boy", "oldScore": 72, "newScore": 100}
  ],
  "estimatedImpact": {
    "blockersRemovedCount": 2,
    "gateStatusAfter": "BLOCKED" // 1 blocker kalır
  }
}
```

#### 3. Gate Status
```typescript
GET /api/workflow/record-123/phase3-gate-status

Response:
{
  "canProceed": false,
  "blockerReasons": [
    {
      "rowId": "row-3",
      "fieldType": "adet",
      "reasonCode": "CONFIDENCE_LOW",
      "operatorMessage": "Adet algılama güveni %65, eşik %85",
      "suggestedAction": "Doğru değeri girmek veya hatalı işaretlemek",
      "score": 65
    }
  ],
  "summary": {
    "totalBlockers": 1,
    "criticalCount": 1, // adet
    "warningCount": 0
  },
  "gateCheckTime": "2026-03-18T10:30:00Z"
}
```

---

## 10. SQL Entegrasyon Analizi

### Yeni Tablolar

#### A. phase2_decision_events (Append-only)
```sql
CREATE TABLE phase2_decision_events (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  record_uuid UUID,
  row_id VARCHAR(50),
  field_type VARCHAR(10),
  event_type VARCHAR(30),
  old_value NUMERIC(10,2),
  new_value NUMERIC(10,2),
  actor_user_id UUID,
  actor_user_name VARCHAR(255),
  decision_reason VARCHAR(50),
  operator_note TEXT,
  suggested_value NUMERIC(10,2),
  confidence_before NUMERIC(5,2),
  is_override BOOLEAN,
  ocr_original_value VARCHAR(100),
  
  INDEX (record_uuid, created_at),
  INDEX (actor_user_id),
  INDEX (event_type)
);
```

#### B. phase2_record_risk_summary (Materialized View)
```sql
CREATE MATERIALIZED VIEW phase2_record_risk_summary AS
SELECT
  r.record_uuid,
  COUNT(*) FILTER (WHERE field_type='adet' AND confidence<85) adet_blockers,
  COUNT(*) FILTER (WHERE field_type IN ('boy','en') AND confidence<80) size_blockers,
  AVG(confidence) FILTER (WHERE confidence<80) avg_low_confidence,
  CASE WHEN ...>0 THEN 'CRITICAL' ELSE 'NORMAL' END risk_level
FROM workflow_records r
LEFT JOIN workflow_rows w ON r.record_uuid=w.record_uuid
WHERE phase_status='PHASE_2'
GROUP BY r.record_uuid;

CREATE UNIQUE INDEX idx_risk_summary ON phase2_record_risk_summary(record_uuid);
```

### Index Strategy
```sql
-- Decision events: fast audit query
CREATE INDEX idx_decision_record_time ON phase2_decision_events(record_uuid, created_at DESC);
CREATE INDEX idx_decision_actor ON phase2_decision_events(actor_user_id, created_at DESC);

-- Risk summary: fast prioritization
CREATE INDEX idx_risk_level ON phase2_record_risk_summary(risk_level, record_uuid);

-- Workflow rows: fast single row query
CREATE INDEX idx_workflow_rows_lookup ON workflow_rows(record_uuid, row_id, field_type);
```

---

## 11. Bosluk Analizi (Gap Analysis)

### Kritik Bosluklar

| Gap | Mevcut | Hedef | Çabası |
|-----|--------|-------|--------|
| Blocker açıklaması | ✗ | ✅ reason_code + mesaj | P1 Sprint 1 |
| Alan-bazlı eşikler | ✗ | ✅ Boy/En/Adet farklı | P1 Sprint 1 |
| Toplu onay kontrolü | ✗ | ✅ Dry-run + commit | P1 Sprint 2 |
| Undo mekanizması | ✗ | ✅ 5 işlem, 5 dakika | P1 Sprint 2 |
| Event-sourced audit | ✗ | ✅ Append-only tablo | P1 Sprint 3 |
| Idempotency | ✗ | ✅ Key-based cache | P1 Sprint 3 |
| Sanallaştırma | ✗ | ✅ react-window | P2 Sprint 3 |
| Hızlı karar UI | ✗ | ✅ 1-satır aksiyonlar | P2 Sprint 2 |
| KPI tracking | ✗ | ✅ 10 metrik dashboard | P2 Sprint 4 |
| A11Y sertleştirmesi | ◐ | ✅ WCAG AA | P2 Sprint 4 |

### Orta Önemdeki Bosluklar (P2/P3)
- Zoom-responsive bbox rendering (önemsiz etki, <5h)
- Split ratio localStorage (UX, <3h)
- Görsel fallback standardlaştırması (tanı amaçlı, <4h)

---

## 12. Riskler

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| **API Idempotency Impl.**: Cache invalidation karmaşık | Orta | Yüksek — double insert | Redis + TTL, comprehensive test |
| **Sanallaştırma**: Selection state tutarsızlığı | Orta | Orta — UI glitch | Virtual row key stability test |
| **Undo**: Dependent state (gate) tutarsız | Düşük | Yüksek — veri gereksizleş | Undo event'te gate re-calculate |
| **Materialize View**: Stale risk summary | Düşük | Orta — yanlış sıralama | Incremental refresh trigger |
| **Perfor. Regression**: Yeni endpoint'ler yavaş | Orta | Orta — operatör deneyim | Load test pre-release p95 latency |
| **A11Y Compat.**: Screen reader test incomplete | Düşük | Orta — compliance miss | WCAG audit + NVDA/JAWS test |
| **Test Senaryo Coverage**: Edge case miss | Orta | Düşük — regression | Scenario matrix review, mutation test |

---

## 13. Yapılacaklar (Implementation Roadmap)

### Sprint 1: Kural + Açıklama + Gate (1.5 hafta)
- [ ] Blocker reason_code type + enum tanımla
- [ ] Operatör mesaj çevirileri (8+ neden × 2 dil)
- [ ] Alan-bazlı confidence eşikleri (boy/en/adet)
- [ ] validateCell API endpoint (backend)
- [ ] Gate status endpoint — blocker nedenleri döndür (backend)
- [ ] UI: Blocker tooltip + reason_code göster
- [ ] Test: reason_code coverage + gate endpoint contract
- [ ] Telemetry: reason_code dağılımı track (basics)

**Hedef**: Operatör her blocker'ın neden olduğunu anlar KPI: +%15 kadar daha hızlı karar

### Sprint 2: Toplu Onay + Hızlı UI + Kısayollar (1.5 hafta)
- [ ] Toplu onay servisi (query → batch update)
- [ ] Batch dry-run endpoint + UI modal
- [ ] Hızlı karar paneli (1-satır, 3 buton)
- [ ] Kısayol genişletme: Ctrl+Enter/Shift+Enter/Ctrl+Z/Ctrl+Y/Shift+BS
- [ ] Undo mekanizması (5-işlem, 5-dakika store)
- [ ] Akıllı sıralama: risk prioritize + auto fokus
- [ ] Odak satır modu UI (toggle)
- [ ] Test: Keyboard-only workflow E2E (15-satır doğrulaması)

**Hedef**: %40 verimlilik artışı (toplu +20%, kısayollar +20%) | KPI: <120s/kayıt

### Sprint 3: Event Audit + Idempotency + Perf (1.5 hafta)
- [ ] Migration: decision_events tablo oluştur
- [ ] Decision event servis (insert/query/audit report)
- [ ] Idempotency cache (in-mem/Redis) + key strategy
- [ ] All POST endpoint'lerine idempotency header support
- [ ] Risk summary materialized view + incremental refresh
- [ ] Pagination + server-side sort (LIST endpoint)
- [ ] React-window integration (virtualized table)
- [ ] Bbox throttle + RAF optimization
- [ ] Test: Idempotency contract test, perf smoke test (<100ms)

**Hedef**: 5K+ satır smooth | KPI: <100ms cell switch | Zero double-insert

### Sprint 4: A11Y + Test Matrisi + Dashboard (1.5 hafta)
- [ ] aria-live blocker announcement
- [ ] Tüm control'ler (separator, zoom, buttons) tab-accessible
- [ ] Metin+ikon kullanımı (renk-only state kaldır)
- [ ] Screen reader walkthrough (NVDA/JAWS)
- [ ] Test matrix: 45+ scenario (düşük conf, bbox, batch, undo, gate)
- [ ] Performance regression test (automated)
- [ ] KPI dashboard UI component
- [ ] Weekly quality report generator
- [ ] Operatör ısı haritası view
- [ ] Sprint sonu KPI taraması + dokümantasyon

**Hedef**: WCAG AA pass | 45+ test green | %measurable sprint-end improvement

---

## 14. Açık Sorular

1. **OCR Model Retraining**: Common error (O→0 benzen) için tür modeli var mı? Trainer access gerekli mi?
   - **Notu**: Operatör suggestion'a tercih eder, otomatik olmaz ama model iyileştirme başka sprint olur.

2. **Backend Session Limit**: Undo 5-işlem kalacak mı, gece reset mi?
   - **Önerisi**: Session özet invalidation; gece reset gerekiyor

3. **Multi-Role (Supervisor Review)**: Operatör karar → Supervisor onay? Yoksa operatör final mi?
   - **Varsayım**: Operatör final, denetim lojundan sorgulanır ama override yok

4. **Archive / Old Record**: 2 haftadan eski record'lar soft-delete mi, decision_events tutulur mu?
   - **Önerisi**: decision_events append-only kalmalı (audit gerekçesi)

5. **Zoom Preference**: Operatör tercihi sekmesi mi, yoksa global admin setting mi?
   - **Varsayım**: Operatör kişisel (localStorage), admin global override yok

6. **Bulk Undo**: "Tüm son işlemleri geri al" button'u istiyor mu, yoksa item-by-item mi?
   - **Önerisi**: Item-by-item, "Tümünü Geri Al" opsiyonel

7. **KPI Alert**: %30 kaydı geçtikten sonra admin bildirimi mi?
   - **Varsayım**: Haftalık rapor yeterli, real-time alert yok (başka sprint)

---

## Kaynaklar

- Mevcut Kod: `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.tsx`
- Backend Contract: `optiplanWorkflowService` type definitions
- Workflow Dokumanı: `Vr15_mikrokur.docx` (Phase 2-3 boundary)
- Yapılar: CLAUDE.md kurallı, backend.instructions.md, ui.instructions.md

---

**Rapor Versiyon Tarihi**: 18 Mart 2026 | **Sonraki Gözden Geçirme**: Sprint 1 başında
