# OPTIPLAN 360 — MASTER HANDOFF (TEK PARÇA)
_Tarih: 2026-02-09 01:15:40_

Bu doküman; **API + DB + İstasyon Mantığı + WhatsApp Otomatik Mesajlar + SQL Board Alanları + Dosyalama Kuralları + UI Alan Manifestosu + Akış Diyagramları + Global Standart Kurallar Manifestosu** dahil olmak üzere, projenin üretime hazır omurgasını tek parçada teslim eder.

---

## 0) Değişmez Kurallar Manifestosu (Kilit)
Aşağıdaki kurallar **global standart** seviyesinde kabul edilmiştir ve değiştirilemez:

### 0.1 Veri ve Dosya Kuralları
- **Gövde ayrı**, **Arkalık ayrı** çıktı (liste/export) üretilir.
- **Renk** ve **kalınlık** farklıysa **ayrı liste** üretilir (UI ve OptiPlanning tarafında).
- OptiPlanning’e giriş formatı `.xlsx`, makineye giden çıktı **OptiPlanning’in ürettiği** `.xml`’dir.
- OptiPlanning’in Excel satır/kolon tag’leri **asla değiştirilmez/eksiltilmez**.
- Makine **ondalık** kabul eder. UI tam sayı girse bile Opti/ makine tarafına ondalıklı gidebilir.
- Trim UI’da gösterilmez. Trim OptiPlanning tarafında sabit/ayarlanabilir kalır.
- Bant payı hesaplaması UI’da yapılmaz; UI yalnızca bant değerini (ör. `1mm`) ve kenar tiklerini gönderir. OptiPlanning düşümü uygular.

### 0.2 Telefon ve CRM
- OCR’dan gelen telefon normalize edilir (ör: `532...`).
- Tek telefon bulunmazsa: **operatör onayı** gerekir.
- Telefon → CRM isim eşleşmesi zorunludur; eşleşme yoksa **yeni kayıt açılması zorunlu**.
- Dosya adlarında CRM isim snapshot zorunludur:
  - `CRMISIM_TIMESTAMP_18mm Beyaz_GOVDE.xlsx`
  - `CRMISIM_TIMESTAMP_5mmBeyaz_ARKALIK.xlsx`

### 0.3 Grain Kuralı (UI’dan seçilir)
- Makinenin kabul ettiği değerler: `0-Material`, `1-Material`, `2-Material`, `3-Material`
- OptiPlanning @437 parametresi ile birebir eşleşme:
  - `0-Material` → **Otomatik (OptiPlanning=0)**: Damar/desen yok. Parça her iki yönde yerleştirilebilir. Boyutlar değiştirilebilir. Düz renk malzemeler için.
  - `1-Material` → **Uzunluk (OptiPlanning=1)**: Damar kısa kenar boyunca. Parça genişliği panel genişliğiyle eşleşir.
  - `2-Material` → **Genişlik (OptiPlanning=2)**: Damar uzun kenar boyunca. Parça uzunluğu panel uzunluğuyla eşleşir.
  - `3-Material` → **Karışık**: Desen yönü var ama karışık/önemsiz. OptiPlanning tarafında ayrıca yönetilir.
- **@433 Kuralı**: Damarlı (grain 1/2) parçalarda OptiPlanning yönelimi yönetmek için otomatik olarak 0,1 mm uzunluk ekler. Bu değer UI’dan gönderilen ölçüyü etkilemez; OptiPlanning kendi içinde uygular.
- **@2012 Kuralı**: Grain 0 (desensiz) malzemelerde “Asgari Değiştirilebilir Boyutlar” aktif edilebilir; drop optimizasyonunda boyut serbestliği artar.
- Grain değişimi **ölçü ekranından** yapılır.

### 0.4 Bant & Arkalık
- Arkalıkta **bant kesinlikle olmaz** (UI’da bant alanı arkalık için kapalı/NULL).

