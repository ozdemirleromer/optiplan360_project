# Unified Ribbon Workflow UI — Implementation Log

**Tarih:** 2026-03-23
**Kapsam:** Phase 2 alan guncellemesi, Phase 3 kenar yeniden adlandirma, 5-tab ribbon, Phase 4 gomulu dashboard

---

## Ozet

SiparisKontrolPage (Phase 3) duz toolbar'i 5 sekmeli ribbon ile degistirildi. Phase 4 is emri dashboard'u IS_EMRI sekmesine gomuldu. Phase 2 OCRKontrolPage alanlari canonical 7-alan setine guncellendi.

---

## Degisiklik Detaylari

### Step 1: OCRKontrolPage Phase 2 Alan Guncellemesi

**Dosya:** `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.tsx`

- Güncel sabit alanlar: `boy, en, adet, u1, u2, k1, k2`
- Yeni alanlar: `boy, en, adet, u1, u2, k1, k2`
- Tip sistemi: `BackendValidatedField | NumericField | TextField` -> `NumericField | BooleanField`
  - `NumericField = "boy" | "en" | "adet"` (sayisal input)
  - `BooleanField = "u1" | "u2" | "k1" | "k2"` (checkbox toggle)
- `FIELD_LABEL`: `{ boy:"Boy", en:"En", adet:"Adet", u1:"U1", u2:"U2", k1:"K1", k2:"K2" }`
- `CRITICAL_FIELD_TEXT = "BOY, EN, ADET, U1, U2, K1, K2"`
- Grid hucre render: Boolean alanlar checkbox olarak, numeric alanlar input olarak render edilir
- `handleTextCellEdit` kaldirildi, `handleBooleanCellEdit` eklendi
- Kolon genislikleri: `COL_TEXT=118` ve `COL_GRAIN=72` kaldirildi, `COL_BOOL=56` eklendi
- `PHASE2_GRID_MIN_WIDTH`: 944 -> 820

**Test:** `OCRKontrolPage.test.tsx` — 35/35 pass
- Grid baslik label'lari guncellendi
- Payload testi: text/number input -> checkbox toggle degistirildi

---

### Step 2: SiparisRow Kenar Alanlari Yeniden Adlandirma

**Dosyalar:**
- `frontend/src/features/OptiPlanWorkflow/siparisKontrolTypes.ts`
  - `SiparisRow` interface: `bUst/bAlt/bSol/bSag` -> `u1/u2/k1/k2` (number tipi korundu)
- `frontend/src/features/OptiPlanWorkflow/siparisKontrolUtils.ts`
  - `toSiparisRowsFromService()`: alan mapping guncellendi
  - `toUiRowsFromPhase3Detail()`: alan mapping guncellendi
- `frontend/src/features/OptiPlanWorkflow/SiparisKontrolPage.tsx`
  - Kolon basliklarinda: `"B.Ust"` -> `"U1"`, `"B.Alt"` -> `"U2"`, `"B.Sol"` -> `"K1"`, `"B.Sag"` -> `"K2"`
  - Grid hucre render: `row.bUst` -> `row.u1` vb.
- `frontend/src/features/OptiPlanWorkflow/siparisKontrolAtoms.tsx`
  - `SiparisRow` import eklendi (Step 2 agent tarafindan kaldirilan inline tip icin)
  - `RowDetailPanel`: alan referanslari guncellendi

---

### Step 3: SiparisKontrolRibbon.tsx (YENI DOSYA)

**Dosya:** `frontend/src/features/OptiPlanWorkflow/SiparisKontrolRibbon.tsx`

5 sekmeli ribbon bileseni:

| Sekme | Aksiyonlar | Ikonlar (lucide-react) |
|-------|-----------|----------------------|
| KAYIT | Kaydet, Yenile, Revizyon, Tarihce | Save, RefreshCw, FileText, Clock |
| CARI | Cari Ara, Eslestir, Yeni Cari | Users, Link, UserPlus |
| SATIR | Stok Ara, Birlestir, Sifirla, Detay, Satir Ekle | Package, GitMerge, RotateCcw, PanelRightOpen, Plus |
| KONTROL | Dogrula, Fire, Faz Gecisi | CheckCircle2, Flame, ChevronRight |
| IS EMRI | Onizleme, Export, Tekrar Dene, Manifest, Durum | Eye, Download, RotateCcw, FileText, Activity |

- 2-stripe layout: 28px tab strip + 56px icon strip
- Dark slate tema: `SL_800=#1e293b`, `COLOR_PRIMARY=#2563eb`
- A11Y: `role="tablist"`, `role="tab"`, `aria-selected`, min 44x44 butonlar
- Props: `activeTab, onTabChange, onAction, disabledActions?, saving?, selectedCount?`

**Test:** `SiparisKontrolRibbon.test.tsx` — 8/8 pass

---

### Step 4: JobDashboardPanel.tsx (YENI DOSYA)

**Dosya:** `frontend/src/features/OptiPlanWorkflow/JobDashboardPanel.tsx`

Phase 4 is emri dashboard'unu gomulu panel olarak sunar:

