# ADDENDUM — ONAYLI KURALLAR (DOĞAÇLAMA YOK)

## 1) ÇALIŞTIRMA ORTAMI (LOCKED)
- Orchestrator SUNUCUDA çalışacaktır.
- Windows Service olarak çalışacaktır.
- Debug için console mode desteklenecektir (service dışı çalıştırma).
- OptiPlanning tek instance kabul edilir: aynı anda yalnız 1 job OPTI_RUNNING olabilir.

## 2) OPTIPLANNING EXPORT XML AKIŞI (LOCKED)
- OptiPlanning export XML, belirlenen yerel export klasörüne yazılır:
  - config/paths.json: optiplanningExportFolder (LOCAL PATH)
- Orchestrator bu klasörü izler (watcher).
- XML oluştuğu anda Orchestrator otomatik olarak ağ klasörüne (UNC) atomik kopyalar:
  - config/paths.json: machineDropFolder (UNC PATH)
- Manuel kopyalama işlemi yoktur; bu adım tamamen otomatikleşir.

## 3) TEMPLATE POLICY (LOCKED) — Excel_sablon.xlsx
- OptiPlanning input XLSX dosyaları SADECE `Excel_sablon.xlsx` template’i kopyalanarak üretilir.
- Template repo konumu zorunlu:
  - templates/Excel_sablon.xlsx
- config/paths.json içine zorunlu alan:
  - xlsxTemplatePath = "./templates/Excel_sablon.xlsx"
- Sheet adı değiştirilemez: `ŞABLON`
- 1. satır tag satırıdır ve ASLA değiştirilemez/silinemez/yeniden yazılamaz.
- Tag sayısı ve sırası tam 12 kolondur ve birebir şu değerler olmalıdır:
  1) [P_CODE_MAT]
  2) [P_LENGTH]
  3) [P_WIDTH]
  4) [P_MINQ]
  5) [P_GRAIN]
  6) [P_IDESC]
  7) [P_EDGE_MAT_UP]
  8) [P_EGDE_MAT_LO]   (Bu yazım template’de böyle, ASLA düzeltilmez)
  9) [P_EDGE_MAT_SX]
  10) [P_EDGE_MAT_DX]
  11) [P_IIDESC]
  12) [P_DESC1]
- 2. satır başlık satırıdır ve ASLA değiştirilemez.
- Veriler 3. satırdan itibaren yazılır.
- XLSX üretimi atomik yapılır: *.tmp yaz → rename.
- Template doğrulaması zorunludur:
  - Sheet adı + 1. satır tagları + kolon sayısı birebir kontrol edilir.
  - Uyuşmazlık varsa job HOLD: E_TEMPLATE_INVALID

## 4) OSI ACK MODE (LOCKED) — “EVET” KARARINA GÖRE
- OSI/makine tesliminden sonra başarı sinyali ZORUNLUDUR.
- Varsayılan ACK modu: file_move (LOCKED)
- machineDropFolder altında şu alt klasörler zorunludur:
  - inbox/
  - processed/
  - failed/
- Orchestrator XML teslimini inbox/ içine atomik yapar.
- ACK koşulu:
  - Aynı dosya adı processed/ altında görünürse DELIVERED.
  - Aynı dosya adı failed/ altında görünürse FAILED.
- Timeout:
  - ACK timeout = 5 dakika
  - Timeout olursa FAILED: E_OSI_ACK_TIMEOUT
- Not: OSI’nin dosyayı taşıması (move) beklenir; kopya (copy) kabul edilmez.
# AGENT_ONEFILE_INSTRUCTIONS — OPTIPLAN360 ORCHESTRATOR (TEK DOSYA KURAL+TALİMAT+PROMPT+CONTEXT)
_Tarih: {{YYYY-MM-DD}} • Versiyon: 1.0 • Durum: LOCKED_

---

## A) BU DOSYANIN STATÜSÜ (TEK KAYNAK GERÇEK)
1) Bu dosya **kilit manifestodur**; agent ve geliştirilen kod bu dosyaya %100 uyar.  
2) Agent **hiç soru sormaz**.  
3) Agent **doğaçlama/yorum/varsayım üretmez**. Belirsiz alanlarda yalnızca bu dosyada tanımlanmış fallback’leri uygular.  
4) Agent, bu dosyada yazmayan hiçbir kuralı “ben böyle uygun gördüm” diye ekleyemez.  
5) Çıktı: Çalışır kod + dokümantasyon + testler.

