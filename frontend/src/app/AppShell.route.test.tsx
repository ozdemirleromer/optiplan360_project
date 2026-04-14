// @vitest-environment jsdom

import type { ReactNode } from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./AppShell";
import { useKeyboardShortcuts, type KeyboardShortcut } from "../hooks/useKeyboardShortcuts";
import { navigateToAppPage } from "../utils/appNavigation";

const mockState = vi.hoisted(() => ({
  logout: vi.fn(),
  fetchOrders: vi.fn().mockResolvedValue(undefined),
  authUser: {
    id: "user-1",
    username: "operator",
    email: "operator@example.com",
    role: "OPERATOR",
    fullName: "Operatör Kullanıcı",
    active: true,
    createdAt: "2026-03-12T08:00:00Z",
  },
  ordersState: {
    orders: [{ id: "ord-42", status: "NEW" }],
    fetchOrders: vi.fn().mockResolvedValue(undefined),
    initialized: true,
    isLoading: false,
    error: null,
  },
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      isAuthenticated: true,
      user: mockState.authUser,
      logout: mockState.logout,
    }),
}));

vi.mock("../stores/uiStore", () => ({
  useUIStore: (selector: (state: unknown) => unknown) =>
    selector({
      themeName: "industrialGrid",
    }),
}));

vi.mock("../stores/ordersStore", () => ({
  useOrdersStore: (selector: (state: unknown) => unknown) => selector(mockState.ordersState),
}));

vi.mock("../themeRuntime", () => ({
  syncRuntimeTheme: vi.fn(),
}));

