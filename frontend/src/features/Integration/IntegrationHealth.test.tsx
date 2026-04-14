// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COLORS } from "../../components/Shared";

vi.mock("../../services/mikroService", () => ({
  mikroService: {
    checkHealth: vi.fn(),
  },
}));

import { mikroService } from "../../services/mikroService";
import { IntegrationHealth } from "./IntegrationHealth";

function toRgbString(color: string): string {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

const readOnlyHealthPayload = {
  overallStatus: "DEGRADED",
  timestamp: "2026-03-13T09:00:00Z",
  integrations: {
    MIKRO: {
      status: "DEGRADED",
      connection: false,
      database: "MikroDB",
      pendingSyncs: 2,
      successRate: 71,
      error: "Mikro push akisi read-only mod nedeniyle durduruldu",
    },
    SMTP: {
      status: "HEALTHY",
      connection: true,
      message: "Aktif",
    },
  },
  errors: [
    {
      entityType: "QUOTE",
      errorCode: "E_MIKRO_READ_ONLY",
      errorMessage: "Mikro P1 read-only mod aktif",
      entityId: "quo-42",
      timestamp: "2026-03-13T08:45:00Z",
    },
  ],
};

describe("IntegrationHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mikroService.checkHealth).mockResolvedValue(readOnlyHealthPayload as never);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("read-only entegrasyon hatasini ve hata kodunu gorunur kilir", async () => {
    render(<IntegrationHealth />);

    expect(await screen.findByText("Son Hatalar")).toBeInTheDocument();
    expect(screen.getByText("QUOTE - E_MIKRO_READ_ONLY")).toBeInTheDocument();
    expect(screen.getByText("Entity ID: quo-42")).toBeInTheDocument();

    const inlineError = screen.getByText("Mikro push akisi read-only mod nedeniyle durduruldu");
    expect(inlineError).toBeInTheDocument();
    expect(inlineError.getAttribute("style") ?? "").toContain(`color: ${toRgbString(COLORS.text)}`);
    expect(inlineError.getAttribute("style") ?? "").toContain(`border: 1px solid ${toRgbString(COLORS.danger)}`);

    expect(screen.getByText("Mikro P1 read-only mod aktif")).toBeInTheDocument();
  });
  it("yeniden yenilemede son saglik durumunu ekranda tutar", async () => {
    vi.useFakeTimers();
    vi.mocked(mikroService.checkHealth)
      .mockResolvedValueOnce(readOnlyHealthPayload as never)
      .mockRejectedValueOnce(new Error("Baglanti kesildi"));

    render(<IntegrationHealth />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Genel Durum")).toBeInTheDocument();
    expect(screen.getByText("Mikro SQL")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(vi.mocked(mikroService.checkHealth)).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Genel Durum")).toBeInTheDocument();
    expect(screen.getByText("Son yenileme hatasi: Baglanti kesildi")).toBeInTheDocument();
    expect(screen.getByText("Mikro SQL")).toBeInTheDocument();
    expect(screen.queryByText("Saglik kontrolu hatasi: Baglanti kesildi")).not.toBeInTheDocument();
  });
});
