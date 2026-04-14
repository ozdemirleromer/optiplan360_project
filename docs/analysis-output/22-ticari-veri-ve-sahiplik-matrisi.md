# Ticari Veri ve Sahiplik Matrisi

Tarih: 2026-03-14
Durum: `Imzaya Hazir`
Kaynak: `03-siparis-fisi-analizi`, `11-teklif-fisi-analizi`

## 1. Siparis Zorunlu Alan Matrisi

| Alan | Faz | Zorunluluk | Sistem sahibi | Is sahibi | No-go etkisi |
|---|---|---|---|---|---|
| `cari_kodu` | Phase 3 | `Zorunlu` | CRMAccount | Satis / Operasyon | Evet |
| `stok_kodu` | Phase 3 | `Zorunlu` | StockCard | Operasyon | Evet |
| `termin` | Phase 3 | `Zorunlu` | Siparis belge modeli | Operasyon | Evet |
| `delivery_date` | Mikro siparis transferi | `Zorunlu` | Siparis belge modeli | Operasyon | Evet, transfer aciliyorsa |
| `delivery_address` | Mikro siparis transferi | `Zorunlu` | CRMAccount + siparis override | Operasyon | Evet, transfer aciliyorsa |
| `payment_method` | Mikro siparis transferi | `Zorunlu` | Siparis belge modeli | Finans / Operasyon | Evet, transfer aciliyorsa |
| `project_code` | Ticari karar | `Karar bekliyor` | Siparis belge modeli | COO | Hayir, scope'a bagli |
| `responsibility_center` | Ticari karar | `Karar bekliyor` | Siparis belge modeli | COO | Hayir, scope'a bagli |

## 2. Siparis Header / Line Sahipligi

| Yuzey | Owner | Not |
|---|---|---|
| Siparis header | `Siparis belge modeli` | Cari, termin, teslim, odeme, aciklama |
| Siparis line | `Siparis line modeli` | Stok referansi, miktar, olcu, satir aciklama |
| Teknik panel | `Sync / audit paneli` | Diger tum teknik alanlar ana form disinda |
| Uretim workbench | `Phase 3 workbench` | Ticari master veriyi tekrar etmez |

Karar:
- Teknik alanlar ana header formuna geri karistirilmayacak.
- Cari ve stok master veri belge icinde text kopya olarak yasatilmayacak.

## 3. Teklif Header / Line Sahipligi

| Yuzey | Owner | Not |
|---|---|---|
| Teklif header | `Teklif belge modeli` | Baslik, durum, revizyon, gecerlilik, toplamlar |
| Teklif line | `Teklif line modeli` | Urun / stok referansi, miktar, fiyat, iskonto |
| Teknik panel | `Sync / audit paneli` | Mikro ref, sync ozeti, hata |
| CRM baglam alani | `CRM lookup` | Sadece referans, belge sahibi degil |

Karar:
- Teklif modulu belge olarak ele alinacak.
- CRM sekmesi teklif sahibi degil, sadece kaynak baglam saglar.

## 4. Tekliften Siparise Donusum

| Alan | Donusum Kuralı |
|---|---|
| `account / cari` | referans tasinir, kopya master olmaz |
| `product_code / mikro_stok_kod` | tek esleme anahtari gerekir |
| `quantity` | line seviyesinde tasinir |
| `valid_until` | sipariste tasinmaz, belge tarihi olarak kalir |
| `price / discount / tax` | ticari karar gerektirir, otomatik tasima imza bekler |

## 5. Kapanis Kriteri

Bu belge kapali sayilmaz, eger:
- `cari_kodu`, `stok_kodu`, `termin` icin owner onayi yoksa
- `delivery_date`, `delivery_address`, `payment_method` transfer kurali imzalanmadiysa
- Teklif modulu konumu yazili onay almadiysa
