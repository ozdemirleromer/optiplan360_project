// @vitest-environment jsdom

import type { ReactNode } from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../../app/AppShell";
import { ORDER_ROUTE_META } from "../orderNavigationContract";

const mockState = vi.hoisted(() => ({
  authUser: {
    id: "user-1",
    username: "operator",
    email: "operator@example.com",
    role: "OPERATOR",
    fullName: "Operatör Kullanıcı",
    active: true,
    createdAt: "2026-03-13T08:00:00Z",
  },
  ordersState: {
    orders: [],
    fetchOrders: vi.fn().mockResolvedValue(undefined),
    initialized: true,
    isLoading: false,
    error: null,
  },
}));

vi.mock("../../../stores/authStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      isAuthenticated: true,
      user: mockState.authUser,
      logout: vi.fn(),
    }),
}));

vi.mock("../../../stores/uiStore", () => ({
  useUIStore: (selector: (state: unknown) => unknown) =>
    selector({
      themeName: "industrialGrid",
    }),
}));

vi.mock("../../../stores/ordersStore", () => ({
  useOrdersStore: (selector: (state: unknown) => unknown) => selector(mockState.ordersState),
}));

vi.mock("../../../themeRuntime", () => ({
  syncRuntimeTheme: vi.fn(),
}));

vi.mock("../../../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("..", () => ({
  MobileHeader: () => <div data-testid="mobile-header" />,
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("../StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));

vi.mock("../SpotlightSearch", () => ({
  SpotlightSearch: () => null,
}));

vi.mock("../WindowsRibbonBar", () => ({
  WindowsRibbonBar: ({ activePage }: { activePage: string }) => (
    <div data-testid="windows-ribbon" data-active-page={activePage} />
  ),
}));

vi.mock("../../../components/Shared", () => ({
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({ children, ...props }: { children?: ReactNode; [k: string]: unknown }) => <button {...props}>{children}</button>,
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: ({ children, ...props }: { children?: ReactNode; [k: string]: unknown }) => <select {...props}>{children}</select>,
  Modal: ({ children, open }: { children?: ReactNode; open?: boolean }) => open ? <div>{children}</div> : null,
  Icon: () => null,
  IconWithLabel: () => null,
  IntegrationReadonlyPanel: () => null,
  EmptyState: () => null,
  EmptyData: () => null,
  ErrorState: () => null,
  TabBar: () => null,
  Pagination: () => null,
  NumberInput: (props: Record<string, unknown>) => <input type="number" {...props} />,
  KPICard: () => null,
  Tooltip: () => null,
  COLORS: { text: "#fff", muted: "#888", border: "#333", primary: "#2563eb", danger: "#dc2626", warning: "#f59e0b", success: "#10b981", accent: "#3b82f6", panel: "#1e293b", bg: { surface: "#1e293b" } },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  TYPOGRAPHY: { fontFamily: { base: "sans-serif", heading: "sans-serif", mono: "monospace" }, fontSize: { xs: 11, sm: 12, base: 14, lg: 16 }, fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 } },
  SHADOWS: { sm: "none", md: "none" },
  Z_INDEX: { modal: 1400, overlay: 1300, dropdown: 1000 },
  primaryRgba: () => "rgba(37,99,235,0.1)",
}));

vi.mock("../../../components/Shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../components/Shared/Toast", () => ({
  ToastContainer: () => null,
}));

vi.mock("../../../components/Shared/Confirmation", () => ({
  ConfirmationProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../contexts/ToastContext", () => ({
  ToastProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../features/AI/AIChatbot", () => ({
  AIChatbot: () => null,
}));

vi.mock("../../../features/Dashboard", () => ({
  Dashboard: () => <div>Mock Dashboard</div>,
}));

vi.mock("../../../features/Orders", () => ({
  Orders: () => <div>Mock Orders</div>,
  OrderEditor: () => <div>Mock OrderEditor</div>,
  UnifiedWorkspace: ({ initialPhase }: { initialPhase: number }) => <div>Workflow {initialPhase}</div>,
}));

vi.mock("../../../features/Auth/LoginPage", () => ({
  LoginPage: () => <div>Mock Login</div>,
}));

vi.mock("../../../features/Orders/SiparisFisiPage", () => ({
  default: () => <div data-testid="siparis-fisi-page">Mock Siparis</div>,
}));

vi.mock("../../../features/CRM/TeklifFisiPage", () => ({
  default: () => <div data-testid="teklif-fisi-page">Mock Teklif</div>,
}));

vi.mock("../../../features/CRM/TeklifWorkspace", () => ({
  default: () => <div data-testid="teklif-fisi-page">Mock TeklifWorkspace</div>,
}));

vi.mock("../../../features/CardManagement/CariKartiPage", () => ({
  default: () => <div data-testid="cari-karti-page">Mock Cari</div>,
}));

vi.mock("../../../features/CardManagement/StokKartiPage", () => ({
  default: () => <div data-testid="stok-karti-page">Mock Stok</div>,
}));

describe("AppShell module routes", () => {
  beforeEach(() => {
    document.title = "Vitest";
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    {
      page: ORDER_ROUTE_META.quoteForm.page,
      title: ORDER_ROUTE_META.quoteForm.title,
      testId: "teklif-fisi-page",
    },
    {
      page: ORDER_ROUTE_META.stockCard.page,
      title: ORDER_ROUTE_META.stockCard.title,
      testId: "stok-karti-page",
    },
    {
      page: ORDER_ROUTE_META.customerCard.page,
      title: ORDER_ROUTE_META.customerCard.title,
      testId: "cari-karti-page",
    },
  ])("$page rotasi orderId baglamini temizler ve ortak basligi korur", async ({ page, title, testId }) => {
    window.history.replaceState({}, "", `/?page=${page}&orderId=ord-42`);

    render(<App />);

    expect(await screen.findByTestId(testId)).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.search).toContain(`page=${page}`);
      expect(window.location.search).not.toContain("orderId=");
      expect(document.title).toBe(`${title} | Optiplan360`);
    });
  });
});