### 0.5 Birleştirme (Merge) Kuralı
- Varsayılan birleştirme **YOK**.
- Ölçü aynıysa birleştirme **öneri** olarak sunulur; operatör onayı olmadan uygulanmaz.
- Delik kodları mevcutsa satırlar **aynı kalır** (birleşmez).
- Birleştirme önerilerinde bant tiklerinin **aynı/farklı** raporu gösterilir.

### 0.6 Sipariş Durumları ve İstasyonlar
- İstasyonlar: **Ürün Hazırlık**, **Ebatlama**, **Bantlama**, **Kontrol**, **Teslimat**.
- Hazır ve teslim bilgisi **makineden değil**, sabit istasyondaki personelin barkod okumasıyla oluşur.
- İstasyon okutma “yanlış aşama” ise işlem yapılmaz, sadece uyarı+log.
#### 0.6.1 2 Okutmanın Yapılması Gereken İstasyonlar
- **Cihaz 1 (EBATLAMA)**: 1. Okutma = Ürün Hazırlık, 2. Okutma = Ebatlama İşlemi
- **Cihaz 3 (KONTROL)**: 1. Okutma = Teslimata Hazır, 2. Okutma = Teslimat Yapıldı

#### 0.6.2 2. Okutma Zaman Kuralı (KRİTİK)
- **30 DAKİKA KURALI**: 2. okutmanın yapılması **gereken** istasyonlarda, 2. okutma MUTLAKA **1. okutmadan 30 DAKİKA SONRA** yapılmalıdır.
- Eğer 2. okutma **30 dakika İÇİNDE** (30 dakikayı tamamlamadan) yapılırsa:
  - **STATUS**: Geçersiz okutma ❌
  - **ACTION**: Durum güncellenmez, işlem iptal edilir
  - **LOGGING**: Sistem loglarına "❌ GEÇERSİZ OKUTMA" kaydı düşer (parça ID, cihaz, sebep, zaman farkı)
  - **REPORTING**: İzleme panelinde raporlanır, operatöre uyarı verilir
- Örnek:
  - 14:00 - 1. Okutma (Ürün Hazırlık - HAZIRLIK)
  - 14:15 - 2. Okutma denemesi → ❌ HATA (15 dakika geçti, 30 dakika gerekirdi)
  - 14:31 - 2. Okutma denemesi → ✅ OK (31 dakika geçti, kural sağlandı)
### 0.7 WhatsApp Otomatik Mesajlar (Standard)
- WhatsApp standardı uygulanır (template/mesai/sıralama).
- Okunmayan satır için **satır numarası zorunlu**.
- Süreç durmaz: müşteri dönüş bekleme süresi UI’dan ayarlanır; süre dolunca operatöre devredilir.
- “Teslim alınmadı” hatırlatma:
  - 2 gün periyot, maksimum 5 tekrar, sadece mesai içinde.

### 0.8 Altyapı ve Güvenlik
- Bulut çıkışı olabilir ama **doğrudan sisteme müdahale etmez**; güvenli ara katman.
- Kullanıcılar yerel; altyapı gelecekte müşteri uygulamasına açılacak şekilde hazır.
- Loglama kullanıcı bazlı olmalı.
- Yedekleme: NAS + ikinci kopya (NAS+Google gibi).

---

## 1) Sistem Mimarisi (Özet)
Bileşenler:
- **Frontend (React)**: Operatör, Admin, İstasyon ekranı (kiosk).
- **Backend (Python API)**: İş akışı, validasyon, merge öneri, loglama, durum yönetimi, Mikro SQL read-only entegrasyonu, WhatsApp tetikleme.
- **Bridge (Python)**: OptiPlanning’e gidecek `.xlsx` üretimi (gövde/arkalık ayrı; renk/kalınlık ayrı; grain ve bant tikleri doğru).
- **DB (PostgreSQL)**: Sipariş/Parça/Durum/Log/İstasyon/Mesaj.

---

## 2) Klasör ve Dosyalama Standartları (Operatör Görünümü + Güvenli İç Yapı)

