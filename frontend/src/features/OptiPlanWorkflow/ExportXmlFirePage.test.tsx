// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportXmlFirePage } from "./ExportXmlFirePage";

const workflowMocks = vi.hoisted(() => ({
  getFolderSettings: vi.fn(),
}));

const phase4Mocks = vi.hoisted(() => ({
  getPhase4Queue: vi.fn(),
  getPhase4RecordDetail: vi.fn(),
  getPhase4Manifests: vi.fn(),
  getPhase4FolderHealth: vi.fn(),
  createPhase4Preview: vi.fn(),
  exportPhase4Record: vi.fn(),
  retryPhase4Record: vi.fn(),
}));

const addToast = vi.fn();

vi.mock("../../components/Layout", () => ({
  TopBar: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    addToast,
  }),
}));

vi.mock("../../services/optiplanWorkflowService", () => ({
  optiplanWorkflowService: {
    getFolderSettings: workflowMocks.getFolderSettings,
  },
}));

vi.mock("../../services/phase4Service", () => ({
  PHASE4_MAPPING_CONTRACT: [
    { sourceField: "Malzeme", targetField: "[P_CODE_MAT]" },
    { sourceField: "BOY", targetField: "[P_LENGTH]" },
  ],
  canCreatePhase4Preview: (status: string) => status === "PHASE4_PENDING",
  canRunPhase4Export: (status: string) => status === "PHASE4_PREVIEW_READY" || status === "PHASE4_RETRY_PENDING",
  canRunPhase4Retry: (status: string) => status === "PHASE4_EXPORT_FAILED",
  getPhase4Queue: phase4Mocks.getPhase4Queue,
  getPhase4RecordDetail: phase4Mocks.getPhase4RecordDetail,
  getPhase4Manifests: phase4Mocks.getPhase4Manifests,
  getPhase4FolderHealth: phase4Mocks.getPhase4FolderHealth,
  createPhase4Preview: phase4Mocks.createPhase4Preview,
  exportPhase4Record: phase4Mocks.exportPhase4Record,
  retryPhase4Record: phase4Mocks.retryPhase4Record,
}));

const folderSettingsFixture = {
  whatsappRawKlasoru: "C:/optiplan/raw/whatsapp",
  scannerRawKlasoru: "C:/optiplan/raw/scanner",
  manuelRawKlasoru: "C:/optiplan/raw/manual",
  emailRawKlasoru: "C:/optiplan/raw/email",
  islenmisKlasoru: "C:/optiplan/processed",
  arsivKlasoru: "C:/optiplan/archive",
  xmlOkumaKlasoru: "C:/optiplan/xml",
  xlsxCiktiKlasoru: "C:/optiplan/xlsx",
  opjCiktiKlasoru: "C:/optiplan/opj",
  hataliKlasoru: "C:/optiplan/error",
  fisEvrakNoFormati: "{siparisNo}",
  arsivZamanDamgasiFormati: "yyyyMMdd_HHmmss",
  xlsxAktifMi: true,
  opjAktifMi: false,
  watcherAktifMi: true,
  yenidenDenemeSayisi: 2,
};

const pendingQueueItem = {
  recordId: "rec_phase4_1",
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
  status: "PHASE4_PREVIEW_READY",
};

const exportFailedQueueItem = {
  ...pendingQueueItem,
  status: "PHASE4_EXPORT_FAILED",
  lastErrorMessage: "Dosya kilidi",
  retryCount: 1,
};

