# Hybrid Partitioning - Single Iteration Implementation

Tarih: 2026-03-06

Bu dokuman, tum proje yapisinda yatay + dikey bolumleme gecisinin tek iterasyonda nasil uygulandigini kaydeder.

## 1) Karar

En dogru ve stabil gecis modeli:

1. **Strangler + Compatibility Wrapper**
- Gercek kod yeni katmana tasinir.
- Eski entry dosyasi wrapper olarak kalir.
- Public API/import kontrati korunur.

2. **Hybrid partition**
- Yatay katmanlar korunur (transport, service, model, infra).
- Dikey feature/domain kompozisyonu merkezilesir.

Bu model, tek iterasyonda kirilma riskini en dusuk seviyeye indirir.

## 2) Uygulanan Tasima (Gercek Kod)

### Backend

1. `app/features/v1_router_groups.py` eklendi.
2. `app/routers/v1/api.py` include mekanizmasi feature-group registry'e tasindi.
3. Route path/endpoint kontrati degismedi.
4. Fiziksel tasima:
   - `app/routers/auth_router.py` -> `app/features/auth/transport/http/router.py`
   - `app/routers/orders_router.py` -> `app/features/orders/transport/http/router.py`
   - `app/routers/integration_router.py` -> `app/features/integration/transport/http/router.py`
   - `app/routers/customers_router.py` -> `app/features/customers/transport/http/router.py`
   - `app/routers/crm_router.py` -> `app/features/crm/transport/http/router.py`
   - `app/routers/payment_router.py` -> `app/features/payment/transport/http/router.py`
   - `app/routers/stations_router.py` -> `app/features/stations/transport/http/router.py`
   - `app/routers/stock_cards_router.py` -> `app/features/stock/transport/http/router.py`
   - `app/routers/materials_router.py` -> `app/features/materials/transport/http/router.py`
   - `app/routers/orchestrator_router.py` -> `app/features/orchestrator/transport/http/router.py`
   - `app/routers/optiplanning_router.py` -> `app/features/optiplanning/transport/http/router.py`
   - `app/routers/biesse_router.py` -> `app/features/biesse/transport/http/router.py`
   - `app/routers/ocr_router.py` -> `app/features/ocr/transport/http/router.py`
   - `app/routers/azure_router.py` -> `app/features/azure/transport/http/router.py`
   - `app/routers/google_vision_router.py` -> `app/features/google_vision/transport/http/router.py`
   - `app/routers/aws_textract_router.py` -> `app/features/aws_textract/transport/http/router.py`
   - `app/routers/telegram_ocr_router.py` -> `app/features/telegram_ocr/transport/http/router.py`
   - `app/routers/email_ocr_router.py` -> `app/features/email_ocr/transport/http/router.py`
   - `app/routers/scanner_device_router.py` -> `app/features/scanner_device/transport/http/router.py`
   - `app/routers/product_router.py` -> `app/features/product/transport/http/router.py`
   - `app/routers/price_tracking_router.py` -> `app/features/price_tracking/transport/http/router.py`
   - `app/routers/admin_router.py` -> `app/features/admin/transport/http/router.py`
   - `app/routers/ai_assistant_router.py` -> `app/features/ai_assistant/transport/http/router.py`
   - `app/routers/ai_config_router.py` -> `app/features/ai_config/transport/http/router.py`
   - `app/routers/compliance_router.py` -> `app/features/compliance/transport/http/router.py`
   - `app/routers/config_router.py` -> `app/features/config/transport/http/router.py`
   - `app/routers/mikro_router.py` -> `app/features/mikro/transport/http/router.py`
   - `app/routers/sql_router.py` -> `app/features/sql/transport/http/router.py`
   - `app/routers/portal.py` -> `app/features/portal/transport/http/router.py`
   - `app/routers/public_tracking_router.py` -> `app/features/public_tracking/transport/http/router.py`
   - `app/routers/whatsapp_router.py` -> `app/features/whatsapp/transport/http/router.py`
5. Eski router dosyalari compatibility wrapper olarak birakildi.

