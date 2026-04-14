# Go-Live Paketi ve Kapanis Tahtasi

Tarih: 2026-03-14
Durum: `Teknik Paket Hazir, Dis Blokajlar Acik`

## 1. Go / No-Go Checklist

### Go icin zorunlu

- Release gate yesil
- OCR -> workflow bagli
- Remove/restore + audit kalici
- Scope freeze imzali
- Export kapsami yazili
- Provider matrisi yazili
- `cari_kodu`, `stok_kodu`, `termin` kurali imzali
- Mikro health gercek ortamda dogrulandi

### No-Go

- Mikro prod config eksikse
- Scope belgesi imzasizsa
- Ticari sahiplik matrisi aciksa
- XLSX disi export MVP zorunlu ilan edilip scope aciksa

## 2. Incident Ownership

| Olay | Birincil owner | Ikinci owner |
|---|---|---|
| OCR intake sorunu | CTO | Operasyon |
| OCR kontrol / audit sorunu | CTO | Operasyon |
| Siparis veri hatasi | COO | Operasyon |
| Mikro health / config | CTO | Finans / ERP |
| Teklif veri hatasi | Satis | CTO |
| Export / XLSX sorunu | CTO | Operasyon |

## 3. Mikro Teknik Hazirlik ve Dis Blokaj

Teknik kanit:
- Mikro ilgili test paketi: `72 passed`

Gercek ortam kaniti:
- `backend/scripts/verify_mikro_connection.py` sonucu:
  - `{"ok": false, "result": {"status": "error", "detail": "Mikro veritabani baglanti bilgileri eksik. Admin panelinden yapilandirma yapilmali."}}`

Hukum:
- Mikro teknik kod omurgasi hazir.
- Mikro prod / gercek ortam kapanisi acik.
- Bu madde repo icinde tek tarafli kapatilamaz.

## 4. Faz Bazli Kapanis Tahtasi

| Faz | Durum | Hukum |
|---|---|---|
| Faz 0 | `Kapali` | Teknik kirmizilar kapandi |
| Faz 1 | `Imza bekliyor` | Dokuman hazir, yonetim karari acik |
| Faz 2 | `Imza bekliyor` | Veri ve sahiplik matrisi hazir |
| Faz 3 | `Kapali` | OCR intake zinciri repo icinde kapandi |
| Faz 4 | `Kismi kapali` | Workflow/export hazir, ticari belge sahipligi imza bekliyor |
| Faz 5 | `Dis blokaj` | Prod Mikro config ve ilk sync kaniti acik |
| Faz 6 | `Teknik oneriler hazir` | Master data ve launch karar imzasi bekliyor |
| Faz 7 | `Kapali` | Smoke/regression paketi ve kanitlar hazir |
| Faz 8 | `Kismi kapali` | Checklist/runbook var, owner imzasi ve dry-run eksik |

## 5. Son Hukum

`Tum asamalar kapandi` denemez.

Dogru ifade:
- `Tum teknik repo ici kapatilabilir maddeler kapatildi.`
- `Tum yonetimsel ve ortam bagimli maddeler imzaya / ortam kanitina hazir hale getirildi.`

## 6. Son Kapatma Adimlari

1. Scope freeze imzasi
2. Ticari veri / sahiplik matrisi imzasi
3. Mikro prod config girisi
4. `verify_mikro_connection.py` gercek ortam PASS
5. Ilk gercek cari/stok sync kaniti
