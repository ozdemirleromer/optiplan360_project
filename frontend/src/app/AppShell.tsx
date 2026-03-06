import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";

import { MobileHeader, Sidebar } from "../components/Layout";
import { HorizontalLayout } from "../components/Layout/HorizontalLayout";
import { SpotlightSearch } from "../components/Layout/SpotlightSearch";

import { AIChatbot } from "../features/AI/AIChatbot";

import { Dashboard } from "../features/Dashboard";

import { Orders, OrderEditor } from "../features/Orders";

import { Card } from "../components/Shared";

import { ToastProvider } from "../contexts/ToastContext";

import { useAuthStore } from "../stores/authStore";

import { useOrdersStore } from "../stores/ordersStore";

import { StatusBar } from "../components/Layout/StatusBar";

import { useUIStore } from "../stores/uiStore";

import { syncRuntimeTheme } from "../themeRuntime";

import type { Order, User } from "../types";

import { LoginPage } from "../features/Auth/LoginPage";

import { ErrorBoundary } from "../components/Shared/ErrorBoundary";

import { ToastContainer } from "../components/Shared/Toast";

import { ConfirmationProvider } from "../components/Shared/Confirmation";

import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { subscribeToAppNavigation } from "../utils/appNavigation";


import "./styles/animations.css";

import "./styles/responsive.css";

import "./styles/theme-layouts.css";

import "./styles/premium-shell.css";



const Kanban = lazy(() => import("../features/Kanban"));

const ModularIntegrationsPage = lazy(() => import("../features/Integrations/ModularIntegrationsPage"));

const IntegrationHealth = lazy(() => import("../features/Integration/IntegrationHealth"));



const CardManagementPage = lazy(() => import("../features/CardManagement/CardManagementPage"));

const ReportsAnalyticsPage = lazy(() => import("../features/ReportsAnalytics/ReportsAnalyticsPage"));

const SystemLogsPage = lazy(() => import("../features/SystemLogs/SystemLogsPage"));

const UserManagementPage = lazy(() => import("../features/UserManagement/UserManagementPage"));

const SupportTickets = lazy(() => import("../features/CRM/SupportTickets"));



const ConfigPage = lazy(() => import("../features/Admin/ConfigPage"));

const StationsPage = lazy(() => import("../features/Admin/StationsPage"));

const OrganizationPage = lazy(() => import("../features/Admin/OrganizationPage"));

const UserActivityPage = lazy(() => import("../features/Admin/UserActivityPage"));



const WorkflowBuilder = lazy(() => import("../features/Admin/WorkflowBuilder"));

const ApiPortal = lazy(() => import("../features/Admin/ApiPortal"));

const WhatsAppBusinessPage = lazy(() => import("../features/WhatsApp/WhatsAppBusinessPage"));

const PriceTrackingPage = lazy(() => import("../features/PriceTracking"));

const AIAssistantPage = lazy(() => import("../features/AIAssistant/AIAssistantPage"));

const AIConfigPage = lazy(() => import("../features/AIConfig/AIConfigPage"));

const OrchestratorPage = lazy(() => import("../features/Orchestrator"));

