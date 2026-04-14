// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Phase1QueuePage } from "./Phase1QueuePage";

// ---------------------------------------------------------------------------
// Servis mock'ları
// ---------------------------------------------------------------------------

const phase1Mocks = vi.hoisted(() => ({
  getPhase1Queue: vi.fn(),
  getPhase1RecordDetail: vi.fn(),
  getPhase1StatusSummary: vi.fn(),
  getPhase1Errors: vi.fn(),
  getPhase1FolderHealth: vi.fn(),
  postManualRetry: vi.fn(),
  postBatchRetry: vi.fn(),
  postManualRescan: vi.fn(),
}));

const workflowMocks = vi.hoisted(() => ({
  manualImport: vi.fn(),
}));

vi.mock("../../services/phase1Service", () => ({
  getPhase1Queue: phase1Mocks.getPhase1Queue,
  getPhase1RecordDetail: phase1Mocks.getPhase1RecordDetail,
  getPhase1StatusSummary: phase1Mocks.getPhase1StatusSummary,
  getPhase1Errors: phase1Mocks.getPhase1Errors,
  getPhase1FolderHealth: phase1Mocks.getPhase1FolderHealth,
  postManualRetry: phase1Mocks.postManualRetry,
  postBatchRetry: phase1Mocks.postBatchRetry,
  postManualRescan: phase1Mocks.postManualRescan,
}));

vi.mock("../../services/optiplanWorkflowService", () => ({
  optiplanWorkflowService: {
    manualImport: workflowMocks.manualImport,
  },
}));

// ---------------------------------------------------------------------------
// Fixture verileri
// ---------------------------------------------------------------------------

const summaryFixture = {
  totalCount: 42,
  duplicateCount: 5,
  retryCount: 3,
  errorCount: 7,
  phase2ReadyCount: 12,
  manualReviewCount: 2,
  activeFolderCount: 4,
};

const queueRecordFixture = {
  recordId: "rec-001",
  uuid: "uuid-aabbcc-1122-3344-5566-778899aabbcc",
  fileName: "siparis_ocr_001.pdf",
  sourceType: "whatsapp_raw",
  ocrProvider: "tesseract",
  ocrEngine: null,
  folderType: "whatsapp_raw",
  status: "PHASE2_PENDING" as const,
  duplicateFlag: false,
  duplicateReason: null,
  retryCount: 0,
  lastErrorMessage: null,
  createdAt: "2026-03-18T10:00:00Z",
  updatedAt: "2026-03-18T10:05:00Z",
  nextRetryAt: null,
  phase2Ready: true,
  imageUrl: null,
};

const retryRecordFixture = {
  ...queueRecordFixture,
  recordId: "rec-002",
  fileName: "siparis_retry_002.pdf",
  status: "OCR_RETRY_PENDING" as const,
  retryCount: 2,
  phase2Ready: false,
};

const folderHealthFixture = [
  {
    folderType: "whatsapp_raw",
    isActive: true,
    healthStatus: "HEALTHY" as const,
    lastScanAt: "2026-03-18T10:00:00Z",
    lastFileAt: "2026-03-18T09:55:00Z",
    recordCount: 42,
    physicalPath: "C:/optiplan/raw/whatsapp",
  },
  {
    folderType: "scanner_raw",
    isActive: true,
    healthStatus: "WARNING" as const,
    lastScanAt: "2026-03-18T09:00:00Z",
    lastFileAt: null,
    recordCount: 0,
    physicalPath: "C:/optiplan/raw/scanner",
  },
];

const errorRecordFixture = {
  recordId: "rec-err-001",
  fileName: "hata_dosya.pdf",
  status: "FAULTY" as const,
  errorSeverity: "RETRYABLE" as const,
  errorType: "OCR_TIMEOUT",
  lastErrorMessage: "OCR zaman aşımı",
  retryCount: 1,
  lastAttemptAt: "2026-03-18T09:50:00Z",
  nextRetryAt: "2026-03-18T10:20:00Z",
};

