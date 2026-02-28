# OPTIPLAN360 — TAM PAKET
## Satış (CRM) + OptiPlanning Üretim + Mikro Muhasebe Entegrasyon Tasarımı (Uygulanabilir Dokümantasyon)

**Versiyon:** v1.0  
**Tarih:** 2026-02-18  
**Amaç:** Satış ekibinin sahada hızla teklif/sipariş üretmesi, üretime kusursuz aktarım (OptiPlanning), muhasebe/ERP tarafında standart ve ölçeklenebilir kayıt (Mikro) — tekil kod yapıları ve deterministik eşleştirme ile.

---

## 1) Başarı Tanımı (KPI’lar)
**Satış:**
- “Cari + Ürün Seç + Teklif” süresi: hedef < 2 dk
- Teklif→Sipariş dönüşüm oranı: +%X
- Hatalı ürün seçimi / yanlış ebat / yanlış kalınlık: < %1

**Üretim:**
- NEW→DONE ortalama süre
- HOLD oranı < %5
- FAILED oranı < %5

**Tahsilat:**
- Vadesi geçen fatura tutarı (aging) düşüş
- Hatırlatıcı “PENDING→SENT” dönüşüm oranı

---

## 2) Değişmez Kurallar Manifestosu (Kilit)
Bu kurallar **tasarımın her yerinde bağlayıcıdır** (UI, servis, dönüşüm, export):

1) **Gövde ayrı**, **arkalık ayrı** çıktı üretilir.  
2) **Renk** ve **kalınlık** farklıysa **ayrı liste/export** üretilir.  
3) OptiPlanning’e giriş `.xlsx`; makine çıktısı OptiPlanning’in ürettiği `.xml`.  
4) OptiPlanning Excel satır/kolon tag’leri **asla değiştirilmez/eksiltilmez**.  
5) Makine **ondalık** kabul eder (UI tam sayı girse bile).  
6) Trim UI’da gösterilmez; OptiPlanning tarafında sabit/ayarlanabilir kalır.  
7) Bant payı hesaplaması UI’da yapılmaz; UI yalnızca bant değerini ve kenar tiklerini gönderir (düşümü OptiPlanning yapar).  
8) Telefon normalize edilir; CRM eşleşmesi yoksa süreç **HOLD** olur ve yeni müşteri açılmadan export üretilmez.  
9) Grain (0/1/2/3) UI’dan seçilir ve OptiPlanning parametresine birebir gider.  
10) Plaka ebatı (plate size) UI’dan alınır veya config’te default’tur; yoksa **HOLD**.

---

## 3) En Doğru Senaryo (Uçtan Uca Akış)
Aşağıdaki akış “tek doğruluk kaynağı” mantığıyla kurgulanır:
- **CRM:** Fırsat/pipeline/aktivite motoru (satış disiplin)
- **Optiplan360:** Satış ekranı + ürün seçimi + iş/üretim orkestrasyonu + tahsilat/hatırlatıcı
- **OptiPlanning:** Kesim/yerleşim/optimizasyon
- **Mikro:** Resmi muhasebe/ERP kayıtları + stok/cari standartları + alternatif/eşdeğer stok yönetimi

### 3.1 Akış A — Satıştan Üretime (ana akış)
1) Satışçı müşteri bulur/oluşturur (telefon üzerinden).  
2) Satışçı ürün seçer: **Spec-first arama** (örn. “Beyaz 18”) → ebat → firma seçimi (gerekiyorsa).  
3) Sipariş/iş oluşturulur → Orchestrator job state machine başlar.  
4) Excel şablonundan `.xlsx` export hazırlanır (tag’ler sabit).  
5) OptiPlanning import/run → `.xml` üretilir.  
6) XML toplanır → teslim edilir → iş DONE.

