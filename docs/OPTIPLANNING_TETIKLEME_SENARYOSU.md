# OPTIPLAN360 - OptiPlanning Tetikleme Senaryosu

Dokuman versiyonu: `v1.0`  
Hazirlanma tarihi: `2026-02-25`  
Hedef kitle: `Backend`, `Frontend`, `DevOps`, `QA`, `Operasyon`

## 1. Amac ve Kapsam

Bu dokuman, OptiPlanning tetikleme akisinin calisan senaryosunu uctan uca tanimlar:

1. UI uzerinden "Optimizasyona Gonder" butonu ile job tetikleme.
2. Job'un backend state machine uzerinden ilerlemesi.
3. Worker ve XML collector adimlari.
4. Kural bazli sirali dosya isleme (EXCEL_TEST_1 pattern).
5. Operasyonel kontrol, hata kodlari ve test proseduru.

Kapsam disi:

1. OptiPlanning lisans/HASP detaylari.
2. Mikro ERP veya diger entegrasyonlarin is kurallari.
3. Fiziksel makine tarafi vendor konfig detaylari.

## 2. Dogrulanan Mevcut Durum (2026-02-25)

Calisma ortami kontrolu:

1. `docker compose ps`:
   - `optiplan360-backend`: `healthy`
   - `optiplan360-frontend`: `healthy`
   - `optiplan360-db`: `healthy`
2. HTTP erisim:
   - `http://127.0.0.1:3001/` -> `200`
   - `http://127.0.0.1:8080/health` -> `200`
3. API davranisi:
   - `http://127.0.0.1:3001/api/v1/orders` -> `401` (auth gerektigi icin beklenen sonuc)

## 3. Mimari Ozeti

Ana bilesenler:

1. Frontend:
   - `frontend/src/components/Orders/OrderEditor/index.tsx`
   - `frontend/src/services/orchestratorService.ts`
2. Backend API:
   - `backend/app/routers/orchestrator_router.py`
   - `backend/app/routers/optiplanning_router.py`
3. Core servisler:
   - `backend/app/services/orchestrator_service.py`
   - `backend/app/services/optiplan_worker_service.py`
   - `backend/app/services/optiplanning_service.py`
   - `backend/app/services/xml_collector_service.py`
4. Sirali dosya tetikleyici:
   - `backend/scripts/optiplan_ordered_inbox_runner.py`
5. CSV queue motoru:
   - `backend/app/services/optiplan_csv_otomasyon.py`

## 4. Senaryo A - UI Butonu ile Optimizasyon Tetikleme (Calisan Ana Akis)

### 4.1 Tetikleme noktasi

Kullanici `OrderEditor` ekraninda `Optimizasyona Gonder` butonuna basar.

Referanslar:

1. `handleOptimize`: `frontend/src/components/Orders/OrderEditor/index.tsx`
2. `createJob`: `frontend/src/services/orchestratorService.ts`

### 4.2 Akis adimlari

1. Frontend validasyon yapar (`runValidation`).
2. Siparis kaydedilir:
   - Header: `POST /api/v1/orders` veya `PUT /api/v1/orders/{id}`
   - Partlar: `PUT /api/v1/orders/{id}/parts`
3. Frontend job olusturur:
   - `POST /api/v1/orchestrator/jobs`
4. Backend `OrchestratorService.create_job()` ile job kaydeder (`state=NEW`).
5. Dis orchestrator erisilemezse local fallback devreye girer:
   - CRM eslesme kontrolu
   - Plaka ebat kontrolu
   - Part/kalinlik/trim kontrolu
6. Kontroller gecerse job `OPTI_IMPORTED` olur.
7. Worker `poll_and_run_once()` job'i claim eder, `OPTI_RUNNING` yapar.
8. Worker XLSX uretir (`OPTIPLAN_IMPORT_DIR`) ve professional scripti calistirir.
9. Basariliysa `OPTI_DONE`, hata varsa `FAILED`, ortam uyumsuzsa `HOLD`.
10. XML Collector export klasorunden XML alir:
    - `XML_READY` -> `DELIVERED` -> `DONE`

### 4.3 API endpointleri

Orchestrator Router:

