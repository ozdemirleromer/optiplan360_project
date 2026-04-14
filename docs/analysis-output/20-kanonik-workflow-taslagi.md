# Kanonik Workflow Taslagi

Tarih: 2026-03-14
Durum: `Taslak`
Amac: `Phase 1-2-3-4` gecislerini tek akista dondurmak.

## Akis

1. `Phase 1 - OCR Havuzu`
   - Giris: `manual import`, `watch folder scan`
   - Cikis:
     - OCR satiri olustuysa `Phase 2 - OCR Kontrol`
     - OCR satiri olusmadiysa kayit `Phase 1` havuzunda kalir veya operator hata akisi baslatir

2. `Phase 2 - OCR Kontrol`
   - Kayitlar:
     - OCR satirlari
     - Confidence alanlari
     - Remove / restore kayitlari
     - Audit trail
   - Gecis sarti:
     - En az bir aktif satir olacak
     - Dusuk confidence alanlari operator tarafindan onaylanacak
   - Cikis: `Phase 3 - Siparis Duzenleme`

3. `Phase 3 - Siparis Duzenleme`
   - Gecis sarti:
     - `cari_kodu`
     - `stok_kodu`
     - `termin`
     - Satir validasyonlari
   - Cikis: `Phase 4 - Export Onizleme`

4. `Phase 4 - Export`
   - Adimlar:
     - Export preview
     - Export request
     - XLSX uretilmesi
     - Export sonucu audit kaydi
   - Cikis:
     - `TAMAMLANDI`
     - `HATALI`
     - `RETRY`

## Durumlar

| Durum | Anlam |
|---|---|
| `PHASE_1_OCR_HAVUZU` | Intake alindi, workflow kaydi acildi |
| `PHASE_2_OCR_KONTROL` | OCR satirlari review bekliyor |
| `SIPARIS_DUZENLEME` | Ticari / operasyonel duzenleme asamasi |
| `EXPORT_ONIZLEME` | Export on kontrol asamasi |
| `PHASE_4_EXPORT_HAZIR` | Export kaydi uretildi |
| `TAMAMLANDI` | Basarili kapanis |
| `HATALI` | Operator veya teknik hata akisi |

## Durdurucu Blokajlar

Go-live oncesi asagidakiler acik olmamali:
- `Release gate` kirmizi olmamali
- `OCR -> workflow` bos satir problemi acik olmamali
- `Remove/restore + audit` kalici backend kaydindan kopuk olmamali
- `Kapsam / provider matrisi` imzasiz olmamali
- `cari_kodu / stok_kodu / termin` zorunlu alan matrisi acik olmamali

## Owner Haritasi

| Alan | Owner |
|---|---|
| OCR intake | CTO |
| OCR kontrol | Operasyon + CTO |
| Siparis duzenleme | COO |
| Export / XLSX | CTO + Operasyon |
| Go / No-Go karari | COO + CTO |

## Not

Bu belge teknik akisi netlestirir. Canli kapsam karari yerine gecmez.