const detailFixture = {
  record: retryRecordFixture,
  folderHealth: folderHealthFixture[0],
  lifecycle: [
    {
      fromStatus: null,
      toStatus: "RECEIVED",
      triggeredAt: "2026-03-18T09:00:00Z",
      triggeredBy: "system",
      note: null,
    },
    {
      fromStatus: "RECEIVED",
      toStatus: "OCR_RETRY_PENDING",
      triggeredAt: "2026-03-18T09:30:00Z",
      triggeredBy: "ocr-worker",
      note: "Retry gereği",
    },
  ],
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  phase1Mocks.getPhase1StatusSummary.mockResolvedValue(summaryFixture);
  phase1Mocks.getPhase1Queue.mockResolvedValue({
    items: [queueRecordFixture],
    page: 1,
    pageSize: 25,
    total: 1,
  });
  phase1Mocks.getPhase1Errors.mockResolvedValue({ items: [] });
  phase1Mocks.getPhase1FolderHealth.mockResolvedValue({ items: folderHealthFixture });
  phase1Mocks.getPhase1RecordDetail.mockResolvedValue(detailFixture);
  phase1Mocks.postManualRetry.mockResolvedValue({ ok: true, message: "Retry planlandı" });
  phase1Mocks.postBatchRetry.mockResolvedValue({ ok: true, message: "Batch retry başlatıldı", processedCount: 1 });
  phase1Mocks.postManualRescan.mockResolvedValue({ ok: true, message: "Tarama başlatıldı" });
});

// ---------------------------------------------------------------------------
// Testler
// ---------------------------------------------------------------------------