---

## B) ÜRÜN TANIMI (ORCHESTRATOR / AKTARMA PROGRAMI)
Bu proje; UI/DB’den aldığı sipariş/iş parçalarını kurallara göre dönüştürür, OptiPlanning’e `.xlsx` olarak besler, OptiPlanning’in ürettiği `.xml` çıktısını toplar ve OSI/makine tarafına “drop folder” ile teslim eder. Bu akış bir “program yöneticisi / orchestrator” olarak job kuyruğu ve audit trail ile yürür. (OptiPlanning motoru yeniden yazılmaz.)

---

## C) DEĞİŞMEZ KURALLAR MANİFESTOSU (LOCKED)
> Aşağıdaki kurallar değiştirilemez. Agent bunları kod+UI+API+dosyalama+flow seviyesinde uygular.
>
> **Kaynak:** Detaylı iş kuralları (gövde/arkalık ayrımı, CRM gate, grain eşleşme, bant/arkalık kuralları, merge politikası) için bkz. **OPTIPLAN360_MASTER_HANDOFF.md Bölüm 0.1-0.5**.
> Bu bölümdeki kurallar MASTER_HANDOFF ile birebir aynıdır; tekrar yazılmaz, oraya referans verilir.

### Özet Hatırlatma (tam detay MASTER_HANDOFF'ta):
- C1: Gövde ayrı, arkalık ayrı export. Renk/kalınlık farklıysa ayrı liste. XLSX giriş, XML çıkış. Tag'ler değişmez.
- C2: OCR telefon normalize. CRM eşleşme zorunlu (yoksa HOLD). Dosya adında CRM snapshot.
- C3: Grain mapping 0/1/2/3 birebir.
- C4: Arkalıkta bant kesinlikle yok.
- C5: Merge varsayılan kapalı. Operatör onayı olmadan uygulanmaz.

---

## D) COMPLIANCE (API/UI/DEPLOYMENT) — LOCKED ZORUNLULAR
> Endpoint uyum matrisi ve açık eksikler: :contentReference[oaicite:22]{index=22} :contentReference[oaicite:23]{index=23}

### D1) Zorunlu API Endpointleri (minimum)
- `GET /health` zorunlu. (Eksik/ele alınacak) :contentReference[oaicite:24]{index=24}  
- `GET /customers/lookup?phone=...` zorunlu. (Eksik/ele alınacak) :contentReference[oaicite:25]{index=25} :contentReference[oaicite:26]{index=26}  
- `POST /orders/{order_id}/import/xlsx` mevcut/uyumlu kabul edilir; orchestrator bu pattern’i destekler. :contentReference[oaicite:27]{index=27}  

### D2) UI Eksik Kuralı (Plaka Ebatı)
- Plaka ebatı alanı UI’da eksik; orchestration kural setinde **plaka ebatı mutlaka** yakalanır/konfigüre edilir. :contentReference[oaicite:28]{index=28} :contentReference[oaicite:29]{index=29}  

---

## E) ACCESSIBILITY (WCAG 2.1 AA) — LOCKED
> Kritik bulgular ve fix checklist: :contentReference[oaicite:30]{index=30} :contentReference[oaicite:31]{index=31}

Minimum zorunlular:
- Modal: `aria-modal`, ESC ile kapanma, focus trap, arka plan tab erişimi kapalı. :contentReference[oaicite:32]{index=32} :contentReference[oaicite:33]{index=33}  
- Form: label `htmlFor/id`, required alan işaretleme, hata mesajı input’a bağlanır (`aria-describedby`), `aria-invalid`. :contentReference[oaicite:34]{index=34}  
- Touch target: minimum 44×44. :contentReference[oaicite:35]{index=35}  

---

## F) ICON SISTEMI — LOCKED (EMOJI YASAK / LUCIDE ZORUNLU)
> Emoji sorunları ve Lucide planı: :contentReference[oaicite:36]{index=36} :contentReference[oaicite:37]{index=37}