### 3.2 Akış B — Tahsilat ve Hatırlatıcı (satış KPI’sı)
1) Fatura oluşturulur (invoice) + vade tarihi girilir.  
2) Hatırlatıcı türü ve bir sonraki hatırlatma zamanı planlanır.  
3) Dashboard: aging, pending reminders, toplam/ödenen/bekleyen.  
4) Ödeme alındığında invoice kapanır; CRM’de görev/aktivite güncellenir (opsiyonel).

### 3.3 Akış C — Mikro ile Standardizasyon (fazlı)
- Faz-1: Mikro **read-only doğrulama** (cari/stok var mı?)  
- Faz-2: Stok/cari açma standardı (Mikro kod yapısı + alternatifler)  
- Faz-3: Fatura/irsaliye/tahsilat kayıtları (kontrollü write)

---

## 4) Ürün Modeli (En kritik tasarım kararı)
OptiPlanning firma bilgisi getirmediği için ürün modelini iki katmanlı yapıyoruz:

### 4.1 MaterialSpec (firma bağımsız özellik seti)
**Tekil anahtar:** `product_type + color + thickness_mm + width_cm + height_cm`

Örnek Spec:
- `MLM (MDFLAM) + BEYAZ + 18 + 210*280`

### 4.2 SupplierItem (firma varyantı)
Aynı spec’in firma bazlı varyantları:
- KAST MLM BEYAZ 18 210*280
- KRONOSPAN MLM BEYAZ 18 210*280

**Tekil anahtar:** `spec_id + brand_id`

> Sonuç: OptiPlanning import’unda firma yoksa önce **spec** eşleşir, sonra “firma seçimi” kontrolle çözülür.

---

## 5) Kod Yapısı Garantisi (Tam otomatik, çakışmasız)
### 5.1 İç ID / Dış Kod ayrımı
- **id (UUID / PK):** sistem içi değişmez anahtar
- **code:** kullanıcı/entegrasyon kodu (otomatik)

### 5.2 Kural: kullanıcı kod yazmaz
- Cari ve stok kartlarında “code” alanı UI’da **gösterilir**, **girilemez**.
- Kod değişimi (update) kapalıdır (immutable).

### 5.3 Önerilen kod formatları
- **Account:** `ACC-{YY}{MM}-{SEQ6}-{CD}`
- **Item Stock:** `STK-{YY}{MM}-{SEQ7}-{CD}`
- **Item Service:** `SRV-{YY}{MM}-{SEQ6}-{CD}`

### 5.4 DB garantisi
- UNIQUE(tenant_id, code)
- Spec ve varyantlar için UNIQUE:
  - MaterialSpec: UNIQUE(product_type, color, thickness_mm, width_cm, height_cm)
  - SupplierItem: UNIQUE(spec_id, brand_id)

---

## 6) Arama ve Seçim UX Şablonu (Satışçı için)
### 6.1 Spec-first arama (doğru davranış)
Satışçı “BEYAZ 18” yazar → sistem önce spec’leri listeler.  
Sonra:
- ebat seçilir (210*280 gibi)
- gerekiyorsa firma seçilir

### 6.2 Firma gelmiyor → deterministik karar ağacı
Gelen spec ile katalog eşleşir:
- **0 sonuç:** NO_MATCH → “Ürün talebi” oluştur (satışçı ürün açamaz)
- **1 sonuç:** MATCHED → otomatik seç
- **2+ sonuç:** AMBIGUOUS → “Firma seç” (yalnızca aday firmalar listesi)

### 6.3 Firma öneri sırası (kural değiştirmeden hızlandırma)
- Müşterinin tercih ettiği marka
- Satışçının son seçtikleri
- Global en çok kullanılanlar

---

## 7) Veri Şeması (Önerilen tablolar)
> Not: Mevcut orchestrator SQLite (jobs/customers/audit_events) korunur; aşağıdaki şema Optiplan360 “iş/satış” veri katmanı içindir.

### 7.1 Master Data
**brands**: (id, code UNIQUE, name)  
**colors**: (id, code UNIQUE, name)  
**product_types**: (id, code UNIQUE, short_code UNIQUE, name)

