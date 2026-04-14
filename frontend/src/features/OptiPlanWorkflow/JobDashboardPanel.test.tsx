// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobDashboardPanel } from "./JobDashboardPanel";

/* ---------- Hoisted mocks ---------- */

const phase4Mocks = vi.hoisted(() => ({
  getPhase4Queue: vi.fn(),
  getPhase4RecordDetail: vi.fn(),
  getPhase4FolderHealth: vi.fn(),
  createPhase4Preview: vi.fn(),
  exportPhase4Record: vi.fn(),
  retryPhase4Record: vi.fn(),
}));

vi.mock("../../services/phase4Service", () => ({
  PHASE4_MAPPING_CONTRACT: [
    { sourceField: "Malzeme", targetField: "[P_CODE_MAT]" },
    { sourceField: "BOY", targetField: "[P_LENGTH]" },
  ],
  canCreatePhase4Preview: (status: string) => status === "PHASE4_PENDING",
  canRunPhase4Export: (status: string) =>
    status === "PHASE4_PREVIEW_READY" || status === "PHASE4_RETRY_PENDING",
  canRunPhase4Retry: (status: string) => status === "PHASE4_EXPORT_FAILED",
  getPhase4Queue: phase4Mocks.getPhase4Queue,
  getPhase4RecordDetail: phase4Mocks.getPhase4RecordDetail,
  getPhase4FolderHealth: phase4Mocks.getPhase4FolderHealth,
  createPhase4Preview: phase4Mocks.createPhase4Preview,
  exportPhase4Record: phase4Mocks.exportPhase4Record,
  retryPhase4Record: phase4Mocks.retryPhase4Record,
}));

