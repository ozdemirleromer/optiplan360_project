# EBATLAMAALANI — GÜNCELLENMİŞ FİNAL SOURCE OF TRUTH + TAM KAPSAMLI UI TASARIM PROMPTU

## 1. AMAÇ

Bu doküman, OptiPlan 360 için şimdiye kadar netleşmiş kararları tek yerde toplar.
Önceki çelişkili notlar, eski kapsam uyarıları ve artık geçersiz hale gelen sınırlamalar bu dosyada temizlenmiştir.

Bu doküman:
- bağlayıcıdır
- source of truth olarak kullanılacaktır
- uygulama, UI tasarımı, entegrasyon ve test için ortak referanstır
- burada yazmayan kural eklenmeyecektir

---

## 2. GÜNCELLENMİŞ KAPSAM

### 2.1 UI geliştirilecek modüller
Aşağıdaki modüller kapsam içindedir ve gerçek UI geliştirilecektir:

- Phase 1 — OCR Havuzu
- Phase 2 — OCR Kontrol
- Phase 3 — Sipariş Düzenleme
- Phase 4 — Optiplanning / Export / XML Fire
- Klasör Yönetim Ekranı
- Cari Kartı
- Stok Kartı
- Sipariş Fişi
- Teklif Fişi

### 2.2 Teknik kapsam içi katmanlar
- Mikro SQL entegrasyon katmanı
- OCR ham veri / audit / retry / revizyon altyapısı
- Watcher yaşam döngüsü
- Export / XML / mapping katmanı
- Yetki modeli
- Test ve hardening katmanı

### 2.3 Kapsam dışı modüller
- İrsaliye
- Fatura
- Depo Sayım
- Satın Alma
- Üretim Reçetesi
- Barkod / etiket tasarımı
- Tevkifat
- Login altyapısı ayrı proje değilse, yalnızca mevcut sistem yetki modeli kapsamında ele alınır

---

## 3. KALDIRILAN ESKİ UYARILAR

Aşağıdaki eski uyarılar artık geçersizdir ve kaldırılmış kabul edilir:

- “Cari / Stok / Sipariş / Teklif UI kapsam dışıdır” uyarısı kaldırılmıştır.
- “OptiPlan içinde yeni cari / stok açılmaz” kararı iptal edilmiştir.
- Bu modüller için yalnızca entegrasyon yapılır yaklaşımı artık geçerli değildir.

Yeni durum:
- Cari, stok, sipariş ve teklif için UI kapsam içindedir
- gerekli create / edit / liste / detay / durum / Mikro yazım akışları tanımlanacaktır

---

## 4. KİLİTLENMİŞ YENİ KARARLAR

### 4.1 Cari / Stok / Sipariş / Teklif UI
Bu modüller artık resmi olarak UI kapsamındadır.

### 4.2 Yeni cari / stok açma
Eski yasak iptal edilmiştir.
OptiPlan içinde yeni cari ve stok açılabilir.

### 4.3 Yetki modeli
Yetki modeli yalnızca görünürlük kuralı değildir.
Gerçek sistem kapsamındadır.

### 4.4 Teklifte fiyat
Teklif fişinde fiyat alanları kapsam içindedir.

### 4.5 Siparişte fiyat
Sipariş fişinde fiyat alanları olacaktır.

### 4.6 Tekliften siparişe dönüşüm
Fiyat alanları siparişe taşınacaktır.

### 4.7 Numaralandırma
Cari / Stok / belge numaralandırma formatları bağlayıcıdır.

### 4.8 Plaka mikro UI detayı
Yeni plaka ekleme ve `Plaka_Ref` değiştirme mikro UI detayı daha sonra belirlenebilir.
Bu, ürün kararı değil uygulama detayıdır.

---

## 5. ANA ÜRÜN TANIMI

OptiPlan 360:
- bağımsız ERP değildir
- Mikro Vr15 ile Optiplanning arasında çalışan bir gateway / entegrasyon katmanıdır
- ancak artık belirli master data ve belge ekranlarını da içeren hibrit operasyon arayüzüne dönüşmüştür
- ticari hesap motoru yine Mikro merkezli kalacaktır
- teknik veri, operasyonel veri ve belge hazırlama akışları OptiPlan içinde yönetilecektir

