# OCR Politikasi ve Dedup Kurallari

Tarih: 2026-03-14
Durum: `Teknik Olarak Uygulanabilir`

## 1. Confidence Politikasi

Repo tespiti:
- `Phase 2 approve` backend tarafinda `%80` altini operator onayina zorluyor.

Kurallar:
- `>= 80`: operator onayi olmadan ilerleyebilir
- `60 - 79`: operator onayi zorunlu
- `< 60`: varsayilan davranis `review_required`; operasyon isterse reject / reprocess uygular

## 2. Review Karari

| Durum | Karar |
|---|---|
| Düsuk confidence ama olcu net | Operator onayi ile devam |
| Satir parse edilemedi | Reprocess veya hata akisi |
| Satir eksik alani var | Operator duzeltir, audit kaydi olusur |

## 3. Duplicate Koruma

Kod kaniti:
- Ingest sirasinda `dosya_hash` ile duplicate bloklaniyor.
- Istisna sadece `force_duplicate=true`.

Kurallar:
- Ayni hash + force yok -> `reject`
- Ayni hash + force var -> yeni kayit acilir, audit notu beklenir
- Duplicate belge launch KPI icinde ayrica raporlanmali

## 4. Kanal Davranisi

| Kanal | Varsayilan |
|---|---|
| Manual import | Aktif |
| Watch folder scan | Aktif |
| Scanner device | Pilot |
| Email | Kapsam disi |
| Telegram | Kapsam disi |

## 5. Kapanis Kriteri

Bu belge kapali sayilmaz, eger:
- Confidence esigi owner onayi almadiysa
- Duplicate belge istisnasi yazili degilse
- Reprocess / reject sorumlusu tanimlanmadiysa