### 2.1 Operatörün gördüğü (Basit)
```
/orders/
  CRMISIM_YYYYMMDD_HHMMSS/
    original.jpg
    normalized.jpg
    CRMISIM_YYYYMMDD_HHMMSS.pdf
    CRMISIM_YYYYMMDD_HHMMSS_GOVDE.xlsx
    CRMISIM_YYYYMMDD_HHMMSS_ARKALIK.xlsx
```

### 2.2 İç sistem dosyaları (yedekli, kullanıcıdan gizli)
```
/system/
  /orders_meta/
    <order_id>/
      meta.json
      ocr_raw.json
      logs.txt
      exports.json
  /backups/
  /archives/
```

---

## 3) UI Alan Manifestosu (Ekranlar)

### 3.1 Operatör — Sipariş Editörü (Zorunlu header alanları)
Bu alanlar dolmadan ölçü tablosu işleme açılmaz:
- Müşteri (CRM eşleşmiş isim) + Telefon
- Malzeme (Mikro’dan listelenen stok adı; operatör seçer)
- Kalınlık (4/5/8/18)
- Plaka ebatı (ör: 2100x2800; %95 standart)
- Bant (gövde için; arkalık için kapalı)
- Grain seçim modu (1/2/3-Material; 0 opsiyon)
- (Admin gizli) Trim gösterilmez

### 3.2 Tablo Alanları (Kesin)
- Boy
- En
- Adet
- Grain (0/1/2/3-Material)
- U1, U2, K1, K2
- Parça Bilgi (Açıklama)
- Delik Kodu-1
- Delik Kodu-2

### 3.3 Import Alanları
- `.xlsx import` (ölçü listesi içeri al)
  - Delik kodları varsa satırlara yazılır
  - Delik kodları yoksa satır birleştirme önerisi devreye girer

### 3.4 Durum Listeleri
- Yeni (New)
- Bekletilen (Hold) — 2 hafta
- İptal (Cancelled) — bekletilenden sonra
- Üretimde (In Production)
- Hazır (Ready)
- Teslim (Delivered)
- Tamamlananlar (Done) — 6 ay tut, sonra arşiv/yedek

### 3.5 Admin Panel
- SQL Board (bağlantı parametreleri)
- Mesai saatleri (config)
- WhatsApp şablonları
- İstasyon tanımları
- Log/rapor ekranı

### 3.6 İstasyon Ekranı (Kiosk)
- Sabit cihaz; sadece okutma + durum sonucu (OK/Uyarı)
- Admin ekranından izlenir

---

## 4) SQL Board — Admin Bağlantı Parametreleri (Sistem Ekibi Entegrasyonu)
- SQL Server Host / IP
- Port
- Instance Name (opsiyonel)
- Database Name
- Username
- Password (maskeli)
- Connection Timeout (sn)
- Encrypt Connection (bool)
- Trust Server Certificate (bool)
- Read-only Mode (her zaman true)
- Test Connection (buton)
- Last Test Result (timestamp)
- Last Error (UI maskeli; audit log tam)

---

## 5) Mikro Stok Adı Normalize Kuralları (Kilit)
- MLAM = MDFLAM
- SLAM = SUNTALAM
- Kalınlık/Ebat/Renk filtreleme: operatör seçer, en yakın eşleşme listesi onaya sunulur.
- Stok kodu gerekmez, stok adı yeterlidir.

---

## 6) API (V1) — Endpoint Seti (kısa)
Detay: `docs/openapi.yaml`

- GET `/health`
- GET `/customers/lookup?phone=...`
- POST `/customers`
- GET `/materials/suggest?...`  (Mikro SQL read-only)
- POST `/orders`
- POST `/orders/:id/import/xlsx`
- POST `/orders/:id/validate`
- POST `/orders/:id/approve`
- POST `/orders/:id/export/opti`
- POST `/stations/scan`
- POST `/messages/send`

---

## 7) DB Şeması
`database/schema.sql`

---