### Frontend

1. `src/App.tsx` -> `src/app/AppShell.tsx` gercek tasima.
2. `src/App.tsx` wrapper oldu:
   - `export { default } from "./app/AppShell";`
3. Feature wave-1 fiziksel tasima:
   - `src/components/CRM/*` -> `src/features/CRM/*`
   - `src/components/Kanban/*` -> `src/features/Kanban/*`
   - `src/components/Payment/*` -> `src/features/Payment/*`
   - `src/components/PriceTracking/*` -> `src/features/PriceTracking/*`
   - `src/components/Reports/*` -> `src/features/Reports/*`
   - `src/components/Integration/IntegrationHealth.tsx` -> `src/features/Integration/IntegrationHealth.tsx`
   - `src/components/Integrations/*` -> `src/features/Integrations/*` (page katmani)
   - `src/components/WhatsApp/WhatsAppBusinessPage.tsx` -> `src/features/WhatsApp/WhatsAppBusinessPage.tsx`
4. Eski `src/components/*` dosyalari compatibility wrapper olarak birakildi.
5. Feature wave-2 fiziksel tasima:
   - `src/components/Admin/*` -> `src/features/Admin/*`
   - `src/components/Dashboard/*` -> `src/features/Dashboard/*`
   - `src/components/Orders/*` -> `src/features/Orders/*`
   - `src/components/Stock/*` -> `src/features/Stock/*`
   - `src/components/LoginPage.tsx` -> `src/features/Auth/LoginPage.tsx`
6. Feature wave-3 fiziksel tasima:
   - `src/components/AI/*` -> `src/features/AI/*`
   - `src/components/Forms/*` -> `src/features/Forms/*`
   - `src/components/Grid/*` -> `src/features/Grid/*`
   - `src/components/UI/*` -> `src/features/UI/*`
   - `src/components/Ribbon/*` -> `src/features/Ribbon/*`
   - `src/components/Optimization/*` -> `src/features/Optimization/*`
7. Feature wave-4 fiziksel tasima:
   - `src/components/AdminPanel.tsx` -> `src/features/AdminPanel.tsx`
   - `src/components/KioskScreen.tsx` -> `src/features/KioskScreen.tsx`
   - `src/components/OperatorScreen.tsx` -> `src/features/OperatorScreen.tsx`
   - `src/components/ErrorBoundary.tsx` -> `src/features/ErrorBoundary.tsx`
   - `src/components/OrderEditor.tsx` -> `src/features/OrderEditor.tsx`
8. Feature wave-5 wrapper standardizasyonu:
   - `src/components/CRM/index.ts` -> `src/features/CRM/index` wrapper
   - `src/components/Kanban/index.ts` -> `src/features/Kanban/index` wrapper
   - `src/components/Payment/index.ts` -> `src/features/Payment/index` wrapper
   - `src/components/PriceTracking/index.ts` -> `src/features/PriceTracking/index` wrapper
   - `src/components/Reports/index.ts` -> `src/features/Reports/index` wrapper
   - `src/components/Integration/IntegrationSettings.tsx` -> `src/features/Integration/IntegrationSettings.tsx` wrapper
   - `src/components/Payment/ReminderPanel.test.tsx` -> `src/features/Payment/ReminderPanel.test.tsx`
9. Feature wave-6 order-optimization merkezilesme:
   - `src/features/UI/OrderOptimizationPanel.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationPanel.tsx`
   - `src/features/Grid/OrderOptimizationGrid.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationGrid.tsx`
   - `src/features/Ribbon/OrderOptimizationRibbon.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationRibbon.tsx`
   - `src/features/UI/orderOptimizationConstants.ts` -> `src/features/Orders/OrderOptimization/orderOptimizationConstants.ts`
   - `src/features/UI/orderOptimizationStyles.ts` -> `src/features/Orders/OrderOptimization/orderOptimizationStyles.ts`
   - `src/features/UI/OrderOptimizationMetaStrip.tsx` -> `src/features/Orders/OrderOptimization/OrderOptimizationMetaStrip.tsx`
   - `src/features/Optimization/OptiPlanStrictOrderEntry.tsx` -> `src/features/Orders/OrderOptimization/OptiPlanStrictOrderEntry.tsx`
   - Eski `features/UI`, `features/Grid`, `features/Ribbon`, `features/Optimization` yollari wrapper olarak korunur.

