# OptiPlan 360 – Master Uygulama Paketi v1
## Kapsamlı Ürün / UI-UX / Uygulama Sıralaması Dosyası

## 0. Amaç

Bu dosya, OptiPlan 360 için konuşma boyunca kesinleştirilen:
- ürün konumu
- faz sınırları
- iş kuralları
- UI/UX kararları
- operasyonel ekran beklentileri
- eksik kalan teknik sözleşme ihtiyaçları
- uygulama sıralaması / teslim planı

başlıklarını **tek dosyada** toplar.

Bu belge, ekiplerin kapsam kaydırmadan ilerlemesi için **master referans** olarak kullanılmalıdır.

---

# 1. Ürün Konumu ve Mimari Çerçeve

## 1.1. Ürün tanımı
OptiPlan 360 bağımsız ERP değildir.

Bu sistem:
- Mikro Vr15
- Optiplanning

arasında çalışan bir:
- operasyonel köprü
- workflow katmanı
- veri hazırlama ve doğrulama sistemi

olarak konumlanır.

## 1.2. Temel ilke
- Ticari kuralların ana sahibi Mikro Vr15’tir
- Cari, stok, sipariş ve ERP otoritesi Mikro’dadır
- OptiPlan 360 ERP’yi yeniden yazmaz
- Fazlar arası kontrollü operasyon akışı sağlar

## 1.3. Kapsam mantığı
Bu master paket içinde en olgun ve detaylı tanımlanan modüller:
- Phase 1 – OCR Havuzu
- Phase 2 – OCR Kontrol
- Phase 3 – Sipariş Kontrol & ERP Eşleştirme

Phase 4 burada yalnız sınırlarıyla anılır; detaylı export sözleşmesi ayrıca netleştirilmelidir.

---

# 2. Fazların Rolü

## 2.1. Phase 1 – OCR Havuzu
Amaç:
- klasörlerden dosya almak
- duplicate kontrol etmek
- OCR pipeline çalıştırmak
- retry/hata yönetmek
- Phase 2’ye hazır kayıt üretmek

## 2.2. Phase 2 – OCR Kontrol
Amaç:
- belgeyi ve OCR sonucunu yan yana göstermek
- yalnızca kritik alanları doğrulatmak
- düşük confidence alanları operatöre onaylatmak
- blocker temizlenmeden bir sonraki faza geçişi engellemek

## 2.3. Phase 3 – Sipariş Kontrol & ERP Eşleştirme
Amaç:
- sistemin ana operasyon merkezi olmak
- cari/stok eşleştirme yapmak
- sipariş satırlarını kontrol etmek
- çoklu plaka / satır birleştirme / fire açıklaması gibi süreçleri taşımak
- Phase 4 öncesi son operasyonel doğrulamayı yapmak

## 2.4. Phase 4 – Export / Üretim Çıktısı
Amaç:
- Phase 3’te temizlenmiş kayıtları export/çıktı akışına taşımak

Not:
Bu belge Phase 4’ü tam teknik detayla kapatmaz; ancak Phase 3’ten çıkışın Phase 4’e bağlı olduğunu kabul eder.

---

# 3. Teknoloji Yığını

## 3.1. Backend
- Python
- FastAPI
- SQLAlchemy Async
- PostgreSQL

## 3.2. OCR / Görsel İşleme
- OpenCV
- Google Gemini API

## 3.3. Frontend
- React
- Next.js (App Router)
- Tailwind CSS

## 3.4. UI kuralları
- hazır ağır UI kütüphaneleri yok
- dense ERP dili korunur
- gereksiz modern SaaS görsel dili kullanılmaz
- saf Tailwind + gerektiğinde Lucide React ikonları kullanılabilir

---

# 4. Genel Mimari İlkeler

- hardcoded klasör yolu yasak
- hardcoded müşteri/evrak tipi iş kuralı yasak
- faz geçişleri operatör onayına bağlıdır
- durum yönetimi izlenebilir olmalıdır
- audit izi zorunludur
- hata ve retry akışları görünür olmalıdır
- UI ile backend kuralları uyumlu olmalıdır
- sistem graceful fallback davranışları taşımalıdır

---

# 5. Phase 1 – OCR Havuzu: Tam Çerçeve

## 5.1. Amaç
Phase 1, arka planda çalışan asenkron dosya alma ve OCR hazırlama servisidir.

