# OptiPlan 360 – Phase 3 Tam Kapsamlı UI/UX Spesifikasyonu

## Doküman Amacı
Bu doküman, **OptiPlan 360 / Phase 3 – Sipariş Kontrol & ERP Eşleştirme** ekranının ve bu ekranla ilişkili tüm UI/UX alanlarının **tam kapsamlı**, **uygulanabilir**, **eksiksiz** ve **doğaçlamaya kapalı** tasarım spesifikasyonudur.

Bu doküman, tasarımcı, frontend geliştirici, backend geliştirici, ürün sahibi ve QA tarafından ortak referans olarak kullanılacaktır.

---

# 1. Ürün Konumu ve Faz Rolü

## 1.1 OptiPlan 360'ın Konumu
OptiPlan 360 bağımsız bir ERP değildir.

Bu sistem:
- **Mikro Vr15** ile
- **Optiplanning**
arasında çalışan operasyonel entegrasyon ve süreç yönetim katmanıdır.

## 1.2 Phase 3'ün Rolü
Phase 3, sistemin **ana operasyon merkezi**dir.

Bu fazın temel görevleri:
- OCR sonrası gelen sipariş satırlarını operatöre kontrollü şekilde göstermek
- ERP cari eşleşmesini tamamlatmak
- ERP stok/malzeme eşleşmesini tamamlatmak
- satır bazlı operasyonel düzenlemeleri yapmak
- satır birleştirme süreçlerini yönetmek
- fire açıklamalarını toplamak
- sonraki export/üretim fazına geçmeden önce tüm blocker kontrollerini tamamlamak

## 1.3 Kapsam Sınırı
Bu ekran:
- ERP'yi yeniden yazmaz
- yeni cari/stok ana veri sistemi kurmaz
- ticari kuralları yeniden tanımlamaz
- yalnızca operatörün kontrol, eşleştirme, düzeltme ve export öncesi doğrulama yapacağı ana ekrandır

---

# 2. UI/UX Tasarım Prensipleri

## 2.1 Tasarım Karakteri
Arayüz aşağıdaki karaktere sahip olmalıdır:
- Dense UI
- Endüstriyel ERP görünümü
- Minimum whitespace
- Çok kolonlu operasyonel tablo mantığı
- Hız odaklı kullanım
- Mouse'tan çok operasyonel netlik önceliği
- Bilgi yoğun ama okunabilir yapı
- Kartlı SaaS görünümü yerine çizgili, düz ve kompakt düzen

## 2.2 Kullanıcı Profili
Ana kullanıcı tipi:
- operasyon personeli
- sipariş kontrol operatörü
- ERP eşleştirme yapan kullanıcı
- yüksek hacimli veri ile çalışan ofis operatörü

Kullanıcının öncelikleri:
- hız
- hata yakalama
- blocker görme
- eşleşmeyen kalemleri hızla düzeltme
- export öncesi güvenli durum oluşturma

## 2.3 Genel UX İlkeleri
- Görsel süsleme minimumda tutulur
- Her alanın operasyonel anlamı olmalıdır
- Renkler yalnız dekoratif değil, iş kuralı taşımalıdır
- Bir hatanın dikkat çekmesi gerektiğinde açık kırmızı state kullanılmalıdır
- Başarı durumları yeşil tonlarda olmalıdır
- Kullanıcı bir bakışta blocker olup olmadığını anlamalıdır
- Büyük kartlar, gereksiz modüler kutular ve bol boşluk kullanılmamalıdır

---

# 3. Renk Sistemi

## 3.1 Ana Tema
- Body / App: `bg-slate-900`
- Header / Footer / Toolbar / Panel: `bg-slate-800`
- Border: `border-slate-700`
- Ana metin: `text-slate-200`
- İkincil metin: `text-slate-400`

## 3.2 Success
- Metin: `text-emerald-400`
- İkon: `text-emerald-500`
- Arka plan: `bg-emerald-900/30`
- Border: `border-emerald-500/50`