---

## 6. BAĞLAYICI TEKNOLOJİ YIĞINI

- Backend: FastAPI
- Frontend: React / Next.js
- OCR: OpenCV + Gemini
- OptiPlan DB: PostgreSQL
- Mikro DB: MS SQL Server
- Kurulum: On-Premise / Local Network
- Klasör izleme: Watcher tabanlı yapı
- Bildirim uyumu: Adapter / Provider Pattern

---

## 7. PHASE 1 — OCR HAVUZU

### Kaynak klasörler
- whatsapp_raw
- scanner_raw
- manuel_raw
- email_raw

### Yaşam döngüsü
1. dosya alınır
2. `_islenmis` klasörüne taşınır
3. işlem kaydı açılır
4. OCR başlar
5. iş tamamlanınca `_arsiv` klasörüne taşınır
6. hatalı iş `hatali_klasoru`na taşınır

### Kurallar
- overwrite yasaktır
- sistem kapanırsa `_islenmis` içindekiler devam eder

### Teknik alanlar
- Kayit_UUID
- Ham_Dosya_Adi
- Kaynak_Klasor
- Gelis_Tarihi
- Dosya_Durumu
- Orijinal_Dosya_Yolu
- Dosya_Hash
- OCR ham JSON
- ayrıştırılmış OCR alanları

### Persistence
- ham JSON tutulur
- ayrıştırılmış alanlar tutulur
- dosya yolu + hash + kaynak klasör tutulur

---

## 8. PHASE 2 — OCR KONTROL

### Ekran yapısı
- split-screen
- sol panel: orijinal görsel
- sağ panel: doğrulama grid’i

### Grid alanları
Sadece:
- BOY
- EN
- ADET

### Görünmeyecek alanlar
- Malzeme
- GRAIN
- BİLGİ
- DELİK-1
- DELİK-2

### Yardımcı alanlar
- Okunan_Cari_Unvan
- Okunan_Cari_Telefon
- Ham_Dosya_Adi
- Kaynak_Klasor
- AI_Guven_Skoru_Ozeti
- Revizyon_Adayi_Uyarisi

### Confidence kuralı
- %80 altı hücre turuncu
- onaylanmadan faz geçişi yok

### Audit
- eski değer + yeni değer saklanır

### Çıkarılan satırlar
- kaybolmaz
- ayrı alanda tutulur
- Phase 2 ve Phase 3’te görünür
- geri alındığında yeni aktif satır olur

### Hatalı butonu
- bu fazda vardır
- hatali_klasoru akışı çalışır

---

## 9. PHASE 3 — SİPARİŞ DÜZENLEME

### Üst alanlar
- Cari_Unvan
- Cari_Kodu
- Siparis_No
- Termin
- Malzeme
- Stok_Kodu
- Bant_Kalinligi
- Grain_Varsayilan
- Plaka_Boy_mm
- Plaka_En_mm

### Grid alanları
- Malzeme
- BOY
- EN
- ADET
- GRAIN
- BİLGİ
- U1
- U2
- K1
- K2
- DELİK-1
- DELİK-2

### Cari / Stok seçim
- alanın kendisine tıklanınca açılır
- debounce ile arama
- tek seçim
- Enter ile onay
- Cari sonucu: Cari_Kodu + Cari_Unvan + Telefon
- Stok sonucu: Stok_Kodu + Stok_Adi
- seçim sonrası Cari_Kodu + Cari_Unvan güncellenir
- seçim sonrası Stok_Kodu + Malzeme güncellenir
- Cari_Kodu / Stok_Kodu manuel yazılamaz

### Hard blocker
- Cari_Kodu yoksa ilerleme yok
- Stok_Kodu yoksa ilerleme yok

### Siparis_No
- varsayılan: SIP-000001
- kullanıcı değiştirebilir
- çakışırsa uyarı verilir

### Termin
- sadece tarih
- zorunlu
- export’a gitmez
- Mikro’ya gitmez
- PostgreSQL’de tutulur

---

## 10. GRAIN / BANT / BİLGİ / DELİK

### Grain
- değer kümesi: 0, 1, 2, 3
- export’a integer gider
- boşsa varsayılan 3
- üst barda hızlı seçim
- gridde dropdown override

