# OPTIPLAN360 EVRENSEL TEK DOSYA PROTOKOLU
Durum: LOCKED
Versiyon: 1.0
Tarih: 2026-02-24
Kapsam: Codex, Claude, Gemini ve diger tum AI kodlama ajanlari icin tek kaynak calisma sozlesmesi.

## 0) Kullanim Sozlesmesi
1. Bu dosya, OptiPlan360 icin AI destekli gelistirmede tek operasyonel prompt/dokumandir.
2. Dogaclama yasaktir.
3. Eger bir gereksinim bu dosyada acik degilse ajan:
   - durur,
   - gorevi BLOCKED olarak isaretler,
   - tek ve net bir aciklama sorusu sorar.
4. Bu dosya ile baska bir dokuman celisirse, bu dosya gecerlidir.
5. Tum kod yenilemeleri/degisiklikleri 9. bolumdeki surece uymak zorundadir.

## 1) Urun Kimligi
OptiPlan360 bir uretim planlama ve orkestrasyon ekosistemidir:
- Frontend UI (React 18 + Vite)
- Backend API (FastAPI)
- Opsiyonel bagimsiz Orchestrator servisi (Node.js + Express + SQLite)
- OptiPlanning entegrasyonu (Biesse EXE)
- XML drop/ACK modeli ile CNC teslim akisi
- ERP/CRM entegrasyon akisleri (Mikro ve ilgili moduller)

## 2) Calisma Topolojisi (Guncel Baseline)
- Frontend: http://127.0.0.1:3001
- Backend API: http://127.0.0.1:8080
- Backend docs: http://127.0.0.1:8080/docs
- Backend health: http://127.0.0.1:8080/health
- Opsiyonel bagimsiz Orchestrator API: http://127.0.0.1:8090

