import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.features.v1_router_groups import V1_ROUTER_GROUPS


def test_backend_feature_group_registry_exists():
    expected_groups = {
        "auth_admin",
        "config",
        "core_operations",
        "integrations",
        "ocr_external",
        "business_modules",
        "orchestration",
        "catalog_tracking",
        "ai",
        "portal_public",
    }
    assert expected_groups.issubset(set(V1_ROUTER_GROUPS))


def test_backend_router_wrapper_contract():
    auth_wrapper = (REPO_ROOT / "backend" / "app" / "routers" / "auth_router.py").read_text(
        encoding="utf-8"
    )
    orders_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "orders_router.py"
    ).read_text(encoding="utf-8")
    integration_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "integration_router.py"
    ).read_text(encoding="utf-8")
    customers_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "customers_router.py"
    ).read_text(encoding="utf-8")
    crm_wrapper = (REPO_ROOT / "backend" / "app" / "routers" / "crm_router.py").read_text(
        encoding="utf-8"
    )
    payment_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "payment_router.py"
    ).read_text(encoding="utf-8")
    stations_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "stations_router.py"
    ).read_text(encoding="utf-8")
    stock_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "stock_cards_router.py"
    ).read_text(encoding="utf-8")
    materials_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "materials_router.py"
    ).read_text(encoding="utf-8")
    orchestrator_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "orchestrator_router.py"
    ).read_text(encoding="utf-8")
    optiplanning_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "optiplanning_router.py"
    ).read_text(encoding="utf-8")
    biesse_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "biesse_router.py"
    ).read_text(encoding="utf-8")
    ocr_wrapper = (REPO_ROOT / "backend" / "app" / "routers" / "ocr_router.py").read_text(
        encoding="utf-8"
    )
    azure_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "azure_router.py"
    ).read_text(encoding="utf-8")
    google_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "google_vision_router.py"
    ).read_text(encoding="utf-8")
    aws_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "aws_textract_router.py"
    ).read_text(encoding="utf-8")
    telegram_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "telegram_ocr_router.py"
    ).read_text(encoding="utf-8")
    email_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "email_ocr_router.py"
    ).read_text(encoding="utf-8")
    scanner_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "scanner_device_router.py"
    ).read_text(encoding="utf-8")
    product_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "product_router.py"
    ).read_text(encoding="utf-8")
    price_tracking_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "price_tracking_router.py"
    ).read_text(encoding="utf-8")
    admin_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "admin_router.py"
    ).read_text(encoding="utf-8")
    ai_assistant_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "ai_assistant_router.py"
    ).read_text(encoding="utf-8")
    ai_config_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "ai_config_router.py"
    ).read_text(encoding="utf-8")
    compliance_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "compliance_router.py"
    ).read_text(encoding="utf-8")
    config_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "config_router.py"
    ).read_text(encoding="utf-8")
    mikro_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "mikro_router.py"
    ).read_text(encoding="utf-8")
    sql_wrapper = (REPO_ROOT / "backend" / "app" / "routers" / "sql_router.py").read_text(
        encoding="utf-8"
    )
    portal_wrapper = (REPO_ROOT / "backend" / "app" / "routers" / "portal.py").read_text(
        encoding="utf-8"
    )
    public_tracking_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "public_tracking_router.py"
    ).read_text(encoding="utf-8")
    whatsapp_wrapper = (
        REPO_ROOT / "backend" / "app" / "routers" / "whatsapp_router.py"
    ).read_text(encoding="utf-8")

    assert "app.features.auth.transport.http.router" in auth_wrapper
    assert "app.features.orders.transport.http.router" in orders_wrapper
    assert "app.features.integration.transport.http.router" in integration_wrapper
    assert "app.features.customers.transport.http.router" in customers_wrapper
    assert "app.features.crm.transport.http.router" in crm_wrapper
    assert "app.features.payment.transport.http.router" in payment_wrapper
    assert "app.features.stations.transport.http.router" in stations_wrapper
    assert "app.features.stock.transport.http.router" in stock_wrapper
    assert "app.features.materials.transport.http.router" in materials_wrapper
    assert "app.features.orchestrator.transport.http.router" in orchestrator_wrapper
    assert "app.features.optiplanning.transport.http.router" in optiplanning_wrapper
    assert "app.features.biesse.transport.http.router" in biesse_wrapper
    assert "app.features.ocr.transport.http.router" in ocr_wrapper
    assert "app.features.azure.transport.http.router" in azure_wrapper
    assert "app.features.google_vision.transport.http.router" in google_wrapper
    assert "app.features.aws_textract.transport.http.router" in aws_wrapper
    assert "app.features.telegram_ocr.transport.http.router" in telegram_wrapper
    assert "app.features.email_ocr.transport.http.router" in email_wrapper
    assert "app.features.scanner_device.transport.http.router" in scanner_wrapper
    assert "app.features.product.transport.http.router" in product_wrapper
    assert "app.features.price_tracking.transport.http.router" in price_tracking_wrapper
    assert "app.features.admin.transport.http.router" in admin_wrapper
    assert "app.features.ai_assistant.transport.http.router" in ai_assistant_wrapper
    assert "app.features.ai_config.transport.http.router" in ai_config_wrapper
    assert "app.features.compliance.transport.http.router" in compliance_wrapper
    assert "app.features.config.transport.http.router" in config_wrapper
    assert "app.features.mikro.transport.http.router" in mikro_wrapper
    assert "app.features.sql.transport.http.router" in sql_wrapper
    assert "app.features.portal.transport.http.router" in portal_wrapper
    assert "app.features.public_tracking.transport.http.router" in public_tracking_wrapper
    assert "app.features.whatsapp.transport.http.router" in whatsapp_wrapper