## 5.2. Kapsam
- klasör izleme
- dosya alımı
- duplicate kontrolü
- lifecycle takibi
- preprocessing
- OCR çağrısı
- parse / normalize
- retry
- hata yönetimi
- Phase 2’ye hazır kayıt üretimi

## 5.3. Kapsam dışı
- manuel veri düzeltme
- operatör hücre onayı
- cari/stok eşleştirme
- sipariş düzenleme
- export üretimi

## 5.4. Kaynak klasör modeli
Mantıksal klasör tipleri örnek:
- whatsapp_raw
- scanner_raw
- manuel_raw
- email_raw

Kural:
- fiziksel yol config/DB’den okunur
- klasörler aktif/pasif yönetilebilir
- watcher bunları dinler

## 5.5. Ana akış
1. Yeni dosya algılanır
2. Ön kayıt açılır
3. Duplicate kontrolü yapılır
4. İşleme kilidi oluşturulur
5. Dosya processing alanına alınır
6. OpenCV preprocessing uygulanır
7. Gemini OCR çağrısı yapılır
8. Sonuç parse edilir
9. Normalize edilir
10. DB’ye yazılır
11. Kayıt Phase 2 Bekliyor durumuna geçer

## 5.6. Duplicate kontrolü
Duplicate yalnız dosya adına göre yapılmaz.

Birlikte değerlendirilecek sinyaller:
- dosya adı
- dosya boyutu
- hash/checksum
- kaynak tipi
- önceki kayıtlar

Duplicate tespit edilirse:
- yeniden işleme alınmaz
- duplicate statüsü atanır
- loglanır
- ayrıştırılır

## 5.7. Dosya yaşam döngüsü
Asgari durumlar:
- Alındı
- Duplicate
- İşleniyor
- OCR İşleniyor
- Phase 2 Bekliyor
- OCR Hatası - Yeniden Denenecek
- Hatalı
- Manuel Müdahale Gerekli

## 5.8. Processing mantığı
Ayrı alanlar:
- raw
- processing/isleniyor
- retry/error
- final/archive

Kural:
OCR tamamlanmadan nihai işlendi alanına taşınmaz.

## 5.9. OCR preprocessing
OpenCV işlemleri modüler olmalıdır:
- grayscale
- threshold
- contrast
- noise reduction
- rotate / deskew
- crop alignment

## 5.10. Gemini OCR çıktısı
Asgari alanlar:
- Unvan
- Telefon

Satır bazlı alanlar:
- Boy_mm
- En_mm
- Adet
- Malzeme
- Bant_1
- Bant_2
- Bant_3
- Bant_4
- Yon
- Delik
- Parca_Adi
- Durum

Her alan için mümkünse:
- raw_value
- normalized_value
- confidence_score
- bbox
- source_text

## 5.11. OCR fallback kuralları
- bbox yoksa kayıt yine saklanır
- confidence yoksa manual review gerekir
- parse kısmi başarısızsa hata loglanır
- sistem çökmez

## 5.12. Retry politikası
Retry’a düşebilecek örnek durumlar:
- timeout
- API erişim hatası
- geçici servis hatası
- parse hatası
- eksik kritik payload
- bozuk JSON

Tutulacak alanlar:
- retry_count
- last_error_message
- last_attempt_at
- next_retry_at

Kural:
- retry sınırsız değildir
- geçmiş izlenebilir olmalıdır
- manuel yeniden deneme desteklenmelidir

## 5.13. Phase 1 operasyon ekranı
Ana parçalar:
- header
- özet kartlar
- filtre paneli
- ana queue tablosu
- kayıt detay drawer
- hata kayıt görünümü
- klasör sağlık görünümü
- empty state

## 5.14. Üst kartlar
Asgari kartlar:
- Toplam Kayıt
- Duplicate Kayıt
- Retry Bekleyen
- OCR Hatası
- Phase 2 Bekliyor
- Aktif Klasör
- Manuel Müdahale Gerekli

## 5.15. Filtreler
- arama
- durum
- kaynak tipi
- klasör tipi
- duplicate
- retry gereken
- tarih aralığı
- Phase 2 bekliyor
- manuel müdahale gerekli