### 7.2 Ürün
**material_specs**
- id, product_type_id, color_id, thickness_mm, width_cm, height_cm
- spec_code (deterministik) (opsiyonel)
- UNIQUE(product_type_id, color_id, thickness_mm, width_cm, height_cm)

**supplier_items**
- id, spec_id, brand_id, is_default, priority, is_active
- display_name (otomatik)
- UNIQUE(spec_id, brand_id)

**items (SKU)**
- id, code UNIQUE, supplier_item_id, unit, vat_rate, default_price, is_active
- (opsiyonel) micro_stok_kodu, micro_hizmet_kodu
- (opsiyonel) barcode

> Eğer tek “SKU = supplier_item” yaklaşımı tercih edilecekse `items` tabloyu supplier_items ile birleştirebilirsiniz.
> Ancak fiyat/vergiler/entegrasyon alanlarını ayırmak için `items` ayrı tavsiye edilir.

### 7.3 OptiPlanning’den gelen (firma yok) satırlar
**incoming_specs**
- id, external_line_id UNIQUE
- product_type_short, normalized_type_id
- color_text, normalized_color_id
- thickness_mm, width_cm, height_cm
- spec_hash
- status: PENDING|MATCHED|AMBIGUOUS|NO_MATCH
- chosen_brand_id (null)
- chosen_item_id (null)
- created_by, created_at

**product_requests** (NO_MATCH için)
- id, spec_hash, fields..., requested_by, status

### 7.4 Satış
**accounts**
- id, code UNIQUE, name, phone_norm UNIQUE (opsiyonel tenant bazlı), tax_no, email, addresses...
- crm_company_id, crm_contact_id (opsiyonel)
- micro_cari_kodu (opsiyonel)

**orders**
- id, external_order_id (OptiPlanning/CRM referansı), account_id, status, totals...
- order_lines: item_id, qty, price, discount, vat_rate, etc.

### 7.5 Tahsilat
**invoices**
- id, invoice_number, account_id, subtotal, tax_rate, discount_amount, total_amount, due_date, status
- reminder_type, reminder_sent, reminder_sent_at, reminder_status, next_reminder_date, reminder_count

**payments**
- id, invoice_id, amount, payment_date, method, notes
- (opsiyonel) micro_fis_no, micro_belge_no

### 7.6 Üretim Orchestrator (mevcut)
- jobs, customers, audit_events (SQLite)
- state machine ve endpointler korunur

---

## 8) Dönüşüm Kuralları (Hard / Değişmez)
Bu kurallar transformerService seviyesinde uygulanır:
- **cm→mm:** `cm * 10`
- **Trim:** 18mm iş → `10.00`; 5mm arkalık → `5.00`
- **Bant mapping:**
  - Bant Yok → null
  - 040 → 0.4
  - 1mm → 1.0
  - 2mm → 2.0
- **Arkalıkta bant:** her koşulda null
- **Grain mapping:** 0/1/2/3 (UI seçimi)

---

## 9) OptiPlanning Export / Import Şablonu
### 9.1 Excel template kullanımı
- Şablon tag’leri sabit
- Atomic write: .tmp → rename
- Split policy: gövde/arkalık ve renk/kalınlık ayrımı

### 9.2 XML toplama ve teslim
- OptiPlanning çalışır → export folder’a .xml üretir
- xmlCollector doğrular ve OSI/makine drop folder’a taşır
- ACK inbox/processed/failed

---

## 10) Orchestrator State Machine ve Operasyon
### 10.1 State machine
NEW → PREPARED → OPTI_IMPORTED → OPTI_RUNNING → OPTI_DONE → XML_READY → DELIVERED → DONE  
↓  
HOLD (operatör onayı)  
↓  
FAILED (retry / manual fix)

