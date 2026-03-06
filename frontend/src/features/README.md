# Frontend Feature Partitioning Contract

Bu klasor dikey bolumleme (feature-slice) icin ana giris noktasi olarak kullanilir.

## Hedef Yapı

1. Dikey (feature):
- `src/features/<feature>/` altinda feature'a ozel `page`, `components`, `hooks`, `services`, `types`, `tests`

2. Yatay (shared):
- `src/components/Shared/` sadece tekrar kullanilan UI primitive
- `src/services/` sadece ortak API client ve cross-feature servisler
- `src/stores/` sadece global state

## Kural

1. Feature kodu baska feature icine dogrudan import etmez.
2. Ortak ihtiyac varsa `Shared` veya `services` katmanina tasinir.
3. Yeni ekran once `src/features/<feature>/index.ts` uzerinden export edilir.

## Gecis Stratejisi

1. Eski `src/components/*` icindeki feature-ozel parcalar asamali tasinacak.
2. Her tasimada public API (`index.ts`) korunacak.
3. Route baglantilari once adapter katmani ile, sonra dogrudan feature export ile guncellenecek.

## Durum (2026-03-06 / Wave-1)

Asagidaki moduller fiziksel olarak `components` altindan `features` altina tasindi ve eski yollar wrapper olarak korunuyor:

1. `CRM`
2. `Kanban`
3. `Payment`
4. `PriceTracking`
5. `Reports`
6. `Integration/IntegrationHealth`
7. `Integrations` (Modular + Simple pages)
8. `WhatsApp`

## Durum (2026-03-06 / Wave-2)

Asagidaki moduller de fiziksel olarak `components` altindan `features` altina tasindi ve eski yollar wrapper olarak korunuyor:

1. `Admin` (page + shared + utility dosyalari)
2. `Dashboard`
3. `Orders` (OrderEditor dahil)
4. `Stock`
5. `Auth/LoginPage`

## Durum (2026-03-06 / Wave-3)

Asagidaki moduller de fiziksel olarak `components` altindan `features` altina tasindi ve eski yollar wrapper olarak korunuyor:

1. `AI` (AIChatbot)
2. `Forms` (RefactoredExamples)
3. `Grid` (OrderOptimizationGrid)
4. `UI` (OrderOptimizationPanel, meta/constants/styles)
5. `Ribbon` (OrderOptimizationRibbon)
6. `Optimization` (NestingVisualizer, RoomSettingsPanel, OptiPlanUI, OptiPlanStrictOrderEntry)

## Durum (2026-03-06 / Wave-4)

Kok (`src/components`) altinda kalan ve feature niteligindeki dosyalar da tasindi:

1. `AdminPanel`
2. `KioskScreen`
3. `OperatorScreen`
4. `ErrorBoundary` (legacy varyant)
5. `OrderEditor` (deprecated legacy varyant)

## Durum (2026-03-06 / Wave-5)

Wrapper ve test kontratlari da feature-first modele cekildi:

1. `src/components/CRM/index.ts` -> `src/features/CRM/index` wrapper
2. `src/components/Kanban/index.ts` -> `src/features/Kanban/index` wrapper
3. `src/components/Payment/index.ts` -> `src/features/Payment/index` wrapper
4. `src/components/PriceTracking/index.ts` -> `src/features/PriceTracking/index` wrapper
5. `src/components/Reports/index.ts` -> `src/features/Reports/index` wrapper
6. `src/components/Payment/ReminderPanel.test.tsx` -> `src/features/Payment/ReminderPanel.test.tsx`
7. `src/components/Integration/IntegrationSettings.tsx` -> `src/features/Integration/IntegrationSettings.tsx` wrapper

## Durum (2026-03-06 / Wave-6)

Order Optimization kufesi `Orders` feature'i altinda merkezilestirildi:

1. `src/features/UI/OrderOptimizationPanel.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationPanel.tsx`
2. `src/features/Grid/OrderOptimizationGrid.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationGrid.tsx`
3. `src/features/Ribbon/OrderOptimizationRibbon.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationRibbon.tsx`
4. `src/features/UI/orderOptimizationConstants.ts` -> `src/features/Orders/OrderOptimization/orderOptimizationConstants.ts`
5. `src/features/UI/orderOptimizationStyles.ts` -> `src/features/Orders/OrderOptimization/orderOptimizationStyles.ts`
6. `src/features/UI/OrderOptimizationMetaStrip.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationMetaStrip.tsx`
7. `src/features/Optimization/OptiPlanStrictOrderEntry.tsx` -> `src/features/Orders/OrderOptimization/OptiPlanStrictOrderEntry.tsx`
8. Eski `UI/Grid/Ribbon/Optimization` yollari compatibility wrapper olarak korunuyor.

## Durum (2026-03-06 / Wave-7)

Order Optimization icin feature-wrapper sozlesmesi test ile sabitlendi:

1. `backend/tests/test_hybrid_partitioning_contract.py` icinde legacy feature wrapper hedefleri dogrulaniyor.
2. `src/features/Orders/OrderOptimization/README.md` canonical import yolu olarak eklendi.
3. `src/features/UI`, `src/features/Grid`, `src/features/Ribbon`, `src/features/Optimization` altindaki legacy girisler wrapper olarak kalmaya devam ediyor.

## Durum (2026-03-06 / Wave-8)

Canonical Order Optimization importlari production source tarafinda da sabitlendi:

1. `src/app/AppShell.tsx` legacy `features/Optimization` wrapper yolundan canonical `features/Orders/OrderOptimization` yoluna gecirildi.
2. Legacy Order Optimization feature wrapper dosyalarinin wrapper-only kalmasi test ile korunuyor.
3. Production source icinde legacy Order Optimization feature-wrapper importlari yasaklandi.

## Durum (2026-03-06 / Wave-9)

Feature->feature bagimliliklarini azaltmak icin sayfa kompozisyonlari `app` katmanina tasindi:

1. `Dashboard` AI sekmeleri `src/app/compositions/dashboardOperationsTabs.tsx` uzerinden yukleniyor.
2. `ReportsAnalytics` sekmeleri `src/app/compositions/reportsAnalyticsTabs.tsx` uzerinden yukleniyor.
3. `SystemLogs` sekmeleri `src/app/compositions/systemLogsTabs.tsx` uzerinden yukleniyor.
4. `UserManagement` sekmeleri `src/app/compositions/userManagementTabs.tsx` uzerinden yukleniyor.
5. Eski feature adapter dosyalari compatibility wrapper olarak korunuyor.

## Durum (2026-03-06 / Wave-10)

Card Management kompozisyonu da `app` katmanina tasindi ve feature sinirinda allowlist sifirlandi:

1. `src/app/compositions/cardManagementTabs.tsx` eklendi.
2. `src/features/CardManagement/cardManagementFeatureAdapters.tsx` wrapper-only oldu.
3. `backend/tests/test_frontend_import_boundaries.py` icinde `ALLOWED_CROSS_FEATURE_IMPORTS = set()` seviyesine inildi.
4. Feature katmaninda beklenen cross-feature import ciftleri kalmadi.