## 8) WhatsApp Mesaj Taslakları (Kurumsal TR)
`integrations/whatsapp/templates.json`

---

## 9) UI Akış Diyagramı (Mermaid)
`docs/ui_flow.mmd`

---

## 10) Canlıya Geçiş İçin Sizden Beklenen Değerler (Sistem Ekibi Girecek)
- SQL Board bağlantı değerleri (Mikro SQL Server)
- WhatsApp: **Meta WABA** — phone_number_id, business_account_id, access_token (vault'a kaydedilecek)
- Mesai saatleri config (config/shift_hours.json — Pzt-Cmt 09:00-18:00, Pazar tatil)
- Makine paylaşım yolu: **\\\\DESKTOP-OPTIMIZE** (UNC, export xlsx buraya kopyalanır)
- **PostgreSQL**: Sistem ekibi önceden kurar. Backend ilk çalışmada Alembic migration ile tabloları otomatik oluşturur.
- Meta Business Manager'dan WhatsApp template onayları (7 şablon)

---

## 11) Kilit
Bu dokümanla **UI alanları + kurallar kilitlenmiştir**. Bundan sonra kod üretimi bu omurgaya %100 uyacaktır.

---

## 12) Güncellemeler ve Değişiklikler

### [2026-02-15] UI İyileştirmeleri ve Menü Yeniden Yapılandırması

#### Menü Yapısı Değişikliği
**Değişiklik**: Sidebar menü hiyerarşisi basitleştirildi.
- **ÖNCEDEN**: 4 ana başlık (ANA MENÜ, ENTEGRASYONLAR, İSTASYONLAR, YÖNETİM)
- **SONRA**: 2 ana başlık (ANA MENÜ, YÖNETİM)

**YÖNETİM** başlığı altındaki öğeler:
```
YÖNETİM
├── 🔗 Entegrasyonlar (OCR/WhatsApp yetkisi olanlar için)
├── 🏗️ İstasyonlar (Sadece Admin)
├── 🏭 Kiosk Mod (Sadece Admin)
├── 👥 Kullanıcılar (Sadece Admin)
├── 📜 Loglar (Sadece Admin)
└── ⚙️ Ayarlar (Sadece Admin)
```

**Gerekçe**: Daha temiz ve organize bir navigasyon deneyimi. Yönetim ile ilgili tüm işlemler tek başlık altında toplandı.

#### İstasyon Adları (Zaten Doğru)
İstasyon isimleri dokümantasyonda zaten doğru şekilde tanımlanmıştı:
- ✅ **HAZIRLIK** (Ürün Hazırlık)
- ✅ **EBATLAMA** (Ebatlama İşlemi)
- ✅ **BANTLAMA** (Bantlama İşlemi)
- ✅ **KONTROL** (Teslimata Hazır)
- ✅ **TESLİMAT** (Teslimat Yapıldı)

#### Kritik Düzeltmeler
1. **İstasyonlar Sayfası**: Cihaz bilgisi erişim hatası düzeltildi (`s.device.name` → `s.deviceName`)
2. **Kullanıcılar Sayfası**: Mock kullanıcı verisi eklendi (5 kullanıcı: 1 Admin, 2 Operatör, 2 İstasyon)
3. **Kanban Sayfası**: Sipariş kartlarına tıklama özelliği eklendi - karta tıklandığında sipariş detayları açılıyor

#### Etkilenen Dosyalar
- `frontend/src/App.tsx`: Menü yapısı + bug düzeltmeleri
- `OPTIPLAN360_MASTER_HANDOFF.md`: Bu dokümantasyon güncellemesi

#### Geriye Dönük Uyumluluk
- ✅ API endpoint'leri değişmedi
- ✅ Database şeması aynı
- ✅ İş kuralları korundu
- ✅ RBAC (rol tabanlı erişim) mantığı aynı

---

**Son Güncelleme**: 2026-02-15 18:00  
**Sorumlu**: Sistem Geliştirme Ekibi

---

## 13) KİOSK MODU — P1 HIGH PRIORITY İYİLEŞTİRMELER (15 Şubat 2026)

### 13.1 Özet
Kiosk modu (istasyon operatörleri için tam ekran barkod okutma) için **P1 High Priority** 5 temel iyileştirme **tamamlandı ve üretime hazır**.

### 13.2 Uygulanan Özellikler

#### A) Geliştirilmiş Kullanım Talimatları (Enhanced Instructions)
**Neler Değişti:**
- Her cihaz için **adım-adım detaylı rehberlik** (2-3 adım)
- Her adımda:
  - 📋 Başlık + açıklama
  - 📝 Pratik örnekler (ne yapılacak, dikkat edilecek)
  - 👁️ Visual gösterimi (ör: `🔷 → 📋✓`)
  - ⏱️ İşlem süresi
  - 👥 Gereken işçi sayısı

**Cihaz-Spesifik İçerik:**

| Cihaz | Adımlar | Bekleme | Not |
|-------|---------|---------|-----|
| **Cihaz 1: Kesim** | HAZIRLIK → EBATLAMA | **30 dk** | Ürün hazırlığı sonra kesim, kesim sonra durumu kaydet |
| **Cihaz 2: Bantlama** | TEK OKUTMA | Yok | Bantlama hemen tamamlandıktan sonra okut, kuralsız hızlı |
| **Cihaz 3: Kalite/Teslimat** | KONTROL → TESLİMAT | **30 dk** | Kalite kontrol sonra depo beklemesi, depo sonra teslimat |

#### B) Sesli Rehberlik Entegrasyonu (Voice Guidance)
**Neler Değişti:**
- 🔊 **Web Speech API** kullanarak Türkçe sesli rehberlik
- Her adımın yanında "🔊 Sesi Dinle" butonu
- Hata durumlarında otomatik sesli uyarı

**Teknik İmplemantasyon:**
- Language: `tr-TR` (Türkçe)
- Speech rate: 0.9 (normalin biraz yavaş)
- Toggle control: Device intro screen'de aktivasyon

#### C) Gerçek Zamanlı Durum Dashboard'u (Real-time Statistics)
**Neler Değişti:**
- Cihaz başına günü istatistikleri:
  - ✅ Başarılı okutma sayısı
  - ❌ Hata sayısı
  - 📍 Son okutma saati
  - 📡 Çevrimdışı mod durumu

**Storage:** LocalStorage (`deviceStats` key ile JSON format)

#### D) Çevrimdışı Mod Desteği (Offline Mode)
**Neler Değişti:**
- 📡 **Çevrimdışı Mod Toggle'ı** (device intro screen'de)
- Offline scan verilerinin `localStorage` depolama (`offlineScans` array)
- Status göstergesi: "_📡 Çevrimdışı Mod Aktif (3 bekleme)_"
- 🔄 "Senkronize Et" butonu görünür

