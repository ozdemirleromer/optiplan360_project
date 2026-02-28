# RESMI KARAR DOKUMANI v1.0

Durum: Onayli (Working Baseline)
Tarih: 2026-02-17
Kapsam: OptiPlan360 + Mikro entegrasyonu + dokumantasyon standardizasyonu

## 1. Amac
Bu dokuman, projedeki daginik karar noktalarini tek resmi karar setinde birlestirir.
Hedef: Uretim kararlarinda belirsizlik ve dokuman cakismalarini sifirlamak.

## 2. Kapsam ve Kaynaklar
Analiz edilen ana kaynaklar:
- AGENT_ONEFILE_INSTRUCTIONS.md
- OPTIPLAN360_MASTER_HANDOFF.md
- OPTIPLAN360_UI_UX_MIMARI_RAPORU_BIRLESTIRILMIS.md
- CLAUDE.md
- docs/API_CONTRACT.md
- docs/STATE_MACHINE.md
- docs/A11Y_CHECKLIST.md
- integrations/mikro_sql/sql_board_fields.md
- Mikro modulleri: Finans, Hizmet, Mikrokur, Satinalma, Satis, Stok

## 3. Kaynak Oncelik Sirasi (Resmi)
1. AGENT_ONEFILE_INSTRUCTIONS.md (locked kurallar)
2. docs/API_CONTRACT.md + docs/STATE_MACHINE.md (teknik davranis)
3. OPTIPLAN360_MASTER_HANDOFF.md (is kurallari ve operasyon)
4. CLAUDE.md (kodlama ve kalite standardi)
5. Diger analiz ve rapor dokumanlari (yardimci kaynak)

## 4. Nihai Kararlar
### K-01 API Standardi
- Orchestrator cekirdegi canonical API: /jobs
- Uyum/facade hatti: /orders
- /orders/:orderId/import/xlsx, /jobs payload modeline bagli calisir.

### K-02 State Machine Standardi
Canonical teknik state zinciri:
NEW -> PREPARED -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE
Bekleme/hata state:
- HOLD (operator mudahalesi)
- FAILED (kalici hata)

### K-03 UI Durum Haritalama Kurali
UI business durumlari, teknik state'lerin sade gorunumu olacak.
UI dogrudan teknik state'i degil, maplenmis durum etiketini gosterecek.

### K-04 Icon ve A11Y Standardi
- Emoji ikon yasak.
- lucide-react + tek Icon wrapper zorunlu.
- WCAG 2.1 AA asgari kurallar zorunlu:
  - modal: aria-modal + ESC + focus trap
  - form: label/id + aria-describedby + aria-invalid
  - touch target: minimum 44x44

### K-05 Veri Katmani Standardi
- Production: PostgreSQL
- Local/Test/edge operasyon: SQLite desteklenebilir
- Dokumanlarda ortam bazli ayrim acik yazilacak.

### K-06 Mikro Entegrasyon Standardi
- Faz P1: read-only entegrasyon (zorunlu)
- Faz P2: kontrollu write-back (opsiyonel, onayli senaryolarla)
- SQL Board read-only mode: kilitli true

## 5. Mikro Ozellik-Katki Ozeti
### Stok Modulu
Katki: stok/depo/ambar/parti-lot/barkod/envanter/maliyet raporlari
Etkisi: malzeme secim dogrulugu, stok gorunurlugu, plan kalitesi artar

### Finans Modulu
Katki: cari, banka-kasa, tahsilat/odeme, cek/senet, finansal raporlama
Etkisi: risk bazli hold/approve karar kalitesi artar

### Satis Modulu
Katki: cari yonetim, siparis/proforma, sevkiyat ve satis raporlari
Etkisi: siparisten uretime geciste veri dogrulugu artar

### Satinalma Modulu
Katki: tedarik ve satin alma sartlari, tedarik raporlari
Etkisi: tedarik-plan uyumu guclenir

### Hizmet Modulu
Katki: hizmet/masraf/proje kayit ve raporlama
Etkisi: operasyonel maliyet gorunurlugu artar

### Mikrokur Modulu
Katki: kullanici yetki, parametre, entegrasyon, log, bakim/yukseltme
Etkisi: sureklilik, guvenlik ve yonetilebilirlik artar

## 6. Entegrasyon Is Akisi Senaryosu (Resmi)
1. Admin SQL Board uzerinden Mikro baglantisini read-only test eder.
2. Sistem Mikrodan musteri/malzeme/stok ana verilerini senkron alir.
3. Siparis olusturmada telefon lookup calisir; eslesme yoksa HOLD.
4. Malzeme onerisi Mikro stok verisi ile zenginlestirilir.
5. Job /jobs uzerinden olusturulur ve state machine baslar.
6. OptiPlanning akisi mode A/B/C kurallarina gore yurur.
7. Mode C ise operator onayi ile HOLD -> NEW gecisi yapilir.
8. XML teslim ve ACK kontrolu tamamlaninca is DONE olur.
9. Audit, log ve raporlama kayitlari tamamlanir.
10. P2'de onayli write-back akislari devreye alinabilir.

## 7. Cakismanin Kapatilmasi Icin Zorunlu Aksiyonlar
1. UI/UX raporundaki emoji referanslari kaldirilacak, lucide standardi yazilacak.
2. API anlatiminda /jobs canonical kurali tum dokumanlarda netlestirilecek.
3. UI status ve teknik state map tablosu tek bir dokumanda sabitlenecek.
4. DB anlatiminda PostgreSQL (prod) ve SQLite (local/test) ayrimi standardize edilecek.

## 8. Kabul Kriterleri
- C1: Dokumanlar arasi API ve state celiskisi kalmadi.
- C2: A11Y ve icon kurallari tum modullerde ayni.
- C3: Mikro P1 entegrasyonu read-only ve audit edilebilir.
- C4: HOLD nedenleri ve approve/retry davranisi tek tip.
- C5: Operasyon dokumanlari production modunu net tarif ediyor.

## 9. Surumleme
- v1.0 (2026-02-17): ilk resmi birlestirilmis karar seti

## 10. Not
Bu dokuman, yeni karar alindiginda v1.x olarak guncellenecek ve onceki surumler korunacaktir.