1. `POST /api/v1/orchestrator/jobs`
2. `GET /api/v1/orchestrator/jobs`
3. `GET /api/v1/orchestrator/jobs/{job_id}`
4. `POST /api/v1/orchestrator/jobs/{job_id}/retry`
5. `POST /api/v1/orchestrator/jobs/{job_id}/approve`
6. `POST /api/v1/orchestrator/jobs/{job_id}/sync`
7. `POST /api/v1/orchestrator/jobs/{job_id}/cancel`
8. `GET /api/v1/orchestrator/jobs/worker/status`
9. `POST /api/v1/orchestrator/jobs/worker/reset`
10. `GET /api/v1/orchestrator/jobs/{job_id}/xml`

Optiplanning Router:

1. `POST /api/v1/optiplanning/optimization/run`

## 5. Senaryo B - Kural Bazli Sirali Dosya Isleme (EXCEL_TEST_1)

### 5.1 Kural dosyasi

Varsayilan referans:

`C:\Optiplan360_Entegrasyon\OPTIPLAN\1_GELEN_SIPARISLER\EXCEL_TEST_1.xlsx`

Bu dosyanin adi pattern baseline olarak kullanilir. Ayni patterndeki dosyalar (orn. `EXCEL_TEST_2.xlsx`, `EXCEL_TEST_3.xlsx`) sirayla islenir.

### 5.2 Klasor akisi

1. Gelen: `1_GELEN_SIPARISLER`
2. Isleniyor: `0_ISLENIYOR`
3. Basarili: `2_ISLENEN_SIPARISLER`
4. Hatali: `3_HATALI_VERILER`

### 5.3 Isleme mantigi

1. Uygun dosyalar pattern ile bulunur.
2. Dosya stabilite kontrolu yapilir.
3. Dosya `0_ISLENIYOR` altina claim edilir.
4. Professional run tetiklenir.
5. Return code `0` ise processed, degilse failed klasorune tasinir.
6. Her tur sonunda summary json olusturulur.

## 6. Veri Sozlesmeleri

### 6.1 Frontend -> Orchestrator createJob payload (ozet)

```json
{
  "order_id": 123,
  "customer_phone": "5XXXXXXXXX",
  "customer_snapshot_name": "MUSTERI",
  "opti_mode": "C",
  "plate_width_mm": 2100,
  "plate_height_mm": 2800,
  "parts": [
    {
      "id": "1",
      "part_type": "GOVDE",
      "material_code": "MDF_18",
      "length_cm": 72.0,
      "width_cm": 45.0,
      "quantity": 2,
      "grain": 1,
      "color": "BEYAZ",
      "thickness_mm": 18
    }
  ]
}
```

### 6.2 CSV queue format (12 kolon, `;` delimiter)

`CSV_ROW1`:

```text
[P_CODE_MAT];[P_LENGTH];[P_WIDTH];[P_MINQ];[P_GRAIN];[P_IDESC];[P_EDGE_MAT_UP];[P_EGDE_MAT_LO];[P_EDGE_MAT_SX];[P_EDGE_MAT_DX];[P_IIDESC];[P_DESC1]
```

`CSV_ROW2`:

```text
Material;Length;Width;Min Q.;GrainI;Description;Upper strip mat.;Lower strip mat.;Left strip mat.;Right strip mat.;II Description;Description 1
```

Ornek satir:

```text
18MM_210*280;720;450;2;1;YAN_PANEL;1;1;;;P001;DELIK_A
```

## 7. State Machine ve Sorumluluklar

| State | Ureten servis | Tetikleyen olay | Not |
|---|---|---|---|
| `NEW` | `orchestrator_service` | Job olusturma | Baslangic |
| `OPTI_IMPORTED` | `orchestrator_service` | Local gate kontrolleri gecildi | Worker kuyruğu |
| `OPTI_RUNNING` | `optiplan_worker_service` | Claim basarili | Tek running is kurali |
| `OPTI_DONE` | `optiplan_worker_service` | Professional run basarili | XML beklenir |
| `XML_READY` | `xml_collector_service` | Gecerli XML bulundu | Parse edildi |
| `DELIVERED` | `xml_collector_service` | XML inbox'a kopyalandi | ACK beklenir |
| `DONE` | `xml_collector_service` | `processed/` ack bulundu | Terminal success |
| `HOLD` | `orchestrator_service` / `worker` | Gate fail veya env unsupported | Manuel aksiyon |
| `FAILED` | `worker` / `xml_collector` / `orchestrator_service` | Islem hatasi/timeout | Retry kosullari gecerli ise yeniden denenebilir |

