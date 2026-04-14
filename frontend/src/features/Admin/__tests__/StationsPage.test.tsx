import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StationsPage } from "../StationsPage";
import { ToastProvider } from "../../../contexts/ToastContext";
import type { StationDto } from "../../../services/adminService";

// adminService mock
vi.mock("../../../services/adminService", () => ({
  adminService: {
    getStations: vi.fn(),
    createStation: vi.fn(),
    updateStation: vi.fn(),
    toggleStation: vi.fn(),
    deleteStation: vi.fn(),
  },
}));

// DeviceManagement mock (ayrı modül, burada test edilmiyor)
vi.mock("../DeviceManagement", () => ({
  DeviceManagement: () => <div data-testid="device-management">DeviceManagement</div>,
}));

// TopBar mock
vi.mock("../../../components/Layout", () => ({
  TopBar: ({ title }: { title?: string }) => (
    <div data-testid="topbar">{title ?? ""}</div>
  ),
}));

import { adminService } from "../../../services/adminService";

const MOCK_STATIONS: StationDto[] = [
  {
    id: 1,
    name: "HAZIRLIK",
    description: "Hazırlık istasyonu",
    active: true,
    scanCountToday: 5,
  },
  {
    id: 2,
    name: "EBATLAMA",
    description: "Ebatlama istasyonu",
    active: true,
    scanCountToday: 3,
  },
];

function renderPage() {
  return render(
    <ToastProvider>
      <StationsPage />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminService.getStations).mockResolvedValue(MOCK_STATIONS);
});

describe("StationsPage", () => {
  it("başlık doğru gösterilir", async () => {
    renderPage();
    const topbar = await screen.findByTestId("topbar");
    expect(topbar.textContent).toContain("İstasyonlar Yönetimi");
  });

  it("tab bar 4 tab içerir", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "EBATLAMA" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "BANTLAMA" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "TESLİM" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cihaz Yönetimi" })).toBeTruthy();
    });
  });

  it("istasyonlar yüklendikten sonra HAZIRLIK ve EBATLAMA görünür", async () => {
    renderPage();
    await waitFor(() => {
      // HAZIRLIK sadece istasyon kartında görünür
      expect(screen.getAllByText("HAZIRLIK").length).toBeGreaterThan(0);
    });
    // EBATLAMA tab bar'da ve istasyon kartında çıkabilir
    expect(screen.getAllByText("EBATLAMA").length).toBeGreaterThan(0);
  });

  it("getStations servisi başlangıçta çağrılır", async () => {
    renderPage();
    await waitFor(() => {
      expect(adminService.getStations).toHaveBeenCalledTimes(1);
    });
  });

  it("boş station listesi durumunda 'Bu gruba ait istasyon bulunamadı' mesajı görünür", async () => {
    vi.mocked(adminService.getStations).mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/Bu gruba ait istasyon bulunamadı/)
      ).toBeTruthy();
    });
  });
});
