# OptiPlan360 Admin UI — Erişilebilirlik Kontrol Listesi (WCAG 2.1 AA)

> Bu belge `apps/admin-ui/` için WCAG 2.1 AA uyumluluk gereksinimlerini ve kontrol listesini tanımlar.
> **Teknoloji:** React 18 + TypeScript + Vite + lucide-react

---

## 1. Genel İlkeler

| İlke | WCAG Referansı | Açıklama |
|------|----------------|----------|
| Algılanabilir | 1.x | İçerik tüm kullanıcılar tarafından algılanabilmeli |
| Çalıştırılabilir | 2.x | Arayüz klavye ve diğer giriş yöntemleriyle kullanılabilmeli |
| Anlaşılabilir | 3.x | İçerik ve işlemler anlaşılabilir olmalı |
| Sağlam | 4.x | İçerik yardımcı teknolojilerle uyumlu olmalı |

---

## 2. İkon Sistemi

### 2.1 Kural: Emoji ikon YASAK

Admin UI'da dekoratif veya işlevsel ikon olarak **emoji kullanılmaz**. Tüm ikonlar `lucide-react` kütüphanesinden `Icon` wrapper bileşeni ile kullanılır.

### 2.2 Icon Wrapper bileşeni

```tsx
// ✅ DOĞRU
<Icon name="RefreshCw" size={16} aria-hidden="true" />

// ❌ YANLIŞ — emoji
<span>🔄</span>

// ❌ YANLIŞ — aria-hidden eksik (dekoratif ikonda)
<RefreshCw size={16} />
```

### 2.3 İkon kontrol listesi

- [ ] Tüm ikonlar `lucide-react` kütüphanesinden geliyor
- [ ] Dekoratif ikonlar `aria-hidden="true"` taşıyor
- [ ] İşlevsel ikonlar (tek başına buton) `aria-label` taşıyor
- [ ] İkon butonları minimum 44×44px dokunma alanına sahip
- [ ] Emoji ikon kullanılmıyor (metin içeriği dışında)

---

## 3. Modal Bileşenleri

### 3.1 WCAG Gereksinimleri

| Gereksinim | WCAG | Kontrol |
|------------|------|---------|
| `aria-modal="true"` | 4.1.2 | Modal açıldığında set edilmiş |
| `role="dialog"` | 4.1.2 | Modal container'da mevcut |
| `aria-labelledby` | 4.1.2 | Modal başlık ID'sine bağlı |
| ESC tuşu ile kapanma | 2.1.1 | KeyDown handler'da `Escape` yakalanıyor |
| Focus trap | 2.4.3 | Tab sırası modal içinde kalıyor |
| Focus restore | 2.4.3 | Modal kapanınca önceki elemana dönüyor |

### 3.2 Kontrol listesi

- [ ] Modal açıldığında `aria-modal="true"` set ediliyor
- [ ] `role="dialog"` veya `role="alertdialog"` atanmış
- [ ] `aria-labelledby` modal başlık elemanına bağlı
- [ ] ESC tuşuna basıldığında modal kapanıyor
- [ ] Tab döngüsü modal içinde kalıyor (focus trap)
- [ ] Modal kapandığında focus tetikleyici elemana dönüyor
- [ ] Modal dışı arka plan tıklamayla kapanıyor (veya açıkça engellenmiş)
- [ ] Arka plandaki içerik `aria-hidden="true"` veya `inert` ile gizlenmiş

### 3.3 Uygulama örneği

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
>
  <h2 id="modal-title">İşi Onayla</h2>
  {/* focus trap içeriği */}
</div>
```

---

## 4. Form Erişilebilirliği

### 4.1 WCAG Gereksinimleri

| Gereksinim | WCAG | Kontrol |
|------------|------|---------|
| `htmlFor` + `id` eşleşmesi | 1.3.1 | Label ile input bağlı |
| `aria-describedby` | 1.3.1 | Yardım metni veya hata mesajıyla bağlı |
| `aria-invalid` | 3.3.1 | Geçersiz alanlarda set ediliyor |
| Hata mesajı görünür | 3.3.1 | Ekran okuyucu tarafından okunabilir |
| Otomatik tamamlama | 1.3.5 | Uygun `autocomplete` attribute |

### 4.2 Kontrol listesi

- [ ] Her `<input>` ve `<select>` elemanının `id`'si var
- [ ] Her form alanının `<label htmlFor="...">` ile bağlanmış etiketi var
- [ ] Hata mesajları `aria-describedby` ile ilgili alana bağlı
- [ ] Geçersiz alanlar `aria-invalid="true"` taşıyor
- [ ] Zorunlu alanlar `aria-required="true"` veya `required` taşıyor
- [ ] Placeholder tek başına etiket yerine kullanılmıyor
- [ ] Form gönderim hatası ekranın üstünde özet olarak gösteriliyor

### 4.3 Uygulama örneği

```tsx
<div>
  <label htmlFor="api-base">API Adresi</label>
  <input
    id="api-base"
    type="url"
    value={apiBase}
    onChange={...}
    aria-describedby="api-base-help"
    aria-invalid={!isValid}
  />
  <span id="api-base-help">Orchestrator API base URL'i giriniz</span>
  {!isValid && <span role="alert">Geçersiz URL formatı</span>}