### 10.2 Operasyon endpointleri
- GET /health
- GET /customers/lookup?phone=
- POST /jobs
- GET /jobs
- GET /jobs/:id
- POST /jobs/:id/retry
- POST /jobs/:id/approve
- GET /config/paths
- GET /config/rules

### 10.3 Operasyon KPI formu (günlük)
- FAILED işler oranı
- NEW→DONE ortalama süre
- En sık hata kodları
- Bekleyen HOLD sebepleri

---

## 11) CRM Gate (Hard)
- customer_phone normalize edilir
- /customers/lookup ile CRM eşleşmesi aranır
- bulunamazsa **HOLD**
- operatör “Create Customer” tamamlamadan export üretilmez

---

## 12) Mikro Entegrasyon Şablonu (Fazlı)
### 12.1 Faz-1: Read-only doğrulama (önerilen başlangıç)
- Cari: micro_cari_kodu var mı?
- Stok: micro_stok_kodu var mı?
- Yoksa “mapping/creation task” oluştur

### 12.2 Faz-2: Kod yapısı + alternatiflerle standart stok açma
Mikro’nun “stok kod yapısı” ve “kod alternatifleri” yaklaşımı ile otomatik kart açma standardı kurulur.
- Yapılar (segmentler): Cins, Renk, Kalınlık, Ebat, Marka
- Alternatifler: her segmentin olası değerleri

### 12.3 Faz-3: Eşdeğer (muadil) stoklar
KAST↔KRONOSPAN gibi firmalar aynı spec’te muadil olabilir.
- “Stok alternatifleri yönetimi” ile eşdeğer tanımlanır
- parametreye bağlı olarak stok yetmezse eşdeğer kullanılabilir

### 12.4 Multi Kod (tedarikçi kodları)
- Tedarikçi firmaların kendi stok kodları isteniyorsa Mikro “Multi Kod” alanı ile karşı stok kodu tutulabilir.

---

## 13) Tahsilat Modülü (Production Ready)
- Invoice CRUD: /api/v1/payments/invoices (POST/GET/PUT/DELETE)
- statistics, aging-report
- reminder_type + next_reminder_date alanları ile planlama
- Rol bazlı erişim: ADMIN/OPERATOR

---

## 14) Güvenlik ve Yetki
**Rol bazlı erişim:**
- ADMIN: tüm modüller
- OPERATOR: üretim operasyon + tahsilat yönetimi
- SALES: müşteri/ürün arama + sipariş oluşturma (tahsilat yok veya sınırlı)

**Audit:**
- HOLD sebebi
- seçilen firma/ürün
- dönüşüm ve override’lar

---

## 15) Test Planı (Kabul kriterli)
### 15.1 Unit
- transformerService: cm→mm, trim, band mapping, arkalık bant null, grain mapping
- phone normalization
- spec_hash üretimi ve matching

### 15.2 Integration
- Excel template tag validation (required tags)
- atomic XLSX write
- state machine constraints (OPTI_RUNNING tek-instance)
- XML validation

### 15.3 E2E
- NEW→DONE tam akış (fake OptiPlanning runner)
- HOLD: CRM eşleşmesi yok → approve sonrası devam
- Firma yok spec import: AMBIGUOUS → firma seçimi → MATCHED

### 15.4 Kabul kriterleri (net)
1) CRM match olmadan export üretilmez (HOLD).  
2) Arkalıkta bant asla yazılmaz (null).  
3) Tag’ler değişmeden XLSX üretilir.  
4) Gövde/arkalık ayrı; renk/kalınlık farklıysa ayrı export.  
5) 0-match spec’te satışçı ürün açamaz; product_request oluşur.

---

## 16) Uygulama Yol Haritası (Fazlar)
**Faz-0 (1 hafta):** Master data + spec/supplier model + arama UX  
**Faz-1 (1–2 hafta):** OptiPlanning spec import + firma seçim akışı + HOLD ekranı  
**Faz-2 (1 hafta):** Tahsilat ekranları (mevcut modül) + CRM görev bağlama  
**Faz-3 (2–4 hafta):** Mikro read-only doğrulama + mapping ekranı  
**Faz-4 (opsiyonel):** Mikro write entegrasyonu (kart/fatura/tahsilat)

