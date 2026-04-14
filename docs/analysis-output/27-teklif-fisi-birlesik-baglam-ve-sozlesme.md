# Teklif Fişi — Birleşik Bağlam ve Uygulama Sözleşmesi

Tarih: 2026-03-24  
Durum: `Uygulamada` (Frontend + Backend sözleşme güncel)

## 1) Amaç
Bu doküman, son sprintte kararlaşan yakın konuları tek bağlamda birleştirir:
- Teklif Fişi sade ticari alan seti
- Satır bazlı vergi kuralı
- Otomatik belge numarası formatı
- UI/payload/test kabul çerçevesi

## 2) Kapsam (Netleşen Alanlar)

### Üst Bölge (Sabit Bilgiler)
- Cari Kodu (read-only)
- Telefon (read-only)
- Belge Numarası (otomatik, read-only)

### Orta Bölge (Satır Bazlı)
- Stok Kodu
- Stok Adı
- Miktar
- Birim Fiyat
- Vergi (`Boş`, `%10`, `%20`)
- Tutar (satır bazlı vergi dahil)

### Alt Bölge (Özet)
- Toplam
- Vergi
- Genel Toplam

## 3) İş Kuralları (Kesin)
1. Vergi alanı sadece üç değer alır: `""`, `10`, `20`.
2. Vergi `""` ise vergi uygulanmaz (`tax_rate = 0`).
3. Vergi seçiliyse satır tutarı vergi dahil hesaplanır.
4. Belge numarası otomatik üretilir: `TF-YYYY-######`.
5. En az 1 satır zorunludur.
6. Miktar `> 0`, birim fiyat `>= 0` olmalıdır.

## 4) Hesap Formülleri

### Satır
- Satır Net = `Miktar × Birim Fiyat`
- Satır Vergi = `Satır Net × (VergiOranı / 100)`
- Satır Tutar = `Satır Net + Satır Vergi`

### Belge Özeti
- Toplam = `Σ Satır Net`
- Vergi = `Σ Satır Vergi`
- Genel Toplam = `Toplam + Vergi`

## 5) Frontend → API Eşleme

### Header
- `account_id` ← seçilen cari
- `document_no` ← otomatik belge numarası (`TF-YYYY-######`)
- `title` ← opsiyonel; gönderilmezse backend `document_no`/`quote_number` ile doldurur
- `valid_until` ← geçerlilik tarihi
- `tax_rate` = `0` (satır bazlı modele geçildi)
- `discount_rate` = `0`

### Lines
- `product_code` ← stok kodu
- `description` ← stok adı
- `quantity` ← miktar
- `unit_price` ← birim fiyat
- `tax_rate` ← satır vergisi (`"" -> 0`)
- `discount_rate` = `0`

## 6) Terminoloji Standardı
- Görsel metinlerde `Teklif No` yerine `Belge Numarası` kullanılır.
- Ticari özet alan adları: `Toplam / Vergi / Genel Toplam`.

## 7) Test Kabul Kriterleri
1. Create kartında Cari Kodu/Telefon/Belge Numarası görünür.
2. Belge Numarası regex: `^TF-\d{4}-\d{6}$`.
3. Satır vergi seçimi üçlü setle çalışır (`Boş/%10/%20`).
4. Vergi `Boş` için payload `tax_rate = 0` gönderir.
5. Hedef test dosyası tam geçer: `src/features/CRM/TeklifFisiPage.test.tsx`.

## 8) Uygulama Durumu
- Frontend bileşen güncellendi: `frontend/src/features/CRM/TeklifFisiPage.tsx`
- Frontend servis tipi güncellendi: `frontend/src/services/crmService.ts`
- Backend quote sözleşmesi güncellendi: `backend/app/features/crm/transport/http/router.py`
- Backend quote hesap/oluşturma servisi güncellendi: `backend/app/services/crm_service.py`
- Hedef testler geçiyor: `frontend/src/features/CRM/TeklifFisiPage.test.tsx` (`9/9`)
- CRM real UI testi geçiyor: `frontend/src/__tests__/CRMPage.real.test.tsx` (`9/9`)
- Backend CRM servis testi geçiyor: `backend/tests/test_crm_service.py` (`5/5`)

## 9) Sonraki Teknik Adım (Önerilen)
`document_no` için ayrı veritabanı kolonu istenirse migration açılarak `crm_quotes.document_no` alanı eklenebilir. Mevcut durumda API düzeyinde `document_no` alanı `quote_number` ile eşlenmektedir.
