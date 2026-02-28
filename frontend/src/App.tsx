import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Sidebar, MobileHeader } from "./components/Layout";
import { SpotlightSearch } from "./components/Layout/SpotlightSearch";
import { AIChatbot } from "./components/AI/AIChatbot";
import { Dashboard } from "./features/Dashboard";
import { Orders, OrderEditor } from "./features/Orders";
import { Card } from "./components/Shared";
import { ToastProvider } from "./contexts/ToastContext";
import { useAuthStore } from "./stores/authStore";
import { useOrdersStore } from "./stores/ordersStore";
import { useUIStore } from "./stores/uiStore";
import { syncRuntimeTheme } from "./themeRuntime";
import type { Order, User } from "./types";
import { LoginPage } from "./features/Auth/LoginPage";
import { ErrorBoundary } from "./components/Shared/ErrorBoundary";
import { ToastContainer } from "./components/Shared/Toast";
import { ConfirmationProvider } from "./components/Shared/Confirmation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

import "./styles/animations.css";
import "./styles/responsive.css";
import "./styles/theme-layouts.css";
import "./styles/premium-shell.css";

const Kanban = lazy(() => import("./features/Kanban"));
const ModularIntegrationsPage = lazy(() => import("./features/Integrations/ModularIntegrationsPage"));
const IntegrationHealth = lazy(() => import("./features/Integration/IntegrationHealth"));

const CardManagementPage = lazy(() => import("./features/CardManagement/CardManagementPage"));
const ReportsAnalyticsPage = lazy(() => import("./features/ReportsAnalytics/ReportsAnalyticsPage"));
const SystemLogsPage = lazy(() => import("./features/SystemLogs/SystemLogsPage"));
const UserManagementPage = lazy(() => import("./features/UserManagement/UserManagementPage"));
const SupportTickets = lazy(() => import("./features/CRM/SupportTickets"));

const ConfigPage = lazy(() => import("./features/Admin/ConfigPage"));
const StationsPage = lazy(() => import("./features/Admin/StationsPage"));
const OrganizationPage = lazy(() => import("./features/Admin/OrganizationPage"));
const UserActivityPage = lazy(() => import("./features/Admin/UserActivityPage"));

const WorkflowBuilder = lazy(() => import("./components/Admin/WorkflowBuilder"));
const ApiPortal = lazy(() => import("./components/Admin/ApiPortal"));
const WhatsAppBusinessPage = lazy(() => import("./features/WhatsApp/WhatsAppBusinessPage"));
const PriceTrackingPage = lazy(() => import("./features/PriceTracking"));
const AIAssistantPage = lazy(() => import("./features/AIAssistant/AIAssistantPage"));
const AIConfigPage = lazy(() => import("./features/AIConfig/AIConfigPage"));
const OrchestratorPage = lazy(() => import("./features/Orchestrator"));
const SpecSearchPage = lazy(() => import("./features/Products/SpecSearchPage"));

const LoadingFallback = () => (
  <div className="app-loading-fallback" role="status" aria-live="polite">
    <div className="app-loading-fallback-inner">
      <div className="loading-spinner loading-spinner-sm" aria-hidden="true" />
      Sayfa yukleniyor...
    </div>
  </div>
);

type Page =
  | "dashboard"
  | "orders"
  | "order-editor"
  | "kanban"
  | "card-management"
  | "reports-analytics"
  | "system-logs"
  | "user-management"
  | "integrations"
  | "integration-health"
  | "stations"
  | "config"
  | "organization"
  | "user-activity"
  | "workflows"
  | "api-portal"
  | "whatsapp-business"
  | "price-tracking"
  | "ai-assistant"
  | "ai-config"
  | "orchestrator"
  | "product-search"
  | "crm-tickets"
  | "export-page";

type SidebarRole = "ADMIN" | "OPERATOR" | "STATION";

function toSidebarRole(role?: string): SidebarRole {
  const normalized = role?.toUpperCase().trim();
  if (!normalized) return "OPERATOR";
  if (normalized === "ADMIN" || normalized.includes("ADMIN")) return "ADMIN";
  if (normalized === "OPERATOR" || normalized.includes("OPERATOR")) return "OPERATOR";
  if (normalized === "STATION" || normalized === "KIOSK" || normalized.includes("KIOSK")) return "STATION";
  return "OPERATOR";
}

function InfoPage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="electric-page">
      <div className="app-page-container">
        <Card title={title} subtitle="Durum bilgisi">
          <p className="info-page-detail">{detail}</p>
        </Card>
      </div>
    </div>
  );
}