const pendingDetail = {
  record: {
    recordId: "rec_phase4_1",
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

const previewReadyDetail = {
  ...pendingDetail,
  record: {
    ...pendingDetail.record,
    status: "PHASE4_PREVIEW_READY",
    previewReady: true,
  },
};

const completedDetail = {
  ...previewReadyDetail,
  record: {
    ...previewReadyDetail.record,
    status: "COMPLETED",
    manifestId: "man_001",
    outputFileName: "siparis_001.xlsx",
  },
};

const exportFailedDetail = {
  ...pendingDetail,
  record: {
    ...pendingDetail.record,
    status: "PHASE4_EXPORT_FAILED",
    phase4Ready: true,
    previewReady: true,
    retryCount: 1,
    lastErrorMessage: "Dosya kilidi",
  },
};

const manifestsFixture = {
  items: [
    {
      manifestId: "man_001",
      recordId: "rec_phase4_1",
      exportType: "XLSX",
      fileName: "manifest_001.json",
      createdAt: "2026-03-18T12:40:00Z",
      status: "CREATED",
    },
  ],
};

const folderHealthFixture = {
  items: [
    { folderType: "phase4_output", healthStatus: "HEALTHY", lastWriteAt: "2026-03-18T12:42:00Z" },
    { folderType: "phase4_preview", healthStatus: "HEALTHY", lastWriteAt: "2026-03-18T12:35:00Z" },
    { folderType: "phase4_manifest_archive", healthStatus: "HEALTHY", lastWriteAt: "2026-03-18T12:40:00Z" },
  ],
};

describe("ExportXmlFirePage", () => {
  beforeEach(() => {
    addToast.mockReset();
    workflowMocks.getFolderSettings.mockResolvedValue(folderSettingsFixture);

    let currentQueueItem = pendingQueueItem;
    let currentDetail = pendingDetail;

    phase4Mocks.getPhase4Queue.mockImplementation(async () => ({ items: [currentQueueItem] }));
    phase4Mocks.getPhase4RecordDetail.mockImplementation(async () => currentDetail);
    phase4Mocks.getPhase4Manifests.mockResolvedValue(manifestsFixture);
    phase4Mocks.getPhase4FolderHealth.mockResolvedValue(folderHealthFixture);
    phase4Mocks.createPhase4Preview.mockImplementation(async () => {
      currentQueueItem = previewReadyQueueItem;
      currentDetail = previewReadyDetail;
      return {
        ok: true,
        recordId: "rec_phase4_1",
        status: "PHASE4_PREVIEW_READY",
        previewData: {
          customerCode: "CARI-001",
          customerName: "Ornek Cari",
          lines: [{ rowIndex: 0, stockCode: "STK-001", boy: "2800" }],
          lineCount: 1,
        },
        errorCode: null,
        message: "Preview created",
      };
    });
    phase4Mocks.exportPhase4Record.mockImplementation(async () => {
      currentDetail = completedDetail;
      return {
        ok: true,
        recordId: "rec_phase4_1",
        status: "COMPLETED",
        exportPath: "exports/siparis_001.xlsx",
        manifestPath: "exports/manifest_001.json",
        manifestId: "man_001",
        outputFileName: "siparis_001.xlsx",
        errorCode: null,
        message: "Export tamamlandi",
      };
    });
    phase4Mocks.retryPhase4Record.mockResolvedValue({
      ok: true,
      recordId: "rec_phase4_1",
      status: "COMPLETED",
      exportPath: "exports/siparis_001.xlsx",
      manifestPath: "exports/manifest_001.json",
      manifestId: "man_001",
      outputFileName: "siparis_001.xlsx",
      errorCode: null,
      message: "Retry tamamlandi",
    });
  });

  it("phase 4 ekranini klasor ve panel baglami ile cizer", async () => {
    render(<ExportXmlFirePage />);

    expect(await screen.findByRole("heading", { name: "OptiPlanning" })).toBeInTheDocument();
    expect(screen.getByText("Phase 4 Kuyruğu")).toBeInTheDocument();
    expect(await screen.findByText("Phase 4 Kayıt Özeti")).toBeInTheDocument();
    expect(screen.getByText("Fire Takip Paneli")).toBeInTheDocument();
    expect(screen.getByText("Klasör Sağlık / Çıktı Hedefleri")).toBeInTheDocument();
    expect((await screen.findAllByText("C:/optiplan/xlsx")).length).toBeGreaterThanOrEqual(1);
  });

  it("mapping drawer kilitli hedef alanlari gosterir", async () => {
    render(<ExportXmlFirePage />);

    await screen.findByText("Phase 4 Kayıt Özeti");
    fireEvent.click(screen.getByRole("button", { name: "Mapping Drawer" }));

    expect(await screen.findByRole("complementary", { name: "Eşleşme Özet Paneli" })).toBeInTheDocument();
    expect(screen.getByText("Optiplanning Default Mapping")).toBeInTheDocument();
    expect(screen.getByText("[P_CODE_MAT]")).toBeInTheDocument();
    expect(screen.getByText("[P_LENGTH]")).toBeInTheDocument();
  });

  it("preview ve export aksiyonlarini kanonik phase4 servisine yollar", async () => {
    render(<ExportXmlFirePage />);

    await screen.findByText("Phase 4 Kayıt Özeti");

    fireEvent.click(screen.getByRole("button", { name: "Önizleme Oluştur" }));
    await waitFor(() => expect(phase4Mocks.createPhase4Preview).toHaveBeenCalledWith("rec_phase4_1"));

    const exportButton = screen.getByRole("button", { name: "Export'u Çalıştır" });
    await waitFor(() => expect(exportButton).toBeEnabled());

    fireEvent.click(exportButton);
    await waitFor(() => expect(phase4Mocks.exportPhase4Record).toHaveBeenCalledWith("rec_phase4_1"));
    expect(await screen.findByText("Phase 4 İşlemi Başarılı")).toBeInTheDocument();
    expect(screen.getAllByText("siparis_001.xlsx").length).toBeGreaterThanOrEqual(1);
  });

  it("retry karari acik degilse butonu disabled reason ile gosterir", async () => {
    render(<ExportXmlFirePage />);

    const retryButton = await screen.findByRole("button", { name: "Retry Başlat" });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute("title", expect.stringContaining("Retry yalnız export hatası sonrasında açılır"));
  });

  it("phase4 hazir degilse export butonu disabled reason gosterir", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [pendingQueueItem] });
    phase4Mocks.getPhase4RecordDetail.mockResolvedValue({
      ...pendingDetail,
      record: {
        ...pendingDetail.record,
        phase4Ready: false,
      },
    });

    render(<ExportXmlFirePage />);

    const exportButton = await screen.findByRole("button", { name: "Export'u Çalıştır" });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("title", expect.stringContaining("Kayıt henüz export-ready değil"));
  });

  it("retry acik oldugunda Retry Now servisi kanonik phase4 endpointine gider", async () => {
    phase4Mocks.getPhase4Queue.mockResolvedValue({ items: [exportFailedQueueItem] });
    phase4Mocks.getPhase4RecordDetail.mockResolvedValue(exportFailedDetail);

    render(<ExportXmlFirePage />);

    const retryButton = await screen.findByRole("button", { name: "Retry Başlat" });
    expect(retryButton).toBeEnabled();

    fireEvent.click(retryButton);
    await waitFor(() => expect(phase4Mocks.retryPhase4Record).toHaveBeenCalledWith("rec_phase4_1"));
  });

  it("manifest drawer manifest ID ve dosya adini gosterir", async () => {
    render(<ExportXmlFirePage />);

    await screen.findByText("Phase 4 Kayıt Özeti");

    fireEvent.click(screen.getByRole("button", { name: "Manifest Drawer" }));

    const drawer = await screen.findByRole("complementary", { name: "Manifest Detay Paneli" });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText("man_001")).toBeInTheDocument();
    expect(screen.getByText("manifest_001.json")).toBeInTheDocument();
  });

  it("folder health WARNING durumunda WARNING etiketi gorunur", async () => {
    phase4Mocks.getPhase4FolderHealth.mockResolvedValue({
      items: [
        { folderType: "phase4_output", healthStatus: "WARNING", lastWriteAt: null },
        { folderType: "phase4_preview", healthStatus: "HEALTHY", lastWriteAt: "2026-03-18T12:35:00Z" },
        { folderType: "phase4_manifest_archive", healthStatus: "OFFLINE", lastWriteAt: null },
      ],
    });

    render(<ExportXmlFirePage />);

    await screen.findByText("Klasör Sağlık / Çıktı Hedefleri");

    expect(await screen.findByText("WARNING")).toBeInTheDocument();
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("fire zorunlu kayıtta Fire Takip Paneli uyari mesaji gosterir", async () => {
    render(<ExportXmlFirePage />);

    await screen.findByText("Fire Takip Paneli");

    // fireRequired: true → uyarı metni görünmeli
    expect(
      await screen.findByText(/Fire izi bu kayıt için zorunlu/),
    ).toBeInTheDocument();

    // InfoCard değeri — hem fireRequired hem phase4Ready "Evet" gösterir
    expect(screen.getAllByText("Evet").length).toBeGreaterThanOrEqual(1);
  });
});