Docker baseline (guncel compose):
- `optiplan360-db` (PostgreSQL 16)
- `optiplan360-backend` (FastAPI)
- `optiplan360-frontend` (build alinmis frontend'i sunan Nginx)

Kritik not:
- Mevcut docker-compose varsayilan olarak `apps/orchestrator` servisini calistirmaz.

## 3) Davranisi Tanimlayan Kaynak Dosyalar
Ajanlar su dosyalari uygulama capasi olarak kabul etmelidir:
- `config/paths.json`
- `config/rules.json`
- `backend/app/main.py`
- `backend/app/routers/v1/api.py`
- `backend/app/routers/orchestrator_router.py`
- `backend/app/services/orchestrator_service.py`
- `backend/app/services/xml_collector_service.py`
- `apps/orchestrator/src/index.ts`
- `apps/orchestrator/src/services/orchestratorService.ts`
- `apps/orchestrator/src/runtime/jobRunner.ts`
- `docs/STATE_MACHINE.md`
- `docs/API_CONTRACT.md`

## 4) Degismez Cekirdek Kurallar
1. Canonical orchestrator state machine:
   `NEW -> PREPARED -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE`
   Ek durumlar: `HOLD`, `FAILED`.
2. CRM gate zorunludur:
   - musteri eslesmesi yoksa => `E_CRM_NO_MATCH` ile HOLD.
3. Plaka olcusu zorunludur:
   - payload'da yok ve default yoksa => `E_PLATE_SIZE_MISSING` ile HOLD.
4. Arkalik (`ARKALIK`) bant politikasi:
   - edge alanlari null/bos olmalidir.
   - gelen arkalik edge degerleri bos degilse sifirlanir ve audit'e yazilir.
5. Kalinlik/trim politikasi:
   - 18mm => trim 10.0
   - 3/4/5/8mm => trim 5.0
6. Grain mapping sabittir:
   - sadece 0, 1, 2, 3.
7. Batch ayirma politikasi:
   - cikti batch'leri `part_type + color + thickness` bazinda ayrilir.
8. Merge politikasi:
   - varsayilan kapali, acik operator onayi gerektirir.
9. ACK modu sabittir:
   - `file_move`
   - machine drop altinda zorunlu klasorler: `inbox/`, `processed/`, `failed/`
   - `processed` basari, `failed` hata yoludur.

## 5) Template ve Export Kurallari
1. Template kaynak dosyasi:
   - `templates/Excel_sablon.xlsx`
2. Template yazimdan once dogrulanmalidir:
   - sheet adi template baseline ile eslesmelidir.
   - ilk satir tag'leri tam ve sirali olmalidir.
3. Zorunlu tag listesi (tam sira):
   - `[P_CODE_MAT]`
   - `[P_LENGTH]`
   - `[P_WIDTH]`
   - `[P_MINQ]`
   - `[P_GRAIN]`
   - `[P_IDESC]`
   - `[P_EDGE_MAT_UP]`
   - `[P_EGDE_MAT_LO]`  (template'deki yazim bilerek bu sekildedir)
   - `[P_EDGE_MAT_SX]`
   - `[P_EDGE_MAT_DX]`
   - `[P_IIDESC]`
   - `[P_DESC1]`
4. Tum dosya yazimlari atomik olmalidir:
   - `*.tmp` yazilir, sonra final ada rename edilir.

## 6) Path ve Config Sozlesmesi
`config/paths.json` zorunlu anahtarlar:
- `optiplanningExePath`
- `optiplanningImportFolder`
- `optiplanningExportFolder`
- `optiplanningRulesFolder`
- `machineDropFolder`
- `tempFolder`
- `xlsxTemplatePath`

`config/rules.json` zorunlu anahtarlar:
- `cm_to_mm_multiplier`
- `trimByThickness`
- `backingThicknesses`
- `edgeMapping`
- `grainMapping`
- `mergePolicy`
- `defaultPlateSize` (yoksa strict HOLD politikasi uygulanir)
- `retry_count_max`
- `retry_backoff_minutes`
- `optiModeDefault`
- `timeouts`
- `ackMode`

## 7) API Sozlesmesi (Drift Yasak)
Backend canonical base:
- `/api/v1/...`

Backend orchestrator bridge endpointleri:
- `POST /api/v1/orchestrator/jobs`
- `GET /api/v1/orchestrator/jobs`
- `GET /api/v1/orchestrator/jobs/{job_id}`
- `POST /api/v1/orchestrator/jobs/{job_id}/retry`
- `POST /api/v1/orchestrator/jobs/{job_id}/approve`
- `POST /api/v1/orchestrator/jobs/{job_id}/sync`
- `POST /api/v1/orchestrator/jobs/{job_id}/cancel`
- `GET /api/v1/orchestrator/jobs/{job_id}/xml`

Sistem saglik endpointi:
- `GET /health` calisir kalmalidir.

## 8) Sifir Dogaclama Politikasi
Ajanlar sunlari YAPAMAZ:
1. Is kurallarini sessizce degistirmek.
2. State, error code veya API path adlarini acik talep olmadan degistirmek.
3. HOLD/FAILED guvenlik kapilarini bypass etmek.
4. Kod degisikligi sonrasi validasyon ve testleri atlamak.
5. Canonical davranis yerine tahmini davranis uygulamak.

## 9) Zorunlu Degisiklik Is Akisi (Tum AI Ajanlari)
Her gorevde su akis aynen uygulanir:
1. Analiz
   - once bu dosya okunur,
   - sadece ilgili moduller incelenir,
   - istenen degisiklik etkilenen bilesenlere map edilir.
2. Uygulama
   - minimum ve kapsamli edit,
   - mevcut mimari ve isim sozlesmeleri korunur,
   - kullanici acikca istemedikce geriye donuk uyumluluk bozulmaz.
3. Dogrulama
   - hedefli test/komutlar calistirilir,
   - degisen endpoint veya UI davranisi teyit edilir.
4. Raporlama
   - degisen dosyalar listelenir,
   - davranis degisikligi ozetlenir,
   - dogrulama sonucu yazilir,
   - varsa kalan riskler belirtilir.
5. Bu dosyayi senkron tutma
   - mimari/kurallar/sozlesme degisti ise ayni gorevde bu dosya guncellenir.

## 10) Done Tanimi
Bir gorev su kosullar saglanmadan tamamlanmis sayilmaz:
1. Istenen davranis uygulandi.
2. Kilitli kurallardan hicbiri ihlal edilmedi.
3. Dogrulama kaniti var.
4. Dokuman ve kod birbiriyle tutarli.

## 11) Ajan Cikti Formati (Zorunlu)
Gorev sonunda AI su sirayla rapor verir:
1. Ne degisti
2. Degisen dosyalar
3. Dogrulama sonuclari
4. Riskler/acik noktalar
5. Sonraki en iyi adim (opsiyonel)

## 11.1) Ortak Kayit Zorunlulugu (Tum AI'lar)
Her gorev sonunda tum AI ajanlari su iki dosyayi kullanmak zorundadir:
1. `docs/multi-agent/AI_SHARED_LOG_TEMPLATE.md`
2. `docs/multi-agent/AI_SHARED_EXECUTION_LOG.md`

Kural:
1. Her gorev icin `AI_SHARED_LOG_TEMPLATE.md` formatinda yeni bir blok yazilir.
2. Bu blok `AI_SHARED_EXECUTION_LOG.md` dosyasina eklenir.
3. `AI_SHARED_EXECUTION_LOG.md` disinda da daginik "status" dosyasi tutulabilir; ancak resmi gorunurluk kaynagi bu log dosyasidir.
4. Bir gorevin durumu degisirse (IN_PROGRESS -> DONE gibi), ayni `Kayit ID` ile yeni "Update" satiri eklenir.

## 12) Hizli Baslangic Komutlari
Docker:
- `docker compose up -d --build`
- `docker compose ps`

Backend local:
- `cd backend`
- `.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8080`

Frontend local:
- `cd frontend`
- `npm run dev -- --host 127.0.0.1 --strictPort --port 3001`

Bagimsiz orchestrator local (opsiyonel):
- `cd apps/orchestrator`
- `npm run dev`

## 13) Nihai Kilit Beyani
Bu dokuman, OptiPlan360 icin AI ajanlarinin aktif ve tek kaynakli calisma sozlesmesidir.
Hicbir ajan bu sozlesmenin disinda dogaclama yapamaz.