## 3.3 Danger / Hard Blocker
- Metin: `text-red-400`
- İkon: `text-red-500`
- Arka plan: `bg-red-900/40`
- Border: `border-red-500/40`

## 3.4 Nötr / Pasif
- `bg-slate-700`
- `text-slate-300`
- disabled state: `text-slate-500`

## 3.5 Aksiyon Rengi
- Ana CTA: `bg-blue-600 text-white hover:bg-blue-500`

---

# 4. Sayfa İskeleti

## 4.1 Genel Layout
Sayfa tam ekran olacak:
- `h-screen`
- `flex`
- `flex-col`

Sayfa 5 ana katmandan oluşacaktır:
1. Header
2. Header altı aksiyon şeridi
3. Sipariş/validation özet alanı
4. Ana grid alanı
5. Footer

## 4.2 Scroll Davranışı
- Header sabit kalmalı
- Footer sabit kalmalı
- Orta grid alanı scroll olmalı
- Yatay scroll tablo alanında kontrollü desteklenmeli

---

# 5. Header (Üst Sabit Bar)

## 5.1 Sol Alan
Sol alanda şunlar bulunur:
- Sayfa başlığı: `Sipariş Kontrol & ERP Eşleştirme`
- Rev badge: `Rev: v1`
- Alt bilgi: `Gelen: Özdemirler Orman Ürünleri (0555 123 45 67)`

### Stil
- Başlık: beyaz, `font-bold`
- Badge: mavi arka planlı, küçük, yüksek kontrastlı
- Alt bilgi: küçük, gri, sıkışık

## 5.2 Sağ Alan – Cari Eşleşme Kartı
Header’ın sağında cari eşleşme durumu kartı yer alır.

### İç Yapı
- solda icon
- ortada üst küçük başlık
- altında büyük cari kodu / durum yazısı
- sağda soluk search icon

### Başlık
`Mikro Cari Eşleşmesi`

### Başarılı Durum
- Check icon
- arka plan: `bg-emerald-900/30`
- border: `border-emerald-500/50`
- değer örneği: `CARI-001`

### Başarısız Durum
- alert/search ağırlıklı icon
- arka plan: `bg-red-900/40`
- border: `border-red-500/50`
- metin örneği: `Eşleşme Yok`

## 5.3 Cari Eşleşme UX Kuralı
Cari eşleşmesi yalnız görsel kart değildir; **hard blocker state** taşır.

Eğer cari eşleşmesi yoksa:
- footer blocker aktif olur
- Phase 4'e geçiş butonu disabled olur
- validation özet kutusunda cari eksik görünür

---

# 6. Header Altı Aksiyon Şeridi

## 6.1 Amaç
Kritik operatör aksiyonlarını üstte sabit ve hızlı erişilebilir tutmak.

## 6.2 Sol Taraf Bilgi Parçaları
Aşağıdaki özetler küçük bilgi etiketi şeklinde yer alabilir:
- Sipariş No
- Kaynak Belge No
- Plaka Sayısı
- Toplam Satır
- Eşleşmeyen Satır
- Merge Bekleyen Satır
- Fire Açıklaması Eksik Satır

## 6.3 Sağ Taraf Aksiyonları
Butonlar:
- `Cari Ara`
- `Stok Ara`
- `Satır Birleştir`
- `Fire Açıklaması`
- `Kaydet`
- `Yenile`

## 6.4 Buton Davranışları
### Cari Ara
- cari arama modalını/drawer’ını açar

### Stok Ara
- seçili satır varsa ilgili stok eşleştirme ekranını açar
- seçili satır yoksa disabled olabilir

### Satır Birleştir
- sadece uygun satırlar seçilmişse aktif olur

### Fire Açıklaması
- seçili satır veya satırlar için fire açıklama girişini açar

### Kaydet
- ekrandaki geçici düzenlemeleri taslak olarak saklar

### Yenile
- backend’den en güncel durumu tekrar çeker

---

# 7. Sipariş Özeti / Validation Bandı

