import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeviceManagement } from "../DeviceManagement";

// ToastContext mock
vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// adminService mock
vi.mock("../../../services/adminService", () => ({
  adminService: {
    getStations: vi.fn().mockResolvedValue([]),
    updateStation: vi.fn().mockResolvedValue({}),
    listStations: vi.fn().mockResolvedValue([]),
  },
}));

describe("DeviceManagement", () => {
  it("renders without crashing", async () => {
    render(<DeviceManagement />);
    await screen.findByText(/Kurulum Rehberi/i);
    expect(document.body).toBeTruthy();
  });

  it("finishes initial station load", async () => {
    render(<DeviceManagement />);
    const totalLabel = await screen.findByText(/Toplam İstasyon/i);
    expect(totalLabel).toBeTruthy();
  });

  it("shows Kurulum Rehberi button after load", async () => {
    render(<DeviceManagement />);
    const btn = await screen.findByText(/Kurulum Rehberi/i);
    expect(btn).toBeTruthy();
  });
});
