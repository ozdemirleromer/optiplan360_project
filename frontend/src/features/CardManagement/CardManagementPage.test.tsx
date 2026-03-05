import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/crmService", async () => {
  const actual = await vi.importActual<typeof import("../../services/crmService")>("../../services/crmService");

  return {
    ...actual,
    crmService: {
      ...actual.crmService,
      getStats: vi.fn().mockResolvedValue({
        pipelineValue: 0,
        avgCloseProbability: 0,
        activeAccounts: 0,
        totalAccounts: 0,
        totalOpportunities: 0,
        stageDistribution: {},
      }),
      listAccounts: vi.fn().mockResolvedValue([]),
      getAccountContacts: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("../../services/integrationService", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/integrationService")>("../../services/integrationService");

  return {
    ...actual,
    integrationService: {
      ...actual.integrationService,
      getHealth: vi.fn().mockResolvedValue({
        status: "HEALTHY",
        outboxPending: 0,
      }),
    },
  };
});

vi.mock("../../services/apiClient", () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.includes("/low-stock/alert")) {
      return { items: [] };
    }

    if (path.includes("/stock/stock-cards")) {
      return [];
    }

    return [];
  }),
}));

import { CardManagementPage } from "./CardManagementPage";

describe("CardManagementPage intro onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens accounts intro first, then only auto-opens create modal once", async () => {
    render(<CardManagementPage />);

    fireEvent.click(screen.getByRole("button", { name: /cari kartlar/i }));
    const accountStartButtons = screen.getAllByRole("button", { name: /cari kartı oluştur/i });
    expect(accountStartButtons).toHaveLength(2);

    fireEvent.click(accountStartButtons[1]);

    await screen.findByText(/yeni cari oluştur/i);

    fireEvent.click(screen.getByRole("button", { name: /ozet panel/i }));
    fireEvent.click(screen.getByRole("button", { name: /cari kartlar/i }));

    await waitFor(() => expect(screen.queryByText(/yeni cari oluştur/i)).not.toBeInTheDocument());
  });

  it("opens stock intro first, then only auto-opens create modal once", async () => {
    render(<CardManagementPage />);

    fireEvent.click(screen.getByRole("button", { name: /stok kartlar/i }));
    const stockStartButtons = screen.getAllByRole("button", { name: /stok kartı oluştur/i });
    expect(stockStartButtons).toHaveLength(2);

    fireEvent.click(stockStartButtons[1]);

    await screen.findByText(/stok kodu \*/i);

    fireEvent.click(screen.getByRole("button", { name: /ozet panel/i }));
    fireEvent.click(screen.getByRole("button", { name: /stok kartlar/i }));

    await waitFor(() => expect(screen.queryByText(/stok kodu \*/i)).not.toBeInTheDocument());
  });
});
