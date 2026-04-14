# Scope Freeze ve Provider Matrisi

Tarih: 2026-03-14
Durum: `Imzaya Hazir`
Not: Bu belge repo bulgularina dayali varsayilan karar setidir. Imza olmadikca yonetim karari yerine gecmez.

## 1. Varsayilan Scope Freeze

### In Scope

- OptiPlan workflow: `manual import`, `watch folder scan`, `OCR kontrol`, `siparis duzenleme`, `export preview`, `XLSX export`
- Mikro read-only: `health`, `lookup`, `mapping readiness`, `teknik health`
- OCR yonetim paneli: tek contract ile gelen `summary` ve `provider stats`
- Kalici audit: `remove`, `restore`, `phase2 onayi`, `export audit`

### Pilot Only

- `scanner device` intake
- `Teklif Fisi` bagimsiz UI yuzeyi

### Out of Scope

- Mikro write-back `order`, `quote`, `invoice`
- `email` ve `telegram` OCR intake
- Tam ticari siparis kapamasi
- Prod ortamda otomatik sync

### Post-Go-Live

- Mikro siparis write-back
- Mikro teklif write-back
- Bagimsiz teklif modul kapanisi
- Stok barcode / multi-price child yapilari

## 2. Export Karar Seti

Repo bulgusu:
- Export zinciri calisiyor.
- Workflow export canli kapsamda xlsx-only kilitlendi.

Varsayilan karar:
- `Status`: `Canli`
- `Launch tipi`: `Defined scope`
- `Kapanis kriteri`: xlsx kontrati + operasyon kabul testi

No-go:
- XLSX disi yeni export formatlari resmi karar olmadan canli kapsama alinamaz.

## 3. OCR Provider ve Kanal Matrisi

| Kanal / Provider | Varsayilan Durum | Gerekce | Kapanis Tipi |
|---|---|---|---|
| Manual import | `Canli` | Repo icinde uctan uca kanit var | Teknik olarak kapali |
| Watch folder scan | `Canli` | Repo icinde uctan uca kanit var | Teknik olarak kapali |
| Scanner device | `Pilot` | Kanal var, operasyon kabul ayrica gerekli | Teknik + operasyon |
| Email intake | `Kapsam disi` | Uctan uca launch kaniti yok | Yonetim karari |
| Telegram intake | `Kapsam disi` | Uctan uca launch kaniti yok | Yonetim karari |
| Local / simulated OCR | `Canli` | Workflow ingest bunu kullaniyor | Teknik olarak kapali |
| Azure OCR admin module | `Pilot` | Admin OCR yuzeyi var, workflow omurgasina resmi launch matrisi bagli degil | Teknik + yonetim |
| Google Vision | `Simulasyon/Pilot` | Launch kaniti yok | Yonetim karari |
| AWS Textract | `Simulasyon/Pilot` | Launch kaniti yok | Yonetim karari |

## 4. Fallback Stratejisi

1. Primary intake: `manual import` veya `watch folder scan`
2. OCR satiri olusmazsa:
   - kayit `PHASE_1_OCR_HAVUZU` durumunda kalir
   - operator hata / reprocess karari verir
3. Duplicated belge:
   - default davranis `reject`
   - istisna sadece `force_duplicate=true`
4. OCR confidence dusukse:
   - `Phase 2` operator onayi olmadan ileri gecis yok

## 5. Owner Haritasi

| Karar | Owner |
|---|---|
| Scope freeze | COO + CTO |
| Export kapsami | CTO + Operasyon |
| OCR provider matrisi | CTO |
| Kanal launch karari | COO + Operasyon |

## 6. Kapanis Kriteri

Bu belge kapali sayilmaz, eger:
- Imza yoksa
- `In Scope / Pilot / Out of Scope` satirlari onaylanmadiysa
- Export kapsami yazili degilse
- Provider matrisi duyurulmadiysa
