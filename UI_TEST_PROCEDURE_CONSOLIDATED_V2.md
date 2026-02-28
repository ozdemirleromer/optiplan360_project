# OptiPlan360 — Revize UI Test Prosedürü (Consolidated)
**Versiyon:** 2.0 — REDUNDANCY ELIMINATED  
**Tarih:** 18 Şubat 2026  
**Hedef:** Kimlik doğrulama → Dashboard → Generic CRUD + Entity-specific tests → Cross-cutting concerns

---

## 📋 Amaç

Frontend uygulamasının **insan gibi kullanılması** senaryosunda, tüm kritik fonksiyonları test etmek. Tekrarlayan CRUD operasyonları **generic patterns** ile konsolide edildi.

---

## 🧑‍💻 Test Senaryosu: İşletmeci Workflow

### BÖLÜM 1: Kimlik Doğrulama (Authentication)
```
1.1 Login Akışı — Başarısız Credential
    ✓ http://localhost:3000 → Login formu göründüğü
    ✓ Kullanıcı: testuser | Şifre: wrongpass
    ✓ Giriş Yap tıkla → Hata mesajı
    
1.2 Login Akışı — Başarılı (Admin/Operator/Viewer)
    ✓ Kullanıcı: admin | Şifre: admin123 (veya operator/viewer)
    ✓ Giriş Yap tıkla
    ✓ Dashboard'a yönlendir
    ✓ Loading spinner (varsa) tamamlanır
    
1.3 Auth State Doğrulama
    ✓ Kullanıcı rolü (ADMIN/OPERATOR/VIEWER) görünür
    ✓ Logout butonu/menu görünür
    ✓ URL dashboard path'ine değişti
```

### BÖLÜM 2: Dashboard & Navigation
```
2.1 Dashboard Yüklemesi
    ✓ İstatistik kartları (toplam, durumlar)
    ✓ Data listesi/tablo
    ✓ Refresh butonu (varsa)
    
2.2 Navigation Menu
    ✓ "Operasyonlar" / "Operations" linki
    ✓ "Ödemeler" / "Payments" linki
    ✓ "Kullanıcılar" / "Users" (ADMIN için)
    ✓ "Ayarlar" / "Settings"
    ✓ Logout linki
    
2.3 Sayfa Geçişleri
    ✓ Operations → Payments geçişi smooth
    ✓ Geri tuşu çalışıyor (tarayıcı back button)
    ✓ URL'ler path'e uymak
```

---

## 🔄 GENERIC TEST PATTERNS (CRUD Operasyonları)

### PATTERN A: List & Navigation (Read)
**Uygulanacak Entityler:** Operations, Payments

```
A.1 Sayfaya Git
    ✓ Navigation → Entity menu seç
    ✓ Sayfa yüklendi (loading spinner bitti)
    ✓ List/Tablo göründü
    
A.2 List İçeriği Doğrula
    ✓ Entity ID / Ref görünür
    ✓ İlişkili kayıt (müşteri, durum) göründü
    ✓ Tarih/saat göründü
    ✓ İşlem butonları (View, Edit, Delete) aktif
    ✓ Sütun başlararı açık ve anlaşılır
    
A.3 Pagination (varsa)
    ✓ "Sonraki" / "Next" butonuna tıkla
    ✓ Yeni veri yüklendi
    ✓ "Önceki" / "Prev" çalışıyor
    ✓ Sayfa numarası doğru gösterilmeli
```

### PATTERN B: Create & Form Submission
**Uygulanacak Entityler:** Orders, Payments

```
B.1 Yeni Kayıt Formu Aç
    ✓ "Yeni [Entity]" butonuna tıkla
    ✓ Modal veya yeni sayfa açıldı
    ✓ Form alanları boş/default valuelar
    
B.2 Form Alanlarını Doldur
    ✓ Tüm REQUIRED alanları doldur
    ✓ Dropdown/Select'ler açılıp seçim yapılabilir
    ✓ Date/Time pickers çalışıyor
    ✓ Validasyon mesajları (eğer ön tarafta varsa) belirtilmeli
    
B.3 Başarılı Submit
    ✓ "Kaydet" / "Submit" butonuna tıkla
    ✓ Loading spinner/indicator göründü
    ✓ Başarı mesajı göründü ("Kaydedildi", "Oluşturuldu")
    ✓ Modal kapatıldı / Sayfa yönlendirildi
    ✓ Yeni kayıt listeye eklendi
    ✓ Yeni kayıt sayfanın en üstünde veya sonunda görünüyor
    
B.4 Form Validation (Invalid Submit)
    ✓ Zorunlu alanı boş bırak
    ✓ "Kaydet" tıkla
    ✓ Validation error mesajı göründü (alanın yanında veya fortta)
    ✓ Form submit edilmedi
    ✓ Mesaj açık ve actionable (örn: "Müşteri seç")
    
B.5 Modal/Form Kapatma
    ✓ X butona tıkla veya ESC tuşu
    ✓ Modal kapatıldı / Form dismissed
    ✓ Veri kayıtsız olarak discarded
```

