# Phase 1 & Phase 2 UI İyileştirmeleri v1

## Phase 1 OCR Pool — `Phase1QueuePage.tsx`

| Alan | Mevcut Durum | Öneri | Öncelik | Durum |
|------|--------------|-------|---------|-------|
| **Klasör Sağlığı** | Detay drawer'da gösteriliyor | Ana grid'e "Klasör Durumu" kolonu ekle (HEALTHY/WARNING/OFFLINE badge) | Orta | ⏳ Planlandı |
| **Batch Retry** | Tekil retry butonu var | Çoklu seçim + toplu retry aksiyonu (checkbox + toolbar) | Yüksek | ⏳ Planlandı |
| **OCR Sağlayıcı** | Görünmüyor | Hangi OCR motoru kullanıldı (Azure/Tesseract/Claude) detayda göster | Düşük | ⏳ Planlandı |
| **Görsel Önizleme** | Yok | Thumbnail sütunu ekle, tıklayınca lightbox aç | Orta | ⏳ Planlandı |
| **Filtre Kaydet** | Yok | Sık kullanılan filtreleri kaydet/yükle özelliği | Orta | ⏳ Planlandı |
| **Otomatik Yenile** | Manuel yenileme | WebSocket veya polling ile canlı status güncellemesi | Yüksek | ⏳ Planlandı |

## Phase 2 OCR Control — `OCRKontrolPage.tsx`

| Alan | Mevcut Durum | Öneri | Öncelik | Durum |
|------|--------------|-------|---------|-------|
| **Confidence Threshold** | Sabit `80` | Kullanıcı ayarlanabilir threshold (70-90 arası slider) | Orta | ⏳ Planlandı |
| **BBOX Görselleştirme** | Canvas overlay var | Renk kodlu bbox: düşük confidence kırmızı, yüksek yeşil | Yüksek | ⏳ Planlandı |
| **Keyboard Navigation** | Temel arrow/Tab | Vim-style hjkl + sayısal hücre atlaması (örn: 3j = 3 satır aşağı) | Düşük | ⏳ Planlandı |
| **Undo History** | Panel var ama dar | Detaylı audit trail: kim, ne zaman, eski/yeni değer | Yüksek | ⏳ Planlandı |
| **Hızlı Onay Modu** | Tek tek onay | "Tüm satırları onayla" + "Tüm düşük confidence'ları atla" kısayolları | Yüksek | ⏳ Planlandı |
| **Bant Kalınlığı İzleme** | Override var | OCR'den okunan band kalınlığı ile override karşılaştırma gösterimi | Orta | ⏳ Planlandı |
| **Zoom/Pan State** | Sayfa başına sıfırlanır | Zoom/pan pozisyonunu kayıt bazında hatırla | Orta | ⏳ Planlandı |
| **F2 Onay Davranışı** | Mevcut hücreyi onaylar | Shift+F2 ile "ve sonraki hücreye geç" opsiyonu | Düşük | ⏳ Planlandı |

## Genel UI/UX İyileştirmeleri

| Öneri | Açıklama | Durum |
|-------|----------|-------|
| **Toast Bildirimleri** | Phase geçişleri, hatalar, başarılı operasyonlar için persistent toast stack | ⏳ Planlandı |
| **Keyboard Shortcut Cheat Sheet** | `?` tuşu ile açılan modal'da tüm kısayollar | ⏳ Planlandı |
| **Dark/Light Toggle** | Sistem temasına otomatik uyum + manuel toggle | ⏳ Planlandı |
| **Responsive Breakpoints** | 1280px altında kompakt mod, 768px altında mobil adaptasyon | ⏳ Planlandı |
| **Loading State Tutarlılığı** | Skeleton loader'lar yerine spinners (daha ERP hissi) | ⏳ Planlandı |

## Teknik Borç

| Dosya | Sorun | Öneri | Durum |
|-------|-------|-------|-------|
| `Phase1QueuePage.tsx` | 1689 satır, inline styles | Component extraction: `SummaryCards`, `FiltersBar`, `QueueTable` ayrı dosyalara | ⏳ Planlandı |
| `OCRKontrolPage.tsx` | 2441 satır | Split-screen logic'i `useSplitScreen` hook'una çıkar | ⏳ Planlandı |
| Her iki dosya | Inline CSS | Tailwind class'larına migrate (mevcut tema tokenları kullanarak) | ⏳ Planlandı |

## Önceliklendirme Özeti

### Yüksek Öncelik (Hemen Uygulanmalı)
1. Batch Retry (Phase 1)
2. Otomatik Yenileme (Phase 1)
3. Renk kodlu BBOX (Phase 2)
4. Detaylı Undo History (Phase 2)
5. Hızlı Onay Modu (Phase 2)

### Orta Öncelik (Planlanmalı)
6. Klasör Sağlığı kolonu (Phase 1)
7. Görsel Önizleme (Phase 1)
8. Confidence Threshold ayarlanabilir (Phase 2)
9. Bant Kalınlığı İzleme (Phase 2)
10. Zoom/Pan State persist (Phase 2)

### Düşük Öncelik (Gelecek Sürüm)
11. OCR Sağlayıcı bilgisi (Phase 1)
12. Filtre Kaydet/Yükle (Phase 1)
13. Vim-style navigation (Phase 2)
14. F2 davranış seçenekleri (Phase 2)

## Uygulama Notları

- Tüm değişiklikler mevcut OptiPlan360 tema sistemini kullanmalı
- Slate-based renk paleti korunmalı
- Keyboard accessibility (WCAG) standartlarına uyulmalı
- Mobil responsive davranış Phase 1/2 için ikincil öncelik (masaüstü ERP odaklı)
