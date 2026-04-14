# Master Data ve Launch Kararlari

Tarih: 2026-03-14
Durum: `Teknik Oneri Hazir`
Kaynak: `01-stok-karti-analizi`, `02-cari-karti-analizi`, `04-mikro-entegrasyon-analizi`

## 1. Cari Master Veri Karari

Tespit:
- `Customer` modeli dar.
- `CRMAccount` modeli fiili master veri adayi.

Teknik onerilen karar:
- `Master model`: `CRMAccount`
- `Customer`: sadece compatibility / lookup amacli dar yuzey
- Yeni cari yazma akislarinda `Customer` birincil kaynak olmayacak.

Kapanis etkisi:
- Bu karar alinmadan cari mapping, siparis baglama ve Mikro sync tekillesmez.

## 2. Stok Launch Karari

Tespit:
- Ana stok karti mevcut.
- Barcode ve multi-price child yapisi launch oncesi tam degil.

Teknik onerilen karar:
- `Launch modeli`: `tek depo + tek temel fiyat`
- `Wave 2`: barcode child, multi-price child, gelismis depo detayi, varyant

Kapanis etkisi:
- Bu ayrim yazili degilse ekip launch'a child model yetismis gibi davranir ve scope sisler.

## 3. Teklif Modulu Konumu

Teknik onerilen karar:
- `Teklif` bagimsiz belge modulu olacak.
- CRM sekmesi yalnizca giris noktasi / lookup baglami saglayacak.

## 4. Mikro Write-Back Karari

Teknik tespit:
- Repo write-back servisleri var.
- P1 guvenlik ve runbook baglaminda `read-only` zorunlulugu tanimli.

Teknik onerilen karar:
- `Wave 1`: read-only
- `Wave 2`: cari / stok sync kaniti sonrasi siparis
- `Wave 3`: teklif

## 5. Kapanis Kriteri

Bu belge kapali sayilmaz, eger:
- `CRMAccount` master karari onaylanmadiysa
- `tek depo + tek fiyat launch` karari imzalanmadiysa
- `Teklif bagimsiz moduldur` karari reddedildi veya acikta birakildiysa
