import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SystemBackbonePage from "./SystemBackbonePage";

const getOverviewMock = vi.fn();
const listFlowsMock = vi.fn();
const createFlowMock = vi.fn();
const advanceFlowMock = vi.fn();
const getPhaseTodoMock = vi.fn();
const getRoadmapMock = vi.fn();
const getPackageStatusMock = vi.fn();
const runFoundationPackageMock = vi.fn();
const runStabilizationPackageMock = vi.fn();
const runChainPackageMock = vi.fn();
const bootstrapCoreStructureMock = vi.fn();
const applyHardeningMock = vi.fn();

vi.mock("../../components/Layout", () => ({
  TopBar: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock("../../components/Shared", () => ({
  Card: ({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
  Button: ({ children, onClick, disabled, size, variant }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; size?: string; variant?: string }) => (
    <button data-size={size} data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("../../services/systemBackboneService", () => ({
  systemBackboneService: {
    getOverview: (...args: unknown[]) => getOverviewMock(...args),
    listFlows: (...args: unknown[]) => listFlowsMock(...args),
    createFlow: (...args: unknown[]) => createFlowMock(...args),
    advanceFlow: (...args: unknown[]) => advanceFlowMock(...args),
    getPhaseTodo: (...args: unknown[]) => getPhaseTodoMock(...args),
    getRoadmap: (...args: unknown[]) => getRoadmapMock(...args),
    getPackageStatus: (...args: unknown[]) => getPackageStatusMock(...args),
    runFoundationPackage: (...args: unknown[]) => runFoundationPackageMock(...args),
    runStabilizationPackage: (...args: unknown[]) => runStabilizationPackageMock(...args),
    runChainPackage: (...args: unknown[]) => runChainPackageMock(...args),
    bootstrapCoreStructure: (...args: unknown[]) => bootstrapCoreStructureMock(...args),
    applyHardening: (...args: unknown[]) => applyHardeningMock(...args),
  },
}));

describe("SystemBackbonePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOverviewMock.mockResolvedValue({
      generatedAt: "2026-03-12T00:00:00Z",
      totalFlows: 1,
      statusSummary: { PENDING: 1 },
      stageSummary: { foundation: 1, stabilization: 0, completed: 0 },
    });
    listFlowsMock.mockResolvedValue({
      data: [
        {
          id: "flow-1",
          flowName: "core-working-structure",
          entityType: "order",
          entityId: "foundation-001",
          externalId: "order-foundation-001-1-0-2026",
          companyId: 1,
          branchId: 0,
          fiscalYear: 2026,
          sourceSystem: "optiplan360",
          targetSystem: "mikro",
          status: "PENDING",
          stage: "foundation",
          retryCount: 0,
          maxRetries: 3,
          retryCooldownSeconds: 0,
          lastError: null,
          metadataJson: "{}",
          lastRetryAt: null,
          nextRetryAt: null,
          createdBy: 1,
          updatedBy: 1,
          createdAt: "2026-03-12T00:00:00Z",
          updatedAt: "2026-03-12T00:00:00Z",
        },
      ],
      total: 1,
    });
    createFlowMock.mockResolvedValue({ id: "flow-2" });
    advanceFlowMock.mockResolvedValue({ id: "flow-1" });
    getPhaseTodoMock.mockResolvedValue({
      phase: "core",
      todos: [{ order: 1, title: "Klasör", status: "pending", detail: "bekliyor" }],
    });
    getRoadmapMock.mockResolvedValue({
      companyId: 1,
      branchId: 0,
      fiscalYear: 2026,
      tamamlananAnaYapi: [],
      anaYapiEksikleri: ["1. Klasör yapısı"],
      tamamlananSertlestirmeTest: [],
      sertlestirmeTestEksikleri: ["1. Test kapsamı"],
    });
    getPackageStatusMock.mockResolvedValue({
      companyId: 1,
      branchId: 0,
      fiscalYear: 2026,
      generatedAt: "2026-03-12T00:00:00Z",
      watcherEnabled: true,
      warnings: [],
      flowCount: 5,
      workflowRecordCount: 1,
      phaseCounts: { phase_1: 1, phase_2: 0, phase_3: 0, phase_4: 0 },
      statusCounts: { PHASE_1_OCR_HAVUZU: 1 },
      lastPackageRun: {
        package: "foundation",
        eventType: "FLOW_CREATED",
        at: "2026-03-12T00:00:00Z",
        userId: 1,
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
      },
      roadmap: {
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
        tamamlananAnaYapi: [],
        anaYapiEksikleri: ["1. Klasör yapısı"],
        tamamlananSertlestirmeTest: [],
        sertlestirmeTestEksikleri: ["1. Test kapsamı"],
      },
    });
    runFoundationPackageMock.mockResolvedValue({
      package: "foundation",
      generatedAt: "2026-03-12T00:01:00Z",
      watcherEnabled: true,
      warnings: [],
      flowCount: 5,
      workflowRecordCount: 1,
      phaseCounts: { phase_1: 1 },
      statusCounts: { PHASE_1_OCR_HAVUZU: 1 },
      lastPackageRun: {
        package: "foundation",
        eventType: "FLOW_CREATED",
        at: "2026-03-12T00:01:00Z",
        userId: 1,
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
      },
      roadmap: {
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
        tamamlananAnaYapi: ["1. Klasör"],
        anaYapiEksikleri: [],
        tamamlananSertlestirmeTest: [],
        sertlestirmeTestEksikleri: ["1. Retry"],
      },
      workflowScan: { mode: "WATCHER_SCAN", ingested_count: 0 },
    });
    runStabilizationPackageMock.mockResolvedValue({
      package: "stabilization",
      generatedAt: "2026-03-12T00:02:00Z",
      watcherEnabled: true,
      warnings: [],
      flowCount: 5,
      workflowRecordCount: 1,
      phaseCounts: { phase_1: 1 },
      statusCounts: { PHASE_1_OCR_HAVUZU: 1 },
      lastPackageRun: {
        package: "stabilization",
        eventType: "FLOW_HARDENING_APPLIED",
        at: "2026-03-12T00:02:00Z",
        userId: 1,
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
      },
      roadmap: {
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
        tamamlananAnaYapi: ["1. Klasör"],
        anaYapiEksikleri: [],
        tamamlananSertlestirmeTest: ["1. Retry"],
        sertlestirmeTestEksikleri: [],
      },
    });
    runChainPackageMock.mockResolvedValue({
      package: "chain",
      chainId: "chain-001",
      generatedAt: "2026-03-12T00:03:00Z",
      watcherEnabled: true,
      warnings: [],
      flowCount: 5,
      workflowRecordCount: 1,
      totalDurationMs: 200,
      failedStep: null,
      phaseCounts: { phase_1: 1 },
      statusCounts: { PHASE_1_OCR_HAVUZU: 1 },
      lastPackageRun: {
        package: "stabilization",
        eventType: "FLOW_HARDENING_APPLIED",
        at: "2026-03-12T00:03:00Z",
        userId: 1,
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
      },
      roadmap: {
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
        tamamlananAnaYapi: ["1. Klasör"],
        anaYapiEksikleri: [],
        tamamlananSertlestirmeTest: ["1. Retry"],
        sertlestirmeTestEksikleri: [],
      },
      workflowScan: { mode: "WATCHER_SCAN", ingested_count: 0 },
      hardening: { summary: { hardened: 5, total: 5 } },
      chainSteps: [
        { step: "foundation", generatedAt: "2026-03-12T00:01:00Z", flowCount: 5, durationMs: 120 },
        { step: "stabilization", generatedAt: "2026-03-12T00:03:00Z", flowCount: 5, durationMs: 80 },
      ],
    });
    bootstrapCoreStructureMock.mockResolvedValue({
      phase: "core",
      summary: { created: 5, reused: 0, total: 5 },
      flowIds: ["flow-1"],
      todos: [{ order: 1, title: "Klasör", status: "done", detail: "ok" }],
    });
    applyHardeningMock.mockResolvedValue({
      phase: "hardening",
      summary: { hardened: 5, total: 5 },
      flowIds: ["flow-1"],
      todos: [{ order: 1, title: "Retry", status: "done", detail: "ok" }],
    });
  });

  it("load sırasında context filtreleriyle overview ve liste çağrısı yapar", async () => {
    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(getOverviewMock).toHaveBeenCalledWith({ companyId: 1, branchId: 0, fiscalYear: 2026 });
      expect(listFlowsMock).toHaveBeenCalledWith({ companyId: 1, branchId: 0, fiscalYear: 2026 });
      expect(getPhaseTodoMock).toHaveBeenCalledWith("core", { companyId: 1, branchId: 0, fiscalYear: 2026 });
      expect(getRoadmapMock).toHaveBeenCalledWith({ companyId: 1, branchId: 0, fiscalYear: 2026 });
      expect(getPackageStatusMock).toHaveBeenCalledWith({ companyId: 1, branchId: 0, fiscalYear: 2026 });
    });
  });

  it("flow oluştururken external id ve context alanlarını gönderir", async () => {
    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(getOverviewMock).toHaveBeenCalled();
      expect(listFlowsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText("entity id"), { target: { value: "foundation-777" } });
    fireEvent.click(screen.getByRole("button", { name: "Flow Oluştur" }));

    await waitFor(() => {
      expect(createFlowMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: "foundation-777",
          externalId: "order-foundation-777-1-0-2026",
          companyId: 1,
          branchId: 0,
          fiscalYear: 2026,
        }),
      );
    });
  });

  it("faz butonları core ve hardening çağrılarını yapar", async () => {
    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(getOverviewMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Faz-1 Core Bootstrap" }));

    await waitFor(() => {
      expect(bootstrapCoreStructureMock).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, branchId: 0, fiscalYear: 2026 }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Faz-2 Hardening" }));

    await waitFor(() => {
      expect(applyHardeningMock).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, branchId: 0, fiscalYear: 2026 }),
      );
    });
  });

  it("paket butonları foundation ve stabilization çağrılarını yapar", async () => {
    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(getOverviewMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Foundation Paketi Çalıştır" }));

    await waitFor(() => {
      expect(runFoundationPackageMock).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, branchId: 0, fiscalYear: 2026 }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Stabilization Paketi Çalıştır" }));

    await waitFor(() => {
      expect(runStabilizationPackageMock).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, branchId: 0, fiscalYear: 2026 }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Foundation+Stabilization Çalıştır" }));

    await waitFor(() => {
      expect(runChainPackageMock).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, branchId: 0, fiscalYear: 2026 }),
      );
    });
  });

  it("chain butonu sadece runChainPackage çağırır ve chain özetini gösterir", async () => {
    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(getOverviewMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Foundation+Stabilization Çalıştır" }));

    await waitFor(() => {
      expect(runChainPackageMock).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, branchId: 0, fiscalYear: 2026 }),
      );
      expect(runFoundationPackageMock).toHaveBeenCalledTimes(0);
      expect(runStabilizationPackageMock).toHaveBeenCalledTimes(0);
      expect(screen.getByText(/Son Chain Çalıştırma:/)).toBeInTheDocument();
      expect(screen.getByText(/chain-001/)).toBeInTheDocument();
      expect(screen.getByText(/toplam:200ms/)).toBeInTheDocument();
    });
  });

  it("ana yapı ve sertleştirme eksik bloklarını render eder", async () => {
    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(screen.getByText("Ana Yapı Eksikleri")).toBeInTheDocument();
      expect(screen.getByText("Sertleştirme/Test Eksikleri")).toBeInTheDocument();
      expect(screen.getByText("1. Klasör yapısı")).toBeInTheDocument();
      expect(screen.getByText("1. Test kapsamı")).toBeInTheDocument();
      expect(screen.getByText(/Son Paket Durumu Üretim Zamanı:/)).toBeInTheDocument();
      expect(screen.getByText(/Son Paket Çalıştırma:/)).toBeInTheDocument();
      expect(screen.getByText(/Watcher Durumu:/)).toBeInTheDocument();
      expect(screen.getByText(/Core Flow Sayısı:/)).toBeInTheDocument();
    });
  });

  it("watcher kapalı foundation sonucunda uyarı gösterir", async () => {
    runFoundationPackageMock.mockResolvedValueOnce({
      package: "foundation",
      generatedAt: "2026-03-12T00:01:00Z",
      watcherEnabled: false,
      warnings: ["WATCHER_DISABLED: Foundation paketinde scan adımı atlandı"],
      flowCount: 5,
      workflowRecordCount: 1,
      phaseCounts: { phase_1: 1 },
      statusCounts: { PHASE_1_OCR_HAVUZU: 1 },
      lastPackageRun: {
        package: "foundation",
        eventType: "FLOW_CREATED",
        at: "2026-03-12T00:01:00Z",
        userId: 1,
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
      },
      roadmap: {
        companyId: 1,
        branchId: 0,
        fiscalYear: 2026,
        tamamlananAnaYapi: ["1. Klasör"],
        anaYapiEksikleri: [],
        tamamlananSertlestirmeTest: [],
        sertlestirmeTestEksikleri: ["1. Retry"],
      },
      workflowScan: { mode: "WATCHER_DISABLED", ingested_count: 0 },
    });

    render(<SystemBackbonePage />);

    await waitFor(() => {
      expect(getOverviewMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Foundation Paketi Çalıştır" }));

    await waitFor(() => {
      expect(screen.getByText("Watcher kapalı: foundation paketi scan adımı atlandı.")).toBeInTheDocument();
    });
  });
});