## 8. Kritik Environment Degiskenleri

1. `ORCH_BASE_URL` (varsayilan: `http://localhost:3001`)
2. `OPTIPLAN_IMPORT_DIR` (worker XLSX hedefi)
3. `OPTIPLAN_EXPORT_DIR` (OptiPlanning XML output klasoru)
4. `MACHINE_DROP_DIR` (inbox/processed/failed koku)
5. `OPTIPLAN_EXE_PATH`
6. `OPTIPLAN_PROFESSIONAL_SCRIPT`
7. `OPTIPLAN_WORKER_TIMEOUT_S` (varsayilan: `180`)
8. `XML_COLLECT_TIMEOUT_S` (varsayilan: `1200`)
9. `MACHINE_ACK_TIMEOUT_S` (varsayilan: `300`)

## 9. Hata Kodlari ve Operasyon Aksiyonlari

| Kod | Kaynak | Anlam | Operasyon aksiyonu |
|---|---|---|---|
| `E_CRM_NO_MATCH` | orchestrator | CRM musteri eslesmedi | Musteri kaydi/acik telefon normalizasyonu |
| `E_PLATE_SIZE_MISSING` | orchestrator | Plaka ebat yok | Sipariste plate boyutunu doldur |
| `E_NO_PARTS` | orchestrator | Part listesi bos | Siparise part ekle |
| `E_BACKING_THICKNESS_UNKNOWN` | orchestrator | Arkalik kalinlik kural disi | Destekli kalinlik setine cek |
| `E_TRIM_RULE_MISSING` | orchestrator | Trim mapping yok | `TRIM_BY_THICKNESS` guncelle |
| `E_LOCAL_PROCESSING` | orchestrator | Local processing exception | Log incele, payload kontrol et |
| `E_WORKER_ENV_UNSUPPORTED` | worker | Calisma ortami uygun degil | Windows/pywinauto/script kontrolu |
| `E_OPTI_WORKER_FAILED` | worker | Professional run fail | Script log ve OptiPlanning UI kontrolu |
| `E_OPTI_XML_TIMEOUT` | xml collector | XML zamaninda gelmedi | OptiPlanning cikti klasoru kontrolu |
| `E_XML_INVALID` | xml collector | XML parse/icerik gecersiz | XML format ve encoding kontrolu |
| `E_OSI_ACK_FAILED` | xml collector | Makine `failed/` ack | Makine tarafi hata inceleme |
| `E_OSI_ACK_TIMEOUT` | xml collector | `processed/` ack timeout | Makine aktarim/okuma zinciri kontrolu |
| `E_CANCELLED` | orchestrator | Kullanici iptal etti | Beklenen durum |

## 10. Operasyonel Test Proseduru (Yazilim Ekibi)

### 10.1 Once altyapi

1. `docker compose ps` ile 3 servis `healthy` olmali.
2. `http://127.0.0.1:3001/` -> `200`.
3. `http://127.0.0.1:8080/health` -> `200`.

### 10.2 UI smoke test

1. OrderEditor ac.
2. Gecerli siparis bilgisi + en az 1 part gir.
3. `Optimizasyona Gonder` butonuna bas.
4. Job id popup geldiyini dogrula.
5. `GET /api/v1/orchestrator/jobs/{job_id}` ile state akisini izle.
6. Beklenen state progression:
   - `NEW -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE`

### 10.3 Ordered inbox smoke test

1. `EXCEL_TEST_1.xlsx`, `EXCEL_TEST_2.xlsx` dosyalarini `1_GELEN_SIPARISLER` klasorune koy.
2. Runner calistir:
   - `py backend/scripts/optiplan_ordered_inbox_runner.py --once`
3. Beklenen:
   - Dosya once `0_ISLENIYOR`, sonra sonucuna gore `2_ISLENEN_SIPARISLER` veya `3_HATALI_VERILER`.
4. `logs/optiplan_queue/ordered_inbox_summary_*.json` dogrula.

## 11. Gozlenebilirlik ve Log Noktalari

Log kaynaklari:

1. Backend app loglari (`optiplan_worker_service`, `xml_collector_service`, `orchestrator_service`)
2. Queue runner loglari (`logs/optiplan_queue/*.log`, `*.json`)
3. Docker loglari:
   - `docker compose logs --tail 200 optiplan360-backend`
   - `docker compose logs --tail 200 optiplan360-frontend`

