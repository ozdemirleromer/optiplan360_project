# Release Gate Sonuc Raporu

Tarih: 2026-03-14

## Nihai Karar

- `Build Green`
- Backend test koleksiyonu: `581 passed, 3 skipped`
- Frontend production build: `passed`

## Kapatilan Durdurucular

1. `Gemini optional dependency` import zinciri
   - `backend/app/services/gemini_service.py`
   - `google-genai` yüklü degilse ana uygulama artik import asamasinda dusmuyor.

2. Eski test kontratlari
   - `backend/tests/test_finance_service.py`
   - Odeme testleri guncel API davranisiyla hizalandi:
     - `NOT_FOUND -> 404`
     - `VALIDATION_ERROR -> 422`
     - fatura toplam hesaplama beklentisi duzeltildi

3. Cakisan frontend wrapper testleri
   - `backend/tests/test_hybrid_partitioning_contract.py`
   - Legacy wrapper listesindeki stale beklentiler temizlendi.

4. OCR summary/stats contract
   - `backend/app/features/ocr/transport/http/router.py`
   - `backend/app/features/azure/transport/http/router.py`
   - `backend/app/features/google_vision/transport/http/router.py`
   - `backend/app/features/aws_textract/transport/http/router.py`
   - `frontend/src/services/adminService.ts`
   - `frontend/src/features/Integrations/OCRStatsPage.tsx`
   - Sahte fallback KPI degerleri kaldirildi.
   - Provider telemetry olmayan alanlar artik tahmini sayi yerine `null` donuyor.
   - OCR summary tek yonetim paneli contract'ina cekildi.

5. Frontend build blocker
   - `frontend/src/features/Stock/StockCardComponent.tsx`
   - `<Button>` / `</button>` JSX uyumsuzlugu giderildi.

6. Siparis update response kontrati
   - `backend/app/services/order_service.py`
   - `crm_account_id` artik update response payload'inda geri donuyor.

7. OCR -> workflow baglayicisi
   - `backend/app/services/optiplan_workflow_service.py`
   - `manual import` ve `watch folder scan` sonrasinda OCR satirlari artik workflow kaydina otomatik yaziliyor.
   - Gecerli belge bytes'i varsa kayit bos Phase 1 kaydi olarak kalmiyor; `PHASE_2_OCR_KONTROL` durumuna geciyor.
   - OCR metadata, satir confidence alanlari ve kalici audit zinciri olusuyor.

8. Remove/restore + kalici audit HTTP kaniti
   - `backend/tests/test_optiplan_workflow_integration.py`
   - Remove/restore akislarinin HTTP uzerinden kalici backend kaydina yazildigi ve tekrar okunabildigi dogrulandi.

## Test Kaniti

Calistirilan ana komutlar:

```powershell
.\.venv313\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider
npm --prefix frontend run -s build
```

Ek contract testleri:

```powershell
.\.venv313\Scripts\python.exe -m pytest backend/tests/test_ocr_stats_contract.py -q -p no:cacheprovider
.\.venv313\Scripts\python.exe -m pytest backend/tests/test_ocr_summary_router.py -q -p no:cacheprovider
.\.venv313\Scripts\python.exe -m pytest backend/tests/test_optiplan_workflow_service.py -q -p no:cacheprovider
.\.venv313\Scripts\python.exe -m pytest backend/tests/test_optiplan_workflow_integration.py -q -p no:cacheprovider
```

## Bilincli Olarak Acik Birakilan Alan

- Azure / Google / AWS provider bazli islem sayaci ve basari metriği
  - Su an veri modeli provider bazli gercek telemetry tutmuyor.
  - Bu yuzden yonetim paneline sahte sayi yazilmadi.
  - Ekranda bu alanlar `null / —` olarak gosterilecek.

## Sonraki Kritik Adim

- `Kapsam / OCR provider matrisi` icin tek governance gate
- `Kanonik workflow` dokumaninin yazili dondurulmasi
- `Zorunlu ticari alan + belge sahipligi` matrisinin imzali kapanisi