- Durum pipeline gorsellestirmesi: PHASE4_PENDING -> PREVIEW_READY -> EXPORT_RUNNING -> COMPLETED/FAILED
- Is kuyrugu tablosu (durum badge'leri ile)
- Aksiyon gate'leri: Preview (PENDING), Export (PREVIEW_READY), Retry (FAILED)
- Klasor saglik gostergesi
- phase4Service API'lerini kullanir

Props: `{ preferredRecordId?: string | null; compact?: boolean }`

---

### Step 5: Ribbon Entegrasyonu (SiparisKontrolPage)

**Dosya:** `frontend/src/features/OptiPlanWorkflow/SiparisKontrolPage.tsx`

- Eski duz toolbar (Aksiyon seridi div) kaldirildi
- `<SiparisKontrolRibbon>` eklendi
- State: `const [ribbonTab, setRibbonTab] = useState<RibbonTab>("KAYIT")`
- Aksiyon mapping:
  - save -> KAYIT/Kaydet
  - refresh -> KAYIT/Yenile
  - cariSearch -> CARI/Cari Ara
  - stokSearch -> SATIR/Stok Ara
  - merge -> SATIR/Birlestir
  - reset -> SATIR/Sifirla
  - detail -> SATIR/Detay
  - fire -> KONTROL/Fire
  - goPhase4 -> KONTROL/Faz Gecisi
- IS_EMRI sekmesi aktifken: Grid yerine `<JobDashboardPanel>` render edilir
- InfoChip band ribbon ile grid arasinda korundu
- Tum modal'lar (CariSearchDrawer, StokSearchDrawer, FireModal, MergeModal, RowDetailPanel) ayni kaldi

**Test:** `SiparisKontrolPage.test.tsx` — 41/41 pass
- `switchRibbonTab()` helper fonksiyonu eklendi
- Buton sorgulari: `getAllByText` -> `getByRole("button", { name })` degistirildi
- Her test icin dogru sekmeye gecis eklendi

---

### Step 6-7: ExportXmlFirePage ve Routing

- `ExportXmlFirePage.tsx` bagimsiz olarak korundu (backward compat)
- IS_EMRI sekmesi `JobDashboardPanel` kullanir (dogrudan)
- AppShell routing: `siparis-duzenleme`, `optiplan-job`, `export-page` dogru sekilde yonlendirilmis

### Step 8: HorizontalLayout Temizligi

**Silinen dosyalar:**
- `components/Layout/HorizontalLayout.tsx`
- `pages/DemoDesktopPage.tsx`
- `pages/OptiPlanDesktopPage.tsx`

**Guncellenen dosyalar:**
- `app/AppShell.tsx` — `optiplan-desktop` ve `optiplan-360` route'lari + Ctrl+Shift+O kisayol kaldirildi
- `components/Layout/index.ts` — HorizontalLayout re-export kaldirildi
- `main.tsx` — DemoDesktopPage import ve isDemoMode branch kaldirildi
- `components/Layout/Sidebar.tsx` — `optiplan-360` -> `optiplan-ui` yonlendirmesi
- `app/AppShell.route.test.tsx` — HorizontalLayout mock kaldirildi
- `Layout/__tests__/AppShell.moduleRoutes.test.tsx` — HorizontalLayout mock kaldirildi

---

## Test Sonuclari

| Dosya | Sonuc |
|-------|-------|
| OCRKontrolPage.test.tsx | 35/35 pass |
| SiparisKontrolRibbon.test.tsx | 8/8 pass |
| SiparisKontrolPage.test.tsx | 41/41 pass |
| SiparisKontrolPage.route.test.tsx | 14/14 pass |
| JobDashboardPanel.tsx | 0 type errors |
| **Toplam OptiPlanWorkflow** | **109/109 pass** |
| **Toplam Frontend** | **414/414 pass (60 dosya)** |
| **Production Build** | **Basarili (4.67s)** |

TypeScript: Yeni dosyalarda sifir hata. Onceden mevcut hatalar (systemBackboneService, themeRuntime, codeSplitting) degisikliklerden etkilenmedi.

---

## Degisen/Olusan Dosya Listesi

### Degisen Dosyalar
1. `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.tsx`
2. `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.test.tsx`
3. `frontend/src/features/OptiPlanWorkflow/SiparisKontrolPage.tsx`
4. `frontend/src/features/OptiPlanWorkflow/SiparisKontrolPage.test.tsx`
5. `frontend/src/features/OptiPlanWorkflow/siparisKontrolTypes.ts`
6. `frontend/src/features/OptiPlanWorkflow/siparisKontrolUtils.ts`
7. `frontend/src/features/OptiPlanWorkflow/siparisKontrolAtoms.tsx`

### Yeni Dosyalar
8. `frontend/src/features/OptiPlanWorkflow/SiparisKontrolRibbon.tsx`
9. `frontend/src/features/OptiPlanWorkflow/SiparisKontrolRibbon.test.tsx`
10. `frontend/src/features/OptiPlanWorkflow/JobDashboardPanel.tsx`

---

## Mimari Notlar

- Ribbon pattern: `SiparisKontrolRibbon` bagimsiz bileseni, `SiparisKontrolPage` state yonetiyor
- Phase 4 embed: `JobDashboardPanel` ayri dosyada, hem IS_EMRI sekmesinde hem `ExportXmlFirePage`'de kullanilabilir
- Kenar alanlari: Phase 2 (boolean u1/u2/k1/k2) vs Phase 3 (number u1/u2/k1/k2) — ayni isim, farkli tip
- Phase 2 guven skoru: Boolean alanlar icin `hucreGuvenSkorlari[field] ?? 100` (varsayilan yuksek guven)
