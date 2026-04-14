import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/phase3Service", () => ({
  getPhase3Queue: vi.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error("test: demo mode")), 0))),
  getPhase3RecordDetail: vi.fn().mockRejectedValue(new Error("test: demo mode")),
  matchCustomer: vi.fn(),
  matchStock: vi.fn(),
  mergeRows: vi.fn(),
  addScrapNote: vi.fn(),
  moveToPhase4: vi.fn(),
  lookupCustomers: vi.fn().mockResolvedValue([]),
  lookupStocks: vi.fn().mockResolvedValue([]),
  updatePhase3Draft: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubEnv("DEV", true);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.stubEnv("DEV", true);
});

async function renderLoaded(Component: any) {
  const utils = render(<Component />);
  await act(async () => {
    if (vi.runAllTimersAsync) {
      await vi.runAllTimersAsync();
    }
  });
  await waitFor(() => {
    expect(screen.queryByText(/Sipariş verileri yükleniyor/)).toBeNull();
  });
  return utils;
}

describe("SiparisKontrolPage prod fallback", () => {
  it("prod build'de canlı veri hatasında demo fallback yerine hata ekranı gösterir", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();

    const { SiparisKontrolPage } = await import("./SiparisKontrolPage");
    await renderLoaded(SiparisKontrolPage);

    expect(screen.getAllByText("Veri alınırken hata oluştu")[0]).toBeTruthy();
    expect(screen.getByText("Canlı veri alınamadı: test: demo mode")).toBeTruthy();
    expect(screen.queryByText("Demo")).toBeNull();
  });

  it("boş phase3 kuyruğunda demo yerine hata ekranı gösterir", async () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();

    const phase3Service = await import("../../services/phase3Service");
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
    });

    const { SiparisKontrolPage } = await import("./SiparisKontrolPage");
    await renderLoaded(SiparisKontrolPage);

    expect(screen.getAllByText("Veri alınırken hata oluştu")[0]).toBeTruthy();
    expect(screen.getByText("Phase 3 kuyruğunda kayıt bulunamadı")).toBeTruthy();
    expect(screen.queryByText("Demo")).toBeNull();
  });
});