- Navigasyon/aksiyon ikonlarında emoji kullanılmaz.  
- `lucide-react` kullanılır ve tek bir `Icon` wrapper bileşeni ile yönetilir.  
- Her ikon için erişilebilirlik (`aria-label`) sağlanır. :contentReference[oaicite:38]{index=38}  

---

## G) ORCHESTRATOR TEKNİK KURALLAR (SIFIR DOĞAÇLAMA)
### G1) Atomik dosya yazma (zorunlu)
- Yazım: `*.tmp` yaz → `rename` ile final.  
- Aynı job için idempotency: aynı payload hash ile ikinci kez üretme yok; revizyon gerekiyorsa `job_XXXX_rNN`.  

### G2) Job Queue ve State Machine (zorunlu)
State’ler (tam liste):
- `NEW`
- `PREPARED`
- `OPTI_IMPORTED`
- `OPTI_RUNNING`
- `OPTI_DONE`
- `XML_READY`
- `DELIVERED`
- `DONE`
- `HOLD`
- `FAILED`

Not:
- HOLD ihtiyacı compliance aksiyon planında geçer; state enum’una eklenir. :contentReference[oaicite:39]{index=39}  
- UI tarafında DONE state’in önemine dair gap notu vardır. :contentReference[oaicite:40]{index=40}  

### G3) OptiPlanning Tetikleme Modları (A/B/C)
Belirsizlik yönetimi bu üç mod dışında yapılamaz.

- **MODE A (CLI/Runner):** varsa kullanılacak.
- **MODE B (Excel COM):** RunOptiPlanning.xls içindeki makro varsa COM ile tetiklenecek.
- **MODE C (Operatör):** Operatör OptiPlanning UI’dan import/execute yapar; orchestrator xml’i görünce otomatik devam eder. (RPA yok.)

### G4) Dönüşüm Kuralları (hard)
- cm → mm: `cm * 10` (değişmez)
- Trim:
  - 18mm iş: `10.00`
  - 5mm arkalık: `5.00`
- Bant mapping:
  - `Bant Yok` → null
  - `040` → 0.4
  - `1mm` → 1.0
  - `2mm` → 2.0
- Arkalıkta bant her koşulda null.
- Grain mapping: `0/1/2/3` (C3’e göre)

### G5) CRM Gate (hard)
- `customers/lookup` sonucu bulunamazsa:
  - Job `HOLD` olur
  - Operatör “Create Customer” akışını tamamlamadan export üretilemez.

### G6) Plaka ebatı (hard)
- İşleme girmeden önce plaka ebatı:
  - UI’dan alınır veya
  - `config/rules.json` içinde default set edilir
- Plaka ebatı yoksa job `HOLD`.

---

## H) DOSYA/ENDPOINT/CONFIG STANDARTLARI (AGENT UYGULAYACAK)
### H1) Repo yapısı (zorunlu)
- `apps/orchestrator/` (backend + worker)
- `apps/admin-ui/` (panel; minimal ama a11y+lucide kurallarına uygun)
- `config/paths.json`
- `config/rules.json`
- `docs/` (aşağıdaki dosyalar zorunlu)
- `tests/`