## 5.16. Queue tablosu
Asgari kolonlar:
- Kayıt UUID
- Dosya Adı
- Kaynak Tipi
- Kaynak Klasör
- Durum
- Duplicate
- Retry Sayısı
- Son Hata
- Oluşturulma Zamanı
- Son Güncelleme
- Sonraki Retry
- Phase 2 Durumu

## 5.17. Kayıt detay paneli
İçerik:
- metadata
- lifecycle geçmişi
- duplicate sinyalleri
- retry geçmişi
- son hata
- OCR işlem özeti
- Phase 2’ye hazır mı

## 5.18. Phase 1 için mevcut eksik teknik katmanlar
Hâlâ ayrıca yazılması gerekenler:
- tam API sözleşmesi
- tam DTO kontratı
- Phase 1 state matrix
- Phase 1 acceptance pack

---

# 6. Phase 2 – OCR Kontrol: Tam Çerçeve

## 6.1. Amaç
Belge ile OCR sonucunu yan yana göstererek kritik alanları operatöre doğrulatmak.

## 6.2. Kapsam
- split-screen kontrol alanı
- görsel ile veri eşleme
- düşük confidence hücre onayı
- hatalı görsel ayrıştırma
- kontrollü Phase 3 geçişi

## 6.3. Kapsam dışı
- genel sipariş düzenleme
- ERP eşleştirme
- cari/stok yönetimi
- export üretimi

## 6.4. Temel iş kuralı
Phase 2’de kritik doğrulama alanları (7 alan):
- BOY
- EN
- ADET
- U1
- U2
- K1
- K2

Diğer alanlar görüntülenebilir; blocker mantığı bu **7 kritik alan** üzerindedir.

## 6.5. Confidence kuralı
Eğer BOY, EN, ADET, U1, U2, K1 veya K2 alanlarından herhangi birinde:
- confidence_score < 80

ise hücre şüphelidir.

Şüpheli hücre:
- turuncu warning state alır
- operatör onayı ister
- onaylanmadan Phase 3’e geçişi engeller

## 6.6. Operatör onayı
Şüpheli hücre şu yollarla temizlenebilir:
- değer değiştirilir
- mevcut değer açıkça onaylanır

Onay aksiyonları örnek:
- Enter
- F2

Onay sonrası:
- warning kalkar
- audit bilgisi oluşur
- kullanıcı ve zaman bilgisi tutulur

## 6.7. Faz geçişi
Phase 2’den Phase 3’e geçiş:
- otomatik değildir
- yalnız operatör aksiyonu ile olur
- blocker yoksa mümkündür

Ana CTA:
- Phase 3’e Aktar

## 6.8. Ana yerleşim
- header
- split-screen main area
- footer/action bar

## 6.9. Split-screen
### Sol panel
- belge/görsel önizleme
- zoom
- pan
- bbox highlight
- selected cell odaklama

### Sağ panel
- dense OCR grid
- BOY / EN / ADET / U1 / U2 / K1 / K2 odaklı doğrulama
- hücresel warning / approval state

### Orta ayraç
- resizer
- varsayılan yaklaşık 50/50

## 6.10. Sol panel kuralları
- belge net render edilir
- seçili alan sarı çerçeve ile vurgulanır
- bbox yoksa bozulmaz
- fallback: zoom-sync atlanır

## 6.11. Sağ grid kuralları
Asgari kolonlar:
- satır no
- BOY
- EN
- ADET
- confidence göstergesi
- onay durumu

Grid özellikleri:
- dense
- kompakt
- ERP-benzeri
- klavye uyumlu

## 6.12. Hücre state’leri
- normal
- low confidence
- selected
- approved
- overridden
- read-only

## 6.13. Klavye davranışı
- Tab: sağa
- Shift+Tab: sola
- Enter: alta geç veya onay davranışı
- Arrow Keys: navigasyon
- F2: hücre onayı

## 6.14. Zoom-sync
Sağ grid’de hücre seçilince:
- bbox bulunur
- sol panel ilgili alana zoom yapar
- sarı çerçeve çizer

bbox yoksa:
- crash olmaz
- davranış sessizce atlanır

## 6.15. Hatalı Görsel akışı
Ekranda Hatalı Görsel aksiyonu bulunmalıdır.

Tetiklenince:
- kayıt süreçten çıkar
- durum Hatalı olur
- operatör notu alınabilir
- WhatsApp taslak mesaj akışı için modal açılır