## 7.1 Amaç
Kullanıcıya, tabloya girmeden önce siparişin sağlık durumunu hızlıca göstermek.

## 7.2 Gösterilecek Alanlar
- Mikro Cari Kodu
- Cari Ünvan
- Toplam Kalem
- Toplam Adet
- Farklı Malzeme Sayısı
- OCR Kaynağı
- Operatör
- Son Güncelleme Zamanı

## 7.3 Validation Box
Bu alanda ayrıca küçük bir validation summary kutusu bulunmalıdır.

### Gösterimler
- Cari eşleşmesi: tamam / eksik
- Stok eşleşmeleri: X tamam / Y eksik
- Merge bekleyen satır: sayı
- Fire açıklaması eksik: sayı
- Export hazır mı: evet / hayır

### Renk Anlamları
- yeşil: tamam
- kırmızı: blocker
- gri: nötr bilgi

---

# 8. Çoklu Plaka Alanı

## 8.1 Zorunlu Bağlam
Sistem çoklu plaka desteği taşır. Bu nedenle UI bunu bozmayacak şekilde tasarlanmalıdır.

## 8.2 Görsel Çözüm
Grid üstünde plaka gruplarını gösteren yatay bir şerit olabilir.

### Her plaka öğesi şu bilgileri taşıyabilir:
- plaka adı / kodu
- satır sayısı
- eşleşme durumu
- blocker var/yok

## 8.3 State'ler
### Aktif Plaka
- `bg-slate-700`
- `text-white`
- border vurgusu

### Sorunlu Plaka
- `bg-red-900/30`
- `text-red-400`
- uyarı ikonlu

### Sorunsuz Plaka
- `bg-emerald-900/20`
- `text-emerald-400`

---

# 9. Ana Grid

## 9.1 Grid Karakteri
- Çok sıkışık
- Border yoğun
- Yatay hizası net
- Excel benzeri satır/sütun mantığı
- Hover ile okunabilirlik artmalı

## 9.2 Temel Table Kuralları
- `w-full`
- `text-sm`
- `text-left`
- `whitespace-nowrap`
- `border-r border-b border-slate-700`
- `px-3 py-1`
- thead: `bg-slate-800 text-slate-400 uppercase text-xs`

## 9.3 Hover
- satır hover: `bg-slate-800/50`

## 9.4 Kolonlar
1. `#`
2. `1. Malzeme / Material`
3. `2. Boy`
4. `3. En`
5. `4. Adet`
6. `5. Yön`
7. `6. Açıklama`
8. `7. B.Üst`
9. `8. B.Alt`
10. `9. B.Sol`
11. `10. B.Sağ`
12. `11. İlave Açıklama`
13. `12. Açıklama 1`
14. `Durum`

## 9.5 Numerik Alanlar
- Boy, En, Adet sağa yaslı olmalıdır

---

# 10. Malzeme / ERP Stok Eşleşmesi

## 10.1 Başarılı Eşleşme
- metin: `text-emerald-400`
- hücre normal koyu tema zemininde kalabilir

## 10.2 Başarısız Eşleşme
- hücre arka planı: `bg-red-900/40`
- metin: `text-red-400 font-bold`
- search icon bulunur

## 10.3 İş Kuralı
Herhangi bir satırda stok eşleşmesi yoksa bu **Hard Blocker** üretir.

Sonuçları:
- footer blocker aktif
- export butonu disabled
- validation box kırmızı state gösterir

## 10.4 UX Beklentisi
Kullanıcı kırmızı hücreyi görür görmez:
- satır problemli olduğunu anlamalı
- search icon ile eşleştirme aksiyonuna ulaşabilmeli

---

# 11. Durum Kolonu

## 11.1 Başarılı Satır
- ortalanmış yeşil check icon

## 11.2 Başarısız Satır
- ortalanmış kırmızı alert icon

## 11.3 Görsel Rol
Durum kolonu, satırın genel eşleşme/uygunluk durumunu tek bakışta aktarır.

---

# 12. Satır Seçimi ve Toplu İşlem UX'i

