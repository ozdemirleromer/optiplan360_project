# XLSX Import Teknik Dokümantasyonu

Bu dosya, Sipariş Editörü için uygulanan özel XLSX aktarım mantığını ve kurallarını içerir. Gelecek güncellemeler bu kurallar üzerinden devam edecektir.

## 1. Sütun Eşleşmeleri (Column Mapping)

XLSX dosyası okunurken başlık (header) kontrolü yapılsa bile, kullanıcı şablonu için aşağıdaki sabit indeksler (0 tabanlı) önceliklidir:

| İndeks | Kolon İsmi | Açıklama |
| :--- | :--- | :--- |
| **0** (A) | **Kalınlık / Bilgi** | Metadata olarak okunur. |
| **1** (B) | **Boy (mm)** | Ölçünün boy bilgisi. |
| **2** (C) | **En (mm)** | Ölçünün en bilgisi. |
| **3** (D) | **Adet** | Parça adedi. |
| **4** (E) | **Desen (Grain)** | Parça deseni (0-3). |
| **5** (F) | **Üst 1 Bant (U1)** | Kenar bandı. |
| **6** (G) | **Üst 2 Bant (U2)** | Kenar bandı. |
| **7** (H) | **Kenar 1 Bant (K1)** | Kenar bandı. |
| **8** (I) | **Kenar 2 Bant (K2)** | Kenar bandı. |
| **9** (J) | **DELİK-1** | Delik ölçüsü. |
| **10** (K) | **DELİK-2** | Delik ölçüsü. |
| **11** (L) | **BİLGİ** | Parça açıklaması. |

## 2. Metadata Ayıklama (Extraction) Kuralları

Sistem, ilk 10 satırı tarayarak aşağıdaki bilgileri otomatik doldurur:

- **Kalınlık (Thickness):** 
  - Regex: `(\d+)\s*MM` (Ör: "18MM", "18 mm")
  - Fallback: Eğer 0. kolonda sadece sayı varsa ve 1-60 arasındaysa (Ör: "18") kalınlık olarak kabul edilir.
- **Plaka Boyutu (Plate Size):**
  - Regex: `(\d+)\s*[*X]\s*(\d+)` (Ör: "210*280", "183x366")
  - Otomatik Dönüşüm: Eğer değerler 1000'den küçükse (cm cinsinden varsayılıp) 10 ile çarpılarak mm'ye çevrilir (210 -> 2100).
- **Renk / Malzeme (Material):**
  - Regex: "RENK:" veya "Renk:" ile başlayan hücreler taranır. 
  - Değer, iki nokta (`:`) veya eşittir (`=`) işaretinden sonraki kısım olarak alınır. 
  - Eğer değer yan hücredeyse o da okunur.
- **Müşteri Adı:**
  - Import edilen dosyanın adı (uzantısız) otomatik olarak Müşteri alanına yazılır.

## 3. Veri İşleme Kuralları

- **Bant İşaretleri:** Bant sütunlarındaki (4, 5, 6, 7) hücre doluysa ve negatif bir değer (0, yok, hayır, false) içermiyorsa, ilgili hücre otomatik olarak "Seçili (Tik)" durumuna getirilir. Bu sayede dosyadaki veri kaybı önlenir ve doğaçlama doldurma yapılmaz.
- **Header Algılama:** Eğer ilk 4 kolondan 1, 2 ve 3. indekslerin hepsi sayıysa, o satır "Veri Başlangıç Satırı" olarak kabul edilir ve aktarım oradan başlar.

## 4. UI Değişiklikleri

- Üst bardaki "Varsayılan Desen" seçimi kaldırıldı.
- Yerine serbest metin girişi yapılabilecek "Renk / Malzeme" alanı eklendi.
- "Optimizasyona Gönder" butonu ile sipariş kaydedildikten sonra doğrudan planlama kuyruğuna aktarım sağlanıyor.

---
*Son Güncelleme: 22.02.2026*
