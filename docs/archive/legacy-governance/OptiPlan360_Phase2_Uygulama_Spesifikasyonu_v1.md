# OptiPlan 360 – Phase 2 Uygulama Spesifikasyonu v2

## 1. Amaç

Phase 2, OCR çıktısının operatör tarafından belge ile yan yana doğrulandığı kontrol fazıdır.

Bu fazın amacı:
- OCR sonucunu operatöre güvenli ve hızlı şekilde göstermek
- yalnızca kritik alanları doğrulatmak
- düşük güvenli hücreleri açıkça işaretlemek
- operatör onayı olmadan sonraki faza geçişi engellemek

Bu faz genel veri düzenleme ekranı değildir.

## 2. Kapsam

Phase 2 yalnızca:
- OCR kontrol
- görsel ile veri eşleme
- düşük güvenli alan onayı
- hatalı görsel ayrıştırma
- sonraki faza kontrollü geçiş

kapsamındadır.

Bu faz kapsamında yoktur:
- tam sipariş düzenleme
- ERP mantığı
- cari/stok eşleştirme
- export üretimi
- ileri operasyonel düzenleme

## 3. Temel iş kuralı

Phase 2’de kritik doğrulama alanları yalnızca:
- BOY
- EN
- ADET
- U1
- U2
- K1
- K2

alanlarıdır.

Diğer OCR alanları görüntülenebilir; ancak blocker ve operatör onay mantığı bu **7 kritik alan** üzerine kurulacaktır.

## 4. Confidence kuralı

Eğer BOY, EN, ADET, U1, U2, K1 veya K2 alanlarından herhangi birinde:

- `confidence_score < 80`

ise bu hücre şüpheli kabul edilir.

Şüpheli hücre:
- turuncu warning state ile gösterilir
- operatör onayı bekler
- onaylanmadan kayıt Phase 3’e geçemez

Bu kural:
- frontend
- backend
- service layer

katmanlarının tümünde uygulanmalıdır.

## 5. Operatör onayı

Şüpheli hücre iki şekilde temizlenebilir:
- operatör değeri değiştirir
- operatör mevcut değeri doğru kabul ederek açık onay verir

Onay aksiyonları:
- Enter
- F2
- tanımlı hücresel onay hareketi

Onay sonrası:
- hücre warning state’den çıkar
- normal renge döner
- audit bilgisi oluşur
- onaylayan kullanıcı ve zaman bilgisi saklanır

## 6. Faz geçişi

Faz geçişleri otomatik olmayacaktır.

Phase 2’den Phase 3’e geçiş:
- yalnızca açık operatör aksiyonu ile olur
- blocker yoksa mümkündür
- blocker varsa engellenir

Ana CTA:
- `Phase 3’e Aktar`

## 7. Ana sayfa yerleşimi

Ekran dense ERP mantığında tasarlanacaktır.

Ana yapı:
- üst bölüm: başlık ve aksiyon alanı
- orta bölüm: split-screen çalışma alanı
- alt bölüm: blocker ve aksiyon barı

## 8. Split-screen çalışma alanı

Ana çalışma alanı iki parçalı olacaktır:

### Sol panel
- orijinal belge/görsel önizleme
- yüksek çözünürlük
- zoom in / zoom out
- pan / drag
- bbox highlight
- selected cell odaklama

### Sağ panel
- dense OCR grid
- satır bazlı veri görünümü
- BOY / EN / ADET / U1 / U2 / K1 / K2 odaklı doğrulama
- hücresel warning / approval state

### Orta ayraç
- resizer
- panel oranı kullanıcı tarafından değiştirilebilir

Varsayılan oran:
- yaklaşık 50 / 50

## 9. Sol panel gereksinimleri

Sol panel şu özellikleri desteklemelidir:
- belgeyi net render etme
- boşluk israfı yapmayan koyu tema panel
- focus edilen alana otomatik kayma
- seçili alanı sarı çerçeve ile gösterme
- bbox yoksa bozulmama

Fallback:
- bbox yoksa zoom-sync atlanır
- panel çalışmaya devam eder