### H2) Zorunlu docs çıktıları
- `docs/API_CONTRACT.md` (Backend + Orchestrator API — birleşik sözleşme)
- `docs/STATE_MACHINE.md`
- `docs/SECURITY_NOTES.md` (en az: JWT/role ve audit)
- `docs/OPERATIONS.md` (scheduled task/service + log rotation + HOLD/FAILED yönetimi + sorun giderme)
- `docs/A11Y_CHECKLIST.md` (E bölümünün checklist'i)
- `docs/HTTPS_SETUP_GUIDE.md`
- `docs/RESMI_KARAR_DOKUMANI_V1.md`

### H3) config/paths.json (zorunlu alanlar)
- optiplanningExePath
- optiplanningImportFolder
- optiplanningExportFolder
- optiplanningRulesFolder
- machineDropFolder (UNC destek)
- tempFolder

### H4) config/rules.json (zorunlu alanlar)
- cm_to_mm_multiplier = 10
- trim map (18→10.0, 5→5.0)
- edge mapping
- grain mapping
- merge policy (default disabled, requires_operator_approval true)
- default plate size (örn. 2100x2800) veya zorunlu alan olarak UI’dan alınır (HOLD policy)

---

## I) KABUL KRİTERLERİ (TEST EDİLEBİLİR / NET)
1) CRM match olmadan export üretilmez; job HOLD olur.  
2) Arkalıkta bant asla yazılmaz; UI gönderirse de null’a çekilir ve audit log’a yazılır.  
3) Gövde ve arkalık ayrı `.xlsx` üretilir.  
4) Renk/kalınlık farklıysa ayrı `.xlsx` üretilir.  
5) `.xlsx` üretimi OptiPlanning tag’lerini korur (template yaklaşımı).  
6) `.xml` export yakalanır; minimal XML doğrulama geçmeden teslim edilmez.  
7) Makine drop folder’a atomik teslim yapılır.  
8) Admin panelde:
   - job list + filtre
   - job detail + audit
   - retry
   - HOLD’dan devam (approve)
   - settings (paths/rules)
9) UI: emoji yok, lucide var; modal/form A11y minimumları sağlanır.  
10) `GET /health` ve `GET /customers/lookup` endpointleri çalışır.  

---

# RUN PROMPT (VS CODE CHATGPT/CODEX’E TEK PARÇA YAPIŞTIR)
Aşağıdaki metni VS Code ChatGPT/Codex’e tek seferde yapıştır. Agent SAKIN soru sormaz.

---
Sen kıdemli bir yazılım mimarı + full-stack lead’sin. Bu repoda **AGENT_ONEFILE_INSTRUCTIONS.md** “tek kaynak gerçek”tir ve %100 uyulacaktır.

KURALLAR:
- SAKIN soru sorma.
- Doğaçlama yok. Yeni kural icat etme yok.
- Belirsiz alanları yalnız MODE A/B/C ile çöz.
- Dosya yazma atomik: .tmp → rename.
- CRM lookup hard gate: match yoksa HOLD, export yok.
- Arkalıkta bant asla yok.
- Emoji nav/action ikon yok; lucide-react + Icon wrapper zorunlu.
- A11y minimumları zorunlu (modal ESC+focus trap+aria-modal; form htmlFor/id + aria-describedby; 44×44).