## 12.1 Seçim Mantığı
- tek satır seçilebilir
- çoklu seçim future-proof olmalıdır
- seçili satır farklı arka plan tonu ile ayırt edilir

## 12.2 Toplu İşlem Senaryoları
- seçili satırlara stok ata
- satır birleştir
- açıklama ekle
- fire açıklaması gir

## 12.3 Seçim Feedback'i
Toolbar üzerinde şu metin gösterilebilir:
- `1 satır seçildi`
- `3 satır seçildi`

---

# 13. Satır Birleştirme UI/UX

## 13.1 İşlev
Operatör belirli satırları birleştirip tek satır haline getirebilir.

## 13.2 Erişim
- toolbar’daki `Satır Birleştir`
- yalnızca uygun satırlar seçiliyse aktif

## 13.3 Birleştirme Ön İzlemesi
Birleştirme modalı veya drawer’ı şu alanları göstermelidir:
- seçilen satırlar
- ortak alanlar
- farklı alanlar
- birleşme sonrası toplam adet
- plaka bilgisi
- açıklama alanları

## 13.4 Sonrası
Birleşmiş satır görsel iz taşımalıdır:
- küçük `Birleştirildi` badge’i
- audit izi
- istenirse tooltip ile geçmiş bilgisi

---

# 14. Cari Arama Modali / Drawer

## 14.1 Açılış Kaynakları
- header cari kartı
- toolbar `Cari Ara` butonu

## 14.2 İçerik
- arama input’u
- sonuç listesi
- cari kodu
- cari ünvanı
- telefon / kısa bilgi
- seçim butonu

## 14.3 Seçim Sonrası
- header kartı success state’e döner
- blocker tekrar hesaplanır
- footer buton state güncellenir

---

# 15. Stok Arama / Eşleştirme Drawer'ı

## 15.1 Açılış Kaynakları
- kırmızı malzeme hücresindeki search icon
- toolbar `Stok Ara`

## 15.2 İçerik
- arama input’u
- önerilen stok listesi
- stok kodu
- stok açıklaması
- varsa kısa teknik bilgiler
- seç butonu

## 15.3 Arama Sonuç Durumları
- tam eşleşme
- benzer eşleşme
- eşleşme bulunamadı

## 15.4 Seçim Sonrası
- satır success hale gelir
- malzeme hücresi yeşile döner
- durum kolonu yeşile döner
- blocker yeniden hesaplanır

---

# 16. Fire Açıklaması UX'i

## 16.1 Zorunlu Bağlam
Sistemde fire açıklaması bulunur ve UI bu alanı desteklemelidir.

## 16.2 Açılış
- toolbar `Fire Açıklaması`
- seçili satır detayı
- satır bazlı inline düzenleme

## 16.3 İçerik
- fire nedeni
- kısa açıklama
- gerekiyorsa miktar / not
- kaydet butonu

## 16.4 Görsel Yansımalar
Fire açıklaması gereken veya eklenmiş satırlar:
- mini rozet taşıyabilir
- açıklama sütunlarında fark edilir küçük iz bırakabilir

---

# 17. Satır Detay Paneli

## 17.1 Amaç
Grid yoğun olduğu için seçili satırın detaylarını ikinci bir panelde göstermek.

## 17.2 İçerik
- satır numarası
- plaka bilgisi
- ERP stok kodu
- açıklamalar
- bant alanları
- merge geçmişi
- fire notu
- son operatör müdahalesi

## 17.3 Görünüm
- sağ drawer ya da alt detay paneli
- sade border’lı bloklar
- küçük tipografi

---

# 18. Footer

## 18.1 Sol Alan
Dinamik hata/success mesaj alanı

### Hard Blocker varsa
- alert icon
- metin: `Eksik ERP Eşleşmeleri Var (Hard Blocker Aktif)`
- `text-red-400`

### Hard Blocker yoksa
- success icon opsiyonel
- metin: `Tüm ERP eşleşmeleri tamamlandı`
- `text-emerald-400`