### PATTERN C: Detail View & State Transitions
**Uygulanacak Entityler:** Order details, Payment details

```
C.1 Detay Sayfasını Aç
    ✓ List'ten bir kayıt tıkla veya "View" butonuna tıkla
    ✓ Detay modal/sayfası açıldı
    ✓ Tüm field'lar göründü (ID, status, created_by, dates, etc.)
    
C.2 Detail Layout & Readability
    ✓ Label-value çiftleri düzgün aligned
    ✓ Status badge renkleri tutarlı (NEW=blue, DONE=green, etc.)
    ✓ Uzun text'ler word-wrap ile kesiliyor
    ✓ Tarihler lokalize format'ta (DD.MM.YYYY)
    
C.3 State Transition Buttons (Durum Değiştirilmesi)
    ✓ Geçerli state'e göre izin verilen durum butonları görünür
    ✓ Örn: NEW → PREPARED, PREPARED → OPTI_IMPORTED
    ✓ Yasaklı geçişler için button görunmez veya disabled
    ✓ Durum butonuna tıkla
    ✓ Confirmation dialog (varsa) "Onay Ver"
    ✓ Loading indicator göründü
    ✓ Durum başarıyla değişti
    ✓ UI bilgiler yenilendi
    ✓ Success mesajı göründü
    
C.4 Edit Mode (varsa)
    ✓ "Düzenle" / "Edit" butonuna tıkla
    ✓ Alanlar editable hale geldi
    ✓ Değişiklik yap ve Kaydet
    ✓ Başarı mesajı + detaylar yenilendi
```

### PATTERN D: Delete Operation & Authorization
**Uygulanacak Entityler:** Orders, Payments (Authorization bağlı)

```
D.1 Delete Butonu Görselleri
    ✓ "Sil" / "Delete" butonu / icon List veya Detail'de
    ✓ Button'un visual state (disabled veya normal) yetki doğru?
    
D.2 Delete Confirmation
    ✓ Delete butonuna tıkla
    ✓ Confirmation dialog göründü ("Emin misiniz?")
    ✓ "Cancel" seçilirse işlem iptal
    ✓ "Sil / Confirm" seçilirse devam
    
D.3 Successful Deletion
    ✓ Loading indicator
    ✓ "Silindi" başarı mesajı
    ✓ List'ten silinmiş veri gitti
    ✓ Detail sayfasından list'e geri dön
    
D.4 Authorization Check
    ✓ VIEWER rolü ile test et → Delete butonu gözükmez(disable olur)
    ✓ OPERATOR rolü → Kendi oluşturduğu kaydı silebilir
    ✓ ADMIN → Tüm kaydı silebilir
    ✓ Yetkisiz işlemde → "Yetki Hatası" mesajı
```

### PATTERN E: Search & Filter
**Uygulanacak Entityler:** Operations, Payments

```
E.1 Arama (Search)
    ✓ List sayfasında Search kutusu görünür
    ✓ Search kutusuna Entity ID / Reference yaz
    ✓ Enter veya Search butonuna tıkla
    ✓ Sonuçlar filtrelendi (ilgili kayıt(lar) gösterildi)
    ✓ Başka arama terimi dene → Sonuçlar değişti
    ✓ Search temizle → Yeniden tüm listeyi göster
    
E.2 Filter (Durum, Tarih, vb)
    ✓ Filter dropdown/checkboxes görünür
    ✓ Durum filtresini seç (örn: "NEW", "PREPARED")
    ✓ Sonuçlar filtrelendi
    ✓ Birden fazla filter kombinleyebilir
    ✓ Filter temizle → Tüm listeyi göster
    ✓ Filter UI kolay anlaşılır (label'lar açık)
    
E.3 Sort (Sıralama)
    ✓ Sütun başlıklarına tıklanabilir
    ✓ First click Ascending (A-Z veya eski-yeni)
    ✓ Second click Descending (Z-A veya yeni-eski)
    ✓ Sort arrow visual indicator gösterilir
```

---

## 🔍 ENTITY-SPECIFIC TEST CASES