**Senkronizasyon:**
- Offline verisi: `{ device, barcode, timestamp, status }`
- Backend sync fonksiyonu: `syncOfflineData()` (hazır, `/api/kiosk/sync`)

#### E) Geliştirilmiş Hata Yönetimi (Error Handling)
**Neler Değişti:**
- ✅ Barkod format validasyonu (minimum 3 karakter)
- ❌ Detaylı, kategorize edilmiş hata mesajları
- 🔊 Sesli error notification
- 📊 Hata istatistikleri cihaz başına saklantı

**Hata Türleri:**

| Hata | Mesaj | Aksiyon |
|------|-------|--------|
| **GEÇERSİZ BARKOD** | Barkod çok kısa (min 3 kar.) | Yeniden okut |
| **SİSTEM HATASI** | İstasyon tanımı bulunamadı | Admin'e rapor et |
| **BULUNAMADI** | Sipariş kaydında yok | Stok kontrol |

---

### 13.3 Barcode Okuma Cihazı Tanıtımı (Hardware Integration)

#### A) Desteklenen Cihazlar ve Protokoller

**USB Barcode Scanner (YAYGINDI)**
- ✅ HID (Human Interface Device) - USB Keyboard Emulation
- ✅ Extra kurulum YOK - Browser tarafındaKeyboard event'i
- ✅ Windows/Mac/Linux tüm işletim sistemede çalışır
- **Kurulum**: USB kabloya takıp, tarayıcıda Enter basın