## 18.2 Orta Alan
Küçük metrik özetleri olabilir:
- Toplam Kalem
- Eşleşmeyen Kalem
- Toplam Adet

## 18.3 Sağ Alan
Aksiyonlar:
- `Taslak Kaydet`
- `Phase 4'e Aktar (Excel Üret)`

### Phase 4 Butonu
#### Disabled State
- `bg-slate-700`
- `text-slate-500`
- `cursor-not-allowed`

#### Active State
- `bg-blue-600`
- `text-white`
- `hover:bg-blue-500`

---

# 19. Hard Blocker Mantığı

## 19.1 Hard Blocker Üreten Durumlar
Aşağıdaki durumların herhangi biri blocker sayılır:
- cari eşleşmesi yok
- en az bir satırda stok eşleşmesi yok
- merge tamamlanması gereken kritik durumlar varsa
- fire açıklaması zorunlu olup eksik bırakılmışsa (iş kuralı bunu gerektiriyorsa)

## 19.2 Hard Blocker Sonuçları
- footer danger state
- export butonu disabled
- validation summary danger state
- ilgili hücre/satır kırmızı görsel state

---

# 20. Dummy Data ve Demo Senaryoları

## 20.1 Minimum Gösterilmesi Gereken Demo
### Senaryo A
- cari eşleşmiş
- 1 satır stok eşleşmiş
- 1 satır stok eşleşmemiş
- footer blocker aktif
- export disabled

### Senaryo B
- cari eşleşmemiş
- tüm satırlar stok eşleşmiş
- header danger
- footer blocker aktif

### Senaryo C
- tüm eşleşmeler tamam
- export butonu aktif

### Senaryo D
- birleştirme bekleyen satırlar

### Senaryo E
- fire açıklaması gereken satır

---

# 21. Durum Rozetleri

## 21.1 Kullanılabilecek Mini Rozetler
- `ERP OK`
- `Cari OK`
- `Stok Eksik`
- `Merge`
- `Fire`
- `Manuel`

## 21.2 Kullanım İlkesi
Rozetler küçük, kompakt ve bilgi yoğun olmalı; ekranı SaaS dashboard görünümüne çevirmemelidir.

---

# 22. Klavye ve Etkileşim İlkeleri

## 22.1 Hedef
Phase 3 yoğun operasyon ekranı olduğu için kullanıcıyı yalnız mouse’a bağımlı bırakmamak gerekir.

## 22.2 Beklenen Davranışlar
- satır seçimi hızlı olmalı
- modal açıldığında ilk input focus almalı
- Escape ile modal kapanabilmeli
- Tab sırası mantıklı olmalı
- Enter ile seçim onayı desteklenebilir

---

# 23. Empty / Loading / Error State'leri

## 23.1 Loading
- grid üstünde veya tablo alanında sade loading göstergesi
- aşırı animasyon kullanılmamalı

## 23.2 Empty State
- `Gösterilecek sipariş satırı bulunamadı`
- gri tonlu sade bilgi

## 23.3 Error State
- `Veri alınırken hata oluştu`
- kırmızı tonlu kompakt uyarı alanı

---

# 24. Responsive Davranış

## 24.1 Hedef Platform
Öncelik desktop kullanımındadır.

## 24.2 Beklenti
- masaüstünde tam verim
- daha dar ekranlarda yatay scroll kabul edilir
- mobil öncelikli tasarım yapılmayacaktır

---

# 25. Erişilebilirlik

## 25.1 Minimum Beklentiler
- yeterli kontrast
- ikonların anlamı yalnız renkle verilmemeli
- tooltip veya metinsel destek olmalı
- focus state görünür olmalı

---

# 26. Geliştirici İçin Uygulama Sınırları

## 26.1 Yapılacaklar
- saf Tailwind CSS
- Lucide React ikonları
- yoğun ama okunabilir layout
- tek dosya demo mümkün
- state’ler iş kurallarına bağlı görünmeli

