# ADR-001: Tek Orchestrator
## Durum: Uygulandi
## Baglam: OCR ve siparis akislarinda job olusturma davranisi daginikti. Job state gecislerinin kanonik kaynagi `OrchestratorService` olmadan retry, hold ve create davranislari ayrisiyordu.
## Karar: OCR'den siparis olusturma akisi `OrderService.create_order()` sonrasinda `OrchestratorService.create_job()` cagiracak sekilde sabitlendi. Router icindeki dogrudan ORM tabanli siparis/job olusturma mantigi aktif akistan cikarildi.
## Etkilenen Dosyalar:
- `backend/app/routers/ocr_router.py`
- `backend/app/services/orchestrator_service.py`
## Test: `cd backend && pytest tests/test_orchestrator_service.py -v --tb=short`

# ADR-002: Tek Rule Engine / Normalize Katmani
## Durum: Uygulandi
## Baglam: Turkce karakter, telefon, malzeme ve grain normalize mantigi birden fazla router ve serviste tekrarliydi.
## Karar: Kanonik normalize fonksiyonlari `backend/app/utils/text_normalize.py` altinda toplandi. OCR tarafinda parse verisi JSON string olarak standartlastirildi; mapper katmani `OcrOrderMapper` ile `OrderCreate` semasina donusum tek noktaya cekildi.
## Etkilenen Dosyalar:
- `backend/app/utils/text_normalize.py`
- `backend/app/services/ocr_order_mapper.py`
- `backend/app/routers/ocr_router.py`
- `backend/app/routers/azure_router.py`
- `backend/app/routers/aws_textract_router.py`
- `backend/app/routers/google_vision_router.py`
## Test: `cd backend && pytest tests/test_rule_engine.py -v --tb=short`

# ADR-003: Tek Export Validator ve Kanonik XLSX Uretimi
## Durum: Uygulandi
## Baglam: `orders_router`, `optiplanning_service` ve `export.py` ayri XLSX uretim mantiklari tasiyordu. Kolon semasi ve grain/bant kurallari tek noktadan gecmiyordu.
## Karar: Kanonik XLSX uretimi `backend/app/services/export.py::generate_xlsx_for_job()` oldu. Tum aktif export akislari bu fonksiyona yonlendirildi ve her grup icin `ExportValidator.validate()` zorunlu hale getirildi.
## Etkilenen Dosyalar:
- `backend/app/services/export.py`
- `backend/app/services/export_validator.py`
- `backend/app/services/filename_generator.py`
- `backend/app/services/optiplanning_service.py`
- `backend/app/routers/orders_router.py`
## Test: `cd backend && pytest tests/test_export_validator.py -v --tb=short`

# ADR-004: Tek Excel Sema Sabitleri
## Durum: Uygulandi
## Baglam: Zorunlu kolonlar, grain degerleri ve grup adlari farkli dosyalarda farkli string listeleriyle tanimlaniyordu.
## Karar: Kanonik sema sabitleri `backend/app/constants/excel_schema.py` icine tasindi. Export validator, schema ve export pipeline bu modulu import eder hale getirildi.
## Etkilenen Dosyalar:
- `backend/app/constants/excel_schema.py`
- `backend/app/schemas.py`
- `backend/app/services/export.py`
- `backend/app/services/export_validator.py`
## Test: `cd backend && pytest tests/test_rule_engine.py tests/test_export_validator.py -v --tb=short`

# ADR-005: Runtime Dogrulama Kisitlari
## Durum: Bloklu
## Baglam: Python runtime ortaminda `python -c` ve `pytest` cagilari `Failed to import encodings module` hatasiyla bloku. Network ve encoding ayarlari incelenmis, hata OS/interpreter seviyesinde.
## Karar: Kod yamasi ve doküman yazimi statik olarak tamamlandi. Runtime test (pytest), migration (alembic) ve health check komutlari RUNBOOK_DEV.md / RUNBOOK_PROD.md'de dokümante edildi ancak bu oturumda calistirilamadi. Bloker kalkirinca bu komutlar once calistirilacak.
## Etkilenen Dosyalar:
- docs/RUNBOOK_DEV.md, docs/RUNBOOK_PROD.md (execute instructions)
## Test: (Blocked until Python fix) — TBD after fix

---

## OZET — TAMAMLANAN ADIMLAR

| ADR | Baslik | Status | Test Komutu |
|-----|--------|--------|------------|
| 001 | Tek Orchestrator | ✅ Uygulanmi | `pytest tests/test_orchestrator_service.py` |
| 002 | Tek Rule Engine / Normalize | ✅ Uygulanmi | `pytest tests/test_rule_engine.py` |
| 003 | Tek Export Validator | ✅ Uygulanmi | `pytest tests/test_export_validator.py` |
| 004 | Tek Excel Sema Sabitleri | ✅ Uygulanmi | `pytest tests/test_*` |
| 005 | Runtime Dogrulama | ⏸️ Bloklu | Python fix requires |

---

## YANSIYAN DOSYALAR (Bu Turda Guncellenen)

1. **constants/excel_schema.py** — LEGACY_GRAIN_MAP eklendi
2. **export.py** — _LEGACY_GRAIN_MAP silinip constant import'u eklendi
3. **orders_router.py** — LEGACY_GRAIN_MAP import eklendi, inline map silinid
4. **ocr_order_mapper.py** — LEGACY_GRAIN_MAP import eklendi

## KALAN ISLER

- B2 Legacy cleanup: ocr_router.py::create_order_from_ocr() silinecek (deprecated endpoint)
- B3 Schema/Frontend: Mapping validation (deferred — Python required)
- B4-5: Integration tests (deferred — Python required)
- B6 Circuit breaker (deferred — optional P2)
- `docs/RUNBOOK_DEV.md`
- `docs/SECTION_7_10_CONTROL_REPORT.md`
## Test: `python -c "import encodings"` komutu duzeldikten sonra tum pytest/alembic komutlari yeniden calistirilacak
