// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OCRStatsPage } from "./OCRStatsPage";

const adminMocks = vi.hoisted(() => ({
  getAzureStats: vi.fn(),
  getGoogleStats: vi.fn(),
  getAwsStats: vi.fn(),
  getOcrSummary: vi.fn(),
  getOCRConfig: vi.fn(),
  resetOcrChannelTelemetry: vi.fn(),
}));

vi.mock("../../services/adminService", () => ({
  adminService: adminMocks,
}));

describe("OCRStatsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    adminMocks.getAzureStats.mockResolvedValue({ configured: false, totalJobs: 0, successRate: 0, avgConfidence: 0, lastUsed: null });
    adminMocks.getGoogleStats.mockResolvedValue({ configured: false, totalJobs: 0, successRate: 0, avgConfidence: 0, lastUsed: null });
    adminMocks.getAwsStats.mockResolvedValue({ configured: false, totalJobs: 0, successRate: 0, avgConfidence: 0, lastUsed: null });
    adminMocks.getOCRConfig.mockResolvedValue({ configured: true, engine: "tesseract", languages: ["tr"], preprocessingEnabled: true, confidenceThreshold: 0.7 });
    adminMocks.getOcrSummary.mockResolvedValue({
      totalJobs: 7,
      successfulJobs: 5,
      failedJobs: 2,
      averageConfidence: 81.5,
      totalPagesProcessed: 12,
      last24hJobs: 3,
      topLanguages: [{ language: "Türkçe", count: 6 }],
      engineBreakdown: [{ engine: "Tesseract", count: 7, successRate: 71.4 }],
      ordersCreated: 1,
      conversionRate: 20,
      channelBreakdown: [
        {
          channelId: "MANUAL_UPLOAD",
          label: "Manuel Upload",
          external: false,
          configured: true,
          ready: true,
          telemetryAvailable: true,
          totalJobs: 4,
          successfulJobs: 4,
          failedJobs: 0,
          last24hJobs: 2,
          successRate: 100,
          lastAttemptedAt: "2026-03-13T10:00:00+00:00",
          lastSuccessfulAt: "2026-03-13T10:00:00+00:00",
          lastFailedAt: null,
          lastErrorAt: null,
          lastIngestedAt: "2026-03-13T10:00:00+00:00",
          lastSignalAt: "2026-03-13T10:00:00+00:00",
          lastJobId: "job-2",
          lastEvent: "DEVICE_INGEST",
          lastEventStatus: "SUCCESS",
          lastError: null,
          telemetryStale: false,
          telemetryAgeHours: 0,
          riskLevel: "LOW",
          riskReason: "WORKFLOW_INTERNAL",
          status: "READY",
        },
        {
          channelId: "EMAIL",
          label: "Email OCR",
          external: true,
          configured: true,
          ready: true,
          telemetryAvailable: true,
          totalJobs: 3,
          successfulJobs: 1,
          failedJobs: 2,
          last24hJobs: 1,
          successRate: 33.3,
          lastAttemptedAt: "2026-03-13T09:30:00+00:00",
          lastSuccessfulAt: null,
          lastFailedAt: "2026-03-13T09:30:00+00:00",
          lastErrorAt: "2026-03-13T09:31:00+00:00",
          lastIngestedAt: "2026-03-13T09:30:00+00:00",
          lastSignalAt: "2026-03-13T09:31:00+00:00",
          lastJobId: "job-1",
          lastEvent: "EMAIL_FETCH_NOW",
          lastEventStatus: "FAILED",
          lastError: "provider timeout",
          telemetryStale: true,
          telemetryAgeHours: 31.5,
          riskLevel: "HIGH",
          riskReason: "TELEMETRY_STALE",
          status: "ATTENTION",
        },
      ],
      recentJobs: [
        {
          id: "job-1",
          status: "FAILED",
          confidence: 52,
          createdAt: "2026-03-13T09:30:00+00:00",
          completedAt: "2026-03-13T09:31:00+00:00",
          errorMessage: "provider timeout",
          orderId: null,
          sourceChannel: "EMAIL",
          sourceLabel: "Email OCR",
        },
        {
          id: "job-2",
          status: "ORDER_CREATED",
          confidence: 94,
          createdAt: "2026-03-13T10:00:00+00:00",
          completedAt: "2026-03-13T10:01:00+00:00",
          errorMessage: null,
          orderId: "ORD-001",
          sourceChannel: "MANUAL_UPLOAD",
          sourceLabel: "Manuel Upload",
        },
      ],
    });
    adminMocks.resetOcrChannelTelemetry.mockResolvedValue({
      ok: true,
      channelId: "EMAIL",
      label: "Email OCR",
      clearedKeys: ["telemetry_last_attempted_at"],
      remainingJobEvidence: true,
      channel: {
        channelId: "EMAIL",
        label: "Email OCR",
        external: true,
        configured: true,
        ready: true,
        telemetryAvailable: true,
        totalJobs: 3,
        successfulJobs: 1,
        failedJobs: 2,
        last24hJobs: 1,
        successRate: 33.3,
        lastAttemptedAt: "2026-03-13T09:30:00+00:00",
        lastSuccessfulAt: null,
        lastFailedAt: "2026-03-13T09:30:00+00:00",
        lastErrorAt: "2026-03-13T09:31:00+00:00",
        lastIngestedAt: "2026-03-13T09:30:00+00:00",
        lastSignalAt: "2026-03-13T09:31:00+00:00",
        lastJobId: "job-1",
        lastEvent: null,
        lastEventStatus: null,
        lastError: "provider timeout",
        telemetryStale: false,
        telemetryAgeHours: 0.5,
        riskLevel: "HIGH",
        riskReason: "LOW_SUCCESS_RATE",
        status: "ATTENTION",
      },
    });
  });

  it("backend summary payloadini normalize edip fallback sayilarini kullanmaz", async () => {
    render(<OCRStatsPage />);

    expect(
      await screen.findByText((_, element) => element?.textContent === "+3 son 24s"),
    ).toBeInTheDocument();
    expect(screen.getByText("5 basarili")).toBeInTheDocument();
    expect(screen.getByText("%81.5")).toBeInTheDocument();
    expect(screen.getByText("Türkçe")).toBeInTheDocument();
    expect(screen.getByText("Tesseract")).toBeInTheDocument();
    expect(screen.getAllByText("Intake Kanallari").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Email OCR").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Riskli").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/provider timeout/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Dis Kanal Release Gate Riski")).toBeInTheDocument();
    expect(screen.getByText("Son Intake Kayitlari")).toBeInTheDocument();
    expect(screen.getAllByText(/Email Fetch \/ Hatali/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scanner Ingest \/ Basarili/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Son hata \(/i)).toBeInTheDocument();
    expect(screen.getByText("Siparis: ORD-001")).toBeInTheDocument();
    expect(screen.getByText("Hatali")).toBeInTheDocument();
    expect(screen.getByText("Aktif Intake Kanali")).toBeInTheDocument();
    expect(screen.getByText("Riskli Kanal")).toBeInTheDocument();
    expect(screen.getAllByText("Telemetry bayat").length).toBeGreaterThan(0);
    expect(screen.getByText("HIGH Risk")).toBeInTheDocument();
    expect(screen.getByText("Telemetry Sifirla")).toBeInTheDocument();
    expect(screen.queryByText("145")).not.toBeInTheDocument();
    expect(screen.queryByText("132 basarili")).not.toBeInTheDocument();
  });

  it("riskli filtre ve telemetry sifirlama aksiyonunu ayni panelde uygular", async () => {
    render(<OCRStatsPage />);

    expect((await screen.findAllByText("Email OCR")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Yalniz Riskli" }));

    await waitFor(() => {
      expect(screen.getAllByText("Email OCR").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Telemetry Sifirla" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Telemetry Sifirla" }));

    await waitFor(() => {
      expect(adminMocks.resetOcrChannelTelemetry).toHaveBeenCalledWith("EMAIL");
      expect(screen.getByText(/telemetry izi sifirlandi/i)).toBeInTheDocument();
      expect(screen.getAllByText("Basari orani dusuk").length).toBeGreaterThan(0);
    });
  });
});