---

## 17) Örnek (senin senaryon)
**Arama:** “BEYAZ 18”  
**Filtre:** 210*280 + MLM  
**Sonuç:** 2 firma (KAST, KRONOSPAN)  
**UI:** Firma seç → ürün otomatik seç → siparişe ekle

---

## 18) Ekler
### 18.1 “SpecCode” örneği (deterministik)
`MLM-BEYAZ-18-210x280`

### 18.2 Display name örneği
`KAST MDFLAM BEYAZ 18MM 210*280`

### 18.3 incoming_specs status örnekleri
- MATCHED: chosen_item_id dolu
- AMBIGUOUS: chosen_brand_id bekleniyor
- NO_MATCH: product_request açıldı

---

**Bitti.**

---

## 19) Uygulama Senaryolari (Operasyonel)

### Senaryo-1: Standart Siparis -> Uretim -> Teslim (Happy Path)
1. Satis kullanicisi musteri secer veya telefon ile lookup yapar.
2. Spec-first urun aramasi yapilir (ornek: BEYAZ 18 + 210x280).
3. Tek eslesme varsa urun otomatik secilir; siparis kaydedilir.
4. /jobs ile job olusturulur.
5. Job state akisi: NEW -> PREPARED -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE.
6. XML makine drop klasorune teslim edilir ve ACK alinir.
7. Siparis statusu tamamlandiya cekilir, audit kaydi kapanir.

### Senaryo-2: CRM Eslesmesi Yok (HOLD)
1. Musteri telefonu lookup ile bulunamaz.
2. Job HOLD olur (E_CRM_NO_MATCH).
3. Operator yeni musteri kaydini olusturur veya eslesme yapar.
4. /jobs/:id/approve ile job NEW state'ine doner.
5. Akis kaldigi yerden yeniden islenir.

### Senaryo-3: Spec Ambiguous (Firma Secimi Gerekli)
1. OptiPlanning veya arama sonucu ayni spec icin birden fazla firma adayi gelir.
2. Sistem statusu AMBIGUOUS verir.
3. Satis/operator firma secimi yapar.
4. Secim audit'e yazilir ve chosen_item_id set edilir.
5. Siparis normal akisla devam eder.

### Senaryo-4: Mode C (Operator Manuel Tetik)
1. Job OPTI_IMPORTED olur.
2. Sistem E_OPERATOR_TRIGGER_REQUIRED ile HOLD atar.
3. Operator OptiPlanning tarafinda manuel tetikler.
4. Approve sonrasi job NEW'e doner ve ikinci geciste OPTI_RUNNING olur.
5. XML alindiginda kalan adimlar otomatik tamamlanir.

### Senaryo-5: Tahsilat ve Hatirlatici
1. Fatura olusturulur, vade tarihi atanir.
2. Reminder tipi ve next_reminder_date set edilir.
3. Zamani gelen kayitlar reminder queue'ya alinir.
4. Odeme geldiyse invoice CLOSED, gelmediyse reminder_count artar.
5. Dashboard'da aging ve tahsilat KPI'lari guncellenir.

---

## 20) TODO List (Faz Bazli Uygulama Listesi)

Durum anahtari:
- [ ] Bekliyor
- [~] Devam ediyor
- [x] Tamamlandi

### Faz-0: Temel Standartlar (Oncelik P0)
- [ ] Canonical API dokumani netlestir: /jobs cekirdek, /orders facade.
- [ ] UI status -> teknik state map tablosu yayinla.
- [ ] Emoji icon temizligi tamamla, lucide wrapper zorunlu hale getir.
- [ ] A11Y minimumlari (aria-modal, focus trap, 44x44, aria-describedby) tum ekranlarda kontrol et.
- [ ] SQL Board read-only mode kilidini dogrula.

