Tamam. Aşağıda, \*\*Phase 2 OCR Kontrol\*\* için, güncellenmiş kritik alan setini de içeren, \*\*kapsamlı ve açık bırakmayan nihai UI/UX tasarım promptu\*\* var.



Not: Yüklenmiş `.md` dosyasını iç aramada doğrudan çekemedim; bu yüzden bu sürüm, bu konuşmada birlikte netleştirdiğimiz kurallara göre hazırlanmıştır.



\---



\# OPTIPLAN 360 – PHASE 2 OCR KONTROL



\## NİHAİ VE KAPSAMLI UI/UX TASARIM PROMPTU



Sen kıdemli bir \*\*ERP Product Designer\*\*, \*\*UX Architect\*\* ve \*\*Dense Interface Specialist\*\* olarak hareket edeceksin.



Aşağıda tanımı netleşmiş olan \*\*OptiPlan 360 – Phase 2 OCR Kontrol\*\* ekranını tasarlayacaksın.

Doğaçlama yapmak, kapsam dışına çıkmak, ekranı başka fazların işlevleriyle karıştırmak yasaktır.



Bu ekranın amacı:



\* OCR çıktısını operatöre güvenli ve hızlı göstermek

\* belge ile OCR verisini \*\*yan yana\*\* doğrulatmak

\* yalnızca kritik alanları operatör onayına sunmak

\* düşük güvenli hücreleri açık biçimde işaretlemek

\* blocker varsa Phase 3’e geçişi engellemek



Bu ekran:



\* genel sipariş düzenleme ekranı değildir

\* ERP eşleştirme ekranı değildir

\* satış siparişi oluşturma ekranı değildir

\* üretim operasyon merkezi değildir



Bu ekran yalnızca:



\* \*\*OCR kontrol\*\*

\* \*\*görsel ile veri eşleme\*\*

\* \*\*kritik hücre onayı\*\*

\* \*\*hatalı görsel ayrıştırma\*\*

\* \*\*kontrollü faz geçişi\*\*



için tasarlanacaktır.



\---



\## 1. BAĞLAYICI İŞ KURALLARI



\### 1.1. Kritik doğrulama alanları



Phase 2’de kritik doğrulama alanları yalnızca şunlardır:



\* \*\*BOY\*\*

\* \*\*EN\*\*

\* \*\*ADET\*\*

\* \*\*U1\*\*

\* \*\*U2\*\*

\* \*\*K1\*\*

\* \*\*K2\*\*



Diğer OCR alanları gösterilebilir; ancak blocker, warning, onay ve geçiş mantığı yalnızca bu \*\*7 kritik alan\*\* üzerinde çalışacaktır.



\### 1.2. Confidence kuralı



Eğer bu 7 kritik alandan herhangi birinde:



\* `confidence\_score < 80`



ise ilgili hücre:



\* şüpheli kabul edilir

\* turuncu warning state alır

\* operatör onayı bekler



\### 1.3. Hard blocker kuralı



Bu 7 kritik alan içinde \*\*tek bir tane bile\*\*:



\* düşük güvenli

\* ve onaysız



hücre varsa:



\* `Phase 3’e Aktar` butonu pasif olmalıdır

\* blocker summary görünür olmalıdır

\* kullanıcı neden ilerleyemediğini açıkça anlamalıdır



\### 1.4. Operatör onayı



Şüpheli hücre iki şekilde temizlenebilir:



\* operatör değeri değiştirir

\* operatör mevcut değeri doğru kabul ederek açık onay verir



Onay sonrası:



\* warning state kalkar

\* hücre normal görünüme döner

\* blocker count yeniden hesaplanır

\* hücrenin onaylandığı hissedilmelidir



\### 1.5. Klavye davranışı



Desteklenecek kullanım:



\* Tab → sağa geç

\* Shift+Tab → sola geç

\* Enter → onay veya alta geçiş

\* Arrow keys → hücre navigasyonu

\* F2 → explicit onay



\### 1.6. Zoom-sync kuralı



Grid’de kritik alanlardan herhangi bir hücre seçildiğinde:



\* sol panel ilgili bbox alanına zoom yapmalıdır