GÖREV:
1) Repo yapısını oluştur:
   - apps/orchestrator (Node.js + TypeScript)
   - apps/admin-ui (Vite + React + TS) veya minimal ama A11y+Lucide kurallarına uygun panel
   - config/paths.json + config/rules.json (template)
   - docs/* (zorunlu dokümanlar)
   - tests/*

2) Orchestrator’ı yaz:
   - Job queue + state machine (NEW→...→DONE/HOLD/FAILED)
   - SQLite persistence (jobs + audit_events)
   - Transformer: cm→mm, trim(18→10, 5→5), edge mapping, grain mapping, merge policy
   - OptiPlanningAdapter:
     - import folder’a template tabanlı XLSX drop
     - MODE A/B/C tetikleme
   - XmlCollector: export folder’dan xml yakala + minimal validate
   - OSIAdapter: xml’i machineDropFolder’a atomik teslim

3) API’yi yaz:
   - GET /health
   - GET /customers/lookup?phone=
   - POST /jobs
   - GET /jobs/:id
   - POST /jobs/:id/retry
   - POST /jobs/:id/approve (HOLD’dan çıkış)

4) Admin UI:
   - Dashboard: job list + filtre
   - Job detail: states + audit + retry + approve
   - Settings: paths/rules edit + test buttons
   - Logs: audit görüntüle

5) Testler:
   - unit: transformer rules
   - integration: atomic write, state machine, xml validate
   - e2e: fake optiplanning runner ile NEW→DONE

6) Dokümanlar:
   - docs/API_CONTRACT.md
   - docs/STATE_MACHINE.md
   - docs/A11Y_CHECKLIST.md
   - docs/OPERATIONS.md
   - docs/SECURITY_NOTES.md

Tek seferde üret: klasörleri oluştur, kodu yaz, docs/testleri ekle, çalıştırma komutlarını README’ye yaz.
---

# CONTEXT (AGENT İÇİN KOPYA)
Bu repo OptiPlanning ↔ OSI arası orchestrator’dır. OptiPlanning input .xlsx, output .xml. CRM lookup zorunlu. Job queue + audit mandatory. A11y/Lucide mandatory. MODE A/B/C mandatory. Plaka ebatı mandatory (UI veya config). HOLD/DONE/FAILED state’leri mandatory.

---

## EK: KANIT REFERANSLAR (KURAL KAYNAKLARI)
- Master manifesto (gövde/arkalık, CRM snapshot, grain, merge, arkalık bant): :contentReference[oaicite:41]{index=41} :contentReference[oaicite:42]{index=42}  
- Compliance zorunlu endpointler ve plaka ebatı eksikliği: :contentReference[oaicite:43]{index=43} :contentReference[oaicite:44]{index=44} :contentReference[oaicite:45]{index=45}  
- /health ve /customers/lookup gap: :contentReference[oaicite:46]{index=46}  
- A11y kritikler (modal, form, 44×44): :contentReference[oaicite:47]{index=47} :contentReference[oaicite:48]{index=48} :contentReference[oaicite:49]{index=49}  
- Emoji→Lucide zorunluluğu: :contentReference[oaicite:50]{index=50} :contentReference[oaicite:51]{index=51}  

---


## 5) OPTIPLANNING TETİKLEME MODLARI (LOCKED)
- MODE A/B/C dışında tetikleme yoktur.
- MODE A: CLI/Runner varsa kullanılır.
- MODE B: Excel COM ile RunOptiPlanning.xls makro varsa kullanılır.
- MODE C: Operatör tetikler; orchestrator xml’i görünce otomatik devam eder.
- Sunucu ortamında MODE C gerekiyorsa:
  - OptiPlanning UI erişimi olan bir “Operator Workstation” tanımlanır.
  - Orchestrator server’da job’u PREPARED/HOLD seviyesinde hazırlar; operatör tetikler; server xml’i yakalar.
  - Bu yaklaşım RPA değildir.

## 6) PLAKA EBATI (LOCKED)
- Plaka ebatı zorunludur.
- Kaynak önceliği:
  1) job payload içinde plate_size (varsa)
  2) config/rules.json defaultPlateSize
- İkisi de yoksa job HOLD: E_PLATE_SIZE_MISSING

## 7) TIMEOUT/RETRY (LOCKED)
- OptiPlanning XML bekleme timeout: 20 dakika (E_OPTI_XML_TIMEOUT)
- OSI ACK timeout: 5 dakika (E_OSI_ACK_TIMEOUT)
- Retry:
  - retry_count_max = 3
  - backoff = 1m, 3m, 9m
- Permanent errors (retry yok):
  - E_TEMPLATE_INVALID
  - E_CRM_NO_MATCH
  - E_PLATE_SIZE_MISSING
  - E_XML_INVALID

## 8) LOCKING (LOCKED)
- OptiPlanning tek-instance:
  - Global mutex/lock ile aynı anda yalnız 1 OPTI_RUNNING
- Folder watcher dedup:
  - Her job işleme alınırken DB üzerinde “claim” yapılır (unique lock).

## THICKNESS POLICY (LOCKED) — ARKALIK KALINLIKLARI
- Her parça şu alanlarla işlenir:
  - part_type: GOVDE | ARKALIK
  - thickness_mm: number

- ARKALIK kalınlıkları (kesin liste):
  - backingThicknesses = [3, 4, 5, 8]

- Eğer part_type=ARKALIK ise:
  - thickness_mm bu liste içinde değilse job HOLD: E_BACKING_THICKNESS_UNKNOWN
  - Bant (edge) alanları her koşulda NULL yapılır (kalınlıktan bağımsız).
  - Trim, kalınlığa bakılmaksızın 5.00 uygulanır (kilit kural).

- Trim kuralı mapping ile sabitlenir (doğaçlama yok):
  - trimByThickness = {
      "18": 10.0,
      "3": 5.0,
      "4": 5.0,
      "5": 5.0,
      "8": 5.0
    }

- Eğer herhangi bir thickness_mm trimByThickness içinde yoksa job HOLD: E_TRIM_RULE_MISSING

