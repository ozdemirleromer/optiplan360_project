## PATCH-001: Bölüm 7 veritabanı stabilizasyon eksikleri kapatıldı
**Dosya:** `backend/app/models/order.py`, `backend/app/models/finance.py`, `backend/app/models/crm.py`
**Neden:** Bölüm 7 raporu index/constraint açıklarını yalnızca öneri olarak bırakmıştı; prompt ise eksiklerin modele uygulanmasını istiyordu.
**Etki:** `Order`, `OrderPart`, `OptiJob`, `Invoice`, `CRMAccount` için eksik index/constraint tanımları eklendi. `PaymentPromise.reminder_count` alanı eklendi.
**Test:** Statik model kontrolü tamamlandı. Migration/pytest çalıştırılamadı; ortamda çalışan Python runtime yok.

## PATCH-002: OrderPart zorunlu alanları güvenli moda çekildi
**Dosya:** `backend/app/models/order.py`
**Neden:** Prompt `boy/en/adet` alanlarını NOT NULL istiyor; mevcut create akışlarının bir kısmı hâlâ `boy_mm/en_mm` üzerinden çalışıyor.
**Etki:** `boy` ve `en` alanları `nullable=False, default=0`, `adet` alanı `nullable=False, default=1` oldu. Bu sayede null kayıtlar engellenirken mevcut çift-alanlı akışlar kırılmadı.
**Test:** Statik model incelemesi PASS. Gerçek DB migration uygulanmadı.

## PATCH-003: Bölüm 9 için prompttaki eksik test dosyaları eklendi
**Dosya:** `backend/tests/test_rule_engine.py`, `backend/tests/test_orchestrator_service.py`, `backend/tests/test_text_normalize.py`
**Neden:** Mevcut test setinde kapsam vardı ama prompttaki hedef dosya adları eksikti; ayrıca `test_text_normalize.py` içinde hatalı bir assertion vardı.
**Etki:** Rule engine için birleşik test dosyası, orchestrator service için entegrasyon benzeri test dosyası eklendi. Yanlış `normalize_text("ÜrünAdı")` beklentisi düzeltildi.
**Test:** Dosya seviyesi statik kontrol tamamlandı. `pytest` çalıştırılamadı.

## PATCH-004: Orchestrator hata kodu enum ile hizalandı
**Dosya:** `backend/app/services/orchestrator_service.py`, `backend/app/services/bridge_service.py`
**Neden:** `cancel_job()` içinde ham `"E_CANCELLED"` string'i kalmıştı; bu, enum tabanlı hata kodu yaklaşımıyla çelişiyordu.
**Etki:** `JobErrorCode.CANCELLED` kullanılmaya başlandı. `bridge_service.py` içindeki eski `3-Both` yorumu `3-Material` olarak güncellendi.
**Test:** `backend/tests/test_orchestrator_service.py::TestOrchestratorService::test_cancel_sets_failed_state` bu davranışı hedefliyor; test çalıştırılamadı.

## PATCH-005: OCR sonucu OrderCreate ve Orchestrator akışına sabitlendi
**Dosya:** `backend/app/services/ocr_order_mapper.py`, `backend/app/routers/ocr_router.py`
**Neden:** `ocr_router.py` içindeki `/create-order` endpointi doğrudan ORM alanlariyla kirik bir siparis olusturma akisi kullaniyordu.
**Etki:** OCR satirlari `OcrOrderMapper` ile kanonik `OrderCreate` semasina donusturuluyor; siparis `OrderService`, job ise `OrchestratorService` uzerinden olusturuluyor.
**Test:** Statik akiş kontrolu PASS. Runtime test, Python `encodings` hatasi nedeniyle calistirilamadi.

## PATCH-006: OCRLine parsed_data yazimi JSON formatinda tekillestirildi
**Dosya:** `backend/app/routers/ocr_router.py`, `backend/app/routers/azure_router.py`, `backend/app/routers/aws_textract_router.py`, `backend/app/routers/google_vision_router.py`
**Neden:** `OCRLine.parsed_data` modelde `Text` alanı olmasına ragmen bazi router'lar dogrudan dict yaziyordu.
**Etki:** Tum aktif OCR router'lari `parsed_data` degerini `json.dumps(..., ensure_ascii=False)` ile kaydediyor. Okuma tarafi `_deserialize_parsed_data()` ile stabil hale geldi.
**Test:** `rg -n "parsed_data=parsed" backend/app/routers -g "*.py"` taramasi temizlendi.

## PATCH-007: Kanonik XLSX export pipeline aktif akisa alindi
**Dosya:** `backend/app/services/export.py`, `backend/app/services/optiplanning_service.py`, `backend/app/routers/orders_router.py`, `docs/ARCHITECTURE_DECISIONS.md`
**Neden:** Siparis export'u birden fazla yerde farkli XLSX semalari ve validation kurallariyla uretiliyordu.
**Etki:** `generate_xlsx_for_job()` kanonik uretici oldu. `orders_router` ve `OptiPlanningService.export_order()` bu fonksiyona yonlendirildi; her grup cikisi `ExportValidator.validate()` kontrolunden geciyor ve dosya adlari `FilenameGenerator` ile uretiliyor.
**Test:** Statik cagrı zinciri `rg -n "generate_xlsx_for_job" backend/app -g "*.py"` ile dogrulandi. Runtime `pytest` calistirilamadi.