Provider pattern altyapısı korunmalıdır.

## 6.16. Header
- ekran adı: OCR Kontrol
- kısa açıklama
- kuyruk bilgisi
- Yenile
- Hatalı Görsel
- Phase 3’e Aktar

## 6.17. Footer
- blocker mesajı
- onay bekleyen hücre sayısı
- seçili kayıt bilgisi
- ana CTA

## 6.18. Empty state
Boş ekran şunları anlatmalıdır:
- burada hangi kayıtların görüneceği
- hangi alanların doğrulandığı
- confidence mantığı
- kayıt gelince split-screen çalışma alanının açılacağı

## 6.19. Phase 2 için mevcut eksik teknik katmanlar
Hâlâ ayrıca yazılması gerekenler:
- tam interaction matrix
- exact UI tokens
- tam API response örnekleri
- Phase 2 acceptance pack

---

# 7. Phase 3 – Sipariş Kontrol & ERP Eşleştirme: Tam Çerçeve

## 7.1. Amaç
Phase 3 sistemin ana operasyon merkezidir.

## 7.2. Rol
- OCR sonrası düzenleme merkezi
- cari/stok eşleşme kontrolü
- sipariş satırı yönetimi
- çoklu plaka desteği
- satır birleştirme
- fire açıklaması
- Phase 4 öncesi son kontrol

## 7.3. Kapsam sınırı
Bu ekran:
- ERP’yi yeniden yazmaz
- yeni ticari kural motoru kurmaz
- yalnız operasyonel eşleştirme ve düzenleme yüzüdür

## 7.4. Kritik blocker’lar
### Cari eşleşmesi
Hard blocker’dır.

Cari eşleşmesi yoksa:
- akış ilerlemez
- CTA disabled olur

### Stok/malzeme eşleşmesi
Herhangi bir satırda stok eşleşmesi yoksa:
- hard blocker oluşur
- ilgili malzeme hücresi danger state alır
- export geçişi engellenir

## 7.5. Çoklu plaka
Sistem çoklu plaka senaryosunu destekler.
UI çok satırlı / çok plaka yapıyı taşıyabilir görünmelidir.

## 7.6. Satır birleştirme
Satır birleştirme kuralı vardır.
UI future-proof olmalıdır:
- toolbar aksiyonu
- drawer/modal özeti
- birleşme sonrası audit izi

## 7.7. Fire açıklaması
Fire açıklaması desteklenir.
UI:
- modal
- inline alan
- drawer

şeklinde taşıyabilir.

## 7.8. Ana layout
- header
- üst aksiyon toolbar’ı
- sipariş özet bandı
- çoklu plaka/gruplama alanı
- ana dense grid
- stok arama drawer
- cari arama modalı
- fire açıklaması alanı
- satır detay paneli
- validation summary box
- footer

## 7.9. Dense grid
Kolonlar örnek:
- #
- Malzeme / Material
- Boy
- En
- Adet
- Yön
- Açıklama
- Bant kolonları
- İlave Açıklama
- Açıklama 1
- Durum

## 7.10. Footer
- blocker mesajı
- metrikler
- Phase 4’e Aktar (Excel Üret) CTA

## 7.11. Phase 3 için mevcut eksik teknik katmanlar
Hâlâ ayrıca yazılması gerekenler:
- tam uygulama spesifikasyonu
- API/DTO kontratı
- interaction matrix
- acceptance pack
- Phase 4 export handoff sözleşmesi

---

# 8. Ortak Tasarım Dili

## 8.1. Genel tema
- arka plan: slate tabanlı koyu tema
- panel ve barlar: koyu panel tonları
- border’lar: ince ve belirgin
- dense ERP dili korunur

## 8.2. Tasarım karakteri
Olmalı:
- keskin çizgiler
- kompakt spacing
- yüksek veri yoğunluğu
- klavye dostu kullanım
- düz operasyonel görünüm

Olmamalı:
- büyük radius
- kalın shadow
- modern SaaS kart dili
- fazla whitespace
- dekoratif animasyon

## 8.3. Renk mantığı
- success: emerald tonları
- warning: turuncu / amber odaklı dikkat tonu
- danger: kırmızı tonlar
- neutral: slate tonları

