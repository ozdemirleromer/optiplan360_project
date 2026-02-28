# OPTIMIZER Program Master Plan

Bu dokuman mevcut klasorden bagimsizdir. Yeni acilacak repository icin dogrudan kullanilabilir.

## 1. Hedef

Amac: Panel kesim optimizasyonunda mevcut ticari cozumle ayni seviyede (veya daha iyi) kaliteye ulasan, UI tarafi daha yalin ama optimizer cekirdegi guclu bir sistem gelistirmek.

## 2. Basari Kriterleri

Asagidaki kriterler kabul kosulu olarak alinacaktir:

1. Kalite:
- Fire (waste area) metriginde mevcut baseline'a gore en az esit performans.
- Levha kullanim sayisinda mevcut baseline'a gore en az esit performans.
- Uretim suresi proxy metriklerinde (kesim dongusu, pattern adedi) kabul edilebilir fark.

2. Tutarlilik:
- Ayni input + ayni parametre ile tekrar calistirmada ayni veya esdeger cozum sinifi.
- Deterministik run modu.

3. Operasyonel:
- Job kuyrugu, retry, timeout ve audit log mekanizmasi.
- Hata durumunda izlenebilirlik (neden, asama, etkilenen veri).

4. Entegrasyon:
- ERP/MES veya mevcut backend'den standart API ile tetikleme.
- Sonuc ciktilarinin API veya dosya tabanli formatta alinabilmesi.

## 3. Kapsam

### 3.1 MVP Kapsami

1. 2D guillotine cutting.
2. Grain (yon) kisiti.
3. Kerf (testere kalinligi) ve trim.
4. Kenar bandi ile ilgili temel kisitlar.
5. Drop/remainder yonetimi (minimum boyut ve tekrar kullanim).
6. Coklu cozum adayi uretimi ve otomatik en iyi secim.

### 3.2 Faz 2 Kapsami

1. Gelismis makine simulasyonu.
2. Istifleme ve hat dengeleme.
3. Cok makineye dagitim optimizasyonu.
4. Senaryo bazli otomatik parametre tuning.

## 4. Sistem Mimarisi

1. `optimizer-api`:
- Job olusturma, parametre seti secimi, calistirma ve sonuc sorgulama endpointleri.

2. `optimizer-core`:
- Pattern generation + solver + local improvement.
- Cok amacli skor fonksiyonu.

3. `runner`:
- Is kuyrugu, lock, timeout, retry, cancellation.

4. `result-engine`:
- Cikti normalize etme.
- KPI hesaplama.
- En iyi cozum secimi.

5. `audit-store`:
- Input hash, parametre versiyonu, solver versiyonu, runtime metrikleri.

6. `param-center`:
- Parametre setlerini versiyonlu saklama.
- Profil tabanli yonetim (hizli, dengeli, minimum fire vb.).

## 5. Optimizasyon Yaklasimi

Hibrit model onerilir:

1. Heuristic Pattern Generator:
- Hizli aday pattern uretir.
- Isi arama uzayinda uygulanabilir hale getirir.

2. CP-SAT/MILP Selection Layer:
- Uretilen adaylardan global amaca gore secim yapar.
- Kisit ihlalini engeller.

3. Local Search / Improvement:
- Pattern swap, reorder, merge/split adimlari ile ince iyilestirme.

4. Multi-objective Scoring:
- Fire, board count, estimated cycle time, maliyet agirlikli birlesik skor.
- Agirliklar profil bazli degistirilebilir.

## 6. Veri Modeli (Cekirdek)

1. `Part`:
- id, L, W, qty, grain, edge flags, oncelik.

2. `Board`:
- material, L, W, qty, cost, trim constraints.

3. `Job`:
- part listesi, board listesi, param set id, hedef profil.

4. `Solution`:
- patterns, board usage, drops, runtime, score, kpi.

5. `RunRecord`:
- input hash, param version, solver version, status, logs, artifacts.

## 7. Parametre Yonetimi

1. Parametre setleri tek merkezde tutulur.
2. Her set semantik versiyon numarasi tasir (or. `v1.3.0`).
3. Run aninda hangi setin kullanildigi immutable kaydedilir.
4. UI sadece gerekli parametreleri gosterir; gelismis set admin seviyesinde acilir.

## 8. Test ve Benchmark Stratejisi

1. Gold Dataset:
- Gercek uretimden 200-500 is.
- Cok farkli urun ve ebat dagilimi.

2. Regression Suite:
- Her release'de kalite metrikleri karsilastirmasi.
- Kalite dususu olursa build fail.

3. Performans Testi:
- P50/P95 runtime hedefleri.
- Buyuk job'larda bellek ve sure limiti.

4. Determinizm Testi:
- Ayni seed ve parametre ile cozum stabilitesi kontrolu.

## 9. Gelistirme Fazlari

### Faz 0 - Hazirlik (1-2 hafta)

1. Gereksinim netlestirme.
2. Veri sozlesmesi ve API kontrati.
3. Benchmark dataset toplama.

### Faz 1 - Cekirdek MVP (4-6 hafta)

1. Modelleme + pattern generator.
2. CP-SAT/MILP secim katmani.
3. Runner ve temel API.

### Faz 2 - Kalite Kalibrasyonu (3-5 hafta)

1. Parametre tuning.
2. Senaryo kosu mekanizmasi.
3. Benchmark ile kalite esitligi.

### Faz 3 - Uretimlestirme (2-4 hafta)

1. Observability, audit, alarm.
2. Rollback, canary, versiyonlu dagitim.
3. Operasyon runbook.

## 10. Riskler ve Onlemler

1. Risk: Kalite hedefi tutmaz.
- Onlem: Gold dataset + otomatik regresyon + profiler bazli tuning.

2. Risk: Runtime uzar.
- Onlem: Iki asamali cozum (hizli draft + derin optimize), timeout ve fallback.

3. Risk: Parametre karmasikligi.
- Onlem: Param-center, profile abstraction, admin-only advanced ekranlar.

4. Risk: Operasyonel hata takibi zorlasir.
- Onlem: Run bazli artifact saklama, structured log, trace id.

## 11. Teslimat Paketi

1. Kaynak kod (core, api, runner, tests).
2. API dokumani (OpenAPI/Swagger).
3. Parametre rehberi.
4. Benchmark raporu.
5. Operasyon runbook ve hata senaryolari.

## 12. Kesin Kabul Kriteri

Proje "kabul edildi" sayilir if:

1. Gold dataset uzerinde kalite KPI'lari baseline ile esit veya daha iyi.
2. P95 runtime hedefi saglanir.
3. Deterministik testler gecilir.
4. Uretim ortaminda en az 2 hafta kritik incident olmadan calisir.

## 13. Sonraki Adimlar

1. Yeni repository ac.
2. Bu dokumani `docs/MASTER_PLAN.md` olarak tasi.
3. Faz 0 backlog'unu issue'lara bol.
4. Gold dataset toplama gorevini hemen baslat.