### Orchestrator

1. `apps/orchestrator/src/index.ts` bootstrap kodu -> `src/app/bootstrap.ts` tasindi.
2. `src/index.ts` wrapper/giris oldu:
   - `startOrchestratorApp()`
3. API katmani dikey tasima:
   - `src/api/server.ts` -> `src/features/orchestration/http/server.ts`
   - `src/api/auth-routes.ts` -> `src/features/orchestration/http/auth-routes.ts`
   - `src/api/dashboard.ts` -> `src/features/orchestration/http/dashboard.ts`
4. `src/api/*` dosyalari compatibility wrapper olarak birakildi.

### Admin UI

1. `apps/admin-ui/src/App.tsx` -> `src/features/shell/AppShell.tsx` tasindi.
2. `src/App.tsx` wrapper oldu:
   - `export { App } from "./features/shell/AppShell";`

### Customer Portal

1. `customer_portal/src/App.tsx` -> `src/features/shell/AppShell.tsx` tasindi.
2. `src/App.tsx` wrapper oldu:
   - `export { default } from "./features/shell/AppShell";`

## 3) Mimari Sozlesme

1. Root entry dosyalari minimal wrapper olmalidir.
2. Gercek uygulama/shell kodu feature veya app katmaninda tutulur.
3. Yeni feature ekleme sadece ilgili feature klasorune yapilir.
4. Legacy import patikalari kademeli olarak azaltilir, tek seferde kirilmaz.

## 4) Test ve Dogrulama

Bu iterasyonda eklenen kontrat testleri:

1. `backend/tests/test_v1_router_groups.py`
2. `backend/tests/test_hybrid_partitioning_contract.py`

Bu testler su garantileri verir:

1. Backend feature-group registry bozulmaz.
2. Frontend/orchestrator/admin-ui/customer-portal wrapper->shell yapisi korunur.

## 5) Sonraki Adim (Faz-2)

1. Backend'de domain bazli fiziksel tasima:
- `orders`, `customers`, `integrations`, `auth`

2. Frontend'de feature ownership netlestirme:
- Kalan feature-ozel kodlari `components/*` altindan `features/*` altina tasima (kalan adaylar agirlikla shared/layout primitive dosyalaridir)

3. Orchestrator ve admin-ui icin:
- `features/<domain>/` ile domain bazli ayristirma
- import boundary kontrolu (lint rule)



## 6) Wave-9 App Composition Extraction

1. `Dashboard` icindeki `Operations` tab kompozisyonu `src/app/compositions/dashboardOperationsTabs.tsx` dosyasina tasindi.
2. `ReportsAnalytics` icindeki `Admin/Reports` tab kompozisyonu `src/app/compositions/reportsAnalyticsTabs.tsx` dosyasina tasindi.
3. `SystemLogs` icindeki `Admin` tab kompozisyonu `src/app/compositions/systemLogsTabs.tsx` dosyasina tasindi.
4. `UserManagement` icindeki `Admin` tab kompozisyonu `src/app/compositions/userManagementTabs.tsx` dosyasina tasindi.
5. Boylece feature boundary icindeki dogrudan cross-feature bagimliliklar azaltildi.

## 7) Wave-10 CardManagement Composition Extraction

1. `CardManagement` icindeki `CRM/Stock/Payment` tab kompozisyonu `src/app/compositions/cardManagementTabs.tsx` dosyasina tasindi.
2. `src/features/CardManagement/cardManagementFeatureAdapters.tsx` wrapper-only bir giris noktasi olarak birakildi.
3. `backend/tests/test_frontend_import_boundaries.py` allowlist'i `set()` seviyesine cekildi.
4. Boylece feature katmaninda gecici cross-feature allowlist ciftleri sifirlandi.