## 8.4. Henüz sayısal olarak kilitlenmemiş tokenlar
Ayrıca belirlenmelidir:
- header height
- footer height
- row height
- cell padding
- font scale
- badge size
- exact warning token
- focus border thickness
- panel min width
- resizer limits

---

# 9. Ortak Teknik Eksikler

Şu anki bilgi seti güçlü olsa da tam eksiksiz uygulama için aşağıdakiler eksiktir:

## 9.1. API + DTO sözleşmeleri
Özellikle:
- Phase 1
- Phase 3
- fazlar arası handoff

## 9.2. Interaction matrix
Özellikle:
- Phase 2
- Phase 3

## 9.3. Handoff sözleşmeleri
- Phase 1 → Phase 2
- Phase 2 → Phase 3
- Phase 3 → Phase 4

## 9.4. Acceptance pack
Given / When / Then senaryolarıyla tam test paketi gerekir.

---

# 10. Uygulama Sıralaması Planı

Aşağıdaki sıra, hem risk azaltır hem de fazların birbirine karışmasını önler.

## Faz A – Temel Çekirdek ve Veri Altyapısı
### Hedef
Ortak veri modeli, status enum’ları, audit mantığı ve temel iskeletin kurulması.

### Yapılacaklar
1. ortak domain enum’ları
   - status listeleri
   - audit trigger türleri
   - source type / folder type
2. veritabanı şeması
   - belge ana kayıtları
   - OCR sonuç kayıtları
   - OCR hücre kayıtları
   - klasör/pipeline ayarları
   - audit kayıtları
3. temel backend iskeleti
   - FastAPI app shell
   - config management
   - database session yapısı
   - logging
4. ortak DTO altyapısı

### Çıktı
- veri modeli iskeleti
- ortak enum’lar
- temel backend omurgası

---

## Faz B – Phase 1 Backend Çekirdeği
### Hedef
Dosya alımı ve OCR pipeline’ını işletmek.

### Yapılacaklar
1. klasör watcher servisi
2. duplicate detection servisi
3. file lifecycle manager
4. processing alanı mantığı
5. OpenCV preprocessing servisleri
6. Gemini adapter
7. OCR parse/normalize katmanı
8. retry scheduler
9. hata yönetimi

### Çıktı
- çalışan Phase 1 arka plan pipeline’ı
- DB’ye düşen gerçek kayıtlar

---

## Faz C – Phase 1 Operasyon Ekranı
### Hedef
Queue, duplicate, retry ve lifecycle görünürlüğünü UI’da sağlamak.

### Yapılacaklar
1. Phase 1 header
2. summary cards
3. filtre paneli
4. ana queue tablosu
5. status badge sistemi
6. duplicate görünürlüğü
7. retry görünürlüğü
8. kayıt detail drawer
9. hata kayıt drawer/görünümü
10. klasör sağlık görünümü
11. empty state

### Çıktı
- operasyonel OCR Havuzu ekranı

---

## Faz D – Phase 2 Backend Sözleşmesi ve Handoff
### Hedef
Phase 1’den gelen veriyi Phase 2’ye uygun hale getirmek.

### Yapılacaklar
1. Phase 2 record detail endpoint’i
2. OCR row/field payload’ı
3. bbox ve confidence fallback kuralları
4. approve / override endpoint’leri
5. mark faulty endpoint’i
6. move to Phase 3 validation endpoint’i
7. Phase 1 → Phase 2 handoff sözleşmesi

### Çıktı
- Phase 2’nin gerçek veri kontratı

---

## Faz E – Phase 2 UI Shell
### Hedef
Split-screen kontrol ekranının ana omurgasını kurmak.

### Yapılacaklar
1. page shell
2. header
3. footer
4. split-screen container
5. resizer
6. image viewer shell
7. OCR grid shell
8. empty state
9. loading / error state

### Çıktı
- çalışan split-screen iskeleti

---

## Faz F – Phase 2 Interaction ve Blocker Sistemi
### Hedef
Gerçek OCR kontrol davranışını çalıştırmak.

### Yapılacaklar
1. BOY / EN / ADET / U1 / U2 / K1 / K2 hücre state’leri
2. confidence < 80 warning
3. selected cell state
4. approve flow
5. override flow
6. blocker summary
7. CTA enable/disable logic
8. bbox focus + zoom-sync
9. bbox missing fallback
10. Hatalı Görsel modal akışı