vi.mock("./phase4Constants", () => ({
  STATUS_LABEL: {
    PHASE4_PENDING: "Phase 4 Hazır",
    PHASE4_PREVIEW_READY: "Preview Hazır",
    PHASE4_EXPORT_RUNNING: "Export Çalışıyor",
    PHASE4_EXPORT_FAILED: "Export Hatalı",
    PHASE4_RETRY_PENDING: "Retry Bekliyor",
    COMPLETED: "Export Başarılı",
  } as Record<string, string>,
  STATUS_COLOR: {
    PHASE4_PENDING: "#0078D4",
    PHASE4_PREVIEW_READY: "#0f766e",
    PHASE4_EXPORT_RUNNING: "#F59E0B",
    PHASE4_EXPORT_FAILED: "#EF4444",
    PHASE4_RETRY_PENDING: "#7c3aed",
    COMPLETED: "#10B981",
  } as Record<string, string>,
  STATUS_PRIORITY: {
    PHASE4_PENDING: 0,
    PHASE4_PREVIEW_READY: 1,
    PHASE4_EXPORT_RUNNING: 2,
    PHASE4_EXPORT_FAILED: 3,
    PHASE4_RETRY_PENDING: 4,
    COMPLETED: 5,
  } as Record<string, number>,
  PIPELINE_ORDER: [
    "PHASE4_PENDING",
    "PHASE4_PREVIEW_READY",
    "PHASE4_EXPORT_RUNNING",
    "COMPLETED",
  ],
  formatPhase4Date: (v: string | null) => v ?? "-",
  sortPhase4Queue: <T extends { status: string; updatedAt: string }>(items: T[]): T[] => {
    const prio: Record<string, number> = {
      PHASE4_PENDING: 0, PHASE4_PREVIEW_READY: 1, PHASE4_EXPORT_RUNNING: 2,
      PHASE4_EXPORT_FAILED: 3, PHASE4_RETRY_PENDING: 4, COMPLETED: 5,
    };
    return [...items].sort((a, b) => {
      const p = (prio[a.status] ?? 99) - (prio[b.status] ?? 99);
      if (p !== 0) return p;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },
  healthColor: (s: string) => {
    if (s === "HEALTHY") return "#10B981";
    if (s === "WARNING") return "#F59E0B";
    if (s === "ERROR") return "#EF4444";
    return "#999";
  },
}));

/* ---------- Fixtures ---------- */

const pendingQueueItem = {
  recordId: "rec_001",
  status: "PHASE4_PENDING",
  customerCode: "CARI-001",
  documentName: "siparis_001.pdf",
  exportType: "XLSX",
  manifestId: null,
  retryCount: 0,
  lastErrorMessage: null,
  fireRequired: true,
  updatedAt: "2026-03-18T12:30:00Z",
};

const previewReadyQueueItem = {
  ...pendingQueueItem,
  recordId: "rec_002",
  status: "PHASE4_PREVIEW_READY",
  documentName: "siparis_002.pdf",
};

const exportFailedQueueItem = {
  ...pendingQueueItem,
  recordId: "rec_003",
  status: "PHASE4_EXPORT_FAILED",
  documentName: "siparis_003.pdf",
  retryCount: 1,
  lastErrorMessage: "Dosya kilidi",
};

const completedQueueItem = {
  ...pendingQueueItem,
  recordId: "rec_004",
  status: "COMPLETED",
  documentName: "siparis_004.pdf",
};

const retryPendingQueueItem = {
  ...pendingQueueItem,
  recordId: "rec_005",
  status: "PHASE4_RETRY_PENDING",
  documentName: "siparis_005.pdf",
  retryCount: 1,
};

const folderHealthFixture = {
  items: [
    { folderType: "phase4_output", healthStatus: "HEALTHY", lastWriteAt: "2026-03-18T12:42:00Z" },
    { folderType: "phase4_preview", healthStatus: "WARNING", lastWriteAt: "2026-03-18T12:35:00Z" },
  ],
};

function makePendingDetail(recordId = "rec_001") {
  return {
    record: {
      recordId,
      status: "PHASE4_PENDING",
      customerCode: "CARI-001",
      exportType: "XLSX",
      outputFileName: null,
      previewReady: false,
      manifestId: null,
      retryCount: 0,
      lastErrorMessage: null,
      fireRequired: true,
      phase4Ready: true,
    },
    mappingSummary: {
      locked: true,
      profileName: "Optiplanning Default Mapping",
    },
    folderHealth: {
      outputFolderStatus: "HEALTHY",
      previewFolderStatus: "HEALTHY",
      manifestArchiveStatus: "HEALTHY",
      lastWriteAt: "2026-03-18T12:31:00Z",
    },
  };
}

function makePreviewReadyDetail(recordId = "rec_002") {
  const d = makePendingDetail(recordId);
  d.record.status = "PHASE4_PREVIEW_READY";
  d.record.previewReady = true;
  return d;
}

function makeExportFailedDetail(recordId = "rec_003") {
  const d = makePendingDetail(recordId);
  d.record.recordId = recordId;
  d.record.status = "PHASE4_EXPORT_FAILED";
  d.record.retryCount = 1;
  d.record.lastErrorMessage = "Dosya kilidi hatasi";
  return d;
}

/* ---------- Tests ---------- */

describe("JobDashboardPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    phase4Mocks.getPhase4Queue.mockResolvedValue({
      items: [
        pendingQueueItem,
        previewReadyQueueItem,
        exportFailedQueueItem,
        completedQueueItem,
      ],
    });
    phase4Mocks.getPhase4FolderHealth.mockResolvedValue(folderHealthFixture);
    phase4Mocks.getPhase4RecordDetail.mockImplementation(
      async (id: string) => {
        if (id === "rec_002") return makePreviewReadyDetail();
        if (id === "rec_003") return makeExportFailedDetail();
        return makePendingDetail(id);
      },
    );
    phase4Mocks.createPhase4Preview.mockResolvedValue({ ok: true, recordId: "rec_001" });
    phase4Mocks.exportPhase4Record.mockResolvedValue({ ok: true, recordId: "rec_002" });
    phase4Mocks.retryPhase4Record.mockResolvedValue({ ok: true, recordId: "rec_003" });
  });

  it("shows loading text initially, then renders Job Dashboard heading", async () => {
    render(<JobDashboardPanel />);
    expect(screen.getByText("Phase 4 kuyruk yükleniyor...")).toBeInTheDocument();
    expect(await screen.findByText("Job Dashboard")).toBeInTheDocument();
  });

  it("renders queue items with record ID, document name, status badge", async () => {
    render(<JobDashboardPanel />);
    expect(await screen.findByText("rec_001")).toBeInTheDocument();
    expect(screen.getByText("siparis_001.pdf")).toBeInTheDocument();
    expect(screen.getByText("siparis_002.pdf")).toBeInTheDocument();
    expect(screen.getByText("rec_002")).toBeInTheDocument();
    // Status badges present
    expect(screen.getAllByText("Phase 4 Hazır").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Preview Hazır").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Kuyrukta kayıt yok.' when queue is empty", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [] });
    render(<JobDashboardPanel />);
    expect(await screen.findByText("Kuyrukta kayıt yok.")).toBeInTheDocument();
  });

  it("shows pipeline status count badges", async () => {
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    // PIPELINE_ORDER: PHASE4_PENDING, PHASE4_PREVIEW_READY, PHASE4_EXPORT_RUNNING, COMPLETED
    // Fixture: 1 pending, 1 preview_ready, 1 export_failed (not in pipeline order), 1 completed
    expect(screen.getByText("Phase 4 Hazır 1")).toBeInTheDocument();
    expect(screen.getByText("Preview Hazır 1")).toBeInTheDocument();
    expect(screen.getByText("Export Çalışıyor 0")).toBeInTheDocument();
    expect(screen.getByText("Export Başarılı 1")).toBeInTheDocument();
    // Conditional failed badge
    expect(screen.getByText("Hatalı 1")).toBeInTheDocument();
  });

  it("shows folder health indicators", async () => {
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    // folderType "phase4_output" -> replace("phase4_", "") -> "output"
    expect(screen.getByText("output")).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(screen.getByText("preview")).toBeInTheDocument();
    expect(screen.getByText("WARNING")).toBeInTheDocument();
  });

  it("preview button enabled only for PHASE4_PENDING status", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [pendingQueueItem] });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    const previewBtns = screen.getAllByLabelText("Önizleme oluştur");
    // Row button should be enabled
    expect(previewBtns[0]).toBeEnabled();
  });

  it("preview button disabled for non-PHASE4_PENDING status", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [previewReadyQueueItem] });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    const previewBtns = screen.getAllByLabelText("Önizleme oluştur");
    expect(previewBtns[0]).toBeDisabled();
  });

  it("export button enabled for PHASE4_PREVIEW_READY or PHASE4_RETRY_PENDING", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({
      items: [previewReadyQueueItem, retryPendingQueueItem],
    });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    const exportBtns = screen.getAllByLabelText("Export çalıştır");
    // Row buttons for both should be enabled
    expect(exportBtns[0]).toBeEnabled();
    expect(exportBtns[1]).toBeEnabled();
  });

  it("export button disabled for PHASE4_PENDING status", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [pendingQueueItem] });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    const exportBtns = screen.getAllByLabelText("Export çalıştır");
    expect(exportBtns[0]).toBeDisabled();
  });

  it("retry button enabled only for PHASE4_EXPORT_FAILED status", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [exportFailedQueueItem] });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    const retryBtns = screen.getAllByLabelText("Tekrar dene");
    expect(retryBtns[0]).toBeEnabled();
  });

  it("retry button disabled for non-PHASE4_EXPORT_FAILED status", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [pendingQueueItem] });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    const retryBtns = screen.getAllByLabelText("Tekrar dene");
    expect(retryBtns[0]).toBeDisabled();
  });

  it("clicking a queue row shows detail panel with record info", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({
      items: [pendingQueueItem, previewReadyQueueItem],
    });
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    // First record auto-selected (pending sorted first)
    expect(await screen.findByText(/Seçili Kayıt.*rec_001/)).toBeInTheDocument();

    // Click on second record row
    fireEvent.click(screen.getByText("rec_002"));

    await waitFor(() => {
      expect(screen.getByText(/Seçili Kayıt.*rec_002/)).toBeInTheDocument();
    });
    expect(phase4Mocks.getPhase4RecordDetail).toHaveBeenCalledWith("rec_002");
  });

  it("shows error message when API fails", async () => {
    phase4Mocks.getPhase4Queue.mockRejectedValue(new Error("Sunucu hatasi"));
    render(<JobDashboardPanel />);

    expect(await screen.findByText("Sunucu hatasi")).toBeInTheDocument();
  });

  it("clicking Yenile calls refresh", async () => {
    render(<JobDashboardPanel />);
    await screen.findByText("Job Dashboard");

    expect(phase4Mocks.getPhase4Queue).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Yenile"));

    await waitFor(() =>
      expect(phase4Mocks.getPhase4Queue).toHaveBeenCalledTimes(2),
    );
  });

  it("detail panel shows customer code, mapping profile and phase4Ready", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [pendingQueueItem] });
    render(<JobDashboardPanel />);

    // Wait for detail to load (first item auto-selected)
    expect(await screen.findByText("CARI-001")).toBeInTheDocument();
    expect(screen.getByText("Optiplanning Default Mapping")).toBeInTheDocument();
    // phase4Ready=true and mapping locked=true both render "Evet"
    expect(screen.getAllByText("Evet").length).toBe(2);
  });

  it("detail panel shows lastErrorMessage when present", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [exportFailedQueueItem] });
    phase4Mocks.getPhase4RecordDetail.mockResolvedValue(makeExportFailedDetail("rec_003"));
    render(<JobDashboardPanel />);

    expect(await screen.findByText("Dosya kilidi hatasi")).toBeInTheDocument();
  });
});