## 10. Sağ panel grid gereksinimleri

Grid:
- dense
- kompakt
- ERP-benzeri
- klavye kullanımına uygun
- satır ve hücre bazlı

Asgari kolonlar:
- satır no
- BOY
- EN
- ADET
- U1
- U2
- K1
- K2
- confidence göstergesi
- onay durumu

Opsiyonel gösterimler:
- diğer OCR alanları
- kaynak OCR değeri
- normalize değer

Blocker mantığı BOY / EN / ADET / U1 / U2 / K1 / K2 alanlarının tamamı için geçerlidir.

## 11. Hücre durumları

Her hücre aşağıdaki state’lerden birinde olabilir:
- normal
- low confidence
- selected
- approved
- overridden
- read-only

Low confidence state:
- turuncu arka plan
- net warning vurgusu

Approved state:
- warning kalkmış
- standart renk
- istenirse küçük bir onay izi

Selected state:
- focus border
- sol panel ile eşleşik davranış

## 12. Klavye davranışı

ERP kullanım alışkanlığına uygun olmalıdır.

Desteklenecek tuşlar:
- Tab: sağa geç
- Shift + Tab: sola geç
- Enter: alta geç veya onay davranışını tetikle
- Arrow Keys: hücre navigasyonu
- F2: hücre onayı

Klavye davranışı tutarlı ve tahmin edilebilir olmalıdır.

## 13. Zoom-sync davranışı

Sağ grid’de bir hücre seçildiğinde:
- ilgili OCR alanının bbox bilgisi bulunur
- sol panel o bölgeye smooth zoom yapar
- ilgili alan sarı highlight ile çerçevelenir

Eğer bbox yoksa:
- crash olmaz
- fokus davranışı sessizce pas geçilir

## 14. Hatalı Görsel akışı

Ekranda görünür bir:
- `Hatalı Görsel`

aksiyonu bulunmalıdır.

Tetiklenince:
- kayıt süreçten çıkarılır
- durum `Hatalı` olur
- operatör notu alınabilir
- WhatsApp taslak mesaj akışı için modal açılır

Bu fazda gerçek gönderim zorunlu değildir; ancak provider pattern yapısı kurulmalıdır.

Minimum beklenti:
- taslak mesaj oluşturma
- operatöre gösterme
- loglama

## 15. Header gereksinimleri

Header alanında:
- ekran adı: `OCR Kontrol`
- kısa açıklama
- gerekirse kuyruk bilgisi
- Yenile aksiyonu
- Hatalı Görsel aksiyonu
- Phase 3’e Aktar aksiyonu

Başlık, ekranın BOY / EN / ADET / U1 / U2 / K1 / K2 doğrulama fazı olduğunu kullanıcıya anlatmalıdır.

## 16. Footer gereksinimleri

Footer’da:
- blocker mesajı
- onay bekleyen hücre sayısı
- seçili kayıt bilgisi
- ana CTA

Örnek blocker mesajı:
- `Onaysız düşük güvenli alanlar var`
- `Phase 3’e aktarım engellendi`

Blocker yoksa:
- success state
- aktar CTA aktif

## 17. Empty state

Kuyruk boşsa ekran yalnızca boş bir metin göstermemelidir.

Empty state şunları anlatmalıdır:
- burada hangi kayıtların görüneceği
- bu fazda hangi alanların doğrulandığı
- düşük confidence mantığı
- kayıt geldiğinde split-screen çalışma alanının açılacağı

## 18. State modeli

Frontend tarafında en az şu state’ler tanımlanmalıdır:
- queue empty
- queue has records
- selected record
- selected row
- selected cell
- blocker active
- blocker cleared
- image loading
- image load failed
- bbox unavailable
- faulty modal open
- approve in progress
- save failed

## 19. Veri kontratı

Frontend’in bekleyeceği veri modeli en az şu alanları taşımalıdır:

### Record
- record_id
- status
- source_type
- image_url veya image reference
- created_at
- blocker_count

### OCR Row
- row_index
- fields