function AuthenticatedApp({ authUser }: { authUser: User }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  useKeyboardShortcuts([
    { keys: ["Ctrl", "k"], description: "Arama ac", action: () => setSpotlightOpen(true) },
    { keys: ["Escape"], description: "Kapat", action: () => setSpotlightOpen(false), preventDefault: false },
    { keys: ["Shift", "Ctrl", "k"], description: "Sidebar ac/kapat", action: toggleSidebar },
  ]);

  const logout = useAuthStore((s) => s.logout);

  const fetchOrders = useOrdersStore((s) => s.fetchOrders);
  const initialized = useOrdersStore((s) => s.initialized);
  const loading = useOrdersStore((s) => s.isLoading);
  const error = useOrdersStore((s) => s.error);
  const allOrders = useOrdersStore((s) => s.orders);

  const badgeCounts = useMemo(
    () => ({
      orders: allOrders.filter((o) => o.status === "NEW").length || undefined,
      kanban: allOrders.filter((o) => o.status === "IN_PRODUCTION").length || undefined,
      payment: undefined,
      orchestrator: undefined,
      systemLogs: undefined,
    }),
    [allOrders],
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const currentUser = useMemo(
    () => ({
      name: authUser.fullName || authUser.username || authUser.email || "Operator",
      role: toSidebarRole(authUser.role),
    }),
    [authUser],
  );

  const openEditor = (order: Order | null) => {
    setEditingOrder(order);
    setPage("order-editor");
  };

  const closeEditor = () => {
    setEditingOrder(null);
    setPage("orders");
  };

  const isFetching = !initialized || loading;
  const statusNote = isFetching
    ? "Veriler yukleniyor..."
    : error
      ? `Veri baglantisi uyarisi: ${error}`
      : "";
  const showGlobalStatusNote = Boolean(statusNote) && page !== "dashboard";

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard currentUser={{ name: currentUser.name }} onNewOrder={() => openEditor(null)} />;
      case "orders":
        return <Orders onEdit={openEditor} />;
      case "order-editor":
        return <OrderEditor order={editingOrder} onBack={closeEditor} />;
      case "kanban":
        return <Kanban onEdit={(order) => openEditor(order)} />;
      case "card-management":
        return <CardManagementPage />;
      case "reports-analytics":
        return <ReportsAnalyticsPage />;
      case "integration-health":
        return <IntegrationHealth />;
      case "integrations":
        return <ModularIntegrationsPage />;
      case "stations":
        return <StationsPage />;
      case "system-logs":
        return <SystemLogsPage />;
      case "user-management":
        return <UserManagementPage />;
      case "config":
        return <ConfigPage />;
      case "organization":
        return <OrganizationPage />;
      case "user-activity":
        return <UserActivityPage />;
      case "workflows":
        return <WorkflowBuilder />;
      case "api-portal":
        return <ApiPortal />;
      case "whatsapp-business":
        return <WhatsAppBusinessPage />;
      case "price-tracking":
        return <PriceTrackingPage />;
      case "ai-assistant":
        return <AIAssistantPage />;
      case "ai-config":
        return <AIConfigPage />;
      case "orchestrator":
        return <OrchestratorPage />;
      case "product-search":
        return <SpecSearchPage />;
      case "crm-tickets":
        return <SupportTickets />;
      default:
        return <InfoPage title="Sayfa bulunamadi" detail="Istenen sayfa tanimli degil." />;
    }
  };

  return (
    <div className="app-shell">
      <div className="show-mobile mobile-header-wrap">
        <MobileHeader
          title="Optiplan360"
          subtitle={page.charAt(0).toUpperCase() + page.slice(1)}
          isMenuOpen={mobileMenuOpen}
          onMenuToggle={toggleSidebar}
          userName={currentUser.name}
          userRole={currentUser.role}
        />
      </div>

      <div
        className={`sidebar-overlay ${mobileMenuOpen ? "is-visible" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <Sidebar
        page={page}
        onNav={(nextPage) => {
          setPage(nextPage as Page);
          setMobileMenuOpen(false);
        }}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onToggle={toggleSidebar}
        userRole={currentUser.role}
        currentUser={authUser}
        badgeCounts={badgeCounts}
        onLogout={() => {
          logout();
          setPage("dashboard");
          setEditingOrder(null);
        }}
      />

      <main className="page-content app-main">
        {showGlobalStatusNote ? (
          <div className={`global-status-note ${error ? "is-warning" : "is-info"}`} role="status" aria-live="polite">
            {isFetching ? (
              <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
            ) : (
              <span className="global-status-dot" aria-hidden="true" />
            )}
            <span>{statusNote}</span>
          </div>
        ) : null}

        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>{renderPage()}</Suspense>
        </ErrorBoundary>

        <ToastContainer />
      </main>

      <SpotlightSearch
        isOpen={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        onNavigate={(nextPage) => {
          setPage(nextPage as Page);
          setSpotlightOpen(false);
        }}
      />

      <AIChatbot onNavigate={(nextPage) => setPage(nextPage as Page)} />
    </div>
  );
}

const PublicOrderTracking = lazy(() => import("./pages/PublicOrderTracking"));

function MainApp() {
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const themeName = useUIStore((s) => s.themeName);

  useEffect(() => {
    syncRuntimeTheme(themeName);
  }, [themeName]);

  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [logout]);

  if (!isAuthenticated || !authUser) {
    return (
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ConfirmationProvider>
        <ToastProvider>
          <AuthenticatedApp authUser={authUser} />
        </ToastProvider>
      </ConfirmationProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  if (pathname.startsWith("/track/")) {
    const token = pathname.replace("/track/", "");
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <PublicOrderTracking token={token} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return <MainApp />;
}
