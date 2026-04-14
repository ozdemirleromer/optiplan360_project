# Klasor Yonetimi - Uygulama Ozet ve Kurallar

## 1) Yapilan Islemler

- `ConfigPage` klasor yonetimi bolumu liste formatina cevrildi.
- Her klasor satiri icin secim (tik/checkbox) alani eklendi.
- `Program Kok Klasoru` alani backend kontrati ile kalici hale getirildi.
- `Secili Satirlara Onerilen Yollari Uygula` aksiyonu eklendi.
- `Varsayilana Don` aksiyonu eklendi (varsayilan: `C:/Optiplan360_Entegrasyon`).
- `Onerilenleri Onizle` aksiyonu eklendi (secili satirlar icin onizleme listesi).
- Backend tarafinda `program_kok_klasoru` alaninin GET/PUT akisi tamamlandi.
- Path config servisinde JSON tabanli kalicilik eklendi (`backend/config/path_config_store.json`).

## 2) Su Anki Davranis

- Kullanici `Program Kok Klasoru` degerini girer veya `Varsayilana Don` ile otomatik doldurur.
- Satir bazli secim yapar (hangi alanlara otomatik yol uygulanacaksa).
- `Onerilenleri Onizle` ile secili satirlara yazilacak yollari gorur.
- `Secili Satirlara Onerilen Yollari Uygula` ile secili satirlar otomatik doldurulur.
- `Kaydet` ile tum ayarlar backend uzerinden kalici kaydedilir.

## 3) Bundan Sonra Yapilacaklar (Onerilen Siralama)

1. Kisa smoke test:
   - `/api/v1/optiplan-workflow/folder-settings` GET/PUT round-trip kontrolu.
2. Ortam dogrulamasi:
   - Uretim/saha makinelerinde `Program Kok Klasoru` degerinin gercek klasor agaciyla uyumu.
3. Operasyonel guvenlik:
   - Kayit sirasinda klasor varlik kontrolunun (opsiyonel) servis katmaninda devreye alinmasi.
4. Dokumantasyon:
   - Admin kullanim adimlarinin ana teknik dokumanlara eklenmesi.

## 4) Uygulama Kurallari

### 4.1 Genel
- Minimum gerekli degisiklik prensibi: Ilgili olmayan dosyalara mudahale edilmez.
- Router katmani yalnizca HTTP in/out yapar; is mantigi service katmaninda kalir.
- Frontend tarafinda backend cevabi dogrudan kullanilmaz, tip map/normalize uygulanir.

### 4.2 Klasor Yolu Kurallari
- Tum klasor alanlari bos birakilamaz.
- Gecerli mutlak yol zorunludur.
- Ayni yol birden fazla klasor alaninda kullanilamaz.
- Path formati normalize edilerek duplicate kontrolu yapilir.

### 4.3 Kalicilik
- `program_kok_klasoru` backend kontratinda resmi alandir.
- Config degerleri `path_config_service` uzerinden dosyaya yazilarak restart sonrasi korunur.

### 4.4 Test ve Dogrulama
- Frontend degisikliklerinde ilgili hedef testler calistirilir.
- Script scope dogru secilir (`frontend` package test komutlari kullanilir).
- Hata varsa once type/compile, sonra davranis testleriyle kapanis yapilir.

## 5) Degisen Ana Dosyalar

- `frontend/src/features/Admin/ConfigPage.tsx`
- `frontend/src/services/optiplanWorkflowService.ts`
- `frontend/src/features/Admin/ConfigPage.test.tsx`
- `backend/app/features/optiplan_workflow/transport/http/router.py`
- `backend/app/services/optiplan_workflow_service.py`
- `backend/app/services/path_config_service.py`

## 6) Not

Bu dosya, klasor yonetimi akisinda yapilan son entegrasyonlarin operasyonel ozetidir. Ayrintili governance ve phase kararlarinda `docs/governance-pack` altindaki canonical dokumanlar esas alinmalidir.

## 7) Son Uygulama Durumu (2026-03-22)

- UI store test beklentileri guncel tema kontratina (`light | dark`) uyumlu hale getirildi.
- Hedefli test dogrulamasi gecildi:
   - `src/stores/__tests__/uiStore.test.ts`
   - `src/features/OptiPlanWorkflow/SiparisKontrolPage.test.tsx`
- Tam frontend CI dogrulamasi gecildi:
   - 59 test dosyasi, 400 test, tamamı basarili.
- Not: Workspace task listesinde gorunen `test:admin:release-gate` ve `test:workflow-contract-gates` root `package.json` scriptleri projede tanimli degil; bu nedenle uygulanabilir resmi dogrulama olarak frontend CI suiti kullanildi.