\* sarı highlight göstermelidir



\### 1.7. Fallback kuralı



BBox yoksa:



\* ekran bozulmamalı

\* yalnız zoom/highlight davranışı atlanmalı



\### 1.8. Hatalı Görsel akışı



Ekranda görünür bir `Hatalı Görsel` aksiyonu olacaktır.

Bu aksiyon:



\* dosyayı süreçten çıkarma mantığı taşımalı

\* not alma alanı içermeli

\* modal veya drawer ile açılmalı



\---



\## 2. TASARIM FELSEFESİ



Arayüz şu karakterde olmalıdır:



\* dense ERP

\* kompakt

\* klavye dostu

\* hızlı karar vermeye uygun

\* ciddi ve operasyonel

\* dekoratif değil işlevsel



Olmalı:



\* ince border’lar

\* keskin hizalama

\* düşük spacing

\* net state ayrımı

\* grid-first düzen

\* görsel ve veri arasında güçlü bağlantı



Olmamalı:



\* modern boşluklu SaaS görünümü

\* büyük shadow

\* büyük radius

\* fazla animasyon

\* kart ağırlıklı dashboard tasarımı

\* üretim dışı dekoratif bileşenler



\---



\## 3. ANA LAYOUT



Ekran desktop-first tasarlanmalıdır.



Ana yapı:



1\. Global Header

2\. OCR Kontrol Header Band

3\. Ana Split-Screen Workspace

4\. Alt Blocker / Action Bar



\---



\## 4. GLOBAL HEADER



Mevcut uygulama üst barıyla uyumlu olacaktır.



İçerik:



\* breadcrumb

\* ekran başlığı

\* global arama

\* sağ üst kullanıcı / bildirim / genel sistem ikonları



Bu alan uygulamanın genel shell yapısıyla tutarlı olmalıdır.



\---



\## 5. OCR KONTROL HEADER BAND



Header altında, ekranın kendi başlık bandı olacaktır.



\### Sol taraf



\* Başlık: `OCR Kontrol`

\* Açıklama:



&#x20; \* bu ekranda doğrulanan kritik alanların



&#x20;   \* BOY

&#x20;   \* EN

&#x20;   \* ADET

&#x20;   \* U1

&#x20;   \* U2

&#x20;   \* K1

&#x20;   \* K2

&#x20;     olduğu açıkça yazılmalı

&#x20; \* düşük güvenli hücrelerin operatör onayı istediği belirtilmeli



\### Sağ taraf aksiyonlar



\* `Yenile`

\* `Hatalı Görsel`

\* `Phase 3’e Aktar`



\### Tasarım kuralları



\* `Phase 3’e Aktar` primer CTA

\* blocker varsa disabled

\* `Hatalı Görsel` danger buton

\* `Yenile` nötr ikincil buton



\---



\## 6. ANA SPLIT-SCREEN WORKSPACE



Bu ekranın merkezi kesin olarak split-screen yapıdır.



\### Sol panel



\* orijinal belge/görsel önizlemesi

\* yüksek çözünürlük hissi

\* zoom in/out

\* pan / drag

\* bbox highlight

\* sarı focus çerçevesi

\* reset zoom kontrolü



\### Sağ panel



\* dense OCR grid

\* satır bazlı veri yapısı

\* kritik alan kolonları yüksek öncelikli:



&#x20; \* BOY

&#x20; \* EN

&#x20; \* ADET

&#x20; \* U1

&#x20; \* U2

&#x20; \* K1

&#x20; \* K2

\* confidence ve approval state görünür olmalı



\### Orta ayraç



\* sürüklenebilir resizer

\* varsayılan yaklaşık 50 / 50 oran

\* panel min width korunmalı



\---



\## 7. SOL GÖRSEL PANEL TASARIMI



Bu panel yalnız belge gösterimi değil, doğrulama bağlamı taşımalıdır.



\### İçerik



\* belge alanı

\* zoom kontrolleri

\* reset görünüm

\* bbox highlight overlay

\* gerekirse sayfa bilgisi / çoklu belge navigasyonu



\### Davranış