## 26.2 Yapılmayacaklar
- UI kütüphanesi kullanımı
- modern SaaS kartlı tasarım
- aşırı shadow / radius / gradient
- referans ekranı yumuşatmak
- ERP dışı estetik katmak

---

# 27. Nihai Teslim Beklentisi

Phase 3 UI/UX çıktısı aşağıdakileri eksiksiz kapsamalıdır:
- header
- cari eşleşme kartı
- aksiyon toolbar’ı
- sipariş özeti bandı
- validation summary
- çoklu plaka gösterimi
- ana dense grid
- stok eşleşme renk state’leri
- durum kolonları
- satır seçimi
- satır birleştirme akışı için yer
- cari arama modal/drawer
- stok arama modal/drawer
- fire açıklaması alanı
- satır detay paneli
- footer blocker alanı
- export butonu
- active/disabled state mantıkları
- loading/empty/error durumları

Bu ekran, görsel olarak yoğun, operasyonel olarak net, iş kuralları açısından güvenli ve sonraki faz export akışını destekleyen bir ERP kontrol merkezi olarak tasarlanmalıdır.

---

# 28. Phase 2'den Gelen Ön Koşullar

Phase 3 ekranı açıldığında aşağıdaki ön koşulların sağlandığı varsayılır:

- kayıt Phase 2 doğrulamasını tamamlamış olmalı
- BOY / EN / ADET / U1 / U2 / K1 / K2 alanlarının tamamı güvenli veya operatör onaylı olmalı
- hatalı işaretlenen kayıtlar bu kuyruğa alınmamalı
- kayıt bazlı blocker özeti erişilebilir olmalı

Eğer ön koşullar sağlanmazsa:
- Phase 3 ekranında kayıt düzenlenebilir görünse bile export kapalı kalmalı
- kullanıcıya neden metni ile geri bildirim verilmelidir

# 29. Hard Blocker Karar Tablosu (Netleştirilmiş)

Phase 3’te export kilidi aşağıdaki karar setine göre çalışır:

## 29.1 Blocker Üreten Durumlar
- cari eşleşmesi yok
- en az bir satırda stok eşleşmesi yok
- fire açıklaması zorunlu satırda fire alanı boş
- kritik merge grubu bekliyor (aynı malzeme/boy/en/plaka kombinasyonunda birden fazla satır henüz birleşmemiş)

## 29.2 Blocker Üretmeyen Durumlar
- yalnız görsel kozmetik farklar
- bilgi amaçlı gri/metrik alanları
- kullanıcı tarafından henüz seçilmemiş satır

## 29.3 Blocker Sonuçları
- footer kırmızı danger state
- `Phase 4'e Aktar (Excel Üret)` butonu disabled
- tooltip içinde blocker nedeni listesi
- problemli satır/hücrede kırmızı veya uyarı izi

# 30. Faz Sonu Çıkış Kriterleri

Phase 3 kapanmış sayılmadan önce aşağıdaki koşullar birlikte sağlanmalıdır:

1. cari eşleşmesi tamam
2. stok eşleşmesi eksik satır yok
3. zorunlu fire açıklamaları tamam
4. kritik merge bekleyen grup yok
5. validation summary alanında export-ready durumu `evet`
6. footer success state aktif
7. export CTA aktif ve tetiklenebilir

# 31. QA Release Checklist (Phase 3)

Release öncesi minimum QA doğrulamaları:

- Senaryo A: stok eksik blocker doğru çalışır
- Senaryo B: cari eksik blocker doğru çalışır
- Senaryo C: tüm eşleşmelerde export açılır
- Senaryo D: merge bekleyen satırları görsel olarak ayırt edilebilir
- Senaryo E: fire eksikliği exportu kilitler
- cari/stok modal açılışında ilk input focus alır
- Escape ile modal kapanır
- toolbar ve footer state’leri blocker değişimine senkron güncellenir
- canlı veri ve demo veri modunda aynı iş kuralı davranışı korunur

Bu checklist sağlanmadan Phase 3 üretim onayı verilmemelidir.
