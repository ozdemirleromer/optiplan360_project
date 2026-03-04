# DEPENDENCY MAP — OptiPlan360 Kritik Bileşenler

**Oluşturma Tarihi:** 2026-03-04  
**Amaç:** Import bağımlılıklarını ve çakışmaları tespit etmek

---

## orchestrator_service.py
**Dosya:** `backend/app/services/orchestrator_service.py` (572 satır)

### İçe Aktarılanlar:
- `hashlib`, `json`, `logging`, `os`, `subprocess`, `uuid` (stdlib)
- `httpx` (external HTTP client)
- `sqlalchemy.orm.Session`
- `app.exceptions`: `ConflictError`, `NotFoundError`, `ValidationError`
- `app.models`: `Customer`, `OptiAuditEvent`, `OptiJob`, `OptiJobStateEnum`, `OptiModeEnum`, `Order`, `OrderPart`
- `app.models.enums.JobErrorCode`

### Dışa Aktarılanlar:
- **Sınıf:** `OrchestratorService`
- **Fonksiyonlar:** `_call_orchestrator`, `_payload_hash`, `_add_audit`, `_load_rules_json`, `_map_edge`, `_map_grain`

### Kullananlar:
- `backend/app/routers/orchestrator_router.py` (11 kullanım)
  - Satır 20: import
  - Satır 41, 66, 78, 89, 100, 111, 122, 191, 224: instantiate

### Sorunlar:
- ✅ İyi durumda, merkezi orchestrator servisi
- ⚠️ `_map_grain()` fonksiyonu (satır 128) grain mapping yapıyor — grain_matcher.py ile çakışma potansiyeli

---

## export_validator.py
**Dosya:** `backend/app/services/export_validator.py` (688 satır)

### İçe Aktarılanlar:
- `dataclasses.dataclass`
- `typing.Any, Dict, List`
- ℹ️ **Bağımlılığı yok** — tamamen izole

### Dışa Aktarılanlar:
- **Sınıf:** `ValidationResult` (dataclass)
- **Sınıf:** `ExportValidator`
- **Fonksiyon:** `validate_export(data: Dict[str, Any]) -> ValidationResult` (satır 679)

### Kullananlar:
- ❌ **Tespit edilemedi** — grep sonucu yok, kullanılmıyor olabilir

### Sorunlar:
- ⚠️ Sabit tanımları (satır 85-127):
  - `REQUIRED_EXCEL_TAGS` = ["NO", "CODE", "LENGTH", ...]
  - `VALID_GRAIN_VALUES` = ["0-Material", "1-Material", "2-Material", "3-Material"]
  - Bu sabitler başka yerlerde de tanımlanmış (DUPLICATION)

---

## grain_matcher.py
**Dosya:** `backend/app/services/grain_matcher.py` (709 satır)

### İçe Aktarılanlar:
- `re` (regex)
- `dataclasses.dataclass`
- `typing.Dict, List`

### Dışa Aktarılanlar:
- **Sınıf:** `GrainSuggestion` (dataclass)
- **Sınıf:** `GrainMatcher`
- **Fonksiyon:** `suggest_grain(material_name: str) -> GrainSuggestion` (satır 610)
- **Fonksiyon:** `get_grain_dropdown_options() -> List[Dict]` (satır 625)

### Kullananlar:
- ❌ **Tespit edilemedi** — orchestrator_service kendi grain mapping yapıyor

### Sorunlar:
- 🔴 **KULLANILMIYOR** — orchestrator_service.py kendi `_map_grain()` fonksiyonunu kullanıyor
- Gereksiz duplicate mantık

---

## stock_matcher.py
**Dosya:** `backend/app/services/stock_matcher.py` (871 satır)

### İçe Aktarılanlar:
- `re`, `difflib.SequenceMatcher`
- `dataclasses.dataclass`
- `typing.Dict, List, Optional, Tuple`

### Dışa Aktarılanlar:
- **Sınıf:** `StockMatch` (dataclass)
- **Sınıf:** `StockMatcher`
- **Fonksiyon:** `create_matcher(stock_list: List[Dict]) -> StockMatcher` (satır 838)
- **Fonksiyon:** `quick_search(...)` (satır 853)

### Kullananlar:
- ❌ **Tespit edilemedi** — muhtemelen Mikro entegrasyon için hazırlanmış, henüz aktif değil

### Sorunlar:
- ℹ️ Mikro P1 entegrasyonu için hazır duruyor

---

## export.py
**Dosya:** `backend/app/services/export.py` (490 satır)

### İçe Aktarılanlar:
- `datetime`, `os`
- `pandas`, `openpyxl.Workbook`
- `sqlalchemy.orm`: `Session`, `joinedload`
- `app.models`

### Dışa Aktarılanlar:
- **Fonksiyon:** `export_order_to_excel(db: Session, order_id: str) -> list[str]` (satır 29)
- **Fonksiyon:** `export_order_to_excel_openpyxl(order)` (satır 112)

### Kullananlar:
- ❌ **Tespit gerekiyor** — router'larda kullanılıyor mu kontrol edilmeli

### Sorunlar:
- 🔴 **DUPLICATE GRAIN_MAP** (satır 18):
  ```python
  GRAIN_MAP = {
      "0-Material": 0,
      "1-Boyuna": 1,
      ...
  }
  ```
  Aynı map `bridge_service.py` satır 41'de de var!
