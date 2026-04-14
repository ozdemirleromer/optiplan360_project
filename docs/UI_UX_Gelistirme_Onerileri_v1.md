# OptiPlan360 UI/UX Geliştirme Önerileri ve Eksik Listesi

**Tarih:** 26 Mart 2026  
**Versiyon:** v1.0  
**Kapsam:** Phase 1, 2, 3, 4 UI/UX Analizi

---

## 1. Genel Bakış

| Faz | Sayfa | Durum | Aksiyon |
|-----|-------|-------|---------|
| **Phase 1** | Queue Page | ✅ Fonksiyonel | İyileştirme |
| **Phase 2** | OCR Kontrol | ✅ Fonksiyonel | İyileştirme |
| **Phase 3** | Sipariş Kontrol | ✅ Fonksiyonel | İyileştirme |
| **Phase 4** | Export/Fire | ✅ Fonksiyonel | İyileştirme |

---

## 2. Yüksek Öncelikli Geliştirmeler

### 2.1 Phase 1 (Queue Page)

| # | Özellik | Mevcut Durum | Öneri | Teknik Detay |
|---|---------|--------------|-------|--------------|
| 1 | **Thumbnail Lightbox** | ✅ Var | ESC ile kapatma, navigasyon ekle | Lightbox component'e key listener ekle |
| 2 | **Batch Retry** | ✅ Var | Progress indicator ekle | Retry işlemi sırasında progress modal göster |
| 3 | **Otomatik Yenileme** | ✅ Var | Son yenileme zamanı göster | Header'a "Son güncelleme: 2dk önce" ekle |
| 4 | **Klasör Sağlığı** | ✅ Var | Renk kodlu badge | HEALTHY=Yeşil, WARNING=Sarı, ERROR=Kırmızı |

### 2.2 Phase 2 (OCR Kontrol)

| # | Özellik | Mevcut Durum | Öneri | Teknik Detay |
|---|---------|--------------|-------|--------------|
| 1 | **Confidence Threshold** | ✅ Var | Tooltip ile açıklama | Slider'a "%${value} altı düşük güven" tooltipi |
| 2 | **Zoom/Pan Persist** | ✅ Var | Reset butonu ekle | Zoom/pan sıfırlama butonu |
| 3 | **Undo History** | ✅ Var | Diff view | Eski/yeni değer karşılaştırma paneli |
| 4 | **Keyboard Nav** | ✅ Var | Shortcut cheat sheet | F1 ile açılabilir kısayol yardımı |
| 5 | **Canvas Performance** | ✅ Var | Loading state | Canvas yüklenirken spinner göster |

### 2.3 Phase 3 (Sipariş Kontrol)

| # | Özellik | Mevcut Durum | Öneri | Teknik Detay |
|---|---------|--------------|-------|--------------|
| 1 | **Toplu Stok Eşleştirme** | ❌ Yok | Batch stock match | Çoklu satır seç → stok ata |
| 2 | **Satır Klonlama** | ❌ Yok | Clone row | Seçili satırı çoğalt |
| 3 | **Drag-Drop Sıralama** | ❌ Yok | Row reordering | Satırları sürükle-bırak sırala |
| 4 | **Undo/Redo** | ❌ Yok | Global undo stack | Phase 2'deki undo history'i getir |
| 5 | **Inline Düzenleme** | ⚠️ Sınırlı | Hücre düzenleme | Tablo hücrelerinde direkt edit |

### 2.4 Phase 4 (Export/Fire)

| # | Özellik | Mevcut Durum | Öneri | Teknik Detay |
|---|---------|--------------|-------|--------------|
| 1 | **Toplu Retry** | ❌ Yok | Batch retry | Phase 1'deki gibi çoklu retry |
| 2 | **Otomatik Yenileme** | ❌ Yok | 30sn polling | Phase 1'den kod taşı |
| 3 | **Export Logları** | ❌ Yok | History view | Export geçmişi tablosu |
| 4 | **Preview Karşılaştırma** | ❌ Yok | Diff view | Önceki vs yeni preview karşılaştır |
| 5 | **Download Butonu** | ⚠️ Sınırlı | Tek tık indir | Export edilmiş dosyayı indir |

---

## 3. Orta Öncelikli Geliştirmeler

### 3.1 Genel UX İyileştirmeler

| # | Alan | Öneri | Etki |
|---|------|-------|------|
| 1 | **Toast Sistemi** | Global toast provider | Kullanıcı bildirimleri tutarlı |
| 2 | **Loading States** | Skeleton screens | Perceived performance artışı |
| 3 | **Error Boundaries** | Hata yakalama | Daha iyi hata mesajları |
| 4 | **Breadcrumbs** | Navigasyon izi | Kullanıcı yönü |
| 5 | **Dark Mode** | Tema desteği | Erişilebilirlik |