## 12. Retry / Approve / Cancel Kurallari

1. Retry sadece `FAILED` veya `HOLD` state'te.
2. Kalici hata kodlarinda retry engelli (`E_TEMPLATE_INVALID`, `E_CRM_NO_MATCH`, `E_PLATE_SIZE_MISSING`, `E_XML_INVALID`).
3. Approve sadece `HOLD` icin.
4. Cancel terminal olmayan state'lerde `FAILED + E_CANCELLED` yapar.

## 13. Gelistirme Notlari

1. `OptiPlanning` endpoint zincirinde auth zorunludur; hosttan token'siz testte `401` beklenen davranistir.
2. `/api/health` endpointinin olmamasi normaldir; dogru backend health endpointi `/health`tir.
3. CSV kuralinda `[P_EGDE_MAT_LO]` yazimi template uyumlulugu nedeniyle bilincli olarak korunmustur.

## 14. Sonuc

Bu dokumandaki iki ana akis (`UI tetikleme` ve `EXCEL_TEST_1 pattern sirali isleme`) mevcut kod tabaninda uygulanmis ve calisan senaryo olarak tanimlanmistir.  
Yazilim ekibi bu dokumani referans alip:

1. Entegrasyon testlerini standardize edebilir.
2. Hata kodu bazli operasyon aksiyonlarini hizlandirabilir.
3. Production readiness checklist'i netlestirebilir.

## 15. Yetkilendirme ve Erisim Modeli

### 15.1 Endpoint bazli auth kontrolu

1. `/api/v1/orchestrator/*` endpointleri:
   - `require_permissions(Permission.ORCHESTRATOR_VIEW/MANAGE)` ile korunur.
2. `/api/v1/optiplanning/*` endpointleri:
   - `require_operator` ile korunur.
   - Sadece `ADMIN` ve `OPERATOR` erisebilir.

### 15.2 Role -> Permission ozet (orchestrator icin)

1. `ADMIN`:
   - `orchestrator:view`
   - `orchestrator:manage`
2. `OPERATOR`:
   - `orchestrator:view`
   - `orchestrator:manage`
3. `VIEWER`, `SALES`, `STATION`, `KIOSK`:
   - Orchestrator yonetim izinleri yok.

### 15.3 Kimlik dogrulama notu

1. Hosttan token'siz cagrilarin `401` donmesi beklenen davranistir.
2. Service-to-service akislarinda `X-Internal-Key` mekanizmasi bulunur (backend auth katmani).

## 16. Senaryo A (UI -> Orchestrator) Detayli Islem Akisi

### 16.1 Adim adim teknik akış

| Adim | Katman | Islem | Girdi | Cikti |
|---|---|---|---|---|
| 1 | Frontend | `handleOptimize` calisir | Form verisi | Local validasyon |
| 2 | Frontend | `saveOrderToDB` | Header + rows | `order_id` |
| 3 | Frontend | `orchestratorService.createJob` | `OptiJobCreate` payload | `job.id` |
| 4 | Backend | `create_job` | order + parts + plate + phone | `opti_jobs` kaydi (`NEW`) |
| 5 | Backend | Dis orchestrator denemesi | HTTP `/jobs` | Basariliysa sync, degilse local fallback |
| 6 | Backend | `_process_job_locally` | Siparis verisi | `OPTI_IMPORTED` veya `HOLD/FAILED` |
| 7 | Worker | `poll_and_run_once` | `OPTI_IMPORTED` job | `OPTI_RUNNING` |
| 8 | Worker | `_prepare_xlsx` | order_id | XLSX dosyasi (`OPTIPLAN_IMPORT_DIR`) |
| 9 | Worker | `optiplan_professional_run.py` | XLSX path | `OPTI_DONE` veya `FAILED/HOLD` |
| 10 | XML Collector | `collect_xml_once` | `Tmp/Sol` XML | `XML_READY -> DELIVERED -> DONE` |

### 16.2 Local gate kontrolleri (fallback yolunda zorunlu)

1. CRM gate:
   - Musteri kaydi yoksa `HOLD + E_CRM_NO_MATCH`
2. Plate size gate:
   - Sipariste plate yoksa ve `rules.json` default yoksa `HOLD + E_PLATE_SIZE_MISSING`