### Entity: Operations / Orders
```
OP.1 Order Lifecycle (Full Workflow)
    ✓ Yeni Order oluştur (B patterniyle)
    ✓ State: NEW → PREPARED (C patternyle)
    ✓ State: PREPARED → OPTI_IMPORTED
    ✓ State: OPTI_IMPORTED → OPTI_RUNNING
    ✓ State: OPTI_RUNNING → OPTI_DONE
    ✓ State: OPTI_DONE → XML_READY
    ✓ State: XML_READY → DELIVERED
    ✓ Son state: DELIVERED → DONE
    ✓ Her geçişte UI doğru güncelledi
    
OP.2 Order Creation - Required Fields
    ✓ Customer (dropdown)
    ✓ Product/Service
    ✓ Quantity
    ✓ Date
    ✓ Herhangi biri girilmezse validation error
    
OP.3 Order Details - All Fields
    ✓ Order ID / Reference
    ✓ Customer Name
    ✓ Product Details
    ✓ Quantity
    ✓ Created By (User)
    ✓ Created At (Timestamp)
    ✓ Current State
    ✓ (Varsa) Notes/Description
```

### Entity: Payments
```
PAY.1 Payment Lifecycle
    ✓ Yeni Payment oluştur (B patternyle)
    ✓ State: PENDING → COMPLETED (C patternyle)
    ✓ (Varsa) PENDING → FAILED (error scenario)
    ✓ Completed/Failed payment'in durum visible
    
PAY.2 Payment Creation - Required Fields
    ✓ Order Selection (Foreign key)
    ✓ Amount (Numeric)
    ✓ Payment Method (Dropdown: Transfer, Card, Cash)
    ✓ (Varsa) Reference/Invoice No
    ✓ Validation tests
    
PAY.3 Payment Details - All Fields
    ✓ Payment ID
    ✓ Order Reference
    ✓ Amount (Format: Currency)
    ✓ Payment Method
    ✓ Status (PENDING/COMPLETED/FAILED)
    ✓ Created At (Timestamp)
    ✓ (Varsa) Completed At
    
PAY.4 Payment Form - Dependent Fields
    ✓ Order dropdown'u Relationship doğru mu?
    ✓ Order seçilince ilgili müşteri update olur mu?
```

---

## 🚨 CROSS-CUTTING CONCERNS (Tüm Sayfalar)

### ERROR HANDLING
```
ERR.1 Network Error
    ✓ F12 → Network → Offline et
    ✓ Herhangi bir entity list'ini refresh yap
    ✓ "Ağ Bağlantısı Hatası" mesajı
    ✓ Online yap ve retry
    
ERR.2 Backend Error
    ✓ Backend'i kapat (Ctrl+C)
    ✓ Frontend → Operasyonlar refresh
    ✓ "Sunucu Bağlantısı Başarısız" mesajı
    ✓ Backend start et
    
ERR.3 API Error Response (401/403/500)
    ✓ F12 → Console → Network errors var mı?
    ✓ CORS error göründüyse NOT et
    ✓ 401 Unauthorized → Login sayfasına redirect
    ✓ 403 Forbidden → "Yetki Hatası" mesajı
    ✓ 500 Server Error → User-friendly mesaj
```

### ACCESSIBILITY (A11Y)
```
A11Y.1 Keyboard Navigation
    ✓ Form sayfasında Tab → tüm input'lar accessible
    ✓ Button'lara Tab ile ulaş
    ✓ Modal'da Focus trap (ESC kapatır)
    ✓ Selection alanlarında Arrow keys
    
A11Y.2 Screen Reader (NVDA / JAWS Test)
    ✓ Form label'ları input'larla associated (id/for)
    ✓ Button text'leri semantic ("Kaydet" OK, ama "Do This" daha spesifik iydir)
    ✓ Error mesajları ARIA live region
    ✓ Modal'da aria-modal="true"
    
A11Y.3 Color & Contrast
    ✓ Material design a11y audit (F12 DevTools)
    ✓ Button text contrast WCAG AA (4.5:1)
    ✓ Icon'lar text olmadan color'a bağlı değil
    
A11Y.4 Responsive & Mobile
    ✓ Desktop (1920x1080)
    ✓ Tablet (768x1024)
    ✓ Mobile (375x667)
    ✓ Tüm seviyelerde form/buttons accessible
```