### Bant kalınlığı
UI:
- 0.40 MM
- 1 MM
- 2 MM

Export:
- 04
- 1
- 2

Kurallar:
- başka değer yok
- üst barda dropdown
- satır bazlı override dropdown
- U1/U2/K1/K2 false ise export hücresi boş
- true ise ilgili export kodu yazılır

### Bilgi / Delik
- BİLGİ = Parça Tanımı
- DELİK-1 = Ön yüz barkod odun bilgisi
- DELİK-2 = Arka yüz barkod odun bilgisi
- sadece Phase 3’te görünür
- üçü de opsiyonel
- BİLGİ serbest metin + karakter sınırı
- DELİK alanları sadece rakam
- export’a aynen taşınır

---

## 11. PLAKA YÖNETİMİ

- aynı işte birden fazla plaka olabilir
- badge formatı: PLAKA-1 (2100x2800)
- her satır `Plaka_Ref` taşır
- yeni satır aktif plakaya bağlanır
- plaka değişimi onaylıdır
- plaka değişince merge uygunluğu yeniden hesaplanır

### Plaka listesi
- sabit liste vardır
- örnek: 18 MM 210*280
- yeni plaka eklenebilir
- düzenlenebilir
- silinebilir

### Kapsam kararları
- yeni plaka: sadece bu iş / genel liste
- düzenleme: sadece bu iş / genel listedeki tanım
- silme: sadece bu iş / genel listeden sil

### Not
Yeni plaka ekleme ve `Plaka_Ref` değiştirme mikro etkileşim detayı uygulama aşamasında belirlenebilir.

---

## 12. SATIR BİRLEŞTİRME

Satırlar ancak şu alanlar aynıysa birleşir:
- Plaka_Ref
- BOY
- EN
- U1
- U2
- K1
- K2
- Bant_Kalinligi_Override
- BİLGİ
- DELİK-1
- DELİK-2

Sonuç:
- ADET toplanır
- tek satıra düşer

Kurallar:
- OCR / MANUEL fark etmez
- Optimizasyona Gönder öncesi çalışır
- önizleme gösterilir
- nihai export listesi gösterilir
- kullanıcı onay verir
- önizlemede düzenleme yapılmaz

---

## 13. FIRE AÇIKLAMASI

- tek genel alan
- satır bazlı değil
- textarea
- başlangıçta boş olabilir
- sonradan sistem doldurabilir
- kullanıcı düzenleyebilir
- XML/fire devredeyse zorunlu olur

---

## 14. EXPORT

### Ana buton
- Optimizasyona Gönder

### Doğrulama sırası
1. hard blocker
2. grid validation
3. merge hazırlığı
4. merge preview
5. export hazırlığı
6. dosya üretimi
7. PostgreSQL durum güncellemesi

### Çıktı seçimleri
- varsayılan seçim Klasör Yönetim’den gelir
- kullanıcı export anında .xlsx / .opj değiştirebilir

### Excel butonu
- ayrı export davranışıdır

### CSV butonu
- placeholder olabilir

### Yazdır butonu
- gerçek fonksiyon olacaktır

### Export dosya adı
`MUSTERI_ADI_MALZEME_RENGI_VE_CINSI_TARIH`

### Normalizasyon
- Türkçe karakter normalize edilir
- boşluk `_`
- tüm metin büyük harf

### Çakışma
- revizyon: `_v2 / _v3`
- yeni ayrı iş: `_01 / _02`
- retry: `_r1 / _r2`

### Siparis_No
- export adına yazılmaz
- DB export kaydıyla ilişkilendirilir

### Başarısız export
- başarılı dosyalar korunur
- yarım/hatalı export status ile işaretlenir
- ayrı yarim_export_klasoru yoktur

---

## 15. HATA / RETRY / REVİZYON

- Hatalı butonu hem Phase 2 hem Phase 3’te vardır
- hatali_klasoru Klasör Yönetim’den tanımlanır
- hata özeti gösterilir
- taslak mesaj alanları zorunludur
- Diger seçilirse not zorunlu
- yeni işleme yeni işlem kaydı açılır
- eski hata kaydı korunur
- Revizyon_No ve Retry_No ayrı tutulur

---

## 16. KLASÖR YÖNETİMİ