vi.mock("../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("../components/Layout", () => ({
  MobileHeader: () => <div data-testid="mobile-header" />,
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("../components/Layout/StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));

vi.mock("../components/Layout/SpotlightSearch", () => ({
  SpotlightSearch: () => null,
}));

vi.mock("../components/Layout/WindowsRibbonBar", () => ({
  WindowsRibbonBar: ({
    activePage,
    onNavigate,
  }: {
    activePage: string;
    onNavigate: (page: "orders" | "order-editor" | "optiplan-order") => void;
  }) => (
    <div data-testid="windows-ribbon" data-active-page={activePage}>
      <button type="button" onClick={() => onNavigate("orders")}>
        Ribbon Orders
      </button>
      <button type="button" onClick={() => onNavigate("order-editor")}>
        Ribbon New Order
      </button>
      <button type="button" onClick={() => onNavigate("optiplan-order")}>
        Ribbon Job
      </button>
    </div>
  ),
}));

vi.mock("../components/Shared", () => ({
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/Shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/Shared/Toast", () => ({
  ToastContainer: () => null,
}));

vi.mock("../components/Shared/Confirmation", () => ({
  ConfirmationProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("../contexts/ToastContext", () => ({
  ToastProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("../features/AI/AIChatbot", () => ({
  AIChatbot: () => null,
}));

vi.mock("../features/Dashboard", () => ({
  Dashboard: ({ onNewOrder }: { onNewOrder: () => void }) => (
    <button type="button" onClick={onNewOrder}>
      Dashboard New Order
    </button>
  ),
}));

vi.mock("../features/Orders", () => ({
  Orders: ({ onEdit }: { onEdit: (order: { id: string } | null) => void }) => (
    <div>
      <button type="button" onClick={() => onEdit({ id: "ord-42" })}>
        Edit Existing Order
      </button>
      <button type="button" onClick={() => onEdit(null)}>
        Create New Order
      </button>
    </div>
  ),
  OrderEditor: () => <div data-testid="order-editor-page">Mock OrderEditor</div>,
  UnifiedWorkspace: ({ initialPhase }: { initialPhase: number }) => <div>Workflow {initialPhase}</div>,
}));

vi.mock("../features/Auth/LoginPage", () => ({
  LoginPage: () => <div>Mock Login</div>,
}));

vi.mock("../features/Orders/SiparisFisiPage", () => ({
  default: ({ title, preferredOrderId }: { title?: string; preferredOrderId?: string | null }) => (
    <div data-testid="siparis-fisi-page">
      {title ? `${title}: ` : ""}
      Focused Order: {preferredOrderId ?? "none"}
    </div>
  ),
}));

vi.mock("../features/CRM/TeklifWorkspace", () => ({
  default: () => <div>Mock Teklif Workspace</div>,
}));


vi.mock("../features/OptiPlanWorkflow/ExportXmlFirePage", () => ({
  ExportXmlFirePage: () => <div data-testid="export-xml-fire-page">Mock Export XML Fire</div>,
}));
const mockedUseKeyboardShortcuts = vi.mocked(useKeyboardShortcuts);

function getRegisteredShortcuts(): KeyboardShortcut[] {
  const lastCall = mockedUseKeyboardShortcuts.mock.calls.at(-1);
  return (lastCall?.[0] as KeyboardShortcut[] | undefined) ?? [];
}

describe("AppShell order routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?page=orders");
    document.title = "Vitest";
    mockState.logout.mockReset();
    mockState.ordersState.fetchOrders.mockClear();
    mockedUseKeyboardShortcuts.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("mevcut siparisi siparis-fisi rotasina ve odak id ile tasir", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /edit existing order/i }));

    expect(await screen.findByTestId("siparis-fisi-page")).toHaveTextContent("ord-42");

    await waitFor(() => {
      expect(window.location.search).toContain("page=siparis-fisi");
      expect(window.location.search).toContain("orderId=ord-42");
      expect(document.title).toBe("Sipariş Fişi #ord-42 | Optiplan360");
    });
  });

  it("yeni siparisi order-editor rotasinda birakir ve orderId temizler", async () => {
    window.history.replaceState({}, "", "/?page=siparis-fisi&orderId=ord-42");

    render(<App />);

    act(() => {
      navigateToAppPage("order-editor", "test-suite");
    });

    expect(await screen.findByTestId("order-editor-page")).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.search).toContain("page=order-editor");
      expect(window.location.search).not.toContain("orderId=");
      expect(document.title).toBe("Yeni Sipariş | Optiplan360");
    });
  });

  it("uygulama event navigasyonunda siparis odagini query ile senkronlar", async () => {
    render(<App />);

    act(() => {
      navigateToAppPage("siparis-fisi", "test-suite", "ord-99");
    });

    expect(await screen.findByTestId("siparis-fisi-page")).toHaveTextContent("ord-99");

    await waitFor(() => {
      expect(window.location.search).toContain("page=siparis-fisi");
      expect(window.location.search).toContain("orderId=ord-99");
      expect(document.title).toBe("Sipariş Fişi #ord-99 | Optiplan360");
    });
  });

  it("optiplan job eventi ayni order context ile query ve basligi korur", async () => {
    render(<App />);

    act(() => {
      navigateToAppPage("optiplan-job", "test-suite", "ord-77");
    });

    expect(await screen.findByTestId("export-xml-fire-page")).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.search).toContain("page=optiplan-job");
      expect(window.location.search).toContain("orderId=ord-77");
      expect(document.title).toBe("OptiPlanning #ord-77 | Optiplan360");
    });
  });

  it("ctrl+n kisayolunu yeni siparis rotasina baglar", async () => {
    render(<App />);

    const shortcut = getRegisteredShortcuts().find((item) => item.keys.join("+") === "Ctrl+n");
    expect(shortcut).toBeDefined();

    act(() => {
      shortcut?.action();
    });

    expect(await screen.findByTestId("order-editor-page")).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.search).toContain("page=order-editor");
      expect(document.title).toBe("Yeni Sipariş | Optiplan360");
    });
  });

  it("orders sayfasina dondugunde query orderId alanini temizler", async () => {
    window.history.replaceState({}, "", "/?page=siparis-fisi&orderId=ord-42");

    render(<App />);

    act(() => {
      navigateToAppPage("orders", "test-suite");
    });

    expect(await screen.findByRole("button", { name: /edit existing order/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.search).toContain("page=orders");
      expect(window.location.search).not.toContain("orderId=");
      expect(document.title).toBe("Siparişler | Optiplan360");
    });
  });
});