3. Parts gate:
   - Part yoksa `HOLD + E_NO_PARTS`
4. Arkalik thickness gate:
   - Destekli set disinda ise `HOLD + E_BACKING_THICKNESS_UNKNOWN`
5. Trim rule gate:
   - `TRIM_BY_THICKNESS` map yoksa `HOLD + E_TRIM_RULE_MISSING`

### 16.3 Worker davranisi

1. Isletim sistemi:
   - Varsayilan olarak Windows zorunlu (`pywinauto` bagimliligi).
2. Script:
   - `OPTIPLAN_PROFESSIONAL_SCRIPT` veya fallback path.
3. Timeout:
   - `OPTIPLAN_WORKER_TIMEOUT_S` (varsayilan `180s`).
4. Circuit breaker:
   - Ardisik hata limiti: `3`
   - Sonrasi worker stop (`circuit_open=true`) ve manuel reset gerekir.

### 16.4 XML Collector davranisi

1. XML tarama:
   - Kaynak: `OPTIPLAN_EXPORT_DIR` (varsayilan `C:\Biesse\OptiPlanning\Tmp\Sol`)
2. Machine drop:
   - `MACHINE_DROP_DIR` (varsayilan `C:\Biesse\OptiPlanning\Tx`)
   - Alt klasorler: `inbox`, `processed`, `failed`
3. Timeoutlar:
   - XML bekleme: `XML_COLLECT_TIMEOUT_S` (varsayilan `1200s`)
   - ACK bekleme: `MACHINE_ACK_TIMEOUT_S` (varsayilan `300s`)

## 17. Senaryo B (API `/optiplanning/optimization/run`) Detaylari

Bu akis orchestrator state machine'den ayridir. `optiplanning_jobs` tablosunu ve CSV queue motorunu kullanir.

### 17.1 Tetikleme

1. Endpoint: `POST /api/v1/optiplanning/optimization/run`
2. Auth: `require_operator` (`ADMIN`/`OPERATOR`)
3. Request modeli: `OptimizationJobRunRequest`

### 17.2 Islem adimlari

1. `OptimizationJob` olusturulur (`status=PENDING`, `format_type=CSV`).
2. `order_ids` loop edilir.
3. Her siparis icin `parca_listesi` map edilir.
4. `optiplan_csv_otomasyon(..., tetikle_optiplan=False)` ile dosya queue'ya yazilir.
5. `optiplan_kuyrugu_isle()` toplu calistirilir.
6. Sonuca gore job status:
   - `FAILED` (failed file varsa)
   - `COMPLETED_WITH_WARNINGS` (validation warning varsa)
   - `COMPLETED`

### 17.3 Bu akis ne zaman tercih edilir

1. Batch/coklu siparis tetikleme gerekiyorsa.
2. Orchestrator job state machine disinda, dosya queue odakli calisma isteniyorsa.

## 18. Senaryo C (Ordered Inbox Runner) Detaylari

### 18.1 Runner amaci

1. Belirli naming pattern'e uyan XLSX dosyalarini strict sira ile islemek.
2. Basari/hataya gore klasor ayirma ve raporlama.

### 18.2 Onemli CLI argumanlari

1. `--rule-file`
2. `--once`
3. `--poll-sec`
4. `--max-files`
5. `--stable-seconds`
6. `--timeout`
7. `--optimize-timeout`
8. `--skip-preflight`
9. `--skip-ui-map`
10. `--skip-optimize`
11. `--quick` (`skip-preflight + skip-ui-map`)
12. `--dry-run`
13. `--report-dir`

### 18.3 Calisan komut ornekleri

1. Tek tur:
   - `py backend/scripts/optiplan_ordered_inbox_runner.py --once`
2. Hizli mod:
   - `py backend/scripts/optiplan_ordered_inbox_runner.py --once --quick`
3. Dry run:
   - `py backend/scripts/optiplan_ordered_inbox_runner.py --once --dry-run`

## 19. API Sozlesmeleri (Detay)

### 19.1 `POST /api/v1/orchestrator/jobs` request

Alanlar:

1. `order_id` (int, zorunlu)
2. `customer_phone` (string, zorunlu)
3. `customer_snapshot_name` (string, opsiyonel)
4. `opti_mode` (string, `A|B|C`, default `C`)
5. `plate_width_mm` (float, opsiyonel)
6. `plate_height_mm` (float, opsiyonel)
7. `parts` (array, zorunlu)