### OCR Field
- field_name
- raw_value
- normalized_value
- confidence_score
- bbox
- approval_status
- override_value
- approved_by
- approved_at

### BBox
- x
- y
- w
- h

## 20. API sözleşmesi

Asgari endpointler:

### GET
- queue records list
- single record detail
- OCR fields for record
- image asset access

### POST / PATCH
- approve cell
- override cell value
- mark faulty
- move to Phase 3
- refresh / reload detail

Backend doğrulaması şarttır:
- frontend disabled olsa bile backend blocker kontrolünü tekrar yapmalıdır

## 21. Blocker karar matrisi

### Geçiş engellenir, eğer:
- BOY düşük confidence ve onaysız
- EN düşük confidence ve onaysız
- ADET düşük confidence ve onaysız
- U1 düşük confidence ve onaysız
- U2 düşük confidence ve onaysız
- K1 düşük confidence ve onaysız
- K2 düşük confidence ve onaysız
- confidence bilgisi yok ve alan manual review gerektiriyorsa
- kayıt hatalı statüye alınmışsa

### Geçiş mümkün, eğer:
- BOY / EN / ADET / U1 / U2 / K1 / K2 alanlarının tamamı ya güvenli ya da operatör onaylı ise

### Geçişi etkilemez:
- bbox eksikliği tek başına blocker değildir

## 22. Audit ve izlenebilirlik

Aşağıdaki aksiyonlar iz bırakmalıdır:
- hücre onayı
- hücre override
- Hatalı Görsel işaretleme
- Phase 3’e aktarım denemesi
- blocker çözülmesi
- kayıt açılması

## 23. Hata durumları

Ayrı ayrı ele alınmalıdır:
- image load failed
- OCR data missing
- bbox missing
- approval save failed
- stale record / concurrent update
- move to Phase 3 rejected by backend

Her biri kullanıcıya anlaşılır ama yoğun olmayan ERP tarzı uyarı diliyle gösterilmelidir.

## 24. Responsive ve layout limitleri

Bu ekran desktop-first tasarlanmalıdır.

Tanımlanması gerekenler:
- minimum page width
- minimum image panel width
- minimum grid width
- resizer alt/üst limitleri
- yatay scroll davranışı
- panel bazlı scroll önceliği

Mobil öncelik yoktur.

## 25. Tasarım tokenları

Tutarlılık için kilitlenmeli:
- header height
- footer height
- grid row height
- cell padding
- warning tone
- success tone
- focus border stili
- border yoğunluğu
- font size scale

Dense ERP dili korunmalıdır.

## 26. Kabul kriterleri

Bir implementasyon aşağıdakiler sağlanmadan tamamlanmış sayılmaz:

1. Split-screen yapı görünür çalışır
2. Sol panel belgeyi render eder
3. Sağ panel BOY / EN / ADET / U1 / U2 / K1 / K2 odaklı grid gösterir
4. `confidence < 80` hücreler warning state alır
5. operatör onayı sonrası warning kalkar
6. grid hücre seçimi görselde bbox focus üretir
7. bbox yoksa ekran bozulmaz
8. blocker varsa `Phase 3’e Aktar` pasif kalır
9. blocker yoksa `Phase 3’e Aktar` aktif olur
10. `Hatalı Görsel` akışı kayıt durumunu değiştirir
11. backend blocker doğrulamasını ayrıca yapar
12. empty state ürün davranışını açıklar

## 27. Geliştirme sırası

Önerilen sıra:
1. layout shell
2. split-screen container
3. image viewer
4. OCR grid
5. low-confidence states
6. approve / override flow
7. blocker summary
8. move to Phase 3 CTA
9. faulty image modal
10. audit/error polish

## 28. Nihai hüküm

Phase 2:
- genel edit ekranı değildir
- ERP eşleştirme ekranı değildir
- asıl amacı düşük güvenli OCR alanlarını operatör doğrulamasına sunmaktır

Bu fazın başarısı, operatörün belgeyi ve kritik OCR hücrelerini aynı anda hızlı ve güvenli biçimde kontrol edebilmesine bağlıdır.