### Faz-1: Siparisten Uretime Akis (Oncelik P0)
- [ ] Spec-first urun arama servisini devreye al.
- [ ] incoming_specs status akisini (MATCHED/AMBIGUOUS/NO_MATCH) tamamla.
- [ ] CRM gate HOLD kurallarini kod seviyesinde sabitle.
- [ ] /jobs create-retry-approve endpointlerinin test kapsamini genislet.
- [ ] Excel template tag validasyonunu zorunlu hale getir.
- [ ] Atomic .tmp -> rename yazma adimini tum export adimlarinda uygula.

### Faz-2: Orchestrator Guvenilirlik (Oncelik P1)
- [ ] Tek OPTI_RUNNING kilidi (DB + uygulama) zorunlu kontrol.
- [ ] HOLD hata kodlari ve FAILED hata kodlarini ayri tabloda dokumante et.
- [ ] XML timeout / ACK timeout monitor alarmlarini ac.
- [ ] Job audit rapor ekranina state gecis zamanlarini ekle.
- [ ] Mode C operator adimlari icin runbook screenshotlu kilavuz hazirla.

### Faz-3: Mikro Entegrasyon P1 (Read-Only) (Oncelik P1)
- [ ] Mikro baglanti test endpointi ve health metrikleri ekle.
- [ ] Cari dogrulama ve stok dogrulama sorgularini standardize et.
- [ ] Material suggest endpointini Mikro verisiyle destekle.
- [ ] Mapping ekraninda micro_cari_kodu ve micro_stok_kodu durumunu goster.
- [ ] Uyum raporu: eslesen/eslesmeyen kayitlar icin gunluk cikti al.

### Faz-4: Tahsilat ve Operasyon KPI (Oncelik P1)
- [ ] Invoice aging raporunu dashboarda sabitle.
- [ ] Reminder queue retry/limit kurallarini netlestir.
- [ ] Tahsilat performans KPI paneli ekle (vadesi gecen toplam, tahsilat orani).
- [ ] Rol bazli izinleri (ADMIN/OPERATOR/SALES) endpoint bazinda test et.

### Faz-5: Mikro P2 Write-Back (Oncelik P2)
- [ ] Write-back kapsam siniri tanimla (hangi belge tipleri yazilacak).
- [ ] Idempotency anahtari ile cift kaydi engelle.
- [ ] Write-back hata geri donus stratejisi (retry + dead-letter) uygula.
- [ ] Finans/muhasebe onay mekanizmasi olmadan write-back yapma.
- [ ] Pilot firma ile UAT tamamlanmadan genel kullanima acma.

### Dokumantasyon ve Kapanis (Oncelik P0)
- [ ] docs/RESMI_KARAR_DOKUMANI_V1.md ile tum dokumanlarin uyum kontrolunu bitir.
- [ ] Cakismali eski notlari temizle (hard cleanup).
- [ ] Go-live checklist ve rollback adimlarini tek sayfada topla.
- [ ] Son kabul: C1-C5 kriterleri icin kanit dosyalarini arsivle.

---

## 21) Bu Dokuman Icin Hemen Yapilacaklar (Top 10)
1. [ ] Faz-0 maddelerini sprint backlog'a tasiyin.
2. [ ] API/state map toplantisini yapin (45 dk).
3. [ ] Emoji -> Lucide cleanup PR acin.
4. [ ] CRM HOLD akisini test ortaminda prova edin.
5. [ ] Template tag validasyon testlerini CI'ya ekleyin.
6. [ ] Mode C operator adimini runbook'a ekleyin.
7. [ ] Mikro read-only sorgulari icin performans limiti koyun.
8. [ ] Tahsilat reminder cron zamanlarini netlestirin.
9. [ ] Dashboard KPI ownerlarini atayin.
10. [ ] Go-live oncesi dry-run NEW -> DONE senaryosunu yapin.