`parts` elemani:

1. `id` (string)
2. `part_type` (string: `GOVDE|ARKALIK`)
3. `material_code` (string)
4. `length_cm` (float)
5. `width_cm` (float)
6. `quantity` (int)
7. `grain` (int: `0/1/2/3`)
8. `color` (string)
9. `thickness_mm` (float)
10. `edge_up`, `edge_lo`, `edge_sx`, `edge_dx`, `iidesc`, `desc1`, `delik_kodu` (opsiyonel)

### 19.2 `GET /api/v1/orchestrator/jobs/{job_id}` response ozet

1. `id`
2. `order_id`
3. `state`
4. `opti_mode`
5. `error_code`
6. `error_message`
7. `retry_count`
8. `created_at`
9. `updated_at`
10. `events[]`

### 19.3 `POST /api/v1/optiplanning/optimization/run` request

1. `order_ids` (List[int], zorunlu)
2. `params` (opsiyonel optimization params)
3. `config_name` (default `DEFAULT`)

### 19.4 cURL ornekleri

Orchestrator job create:

```bash
curl -X POST "http://127.0.0.1:8080/api/v1/orchestrator/jobs" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 123,
    "customer_phone": "5551234567",
    "opti_mode": "C",
    "parts": [
      {
        "id": "1",
        "part_type": "GOVDE",
        "material_code": "MDF_18",
        "length_cm": 72.0,
        "width_cm": 45.0,
        "quantity": 2,
        "grain": 1,
        "color": "BEYAZ",
        "thickness_mm": 18
      }
    ]
  }'
```

Job status:

```bash
curl -X GET "http://127.0.0.1:8080/api/v1/orchestrator/jobs/<JOB_ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

Worker status:

```bash
curl -X GET "http://127.0.0.1:8080/api/v1/orchestrator/jobs/worker/status" \
  -H "Authorization: Bearer <TOKEN>"
```

Queue optimization run:

```bash
curl -X POST "http://127.0.0.1:8080/api/v1/optiplanning/optimization/run" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"order_ids":[101,102,103],"config_name":"DEFAULT"}'
```

## 20. Veri Tabanı Tablolari (Akis Bazli)

### 20.1 Orchestrator tablolari

1. `opti_jobs`
   - Ana state machine kaydi.
2. `opti_audit_events`
   - State/event audit log.

### 20.2 Advanced optimization tablolari

1. `optiplanning_jobs`
2. `optiplanning_reports`
3. `optiplanning_machine_configs`

Not: `opti_jobs` ve `optiplanning_jobs` farkli akislarin tablolaridir, birbiri yerine kullanilmaz.

## 21. Audit Event Katalogu

Ana event tipleri:

1. `JOB_CREATED`
2. `STATE_CHANGE`
3. `STATE_HOLD`
4. `STATE_OPTI_IMPORTED`
5. `STATE_OPTI_RUNNING`
6. `STATE_OPTI_DONE`
7. `STATE_XML_READY`
8. `STATE_DELIVERED`
9. `STATE_DONE`
10. `STATE_FAILED`
11. `RETRY`
12. `APPROVE`
13. `CANCEL`
14. `STATE_SYNC`

## 22. Zamanlayici (Scheduler) Parametreleri

`backend/app/tasks/reminders.py`:

1. Worker calisma araligi:
   - Her `15s` (`id="optiplan_worker"`)
2. XML collector tarama araligi:
   - Her `30s` (`id="xml_collector"`)
3. Hatirlatma job:
   - Her `1 saat`

## 23. Path ve Dizin Matrisi

### 23.1 Docker expose edilen portlar

1. Frontend: `3001`
2. Backend: `8080`
3. PostgreSQL: `5432`

### 23.2 OptiPlanning path'leri (varsayilan)

1. `OPTIPLAN_IMPORT_DIR`:
   - `C:\Biesse\OptiPlanning\ImpFile`
2. `OPTIPLAN_EXPORT_DIR`:
   - `C:\Biesse\OptiPlanning\Tmp\Sol`
3. `MACHINE_DROP_DIR`:
   - `C:\Biesse\OptiPlanning\Tx`
4. `OPTIPLAN_EXE_PATH`:
   - `C:\Biesse\OptiPlanning\System\OptiPlanning.exe`

### 23.3 CSV queue klasorleri

1. Kok: `C:\Optiplan360_Entegrasyon`
2. Gelen: `1_GELEN_SIPARISLER`
3. Islenen: `2_ISLENEN_SIPARISLER`
4. Hatali: `3_HATALI_VERILER`
5. Lock: `.optiplan_queue.lock`

## 24. Queue Lock ve Paralellik Kurallari

1. CSV queue lock:
   - `OPTIPLAN_QUEUE_LOCK_WAIT_SEC` (default `180`)
   - `OPTIPLAN_QUEUE_LOCK_POLL_SEC` (default `0.2`)
2. Worker tek instance:
   - Scheduler `max_instances=1`
3. Running claim:
   - Kod yorumuna gore `OPTI_RUNNING` ayni anda tek is olacak sekilde tasarlanmistir.

## 25. Sorun Giderme (Debug Playbook)

### 25.1 Hizli kontrol komutlari

1. `docker compose ps`
2. `docker compose logs --tail 200 optiplan360-backend`
3. `docker compose logs --tail 200 optiplan360-frontend`
4. `curl http://127.0.0.1:8080/health`