Tanımlanacak alanlar:
- whatsapp_raw_klasoru
- scanner_raw_klasoru
- manuel_raw_klasoru
- email_raw_klasoru
- islenmis_klasoru
- arsiv_klasoru
- xml_okuma_klasoru
- xlsx_cikti_klasoru
- opj_cikti_klasoru
- hatali_klasoru
- fis_evrak_no_formati
- arsiv_zaman_damgasi_formati
- xlsx_aktif_mi
- opj_aktif_mi
- watcher_aktif_mi
- yeniden_deneme_sayisi

Kurallar:
- hardcoded yol olmayacak
- watcher kapalıysa manuel içe aktar çalışır
- manuel içe aktar tipleri: .jpg, .png, .pdf
- duplicate manual importta kullanıcı uyarılır, isterse devam eder

---

## 17. MİKRO ENTEGRASYONU

### Mikro’dan okunacaklar
Cari:
- Cari_Kodu
- Cari_Unvan
- Telefon

Stok:
- Stok_Kodu
- Stok_Adi

### Mikro’ya yazılacaklar
Header:
- Cari_Kodu
- Evrak_No
- Tarih
- teklif ise Gecerlilik_Tarihi

Satır:
- Stok_Kodu
- Miktar
- Satir_Aciklamasi

### Kural
- Mikro verileri PostgreSQL’e kopyalanmaz
- SQL detayları referans dokümanlara göre uygulanır
- doğaçlama alan eklenmez

---

## 18. YENİ UI MODÜLLERİNE İLİŞKİN KİLİTLİ KARARLAR

### Cari Kartı
- UI kapsam içindedir
- yeni cari açılabilir
- yetki modeli gerçek sistem kapsamındadır
- numaralandırma bağlayıcıdır
- taslak → Mikro’ya yazım akışı olacaktır

### Stok Kartı
- UI kapsam içindedir
- yeni stok açılabilir
- numaralandırma bağlayıcıdır
- taslak → Mikro’ya yazım akışı olacaktır

### Sipariş Fişi
- UI kapsam içindedir
- fiyat alanı olacaktır
- belge numaralandırması bağlayıcıdır

### Teklif Fişi
- UI kapsam içindedir
- fiyat alanları kapsam içindedir
- siparişe dönüşümde fiyat taşınacaktır
- belge numaralandırması bağlayıcıdır

---

## 19. TAM KAPSAMLI UI TASARIM PROMPTU

Aşağıdaki prompt, uygulama ajanının yalnızca kodu değil, tüm ekranları profesyonel düzeyde, tutarlı, dense, ERP uyumlu ve operasyon odaklı biçimde tasarlaması için bağlayıcı tasarım talimatıdır.

### UI TASARIM GÖREVİ
Tüm modüller için aşağıdaki tasarım ilkelerine uy:

#### Ana prensipler
- Tasarım modern vitrin arayüzü değil, operasyonel ERP arayüzü olacaktır
- Dense UI zorunludur
- Grid merkezli kullanım tercih edilir
- Gereksiz padding ve boşluk azaltılır
- Keyboard-first kullanım desteklenir
- Renkler estetik değil işlev odaklı kullanılır
- Kritik alanlar ilk bakışta görünür olmalıdır
- Sessiz hatalar ve sessiz veri dönüşümleri yasaktır
- Her önemli aksiyon görünür geri bildirim vermelidir

#### Genel ekran ilkeleri
- Üst bar: kimlik ve bağlam alanları
- Orta alan: grid, liste veya doğrulama alanı
- Alt / yan alan: yardımcı bilgi, uyarı, hata, preview veya audit özetleri
- Buton hiyerarşisi net olacak:
  - ana aksiyon
  - ikincil aksiyon
  - tehlikeli aksiyon
- Modal yalnızca gerçekten gerekli yerde
- Mümkünse yan panel / drawer / inline edit tercih edilir

#### Keyboard-first ilkeleri
- Tab sırası mantıklı olacak
- Enter ile seçim/onay akışı desteklenecek
- Grid içinde odak kaybolmayacak
- Popup/listelerde klavye ile seçim yapılabilecek
- Yoğun veri girişinde mouse bağımlılığı azaltılacak