\* grid’de seçili kritik hücreye bağlı focus

\* bbox varsa smooth zoom

\* sarı highlight çerçevesi

\* bbox yoksa sessiz fallback



\### Görsel dil



\* sade

\* koyu panel içinde net belge alanı

\* kontroller minimal

\* veri değil, görsel öncelikli



\---



\## 8. SAĞ OCR GRID PANELİ TASARIMI



Bu alan ekranın çalışma merkezi olacaktır.



\### Grid karakteri



\* dense

\* ERP-benzeri

\* satır/hücre odaklı

\* klavye-first

\* kompakt



\### Zorunlu kolonlar



\* Satır No

\* BOY

\* EN

\* ADET

\* U1

\* U2

\* K1

\* K2

\* Confidence

\* Onay Durumu



\### Opsiyonel kolonlar



\* OCR Kaynak Değeri

\* Normalize Değer

\* Alan Tipi

\* Satır Durumu



\### Öncelik



Kritik kolonlar:



\* BOY

\* EN

\* ADET

\* U1

\* U2

\* K1

\* K2



görsel olarak diğer kolonlardan daha belirgin olmalıdır.



\### Tasarım kuralları



\* sayısal alanlar sağa hizalanmalı

\* kenar/bant alanları kompakt ama okunur olmalı

\* confidence alanı kompakt olmalı

\* onay durumu küçük ikon/badge ile desteklenmeli



\---



\## 9. HÜCRE STATE TASARIMI



Her hücre aşağıdaki state’lerden birinde olabilir:



\* normal

\* selected

\* low confidence

\* approved

\* overridden

\* read-only



\### Low confidence



\* turuncu arka plan veya warning tint

\* net border/focus

\* ilk bakışta ayırt edilebilir



\### Selected



\* güçlü focus border

\* diğer hücrelerden belirgin ayrışmalı



\### Approved



\* warning kalkmalı

\* nötr/success izi olabilir

\* hafif onay göstergesi kullanılabilir



\### Overridden



\* kullanıcı müdahalesi olduğu anlaşılmalı

\* approved’den farklı hafif audit izi taşımalı



\### Read-only



\* kritik olmayan veya düzenlenemeyen alanlar daha pasif görünmeli



\---



\## 10. KRİTİK ALANLARIN GÖRSEL ÖNCELİĞİ



Tasarımda aşağıdaki 7 alan, yalnız veri kolonları olarak değil, \*\*doğrulama kolonları\*\* olarak algılanmalıdır:



\* BOY

\* EN

\* ADET

\* U1

\* U2

\* K1

\* K2



Bu alanlar için:



\* kolon başlıkları daha görünür olabilir

\* low-confidence state daha belirgin uygulanmalı

\* selected state daha net görünmeli

\* approval izi daha anlaşılır olmalı



Amaç:

Kullanıcı ilk bakışta hangi alanların kritik olduğunu anlamalıdır.



\---



\## 11. KLAVYE ODAKLI DENEYİM



UI, mouse ile olduğu kadar klavye kullanımına da uygun görünmelidir.



Desteklenecek kullanım:



\* Tab

\* Shift+Tab

\* Enter

\* Arrow keys

\* F2



Tasarımda şunlar çok net ayrışmalıdır:



\* selected hücre

\* aktif edit hücresi

\* warning hücresi

\* onaylanmış hücre



\---



\## 12. LOW-CONFIDENCE VE BLOCKER GÖRÜNÜRLÜĞÜ



Blocker hissi yalnız footer’da değil, tüm deneyimde görünür olmalıdır.



\### Görünür olması gereken yerler



\* hücre state’i

\* üst bilgi notu

\* blocker summary

\* action bar

\* CTA disabled görünümü



\### Blocker örnek metinleri



\* `Onaysız düşük güvenli alanlar var`

\* `Phase 3’e aktarım engellendi`

\* `5 hücre onay bekliyor`

\* `Kritik alan onayları tamamlanmadan geçiş yapılamaz`



\---



\## 13. HATALI GÖRSEL AKIŞI TASARIMI



Bu akış yalnız butondan ibaret olmamalıdır.



\### Tetikleme



