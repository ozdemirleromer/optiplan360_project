# Sistem Ayarları & Klasör Ayarları Birleşik Mimari Raporu
**Tarih:** 21 Mart 2026 | **Versiyon:** 2.0

---

## Özet

Klasör yönetimi artık ayrı bir sayfa/route değildir.

- `klasor-yonetimi` route'u kaldırıldı.
- Klasör ayarları, `ConfigPage` içinde **"Klasör Ayarları"** sekmesi altında toplandı.
- Sidebar’da ayrı "Klasör Yönetimi" menüsü yerine yalnızca **Sistem Ayarları** (`config`) kalır.
- Route kontratı ve ilgili testler yeni modele göre temizlenmiştir.

---

## Güncel Mimari

### Navigasyon

- Kanonik yönetim route’u: `config`
- Kaldırılan route: `klasor-yonetimi`

İlgili güncel dosyalar:
- `frontend/src/utils/appNavigation.ts`
- `frontend/src/app/AppShell.tsx`
- `frontend/src/components/Layout/Sidebar.tsx`

### Sayfa Katmanı

Klasör ayarlarının tek sahibi:
- `frontend/src/features/Admin/ConfigPage.tsx`

Bu sayfada aktif sekmeler:
- Tema Ayarları
- Sistem Kontrolü
- Servisler
- **Klasör Ayarları**

---

## Klasör Ayarları (ConfigPage içinde)

### Veri Kaynağı

- `optiplanWorkflowService.getFolderSettings()`
- `optiplanWorkflowService.updateFolderSettings()`

### Validasyon

- `frontend/src/features/Orders/workflowWorkspaceUtils.ts`
  - `validateFolderSettings`
  - `FOLDER_FIELD_LABELS`

### Kapsanan Ayarlar

- Kaynak klasörleri (WhatsApp/Scanner/Manual/Email raw)
- Çıktı klasörleri (işlenmiş/arşiv/xml/xlsx/hatalı)
- Politika alanları (formatlar, retry vb.)
- Toggle alanları (`xlsx_aktif_mi`, `watcher_aktif_mi`)

---

## Temizlenen Eski Bileşenler

Aşağıdaki eski ayrık yapı kaldırılmıştır:

- `frontend/src/features/OptiPlanWorkflow/KlasorYonetimiPage.tsx`
- `frontend/src/features/OptiPlanWorkflow/KlasorYonetimiPage.test.tsx`

Ayrıca route/test kontrat kalıntıları güncellenmiştir:
- `frontend/src/components/Layout/__tests__/orderNavigationContract.test.ts`
- `frontend/src/components/Layout/__tests__/AppShell.moduleRoutes.test.tsx`
- `frontend/src/components/Layout/__tests__/Sidebar.test.tsx`

---

## Akış (Yeni)

1. Kullanıcı Sidebar’dan **Sistem Ayarları**na gider (`config`).
2. `ConfigPage` açılır.
3. Kullanıcı **Klasör Ayarları** sekmesini seçer.
4. Ayarlar servis üzerinden yüklenir.
5. Değişiklikler yerel validasyondan geçer.
6. `updateFolderSettings` ile backend’e kaydedilir.

---

## Doğrulama Notu

Birleşim sonrası doğrulama kapsamında:
- Frontend kaynakta `klasor-yonetimi` / `KlasorYonetimiPage` referansı kalmamıştır.
- `ConfigPage`, `AppShell`, `Sidebar`, `appNavigation` dosyalarında tip/derleme hatası yoktur.
- Orders UI kontrat test paketi yeşil durumdadır.

---

## Sonuç

Sistem ayarları ile klasör ayarları artık tek bir yönetim yüzeyinde toplanmış, route karmaşıklığı azaltılmış ve bakım maliyeti düşürülmüştür. Yeni kanonik yol `config` üzerinden ilerlemektedir.
