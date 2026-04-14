// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { Dashboard } from "./Dashboard";

vi.mock("../../services/adminService", () => ({
  adminService: {
    getStats: vi.fn(),
    getInsights: vi.fn(),
    getKpiTrends: vi.fn(),
    getStations: vi.fn(),
  },
}));

vi.mock("../../services/ordersService", () => ({
  ordersService: {
    list: vi.fn(),
  },
}));

vi.mock("../../hooks/useRealtime", () => ({
  useRealtime: vi.fn(),
}));

vi.mock("./dashboardFeatureAdapters", () => ({
  AIOpsDashboard: () => null,
  AIOrchestratorDashboard: () => null,
}));

import { adminService } from "../../services/adminService";
import { ordersService } from "../../services/ordersService";

const baseStats = {
  totalOrders: 18,
  ordersNew: 4,
  ordersProduction: 6,
  ordersReady: 3,
  ordersDelivered: 5,
  totalCustomers: 9,
  totalUsers: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminService.getStats).mockResolvedValue(baseStats as never);
  vi.mocked(adminService.getInsights).mockResolvedValue({} as never);
  vi.mocked(adminService.getKpiTrends).mockResolvedValue({ trends: [] } as never);
  vi.mocked(adminService.getStations).mockResolvedValue([
    { id: 1, name: "Kesim 1", isActive: true, stationType: "Hazır", scanCountToday: 3 },
  ] as never);
  vi.mocked(ordersService.list).mockResolvedValue([
    {
      id: "ord-1",
      cust: "Müşteri A",
      phone: "555",
      mat: "MAT-001",
      parts: 2,
      priority: "normal",
      status: "NEW",
      date: "2026-03-12",
    },
  ] as never);
});

describe("Dashboard", () => {
  it("overview sekmesinde yeni siparis CTA etiketini route metasindan uretir", async () => {
    const onNewOrder = vi.fn();

    render(<Dashboard currentUser={{ name: "Operatör Test" }} onNewOrder={onNewOrder} />);

    await waitFor(() => {
      expect(adminService.getStats).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: ORDER_ROUTE_META.newOrder.navLabel }));

    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  it("topbar altinda overview verilerini ve son siparisleri render eder", async () => {
    render(<Dashboard currentUser={{ name: "Operatör Test" }} />);

    expect(await screen.findByText("Son Siparişler")).toBeInTheDocument();
    expect(screen.getByText("Müşteri A")).toBeInTheDocument();
    expect(screen.getByText("İstasyon Durumları")).toBeInTheDocument();
    expect(screen.getByText("Gün Özeti")).toBeInTheDocument();
  });
});