### Çıktı
- çalışan Phase 2 OCR Kontrol deneyimi

---

## Faz G – Phase 3 Kapsamını Teknik Sözleşmeye Bağlama
### Hedef
Phase 3 için UI yönünü gerçek teknik uygulama paketine dönüştürmek.

### Yapılacaklar
1. cari eşleşme sözleşmesi
2. stok eşleşme sözleşmesi
3. Phase 2 → Phase 3 handoff
4. çoklu plaka veri modeli
5. satır birleştirme kuralları
6. fire açıklaması veri modeli
7. blocker matrix
8. ana grid payload’ı

### Çıktı
- Phase 3 teknik spesifikasyonu

---

## Faz H – Phase 3 UI Uygulaması
### Hedef
Ana operasyon merkezini kurmak.

### Yapılacaklar
1. header + cari state kartı
2. toolbar
3. sipariş özet bandı
4. plaka grup alanı
5. dense grid
6. stok arama drawer
7. cari arama modalı
8. fire açıklaması akışı
9. satır detay drawer
10. validation summary
11. footer + Phase 4 CTA

### Çıktı
- çalışan Phase 3 operasyon ekranı

---

## Faz I – Handoff ve Entegrasyon Kapanışı
### Hedef
Fazlar arası geçişlerin kontrollü ve test edilebilir hale getirilmesi.

### Yapılacaklar
1. Phase 1 → Phase 2 entegrasyon testi
2. Phase 2 → Phase 3 entegrasyon testi
3. Phase 3 → Phase 4 çıkış ön koşulları
4. audit zinciri testi
5. concurrent update / stale state testleri

### Çıktı
- güvenli faz akışları

---

## Faz J – Acceptance ve QA Paketi
### Hedef
Master paketi kapatmak.

### Yapılacaklar
1. Given / When / Then test senaryoları
2. duplicate senaryoları
3. retry senaryoları
4. bbox missing
5. confidence missing
6. low confidence BOY / EN / ADET / U1 / U2 / K1 / K2
7. faulty image
8. cari eşleşme yok
9. stok eşleşme yok
10. multi-plate
11. merge
12. fire açıklaması eksik

### Çıktı
- uygulama kabul paketi

---

# 11. Uygulama Önceliklendirme

## En önce yapılması gereken
1. Veri modeli ve backend çekirdek
2. Phase 1 pipeline
3. Phase 1 operasyon ekranı
4. Phase 2 split-screen shell
5. Phase 2 blocker ve interaction
6. Phase 3 teknik sözleşmesi
7. Phase 3 UI
8. Handoff + QA

## Neden bu sıra
- veri olmadan UI sağlıklı ilerlemez
- Phase 1 olmadan Phase 2 test edilemez
- Phase 2 kapanmadan Phase 3 güvenli ilerlemez
- Phase 3 sözleşmesi yazılmadan UI doğaçlama riski taşır

---

# 12. Eksiksiz Uygulama İçin Son Eksik Belgeler

Bu dosya master çerçeveyi toplar; fakat aşağıdaki belgeler ayrıca yazılırsa paket tam kapanır:

1. Phase 1 API + DTO Sözleşmesi
2. Phase 2 Interaction Matrix
3. Phase 1 → Phase 2 Handoff Sözleşmesi
4. Phase 2 → Phase 3 Handoff Sözleşmesi
5. Phase 3 Teknik Uygulama Spesifikasyonu
6. Acceptance Criteria / Test Senaryoları Paketi

---

# 13. Nihai Hüküm

Bu dosya, mevcut konuşmada netleşen tüm ana kararları tek yerde toplar.

Bugünkü durum itibarıyla:
- ürün kapsamı güçlü biçimde netleşmiştir
- UI/UX yönü büyük ölçüde kilitlenmiştir
- faz sınırları belirginleşmiştir
- uygulama sıralaması oluşmuştur

Ancak tam sıfır doğaçlamalı geliştirme için:
- teknik sözleşme katmanları
- interaction matrix’leri
- handoff paketleri
- acceptance test seti

ayrıca kapatılmalıdır.

Bu nedenle bu dosya:
- master yön belgesi
- geliştirme sıralaması planı
- kapsam kilitleme belgesi

olarak kullanılmalıdır.