def test_frontend_app_shell_wrapper_contract():
    app_wrapper = (REPO_ROOT / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
    shell_file = REPO_ROOT / "frontend" / "src" / "app" / "AppShell.tsx"
    assert "export { default } from \"./app/AppShell\";" in app_wrapper
    assert shell_file.exists()


def test_orchestrator_bootstrap_wrapper_contract():
    index_file = (REPO_ROOT / "apps" / "orchestrator" / "src" / "index.ts").read_text(
        encoding="utf-8"
    )
    bootstrap_file = REPO_ROOT / "apps" / "orchestrator" / "src" / "app" / "bootstrap.ts"
    assert "startOrchestratorApp" in index_file
    assert bootstrap_file.exists()


def test_orchestrator_api_wrapper_contract():
    server_wrapper = (
        REPO_ROOT / "apps" / "orchestrator" / "src" / "api" / "server.ts"
    ).read_text(encoding="utf-8")
    auth_wrapper = (
        REPO_ROOT / "apps" / "orchestrator" / "src" / "api" / "auth-routes.ts"
    ).read_text(encoding="utf-8")
    dashboard_wrapper = (
        REPO_ROOT / "apps" / "orchestrator" / "src" / "api" / "dashboard.ts"
    ).read_text(encoding="utf-8")

    feature_server = (
        REPO_ROOT
        / "apps"
        / "orchestrator"
        / "src"
        / "features"
        / "orchestration"
        / "http"
        / "server.ts"
    )
    feature_auth = (
        REPO_ROOT
        / "apps"
        / "orchestrator"
        / "src"
        / "features"
        / "orchestration"
        / "http"
        / "auth-routes.ts"
    )
    feature_dashboard = (
        REPO_ROOT
        / "apps"
        / "orchestrator"
        / "src"
        / "features"
        / "orchestration"
        / "http"
        / "dashboard.ts"
    )

    assert "features/orchestration/http/server" in server_wrapper
    assert "features/orchestration/http/auth-routes" in auth_wrapper
    assert "features/orchestration/http/dashboard" in dashboard_wrapper
    assert feature_server.exists()
    assert feature_auth.exists()
    assert feature_dashboard.exists()


def test_admin_ui_shell_wrapper_contract():
    app_wrapper = (REPO_ROOT / "apps" / "admin-ui" / "src" / "App.tsx").read_text(
        encoding="utf-8"
    )
    shell_file = REPO_ROOT / "apps" / "admin-ui" / "src" / "features" / "shell" / "AppShell.tsx"
    assert "export { App } from \"./features/shell/AppShell\";" in app_wrapper
    assert shell_file.exists()


def test_customer_portal_shell_wrapper_contract():
    app_wrapper = (REPO_ROOT / "customer_portal" / "src" / "App.tsx").read_text(
        encoding="utf-8"
    )
    shell_file = (
        REPO_ROOT / "customer_portal" / "src" / "features" / "shell" / "AppShell.tsx"
    )
    assert "export { default } from \"./features/shell/AppShell\";" in app_wrapper
    assert shell_file.exists()


def test_frontend_component_to_feature_wrapper_contract():
    wrapper_map = {
        "frontend/src/components/CRM/CRMPage.tsx": "../../features/CRM/CRMPage",
        "frontend/src/components/CRM/CariCardsIntroScreen.tsx": "../../features/CRM/CariCardsIntroScreen",
        "frontend/src/components/CRM/index.ts": "../../features/CRM/index",
        "frontend/src/components/Kanban/Kanban.tsx": "../../features/Kanban/Kanban",
        "frontend/src/components/Kanban/KanbanCard.tsx": "../../features/Kanban/KanbanCard",
        "frontend/src/components/Kanban/index.ts": "../../features/Kanban/index",
        "frontend/src/components/Payment/PaymentDashboard.tsx": "../../features/Payment/PaymentDashboard",
        "frontend/src/components/Payment/InvoiceForm.tsx": "../../features/Payment/InvoiceForm",
        "frontend/src/components/Payment/InvoiceList.tsx": "../../features/Payment/InvoiceList",
        "frontend/src/components/Payment/ReminderPanel.tsx": "../../features/Payment/ReminderPanel",
        "frontend/src/components/Payment/index.ts": "../../features/Payment/index",
        "frontend/src/components/PriceTracking/PriceTrackingPage.tsx": "../../features/PriceTracking/PriceTrackingPage",
        "frontend/src/components/PriceTracking/PriceUploadForm.tsx": "../../features/PriceTracking/PriceUploadForm",
        "frontend/src/components/PriceTracking/PriceJobList.tsx": "../../features/PriceTracking/PriceJobList",
        "frontend/src/components/PriceTracking/PriceItemsTable.tsx": "../../features/PriceTracking/PriceItemsTable",
        "frontend/src/components/PriceTracking/PriceExportButton.tsx": "../../features/PriceTracking/PriceExportButton",
        "frontend/src/components/PriceTracking/index.ts": "../../features/PriceTracking/index",
        "frontend/src/components/Reports/Reports.tsx": "../../features/Reports/Reports",
        "frontend/src/components/Reports/index.ts": "../../features/Reports/index",
        "frontend/src/components/Integration/IntegrationHealth.tsx": "../../features/Integration/IntegrationHealth",
        "frontend/src/components/Integration/IntegrationSettings.tsx": "../../features/Integration/IntegrationSettings",
        "frontend/src/components/Integrations/ModularIntegrationsPage.tsx": "../../features/Integrations/ModularIntegrationsPage",
        "frontend/src/components/Integrations/SimpleIntegrationsPage.tsx": "../../features/Integrations/SimpleIntegrationsPage",
        "frontend/src/components/WhatsApp/WhatsAppBusinessPage.tsx": "../../features/WhatsApp/WhatsAppBusinessPage",
        "frontend/src/components/Admin/ConfigPage.tsx": "../../features/Admin/ConfigPage",
        "frontend/src/components/Admin/StationsPage.tsx": "../../features/Admin/StationsPage",
        "frontend/src/components/Admin/OrganizationPage.tsx": "../../features/Admin/OrganizationPage",
        "frontend/src/components/Admin/UserActivityPage.tsx": "../../features/Admin/UserActivityPage",
        "frontend/src/components/Admin/UsersPage.tsx": "../../features/Admin/UsersPage",
        "frontend/src/components/Admin/RolesPermissionsPage.tsx": "../../features/Admin/RolesPermissionsPage",
        "frontend/src/components/Admin/LogsPage.tsx": "../../features/Admin/LogsPage",
        "frontend/src/components/Admin/AuditRecordsPage.tsx": "../../features/Admin/AuditRecordsPage",
        "frontend/src/components/Admin/AnalyticsPage.tsx": "../../features/Admin/AnalyticsPage",
        "frontend/src/components/Admin/ReportsPage.tsx": "../../features/Admin/ReportsPage",
        "frontend/src/components/Admin/index.ts": "../../features/Admin/index",
        "frontend/src/components/Dashboard/index.ts": "../../features/Dashboard/index",
        "frontend/src/components/Dashboard/Dashboard.tsx": "../../features/Dashboard/Dashboard",
        "frontend/src/components/Dashboard/SimpleDashboard.tsx": "../../features/Dashboard/SimpleDashboard",
        "frontend/src/components/Dashboard/BIDashboardWidgets.tsx": "../../features/Dashboard/BIDashboardWidgets",
        "frontend/src/components/Orders/index.ts": "../../features/Orders/index",
        "frontend/src/components/Orders/Orders.tsx": "../../features/Orders/Orders",
        "frontend/src/components/Orders/OrderNotesPanel.tsx": "../../features/Orders/OrderNotesPanel",
        "frontend/src/components/Orders/OrderEditor/index.tsx": "../../../features/Orders/OrderEditor/index",
        "frontend/src/components/Orders/OrderEditor/workbenchUtils.ts": "../../../features/Orders/OrderEditor/workbenchUtils",
        "frontend/src/components/Stock/StockCardComponent.tsx": "../../features/Stock/StockCardComponent",
        "frontend/src/components/Stock/QuickDefinitionPage.tsx": "../../features/Stock/QuickDefinitionPage",
        "frontend/src/components/Stock/StockCardsIntroScreen.tsx": "../../features/Stock/StockCardsIntroScreen",
        "frontend/src/components/Stock/StockAndCustomerDefinitionModal.tsx": "../../features/Stock/StockAndCustomerDefinitionModal",
        "frontend/src/components/LoginPage.tsx": "../features/Auth/LoginPage",
        "frontend/src/components/AI/AIChatbot.tsx": "../../features/AI/AIChatbot",
        "frontend/src/components/Forms/RefactoredExamples.tsx": "../../features/Forms/RefactoredExamples",
        "frontend/src/components/Grid/OrderOptimizationGrid.tsx": "../../features/Grid/OrderOptimizationGrid",
        "frontend/src/components/UI/orderOptimizationConstants.ts": "../../features/UI/orderOptimizationConstants",
        "frontend/src/components/UI/orderOptimizationStyles.ts": "../../features/UI/orderOptimizationStyles",
        "frontend/src/components/UI/OrderOptimizationMetaStrip.tsx": "../../features/UI/OrderOptimizationMetaStrip",
        "frontend/src/components/UI/OrderOptimizationPanel.tsx": "../../features/UI/OrderOptimizationPanel",
        "frontend/src/components/Ribbon/OrderOptimizationRibbon.tsx": "../../features/Ribbon/OrderOptimizationRibbon",
        "frontend/src/components/Optimization/NestingVisualizer.tsx": "../../features/Optimization/NestingVisualizer",
        "frontend/src/components/Optimization/OptiPlanStrictOrderEntry.tsx": "../../features/Optimization/OptiPlanStrictOrderEntry",
        "frontend/src/components/Optimization/OptiPlanUI.tsx": "../../features/Optimization/OptiPlanUI",
        "frontend/src/components/Optimization/RoomSettingsPanel.tsx": "../../features/Optimization/RoomSettingsPanel",
        "frontend/src/components/AdminPanel.tsx": "../features/AdminPanel",
        "frontend/src/components/KioskScreen.tsx": "../features/KioskScreen",
        "frontend/src/components/OperatorScreen.tsx": "../features/OperatorScreen",
        "frontend/src/components/ErrorBoundary.tsx": "../features/ErrorBoundary",
        "frontend/src/components/OrderEditor.tsx": "../features/OrderEditor",
    }

    for wrapper_path, import_target in wrapper_map.items():
        wrapper_file = REPO_ROOT / wrapper_path
        assert wrapper_file.exists(), f"missing wrapper file: {wrapper_path}"
        wrapper_content = wrapper_file.read_text(encoding="utf-8")
        assert import_target in wrapper_content, f"wrapper target mismatch: {wrapper_path}"

        if wrapper_path == "frontend/src/components/LoginPage.tsx":
            feature_file = REPO_ROOT / "frontend/src/features/Auth/LoginPage.tsx"
        else:
            feature_file = REPO_ROOT / wrapper_path.replace("components", "features")
        assert feature_file.exists(), f"missing moved feature file: {feature_file}"


def test_frontend_feature_wrapper_contract():
    wrapper_map = {
        "frontend/src/features/UI/OrderOptimizationPanel.tsx": "../Orders/OrderOptimization/OrderOptimizationPanel",
        "frontend/src/features/Grid/OrderOptimizationGrid.tsx": "../Orders/OrderOptimization/OrderOptimizationGrid",
        "frontend/src/features/Ribbon/OrderOptimizationRibbon.tsx": "../Orders/OrderOptimization/OrderOptimizationRibbon",
        "frontend/src/features/UI/orderOptimizationConstants.ts": "../Orders/OrderOptimization/orderOptimizationConstants",
        "frontend/src/features/UI/orderOptimizationStyles.ts": "../Orders/OrderOptimization/orderOptimizationStyles",
        "frontend/src/features/UI/OrderOptimizationMetaStrip.tsx": "../Orders/OrderOptimization/OrderOptimizationMetaStrip",
        "frontend/src/features/Optimization/OptiPlanStrictOrderEntry.tsx": "../Orders/OrderOptimization/OptiPlanStrictOrderEntry",
    }

    for wrapper_path, import_target in wrapper_map.items():
        wrapper_file = REPO_ROOT / wrapper_path
        assert wrapper_file.exists(), f"missing feature wrapper file: {wrapper_path}"
        wrapper_content = wrapper_file.read_text(encoding="utf-8")
        assert import_target in wrapper_content, f"feature wrapper target mismatch: {wrapper_path}"

        target_base = (wrapper_file.parent / import_target).resolve()
        candidate_files = [
            target_base,
            Path(f"{target_base}.ts"),
            Path(f"{target_base}.tsx"),
        ]
        assert any(candidate.exists() for candidate in candidate_files), (
            f"missing canonical order-optimization file: {target_base}"
        )



def test_no_production_source_uses_legacy_order_optimization_feature_wrappers():
    legacy_fragments = {
        "features/UI/OrderOptimizationPanel",
        "features/Grid/OrderOptimizationGrid",
        "features/Ribbon/OrderOptimizationRibbon",
        "features/UI/orderOptimizationConstants",
        "features/UI/orderOptimizationStyles",
        "features/UI/OrderOptimizationMetaStrip",
        "features/Optimization/OptiPlanStrictOrderEntry",
    }
    excluded_files = {
        REPO_ROOT / "frontend" / "src" / "features" / "UI" / "OrderOptimizationPanel.tsx",
        REPO_ROOT / "frontend" / "src" / "features" / "Grid" / "OrderOptimizationGrid.tsx",
        REPO_ROOT / "frontend" / "src" / "features" / "Ribbon" / "OrderOptimizationRibbon.tsx",
        REPO_ROOT / "frontend" / "src" / "features" / "UI" / "orderOptimizationConstants.ts",
        REPO_ROOT / "frontend" / "src" / "features" / "UI" / "orderOptimizationStyles.ts",
        REPO_ROOT / "frontend" / "src" / "features" / "UI" / "OrderOptimizationMetaStrip.tsx",
        REPO_ROOT / "frontend" / "src" / "features" / "Optimization" / "OptiPlanStrictOrderEntry.tsx",
    }
    scan_roots = {
        REPO_ROOT / "frontend" / "src" / "app",
        REPO_ROOT / "frontend" / "src" / "pages",
        REPO_ROOT / "frontend" / "src" / "features",
    }

    violations = []
    for root in scan_roots:
        for ext in ("*.ts", "*.tsx"):
            for file_path in root.rglob(ext):
                if file_path in excluded_files:
                    continue
                if file_path.name.endswith(".test.ts") or file_path.name.endswith(".test.tsx"):
                    continue
                source = file_path.read_text(encoding="utf-8")
                for fragment in legacy_fragments:
                    if fragment in source:
                        rel_path = file_path.relative_to(REPO_ROOT).as_posix()
                        violations.append(f"{rel_path} -> {fragment}")

    assert not violations, (
        "Production source legacy Order Optimization feature-wrapper importlarini kullanmamali:\n"
        + "\n".join(sorted(violations))
    )