- İki farklı export fonksiyonu var (pandas vs openpyxl) — hangisi kanonik?

---

## optiplan_worker_service.py
**Dosya:** `backend/app/services/optiplan_worker_service.py` (1689 satır)

### İçe Aktarılanlar:
- `importlib.util`, `json`, `logging`, `os`, `platform`, `subprocess`, `sys`, `threading`
- `datetime`, `typing.Optional`
- `sqlalchemy.exc.IntegrityError`, `sqlalchemy.orm.Session`
- `app.database.SessionLocal`
- `app.models`: `OptiAuditEvent`, `OptiJob`, `OptiJobStateEnum`
- `app.services.tracking_folder_service as tracking`

### Dışa Aktarılanlar:
- **Fonksiyon:** `_resolve_professional_run_script()` (satır 45)
- **Fonksiyon:** `_add_audit(...)` (satır 84)
- **Fonksiyon:** `_claim_job(...)` (satır 96)
- **Fonksiyon:** `_prepare_xlsx(...)` (satır 126)
- **Fonksiyon:** `_run_professional(...)` (satır 154)
- **Fonksiyon:** `_hold_job(...)` (satır 206)

### Kullananlar:
- APScheduler job (periyodik worker)

### Sorunlar:
- ✅ Worker mantığı iyi yapılandırılmış
- ⚠️ `_prepare_xlsx()` fonksiyonu export işini yapıyor — export.py ile koordinasyon gerekiyor mu?

---

## azure_router.py
**Dosya:** `backend/app/routers/azure_router.py` (2016 satır)

### İçe Aktarılanlar:
- `datetime`, `uuid`
- `app.auth.get_current_user`
- `app.database.get_db`
- `app.exceptions`: `BusinessRuleError`, `ValidationError`

### Kullananlar:
- FastAPI router endpoint'leri

### Sorunlar:
- ℹ️ Azure OCR entegrasyonu
- Detaylı analiz için tam import listesi gerekiyor

---

## ocr_router.py
**Dosya:** `backend/app/routers/ocr_router.py` (5711 satır)

### İçe Aktarılanlar:
- `io`, `logging`, `re`, `datetime`, `uuid`

### Dışa Aktarılanlar:
- OCR endpoint'leri

### Sorunlar:
- 🔴 **LOCAL NORMALIZE FUNCTION** (satır 191):
  ```python
  def _normalize_phone(phone: str) -> str:
  ```
  Bu fonksiyon ocr_router içinde tanımlı, merkezi bir utils modülüne taşınmalı!
- Satır 218, 492, 900'de kullanılıyor

---

## apps/orchestrator/ (Node.js)
**Platform:** Node.js + TypeScript + Express  
**Paket Yöneticisi:** npm  
**Ana Dosya:** `src/index.ts`

### Bağımlılıklar (package.json):
- `express` v4.21.2
- `better-sqlite3` v11.8.1
- `chokidar` v4.0.3 (dosya izleme)
- `fast-xml-parser` v4.5.1
- `jsonwebtoken` v9.0.0
- `xlsx` v0.18.5
- `zod` v3.24.2 (validation)

### Dizin Yapısı:
```
src/
  ├── adapters/
  ├── api/
  ├── config/
  ├── db/
  ├── domain/
  ├── index.ts
  ├── middleware/
  ├── runtime/
  ├── services/
  └── utils/
```

### Python Backend ile İlişki:
- `orchestrator_service.py` içindeki `_call_orchestrator()` fonksiyonu Node.js orchestrator'a HTTP istekleri yapıyor
- Env var: `ORCH_BASE_URL` (default: `http://localhost:3001`)

### Sorunlar:
- ⚠️ **CONTRACT UYUMSUZLUĞU RİSKİ** — Python tarafı hangi endpoint path formatını bekliyor vs Node.js tarafı ne sunuyor karşılaştırılmalı

---

## ÖZET — KRİTİK SORUNLAR

| # | Sorun | Konum | Öncelik |
|---|-------|-------|---------|
| 1 | GRAIN_MAP duplicate | export.py:18, bridge_service.py:41 | 🔴 P0 |
| 2 | _normalize_phone() local fonksiyon | ocr_router.py:191 | 🔴 P0 |
| 3 | grain_matcher.py KULLANILMIYOR | orchestrator kendi mapping yapıyor | 🔴 P0 |
| 4 | VALID_GRAIN_VALUES duplicate | export_validator.py:127, schemas.py:129 | 🟡 P1 |
| 5 | REQUIRED_EXCEL_TAGS inline | export_validator.py:85 | 🟡 P1 |
| 6 | export_validator.py kullanılmıyor | Test edilmedi | 🟡 P1 |
| 7 | stock_matcher.py kullanılmıyor | Mikro P1 için hazır | 🟢 P2 |
| 8 | Node.js contract bilinmiyor | orchestrator_service.py HTTP çağrıları | 🟡 P1 |

---

## SONRAKI ADIMLAR

GÖREV-1B: Bu sorunların detaylı duplicate analizi (DUPLICATION_REGISTRY.md)  
GÖREV-1C: Import test (broken component tespiti)