### PERFORMANCE
```
PERF.1 Page Load Time
    ✓ F12 → Network Tab
    ✓ Dashboard: < 3s
    ✓ List pages: < 2s
    ✓ Detail page: < 1.5s
    
PERF.2 Responsiveness
    ✓ Button click → 300ms içinde visual feedback
    ✓ List scroll → Smooth (no jank)
    ✓ Search/filter → 500ms responsiveness
    
PERF.3 Memory Leaks
    ✓ 10x Open/Close → Stabilize or grow?
    ✓ F12 → Memory → Heap Snapshot before/after
    ✓ Check for exponential growth
    
PERF.4 State Persistence (Zustand)
    ✓ Login → Dashboard → F5 Refresh
    ✓ Auth state korunmuş
    ✓ User logout olmamış olmalı
```

### STYLING & THEME
```
STY.1 Icon Consistency (Lucide Icons)
    ✓ Icons tutarlı boyut
    ✓ Icons tutarlı renk
    ✓ Icons accessible (ARIA labels)
    
STY.2 Tailwind CSS
    ✓ Spacing tutarlı (padding/margin)
    ✓ Border radius tutarlı
    ✓ Shadows consistent
    
STY.3 Color Palette
    ✓ Primary color (button colors) tutarlı
    ✓ Success (green), Error (red), Warning (yellow)
    ✓ Disabled state grayish
    ✓ Hover/Active states visible
```

### SESSION MANAGEMENT
```
SESS.1 Logout
    ✓ Menu → Logout tıkla
    ✓ Login sayfasına redirect
    ✓ F12 → Application → Token silinmiş mi?
    
SESS.2 Token Expiry
    ✓ (Varsa expiration) JWT exp time kontrol et
    ✓ Token expire et
    ✓ İşlem denemesi → 401 → Login sayfasına redirect
    
SESS.3 Token Refresh
    ✓ Uzun idle durumda
    ✓ Refresh endpoint çağrılmış mı?
    ✓ User logout olmamış kalabilmelidir
```

---

## ❌ DEFECT CATEGORIES (Tasnif Sistemi)

| Kategori | Sembol | Örnek |
|----------|--------|-------|
| **Critical** | 🔴 | API down, Auth broken, Data loss |
| **High** | 🟠 | State transition fail, Validation missing |
| **Medium** | 🟡 | UI glitch, Slow response, Typo |
| **Low** | 🔵 | Missing icon, "Next" button wording |
| **Info** | ℹ️ | Nice-to-have, Feature request |

---

## 📊 TEST OUTPUT TEMPLATE

```
╔═══════════════════════════════════════════════════════════════╗
║          OptiPlan360 UI TEST EXECUTION REPORT                ║
╠═══════════════════════════════════════════════════════════════╣
║ Test Date:     [DATE]                                         ║
║ Test Duration: [TIME]                                         ║
║ Tester:        [NAME]                                         ║
║ Browser:       Chrome 120                                     ║
║ Screen:        1920x1080                                      ║
╠═══════════════════════════════════════════════════════════════╣

BÖLÜM SONUÇLARI:
  1. Authentication           : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  2. Dashboard               : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  3. Generic List (A)        : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  4. Generic Create (B)      : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  5. Generic Detail & State (C) : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  6. Delete & Auth (D)       : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  7. Search & Filter (E)     : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  8. Orders Lifecycle        : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  9. Payments Lifecycle      : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  10. Error Handling         : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  11. Accessibility         : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  12. Performance           : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  13. Styling               : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED
  14. Session Management    : ✅ PASSED / ⚠️ PARTIAL / ❌ FAILED

TOPLAM SONUÇ: [X/14] PASSED

═════════════════════════════════════════════════════════════════

DEFECTS FOUND:

🔴 CRITICAL:
  [D-001] [Bölüm] Issue description...
  [D-002] ...

🟠 HIGH:
  [D-003] ...

🟡 MEDIUM:
  [D-004] ...

🔵 LOW:
  [D-005] ...

ℹ️ INFO:
  [D-006] ...

═════════════════════════════════════════════════════════════════
SUMMARY:
  Total Defects: [N]
  Critical: [N] | High: [N] | Medium: [N] | Low: [N]
  
  Overall Status: ✅ READY / ⚠️ WITH FIXES / ❌ BLOCKED

═════════════════════════════════════════════════════════════════
```

---

## ✅ ONAY VE BAŞLAT

Revize prosedürü uygulanmasına **onay veriyor musunuz?**

```
☐ ONAYLIYORUM — Consolidated test'i başlat
☐ ONAYLAMIYORUM — Daha fazla revizyon
☐ KÎSMI ONAY — Sadece Generic Patterns test et
```

---

**Dokümantasyon Tarihi:** 18 Şubat 2026  
**Hazırlayan:** GitHub Copilot  
**Versiyon:** 2.0 (Consolidated, Redundancy Eliminated)