#### Görsel hiyerarşi ilkeleri
- Üst bar ile grid karışmayacak
- Yardımcı alanlar ana işi gölgelemeyecek
- Uyarılar işlevsel renkle ayrışacak
- Confidence, blocker, hata ve success durumları net görünür olacak
- Badge kullanımı sade ve işlevsel olacak

#### Phase 1 UI tasarım kuralları
- liste yoğun veri takibine uygun olacak
- satır yüksekliği gereksiz büyük olmayacak
- dosya adı, kaynak klasör, geliş tarihi ve durum kolay okunacak
- durum sütunu operasyonel izlemeyi kolaylaştıracak

#### Phase 2 UI tasarım kuralları
- split-screen dengeli olacak
- sol panel görsel incelemeye yetecek
- sağ panel grid doğrulama için optimize olacak
- BOY / EN / ADET dışındaki alanlar görünmeyecek
- turuncu confidence vurgusu belirgin ama boğucu olmayacak
- kullanıcı neden ilerleyemediğini açıkça görecek
- çıkarılan satırlar görünür ama ana işi bozmayan biçimde konumlanacak

#### Phase 3 UI tasarım kuralları
- üst bar alan sırası operasyon akışına göre olacak
- grid yoğunluğu korunacak
- kolonlar okunabilir ama kompakt olacak
- Cari / Stok kod alanları readonly input gibi görünecek
- Malzeme, Grain ve Bant seçimleri hızlı erişilebilir olacak
- BİLGİ / DELİK girişleri net ayırt edilecek
- Fire_Aciklamasi yardımcı ama görünür konumda olacak
- manuel satır ekleme hızlı olacak
- Plaka badge görünürlüğü kuvvetli olacak

#### Cari Kartı UI tasarım kuralları
- Liste + filtre + detay akışı olacak
- Hızlı arama zorunlu
- Yeni kayıt, taslak kayıt, Mikro’ya yaz durumu görünür olacak
- Alan grupları:
  - temel kimlik
  - iletişim
  - vergi / resmi bilgiler
  - adres / not
  - sistem durumu / audit
- Yetkiye bağlı aksiyonlar görünür biçimde ayrılacak

#### Stok Kartı UI tasarım kuralları
- Liste + filtre + detay akışı olacak
- Teknik alanlar kompakt gruplandırılacak
- Malzeme tipi, kalınlık, ölçü, birim, kategori alanları birbirine yakın konumlandırılacak
- Taslak / Mikro’ya yazım / aktif-pasif durumu görünür olacak

#### Sipariş Fişi UI tasarım kuralları
- Liste + filtre + detay / edit akışı olacak
- Başlık ve satır alanları ayrışacak
- Fiyat alanları görünür olacak
- Mikro’ya yazım durumu, revizyon ve belge statüsü net olacak
- Phase 3’ten gelen teknik satırların okunabilirliği korunacak

#### Teklif Fişi UI tasarım kuralları
- Liste + filtre + detay / edit akışı olacak
- Fiyat ve indirim alanları belirgin olacak
- Siparişe dönüştür aksiyonu görünür ve güvenli olacak
- Teklif statüsü, geçerlilik tarihi ve toplam alanları net görünmeli

#### Klasör Yönetim UI tasarım kuralları
- Çok sayıda config alanı mantıklı gruplara ayrılacak
- giriş klasörleri / çıktı klasörleri / hata klasörleri / watcher ayarları ayrı bölümlerde olacak
- kritik alanlar ve yanlış yapılandırma riskleri görünür uyarılarla desteklenecek

#### Hata / Retry UI tasarım kuralları
- Hatalı aksiyonu tehlikeli buton olarak görünür ama kontrollü olacak
- Hata özeti bağlam verecek
- Retry ve revizyon durumları kullanıcıyı belirsizlikte bırakmayacak

#### Merge Preview UI tasarım kuralları
- birleşen satırlar ve nihai export listesi ayrışacak
- kullanıcı onay vermeden export ilerlemeyecek
- önizlemede düzenleme yapılmayacak
- gerekiyorsa asıl gride dönüş kolay olacak

---

## 20. SON KURAL

Bu dosya, çelişki çözülmüş, güncellenmiş ve genişletilmiş source-of-truth’tur.
Uygulama, UI tasarımı, entegrasyon ve test bu dosyaya göre ilerletilecektir.