### 3.2 Erişilebilirlik (A11y)

| # | Alan | Öneri | WCAG |
|---|------|-------|------|
| 1 | **Keyboard Nav** | Tab sırası optimizasyonu | 2.1.1 |
| 2 | **Focus Indicators** | Görsel focus state | 2.4.7 |
| 3 | **ARIA Labels** | Eksik label tamamlama | 4.1.2 |
| 4 | **Color Contrast** | Kontrast oranı kontrolü | 1.4.3 |
| 5 | **Screen Reader** | ARIA live regions | 4.1.3 |

### 3.3 Performans

| # | Alan | Öneri | Metrik |
|---|------|-------|--------|
| 1 | **Virtual Scrolling** | Büyük listeler için | Render süresi ↓ |
| 2 | **Image Lazy Load** | Thumbnail lazy load | LCP ↓ |
| 3 | **Code Splitting** | Route-based splitting | Bundle size ↓ |
| 4 | **Memoization** | React.memo optimize | Re-render ↓ |
| 5 | **Prefetching** | Ön yükleme stratejisi | TTI ↓ |

---

## 4. Düşük Öncelikli Geliştirmeler

### 4.1 Nice-to-Have

| # | Özellik | Açıklama |
|---------|---------|----------|
| 1 | **Keyboard Shortcuts Customization** | Kullanıcı tanımlı kısayollar |
| 2 | **Export Template Editor** | XLSX şablon düzenleme |
| 3 | **Dashboard Widgets** | Özelleştirilebilir dashboard |
| 4 | **Audit Log Viewer** | Detaylı değişiklik geçmişi |
| 5 | **Multi-language** | İngilizce desteği |

### 4.2 Teknik Borç

| # | Konu | Açıklama | Risk |
|---|------|----------|------|
| 1 | **TypeScript Strict Mode** | Strict mode'a geçiş | Düşük |
| 2 | **Test Coverage** | %80 coverage hedefi | Orta |
| 3 | **Storybook** | Component dokümantasyonu | Düşük |
| 4 | **E2E Tests** | Playwright testleri | Orta |
| 5 | **Bundle Analysis** | Webpack analizi | Düşük |

---

## 5. Önerilen İş Sırası

### Sprint 1 (Hafif 1-2)
```
1. Phase 4 - Otomatik Yenileme (30sn polling)
2. Phase 3 - Toplu Stok Eşleştirme
3. Phase 4 - Toplu Retry
```

### Sprint 2 (Hafit 3-4)
```
1. Phase 2 - Blocker Summary Panel (kod hazır)
2. Phase 3 - Inline Düzenleme
3. Genel - Toast Sistemi Standardizasyonu
```

### Sprint 3 (Hafif 5-6)
```
1. Phase 3 - Satır Klonlama
2. Phase 3 - Undo/Redo Stack
3. Erişilebilirlik - A11y Audit
```

### Sprint 4+
```
- Drag-drop sıralama
- Export logları
- Preview karşılaştırma
- Dark mode
```

---

## 6. Teknik Notlar

### 6.1 Phase 2 Blocker Summary (Kullanıcı Tarafından Eklendi/Silindi)

Kullanıcı `canApprove + blockerSummary` kodunu ekleyip sildi. Bu kod şu an **aktif değil**.

**Öneri:** Bu kodu geri ekleyerek export hazır olma durumunu gösteren bir panel eklenmeli.

```typescript
// Önerilen konum: ~satır 900 arası
const { canApprove, blockerSummary } = useMemo(() => {
  // ... mevcut kod ...
}, [activeRecord, approvedCells]);
```

**UI Önerisi:** Footer veya yan panelde blocker özeti:
- ✅ Düşük güven: 3/12 onaylandı
- ⏳ Bekleyen: 9 hücre
- 🚀 Export durumu: Hazır / Değil

---

## 7. Sonuç

**Mevcut Durum:** Phase 1-4 temel fonksiyonellik açısından tamamlanmış durumda.

**Öncelikli Eksikler:**
1. Phase 2 Blocker Summary (kod hazır, UI entegrasyonu gerekli)
2. Phase 3 Toplu Stok Eşleştirme
3. Phase 4 Toplu Retry + Otomatik Yenileme

**Önerilen Başlangıç:** Sprint 1 içeriği ile devam et.

---

**Hazırlayan:** Cascade AI  
**Onay:** UI/UX Team
