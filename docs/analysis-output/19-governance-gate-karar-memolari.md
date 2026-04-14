# Governance Gate Karar Memolari

Tarih: 2026-03-14
Durum: `Karar Bekliyor`
Amac: `Phase 1 sonrasi canli kapsam, ticari sahiplik ve OCR provider matrisi` kararlarini tek dosyada dondurmak.

## 1. Kapsam Dondurma Karari

Mevcut durum:
- `Release gate`: yesil
- `OCR contract`: kapali
- `OCR -> workflow`: calisiyor
- `Remove/restore + audit`: kalici backend izi ile dogrulandi
- `Ticari alan / belge sahipligi`: acik
- `Mikro siparis / teklif`: yonetim kapsami net degil

Karar zorunlu alanlari:

| Baslik | Secenek | Durum | Owner | Deadline |
|---|---|---|---|---|
| P1 canli kapsam | `workflow + read-only Mikro + xlsx export` | `Karar bekliyor` | COO / CTO | ____ |
| Siparis ticari kapanis | `in scope / pilot / out of scope` | `Karar bekliyor` | COO | ____ |
| Teklif modulu | `in scope / pilot / out of scope` | `Karar bekliyor` | COO / Sales | ____ |
| Dis OCR intake | `launch / pilot / kapsam disi` | `Karar bekliyor` | COO / Operasyon | ____ |

No-go etkisi:
- Bu tablo imzalanmadan verilen tarih gercek scope freeze sayilmaz.
- Siparis ve teklif kapsam belirsiz kalirsa UAT, egitim ve kapasite planlamasi bozulur.

## 2. Export Kapsam Kilidi

Repo kaniti:
- Export zinciri calisiyor.
- Workflow export canli kapsamda yalnizca `xlsx` olarak tanimlandi.

Ek karar seti:
- XLSX disi format talebi yeni pilot veya release gate ile acilir.
- Phase 4 tamamlandi hukmu yalniz xlsx-only kontrat uzerinden verilir.

## 3. OCR Provider Matrisi

Karar tablosu:

| Kanal / Provider | Canli | Pilot | Simulasyon | Kapsam disi | Owner |
|---|---:|---:|---:|---:|---|
| Manual import |  |  |  |  | CTO |
| Watch folder scan |  |  |  |  | CTO |
| Email intake |  |  |  |  | Operasyon |
| Telegram intake |  |  |  |  | Operasyon |
| Scanner device |  |  |  |  | Operasyon |
| Azure OCR |  |  |  |  | CTO |
| Google Vision |  |  |  |  | CTO |
| AWS Textract |  |  |  |  | CTO |
| Tesseract / local OCR |  |  |  |  | CTO |

Zorunlu ek kararlar:
- Primary provider
- Fallback provider
- Timeout sonrasi davranis
- Dusuk confidence esigi
- Manuel kontrol zorunlu esigi

No-go etkisi:
- Resmi provider matrisi olmadan telemetry, SLA ve incident ownership guvenilir degildir.

## 4. Imza Bloku

| Rol | Isim | Karar Tarihi | Imza |
|---|---|---|---|
| COO | ____ | ____ | ____ |
| CTO | ____ | ____ | ____ |
| Operasyon | ____ | ____ | ____ |
| Satis | ____ | ____ | ____ |

## 5. Kapanis Kriteri

Bu belge kapali sayilmaz, eger:
- Karar secilmedi ise
- Owner yazilmadi ise
- Deadline yoksa
- Go / No-Go etkisi kabul edilmediyse
- Imza tamamlanmadiysa