describe("Phase1QueuePage", () => {
  it("başlık ve özet KPI kartlarını yükler", async () => {
    render(<Phase1QueuePage />);

    expect(await screen.findByText("Phase 1 — OCR Havuzu")).toBeInTheDocument();

    // Summary cards (tüm etiketler görünmeli)
    expect(await screen.findByText("Toplam Kayıt")).toBeInTheDocument();
    // "Phase 2 Hazır" FiltersBar checkbox ve SummaryCards'da ikisinde görünür
    expect(screen.getAllByText("Phase 2 Hazır").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Retry Bekliyor")).toBeInTheDocument();
    expect(screen.getByText("Tekrar (Dup.)")).toBeInTheDocument();
    // “Manuel İnceleme” STATUS_OPTIONS ve SummaryCards'da ikisinde görünür
    expect(screen.getAllByText("Manuel İnceleme").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Aktif Klasör")).toBeInTheDocument();

    // Sayılar görünmeli
    expect(await screen.findByText("42")).toBeInTheDocument(); // totalCount
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1); // phase2ReadyCount
  });

  it("kuyruk sekmesinde kayıt listesini durum badge ile gösterir", async () => {
    render(<Phase1QueuePage />);

    // Queue item dosya adı görünmeli
    expect(await screen.findByText("siparis_ocr_001.pdf")).toBeInTheDocument();

    // Durum badge: "Phase 2 Bekliyor" — select option ve badge'de birden çok olabilir
    expect((await screen.findAllByText("Phase 2 Bekliyor")).length).toBeGreaterThanOrEqual(1);
  });

  it("kuyrukta OCR_RETRY_PENDING kaydı için Retry butonu görünür", async () => {
    phase1Mocks.getPhase1Queue.mockResolvedValue({
      items: [retryRecordFixture],
      page: 1,
      pageSize: 25,
      total: 1,
    });

    render(<Phase1QueuePage />);

    const retryBtn = await screen.findByRole("button", { name: "Retry" });
    expect(retryBtn).toBeInTheDocument();
  });

  it("satır retry butonu postManualRetry'ı doğru recordId ile çağırır", async () => {
    phase1Mocks.getPhase1Queue.mockResolvedValue({
      items: [retryRecordFixture],
      page: 1,
      pageSize: 25,
      total: 1,
    });

    render(<Phase1QueuePage />);

    const retryBtn = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    await waitFor(() =>
      expect(phase1Mocks.postManualRetry).toHaveBeenCalledWith("rec-002"),
    );
  });

  it("durum filtresi değişince getPhase1Queue yeniden çağrılır", async () => {
    render(<Phase1QueuePage />);

    await screen.findByText("Phase 1 — OCR Havuzu");

    // Durum filtresi: "Tüm Durumlar" default değerini taşıyan select
    const statusSelect = screen.getByDisplayValue("Tüm Durumlar");
    fireEvent.change(statusSelect, { target: { value: "FAULTY" } });

    await waitFor(() => {
      const calls = phase1Mocks.getPhase1Queue.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.status).toBe("FAULTY");
    });
  });

  it("Klasör Durumu sekmesi klasörleri healthStatus ile listeler", async () => {
    render(<Phase1QueuePage />);

    await screen.findByText("Phase 1 — OCR Havuzu");

    const folderTab = screen.getByRole("button", { name: /Klasör Durumu/i });
    fireEvent.click(folderTab);

    // HEALTHY ve WARNING etiketleri görünmeli
    expect(await screen.findByText("Sağlıklı")).toBeInTheDocument();
    expect(await screen.findByText("Uyarı")).toBeInTheDocument();
  });

  it("Hatalar sekmesi boş olunca 'Hata kaydı yok' mesajı gösterir", async () => {
    phase1Mocks.getPhase1Errors.mockResolvedValue({ items: [] });

    render(<Phase1QueuePage />);

    await screen.findByText("Phase 1 — OCR Havuzu");

    const errorsTab = screen.getByRole("button", { name: /Hatalar/i });
    fireEvent.click(errorsTab);

    expect(await screen.findByText("Hata kaydı yok")).toBeInTheDocument();
  });

  it("Hatalar sekmesi dolu olunca kayıt listesini görüntüler", async () => {
    phase1Mocks.getPhase1Errors.mockResolvedValue({ items: [errorRecordFixture] });

    render(<Phase1QueuePage />);

    await screen.findByText("Phase 1 — OCR Havuzu");

    const errorsTab = screen.getByRole("button", { name: /Hatalar/i });
    fireEvent.click(errorsTab);

    expect(await screen.findByText("hata_dosya.pdf")).toBeInTheDocument();
    expect(screen.getByText("OCR zaman aşımı")).toBeInTheDocument();
  });

  it("satır seçilip Batch Retry yapılınca postBatchRetry çağrılır", async () => {
    phase1Mocks.getPhase1Queue.mockResolvedValue({
      items: [queueRecordFixture],
      page: 1,
      pageSize: 25,
      total: 1,
    });

    render(<Phase1QueuePage />);

    await screen.findByText("siparis_ocr_001.pdf");

    // Tümünü seç checkbox'u ile satır seç → Toplu Retry toolbar'u belirir
    const selectAllCheckbox = screen.getByTitle("Tümünü seç/temizle");
    fireEvent.click(selectAllCheckbox);

    // Checkbox seçili → "Toplu Retry" butonu belirir
    const batchRetryBtn = await screen.findByRole("button", { name: /Toplu Retry/i });
    fireEvent.click(batchRetryBtn);

    await waitFor(() =>
      expect(phase1Mocks.postBatchRetry).toHaveBeenCalledWith(["rec-001"]),
    );
  });

  it("satıra tıklanınca kayıt detayı drawer'ı açılır ve lifecycle gösterilir", async () => {
    render(<Phase1QueuePage />);

    await screen.findByText("siparis_ocr_001.pdf");

    fireEvent.click(screen.getByText("siparis_ocr_001.pdf"));

    expect(await screen.findByRole("dialog", { name: "Kayıt Detayı" })).toBeInTheDocument();
    expect(screen.getByText("Kayıt Detayı")).toBeInTheDocument();

    // Lifecycle olayları görünmeli
    expect(await screen.findByText("Yaşam Döngüsü")).toBeInTheDocument();
    // RECEIVED → OCR_RETRY_PENDING geçişi fixture'da mevcuttur
    expect(screen.getAllByText(/RECEIVED/).length).toBeGreaterThanOrEqual(1);
    // Lifecycle note alanı görünür (fixture'daki 2. olayın note'u)
    expect(screen.getByText("Retry gereği")).toBeInTheDocument();
  });
});