</div>
```

---

## 5. Dokunma Hedefi Boyutu

### 5.1 WCAG 2.5.5 (AA)

Tüm etkileşimli elemanlar minimum **44×44 CSS piksel** dokunma alanına sahip olmalıdır.

### 5.2 Kontrol listesi

- [ ] Butonlar minimum 44×44px (`min-width` + `min-height` veya padding)
- [ ] İkon butonları minimum 44×44px (padding ile genişletilmiş)
- [ ] Link'ler yeterli padding'e sahip (satır içi link'ler hariç)
- [ ] Checkbox / radio butonları minimum 44×44px tıklama alanı
- [ ] Tab / sekme butonları minimum 44×44px
- [ ] Tablo satırlarındaki aksiyon butonları yeterli boyutta

### 5.3 CSS örneği

```css
/* İkon buton — minimum dokunma hedefi */
button.icon-button {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}
```

---

## 6. Renk Kontrastı

### 6.1 WCAG 1.4.3 (AA)

| Eleman tipi | Minimum kontrast oranı |
|-------------|----------------------|
| Normal metin | 4.5:1 |
| Büyük metin (18px+ veya 14px+ bold) | 3:1 |
| UI bileşenleri, grafikler | 3:1 |

### 6.2 Kontrol listesi

- [ ] Metin/arka plan kontrast oranı ≥ 4.5:1
- [ ] Badge renkleri (HOLD sarı, FAILED kırmızı, DONE yeşil) yeterli kontrasta sahip
- [ ] Devre dışı buton metni okunabilir (ama etkileşimsiz olduğu anlaşılır)
- [ ] Focus göstergeleri arka plandan ayırt edilebilir (3:1 kontrast)
- [ ] Renk tek başına bilgi taşıyıcı olarak kullanılmıyor (ikon veya metin eşliğinde)

---

## 7. Klavye Erişilebilirliği

### 7.1 WCAG 2.1.1 — Klavye

- [ ] Tüm işlevler klavye ile erişilebilir
- [ ] Tab sırası mantıklı ve doğal akışta (DOM sırası)
- [ ] Focus göstergesi tüm etkileşimli elemanlarda görünür
- [ ] Tab switcher klavyeyle çalışır (Enter/Space ile seçim)
- [ ] Tablo satırlarında aksiyon butonlarına tab ile ulaşılabiliyor
- [ ] Filtre alanları Enter ile tetiklenebilir

### 7.2 WCAG 2.4.7 — Görünür Focus

- [ ] `:focus-visible` stili tanımlı
- [ ] Focus outline en az 2px ve kontrastlı
- [ ] Focus kesinlikle `outline: none` ile kaldırılmamış (uygun alternatif yoksa)

---

## 8. Tablo Erişilebilirliği

Admin UI'daki iş listesi tablosu için:

### 8.1 Kontrol listesi

- [ ] `<table>` elemanı kullanılmış (div tablosu yerine)
- [ ] `<thead>` ve `<th>` ile başlık satırı tanımlı
- [ ] `<th scope="col">` ile sütun başlıkları işaretlenmiş
- [ ] State badge'leri sadece renkle değil, metin ile de durumu gösteriyor
- [ ] Boş tablo durumunda açıklayıcı mesaj var
- [ ] Tablo caption veya `aria-label` ile tanımlanmış

---

## 9. Durum Bildirimleri

### 9.1 WCAG 4.1.3 — Status Messages

- [ ] İşlem sonuçları (`role="status"` veya `role="alert"`) `aria-live` bölgesinde gösterilir
- [ ] "Job listesi guncellendi" gibi bilgi mesajları `aria-live="polite"` ile duyurulur
- [ ] Hata mesajları `aria-live="assertive"` veya `role="alert"` ile duyurulur
- [ ] Yükleniyor durumu ekran okuyuculara `aria-busy="true"` ile bildiriliyor

### 9.2 Uygulama örneği

```tsx
<div role="status" aria-live="polite">
  {statusLine}
</div>
```

---

## 10. Test Araçları

| Araç | Kullanım |
|------|----------|
| axe DevTools | Tarayıcı uzantısı — otomatik WCAG kontrolü |
| Lighthouse (Chrome) | Erişilebilirlik puanı |
| NVDA / JAWS | Ekran okuyucu ile manuel test |
| Keyboard-only navigation | Tab/Enter/Escape ile tüm akışları test et |
| Color Contrast Analyzer | Renk kontrast oranı ölçümü |

### 10.1 Otomatik test entegrasyonu

```typescript
// vitest + @testing-library/jest-dom
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("modal erişilebilirlik ihlali yok", async () => {
  const { container } = render(<Modal onClose={() => {}} title="Test" />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 11. Kontrol Özeti

| Kategori | Madde sayısı | Öncelik |
|----------|-------------|---------|
| İkon sistemi | 5 | Yüksek |
| Modal | 8 | Yüksek |
| Form | 7 | Yüksek |
| Dokunma hedefi | 6 | Orta |
| Renk kontrastı | 5 | Yüksek |
| Klavye | 8 | Yüksek |
| Tablo | 6 | Orta |
| Durum bildirimleri | 4 | Orta |

**Toplam:** 49 kontrol noktası
