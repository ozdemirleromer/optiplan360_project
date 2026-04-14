# Test, Smoke, UAT ve Regression Paketi

Tarih: 2026-03-14
Durum: `Hazir`

## 1. Teknik Kanit

Calistirilan komutlar ve sonuc:

| Komut | Sonuc |
|---|---|
| `.\.venv313\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider` | `581 passed, 3 skipped` |
| `npm --prefix frontend run -s build` | `passed` |
| `npm --prefix frontend run -s test:ci -- src/features/Orders/__tests__/UnifiedWorkspace.test.tsx` | `11 passed` |
| `npm --prefix frontend exec vitest run src/features/CRM/TeklifFisiPage.test.tsx` | `8 passed` |
| `.\.venv313\Scripts\python.exe -m pytest backend/tests/test_mikro_service_health.py backend/tests/test_mikro_sync_service.py backend/tests/test_mikro_sql_client.py backend/tests/test_integration_outbox_processing.py backend/tests/test_mikro_sync_idempotency.py -q -p no:cacheprovider` | `72 passed` |

## 2. Minimum Release Smoke Paketi

1. OCR manual import -> satir olusumu
2. Watch folder scan -> satir olusumu
3. OCR kontrol -> remove / restore / audit
4. Phase 2 approve -> dusuk confidence blokaji
5. Phase 3 -> export preview
6. Export -> XLSX artifact
7. Mikro health -> read-only / config durumu
8. Teklif Fisi temel UI smoke

## 3. Negatif Senaryo Seti

- Duplicate belge
- OCR satiri olusmayan girdi
- `%80` alti hucrede operator onayi olmadan approve
- Remove/restore sonrasi kaydi tekrar okuma
- Mikro config eksik
- Mikro read-only push denemesi
- Phase 4 zorunlu alan eksigi

## 4. UAT Kabul Kriterleri

| Modül | Kabul | Red | Launch blocker |
|---|---|---|---|
| OCR intake | Kayit olusur, satirlar gelir, audit izi vardir | Bos kayit / audit yok | Evet |
| OCR kontrol | Remove/restore kalici okunur | Session-local davranis | Evet |
| Siparis duzenleme | `cari_kodu`, `stok_kodu`, `termin` gate calisir | Gate bypass | Evet |
| Export | Preview ve XLSX artifact uretir | Eksik artifact | Evet |
| Mikro health | Config/health gercek sonucu verir | Sahte health veya config belirsiz | Evet |
| Teklif yuzeyi | Temel UI acilir, create payload olusur | Sayfa acilmaz | Hayir, scope'a bagli |

## 5. Regression Cekirdek Listesi

- `backend/tests/test_optiplan_workflow_service.py`
- `backend/tests/test_optiplan_workflow_integration.py`
- `backend/tests/test_ocr_stats_contract.py`
- `backend/tests/test_ocr_summary_router.py`
- `backend/tests/test_mikro_service_health.py`
- `backend/tests/test_mikro_sync_service.py`
- `backend/tests/test_mikro_sql_client.py`
- `frontend/src/features/Orders/__tests__/UnifiedWorkspace.test.tsx`
- `frontend/src/features/CRM/TeklifFisiPage.test.tsx`

## 6. Kapanis Kriteri

Bu paket kapali sayilmaz, eger:
- Komutlar son kez release adayinda tekrar kosulmadiysa
- Smoke sonuclari kayda gecmediyse
- UAT owner imzasi alinmadiysa