const SpecSearchPage = lazy(() => import("../features/Products/SpecSearchPage"));
const OptiPlanUIPage = lazy(() => import("../features/Optimization/OptiPlanUI").then(m => ({ default: m.OptiPlanUI })));
const OptiPlanOrderEntryPage = lazy(() => import("../features/Orders/OrderOptimization/OptiPlanStrictOrderEntry").then(m => ({ default: m.OptiPlanStrictOrderEntry })));



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
  | "optiplan-desktop"
  | "optiplan-ui"
  | "optiplan-order"
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

  const [page, setPage] = useState<Page>(() => {
    if (typeof window === "undefined") {
      return "dashboard";
    }

    const requestedPage = new URLSearchParams(window.location.search).get("page");
    if (requestedPage === "optiplan-desktop") {
      return "optiplan-desktop";
    }

    return "dashboard";
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState({ x: 0, y: 0 });
  const cursorRafRef = useRef<number | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });



  const toggleSidebar = () => {

    if (window.innerWidth <= 768) {

      setMobileMenuOpen((prev) => !prev);

    } else {

      setSidebarCollapsed((prev) => !prev);

    }

  };

  const handleEscClose = () => {
    if (spotlightOpen) {
      setSpotlightOpen(false);
      return;
    }

    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
      return;
    }

    if (page === "order-editor") {
      setEditingOrder(null);
      setPage("orders");
    }
  };



  useKeyboardShortcuts([

    { keys: ["Ctrl", "k"], description: "Arama ac", action: () => setSpotlightOpen(true) },

    { keys: ["Escape"], description: "Kapat", action: handleEscClose, preventDefault: false },

    { keys: ["Shift", "Ctrl", "k"], description: "Sidebar ac/kapat", action: toggleSidebar },

    { keys: ["F1"], description: "Gösterge paneli", action: () => setPage("dashboard") },

    { keys: ["F2"], description: "Siparişler", action: () => setPage("orders") },

    { keys: ["F3"], description: "Sipariş editör", action: () => setPage("order-editor") },

    { keys: ["F4"], description: "Kanban", action: () => setPage("kanban") },

    { keys: ["F5"], description: "Raporlar", action: () => setPage("reports-analytics") },

    { keys: ["F6"], description: "Orchestrator", action: () => setPage("orchestrator") },

    { keys: ["F7"], description: "Fiyat takip", action: () => setPage("price-tracking") },

    { keys: ["F8"], description: "Kullanıcı yönetimi", action: () => setPage("user-management") },

    { keys: ["F9"], description: "Sistem logları", action: () => setPage("system-logs") },

    { keys: ["F10"], description: "Entegrasyonlar", action: () => setPage("integrations") },

    { keys: ["F11"], description: "İstasyonlar", action: () => setPage("stations") },

    { keys: ["F12"], description: "Konfigürasyon", action: () => setPage("config") },

    { keys: ["Ctrl", "Shift", "o"], description: "OptiPlan Desktop", action: () => setPage("optiplan-desktop") },

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

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      latestPointerRef.current = {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      };

      if (cursorRafRef.current !== null) return;

      cursorRafRef.current = window.requestAnimationFrame(() => {
        cursorRafRef.current = null;
        setCursorCoords(latestPointerRef.current);
      });
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (cursorRafRef.current !== null) {
        window.cancelAnimationFrame(cursorRafRef.current);
      }
    };
  }, []);



  useEffect(() => {

    return subscribeToAppNavigation(({ page: nextPage }) => {

      setPage(nextPage as Page);

      setMobileMenuOpen(false);

    });

  }, []);



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

      case "optiplan-desktop":
        return <HorizontalLayout />;
      case "optiplan-ui":
        return <OptiPlanUIPage />;
      case "optiplan-order":
        return <OptiPlanOrderEntryPage />;
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

      <div className="app-workspace">

        <Sidebar

          page={page}

          onNav={(nextPage) => setPage(nextPage as Page)}

          collapsed={sidebarCollapsed}

          mobileOpen={mobileMenuOpen}

          onToggle={toggleSidebar}

          userRole={currentUser.role}

          currentUser={authUser}

          onLogout={() => {

            logout();

            setPage("dashboard");

            setEditingOrder(null);

          }}

          badgeCounts={badgeCounts}

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

      </div>

      <StatusBar
        data={{
          xCoord: cursorCoords.x,
          yCoord: cursorCoords.y,
          serverStatus: isFetching ? "BAĞLANTIYI KAYBETTI" : "BAĞLI",
          activeUser: currentUser.role.toUpperCase(),
          softwareVersion: "v3.1.2",
        }}
      />

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



const PublicOrderTracking = lazy(() => import("../pages/PublicOrderTracking"));



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