\* `Hatalı Görsel`



\### Açılan yapı



\* modal veya sağ drawer



\### İçerik



\* neden hatalı olduğunu açıklayan kısa metin

\* operatör not alanı

\* taslak mesaj alanı

\* `İptal`

\* `Hatalı Olarak İşaretle`



\### Tasarım hedefi



Kullanıcı bu kaydı süreçten çıkarırken bilinçli ve kontrollü aksiyon aldığını hissetmelidir.



\---



\## 14. EMPTY STATE TASARIMI



Kuyruk boşsa ekran yalnızca “kayıt yok” mesajı vermemelidir.



\### Empty state metni şunları anlatmalıdır



\* burada hangi kayıtların görüneceği

\* doğrulanan kritik alanların:



&#x20; \* BOY

&#x20; \* EN

&#x20; \* ADET

&#x20; \* U1

&#x20; \* U2

&#x20; \* K1

&#x20; \* K2

&#x20;   olduğu

\* `%80` altı confidence alanların turuncu olacağı

\* blocker varsa geçiş olmayacağı

\* kayıt geldiğinde split-screen çalışma alanının açılacağı



\### Empty state aksiyonları



\* `Yenile`

\* gerekiyorsa kısa bilgilendirme metni



\### Kural



Empty state bile Phase 2’nin gerçek davranışını öğretmelidir.



\---



\## 15. ALT BLOCKER / ACTION BAR



Ekranın altında belirgin bir action bar olmalıdır.



\### Sol taraf



\* blocker mesajı

\* onay bekleyen hücre sayısı

\* seçili kayıt bilgisi



\### Sağ taraf



\* `Phase 3’e Aktar`



\### Durumlar



\#### Blocker varsa



\* warning/danger bar

\* CTA disabled



\#### Blocker yoksa



\* success hissi

\* CTA aktif



\---



\## 16. STATE SENARYOLARI TASARIMDA AYRI AYRI DESTEKLENMELİ



UI aşağıdaki durumları ayrı hissettirmelidir:



\* loading

\* empty

\* ready

\* image error

\* save error

\* blocker active

\* blocker cleared

\* faulty modal open



Her state için:



\* görsel ayrım

\* metin tonu

\* aksiyon uygunluğu

&#x20; olmalıdır



\---



\## 17. TİPOGRAFİ VE YOĞUNLUK



\### Tipografi



\* başlıklar güçlü ama aşırı büyük değil

\* grid metni kompakt

\* yardımcı metinler küçük

\* blocker metinleri görünür



\### Yoğunluk



\* satır yüksekliği kompakt

\* padding düşük

\* border’lar ince

\* yüksek veri yoğunluğu korunmalı



\---



\## 18. TASARIM TOKENLARI



\### Genel tema



\* arka plan: slate-900

\* paneller: slate-800

\* border: slate-700

\* ana metin: slate-200

\* ikincil metin: slate-400



\### State renkleri



\* success: emerald

\* warning: amber/turuncu

\* danger: red

\* primary CTA: blue



\### Görsel yoğunluk



\* dense row

\* compact input

\* minimal radius

\* minimal shadow



\---



\## 19. EKRANDA OLMAMASI GEREKENLER



Bunları tasarıma ekleme:



\* sipariş düzenleme mantığı

\* cari/stok eşleşme ekranı davranışı

\* satış fişi oluşturma alanı

\* üretim optimizasyon ekranı hissi

\* ikinci bir dashboard yapısı

\* teknik olmayan dekoratif bileşenler

\* gereksiz grafik / chart



\---



\## 20. SON TASARIM TALİMATI



Bu ekranı şu hisle tasarla:



\*\*“Operatör belgeyi solda, OCR verisini sağda görüyor; kritik alanlar BOY, EN, ADET, U1, U2, K1 ve K2 olarak açıkça öne çıkıyor; düşük güvenli hücreler çok net görünüyor; blocker çözülmeden Phase 3’e geçemiyor.”\*\*



Tasarım:



\* ciddi

\* yoğun

\* üretim kalitesinde

\* doğaçlamasız

\* ERP standardında

&#x20; olmalıdır.