### 25.2 SQL kontrol sorgulari

Son orchestrator joblar:

```sql
SELECT id, order_id, state, error_code, error_message, retry_count, created_at
FROM opti_jobs
ORDER BY created_at DESC
LIMIT 20;
```

Tek job eventleri:

```sql
SELECT id, job_id, event_type, message, created_at
FROM opti_audit_events
WHERE job_id = '<JOB_ID>'
ORDER BY id ASC;
```

Queue optimization joblari:

```sql
SELECT id, name, status, format_type, result_file_path, error_message, created_at, completed_at
FROM optiplanning_jobs
ORDER BY created_at DESC
LIMIT 20;
```

### 25.3 Tipik incident senaryolari

1. Job `HOLD`:
   - `error_code` kontrol et.
   - CRM/plate/part kurallarini dogrula.
2. Job `OPTI_RUNNING` takildi:
   - Worker status endpoint.
   - Script path, pywinauto, Windows ortam kontrolu.
3. Job `OPTI_DONE` ama `XML_READY` olmuyor:
   - `OPTIPLAN_EXPORT_DIR` klasorunde XML var mi.
   - `XML_COLLECT_TIMEOUT_S` asimi var mi.
4. `DELIVERED` -> `DONE` olmuyor:
   - `MACHINE_DROP_DIR\processed` dosya hareketini dogrula.

## 26. Kabul Kriterleri (Definition of Done)

Bir release icin "OptiPlanning tetikleme calisiyor" demek icin minimum:

1. UI butonu ile yeni job acilabilmeli.
2. Job en az bir kez `NEW -> ... -> DONE` tamamlamali.
3. Hata durumunda `error_code` set edilmeli ve audit event dusmeli.
4. Worker status endpointi dogru metrik donmeli.
5. Ordered inbox runner dry-run ve normal run testleri gecmeli.
6. Dokumandaki test komutlari QA tarafinda tekrarlandiginda ayni sonuc alinmali.

## 27. Bilinen Limitasyonlar

1. Worker akisi Windows + pywinauto bagimlidir.
2. `/api/health` endpointi yoktur; backend health endpointi `/health`tir.
3. `optiplanning_service` icinde `XML/OSI export` branchleri "pending implementation" olarak loglanir.
4. CSV formatinda `[P_EGDE_MAT_LO]` etiketi bilincli olarak bu sekilde tutulur (template uyumlulugu).

## 28. Onerilen Iyilestirmeler

1. State machine telemetry dashboard (job latency, timeout ratio, failure code histogram).
2. `OPTI_RUNNING` stuck detector + auto-recovery policy.
3. Runner icin centralized config file (CLI param daginikligini azaltmak icin).
4. `optiplanning/optimization/run` ve orchestrator akislari icin ortak izleme paneli.
5. XML schema validator seviyesinin arttirilmasi (vendor schema aware parse).

## 29. Ek Not - Calisan Senaryo Ozeti

Bu dokuman kapsaminda "calisan senaryo" su iki ana yoldur:

1. UI buton tabanli orchestrator state machine akisi.
2. `EXCEL_TEST_1` pattern tabanli sirali dosya isleme akisi.

Iki akis da ayni projede birlikte bulunur, fakat operasyonel olarak farkli ihtiyaclari cozer.