**Bluetooth Barcode Scanner (İLERİ)**
- ⚠️ Web Bluetooth API gereklı
- ⚠️ Pairing + browser izni + mobil uyum

**Yazılım Okutma / Kamera (FUTURE)**
- ⚠️ WebRTC + ZXing.js (QR/Barcode detection)
- ⚠️ Kamera izni + computationally expensive

#### B) Önerilen: USB HID Barcode Scanner (Phase 1)

**Neden USB HID?**
- ✅ En basit, 0 kurulum
- ✅ En güvenilir (donanım destekli)
- ✅ Tüm işletim sistemlerinde native
- ✅ Operatör: "Cihazı takıp okut"

**Teknik:**
```typescript
// Browser'dan barcode scanner = USB keyboard event
// Input focused → Enter → handleScan()

useEffect(() => {
  const handleKeyDown = (e) => {
    if (kioskMode && inputRef.current === document.activeElement) {
      if (e.key === "Enter") handleScan();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [kioskMode]);
```

#### C) Cihaz Entegrasyon Adımları (Operatör Kılavuzu)

**Adım 1: Bağlantı**
```
1. USB Barcode Scanner'ı masaüstü/dizüstü USB portuna takın
2. Sistem otomatik tanır (sürücü yok)
3. Browser: http://localhost:5177
4. "Kiosk Mod" → Cihaz seç → Okut
```

**Adım 2: Test**
```
Test barkodu: OP-2026-0847

Beklenen:
- Scanner "beep" ses çıkar
- Input field'a barkod yazılır
- Enter basılmadan OK değil ("🔊 Sesi Dinle"ye yakla)
```

**Adım 3: Sorun Giderme**

| Sorun | Çözüm |
|-------|-------|
| Barkod girilmiyor | Input'u tıkla, scanner ayarını kontrol et |
| Çift okutma oluyor | Scanner ayarından "Auto Enter" KAPATIN |
| Format yanlış | Scanner'dan: Kod128/EAN13/UPC seç |

---

### 13.4 Cihaz Yüklemeleri İçin Alanlar (Installation & Classification)

#### A) Cihaz Bilgileri Tablosu (Device Metadata)

| Alan | Tür | Zorunlu | Açıklama | Örnek |
|------|-----|---------|----------|-------|
| **device_id** | Int | ✅ | Sistemin tanısı | 1,2,3 |
| **device_name** | String | ✅ | Operatör görünümü | "Cihaz 1" |
| **device_location** | String | ✅ | Fabrika konumu | "HAZIRLIK İSTASYONU" |
| **device_type** | Enum | ✅ | DUAL_SCAN \| SINGLE_SCAN | "DUAL_SCAN" |
| **device_description** | String | ✅ | Fonksiyonu | "Kesim İşlemleri Cihazı" |
| **station_start** | String | ✅ | 1. istasyon | "HAZIRLIK" |
| **station_end** | String | ⭕ | 2. istasyon (dual) | "EBATLAMA" |
| **hardware_type** | Enum | ✅ | USB_SCANNER \| BLE \| WEB_CAMERA | "USB_SCANNER" |
| **is_active** | Bool | ✅ | Etkin? | true |

#### B) İstasyonlar Tablosu (Stations)

| Alan | Tür | Zorunlu | Açıklama | Örnek |
|------|-----|---------|----------|-------|
| **station_id** | Int | ✅ | İstasyon ID | 1-5 |
| **station_name** | String | ✅ | Display adı | "HAZIRLIK" |
| **station_label** | String | ✅ | Uzun açıklama | "Ürün Hazırlık" |
| **device_id** | Int | ✅ | Hangi cihaza bağlı | 1,2,3 |
| **scan_number** | Int | ✅ | Sıra (1. mi 2. mi) | 1 veya 2 |
| **requires_dualtime** | Bool | ✅ | 30 dk kuralı? | true/false |
| **min_wait_minutes** | Int | ⭕ | Min bekleme (dual) | 30 |
| **is_active** | Bool | ✅ | Aktif? | true |

#### C) Üretime Transfer Kontrol Listesi

**✅ Donanım:**
- [ ] USB Barcode Scanner takılı
- [ ] Scanner manual test edildi
- [ ] Browser localhost:5177 açıldı
- [ ] Network OK (offline mode gerekliyse)

**✅ Yazılım:**
- [ ] `registeredDevices` tamamlı (id, name, location, type, description, hardware_type)
- [ ] `STATIONS` tablosu dolu (5 istasyon, 3 cihaz)
- [ ] `min_wait_minutes = 30` Cihaz 1 & 3'te
- [ ] Kiosk Mod butonu visible
- [ ] Device intro screen 2 sütunlu

**✅ Eğitim:**
- [ ] Operatör Kiosk Mod açmayı bilir
- [ ] Operatör "30 dakika kuralı" anlar
- [ ] Operatör offline mode gördü

**✅ Test:**
- [ ] Frontend: `npm run build` ✅
- [ ] Backend: `uvicorn` ✅
- [ ] PostgreSQL: tablolar dolu ✅
- [ ] Logs: ilk scan loglandı ✅

---

### 13.5 Teknik Referans (Güncel Dosya Konumları)

> Not: Frontend modüler refactor sonrası satır numaraları yerine dosya bazlı referans kullanılır.

| Feature | Güncel Konum | Açıklama |
|---------|--------------|----------|
| **DeviceStats** | `frontend/src/App.tsx` (`KioskMode`) | State + localStorage |
| **Voice API** | `frontend/src/App.tsx` (`KioskMode`) | `speakInstruction()` |
| **Enhanced Instructions** | `frontend/src/App.tsx` (`registeredDevices`) | Cihaz bazlı rehber akış |
| **Device Intro Screen** | `frontend/src/App.tsx` (`KioskMode`) | 2-column layout |
| **Barcode Validation** | `frontend/src/App.tsx` (`handleScan`) | Barkod doğrulama |
| **Offline Sync** | `frontend/src/App.tsx` (`syncOfflineData`) | Offline senkronizasyon |
| **Offline UI** | `frontend/src/App.tsx` (`KioskMode`) | Indicator + Sync button |

---

### 13.6 Test Senaryoları

**Test 1: Normal Akış**
1. Kiosk Mod → Cihaz 1
2. Device info: Talimatları oku
3. Barcode: OP-2026-0847
4. Result: ✅ stats +1

**Test 2: Offline + Sync**
1. Offline Mode ON
2. 3 barcode okut
3. Offline: 3 pending
4. "Senkronize Et (3)" → Backend sync

**Test 3: 30 Dakika Kuralı**
1. Cihaz 1 okut (14:00)
2. 10 dk sonra 2. okut → ❌
3. 20 dk sonra → ✅

---

**Son Güncelleme**: 2026-02-15 21:00  
**Sorumlu**: Sistem Geliştirme Ekibi

## [2026-02-17] API VE STATE UYUMLULUK NOTU

Bu ek not, `docs/RESMI_KARAR_DOKUMANI_V1.md` ile uyum amaciyla eklenmistir.

- Canonical orchestrator API: `/jobs`
- `/orders/*` endpointleri facade/uyumluluk katmani olarak korunur.
- Teknik state canonical zinciri:
  `NEW -> PREPARED -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE`
- UI status etiketleri teknik state'lerin sade gorunumudur; birebir backend state olarak kullanilmaz.
- Veri katmani standardi:
  - Production: PostgreSQL
  - Local/Test/edge operasyon: SQLite desteklenebilir
