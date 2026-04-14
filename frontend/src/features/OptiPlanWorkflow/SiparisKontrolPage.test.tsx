import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SiparisKontrolPage } from "./SiparisKontrolPage";
import * as phase3Service from "../../services/phase3Service";

/** Ribbon sekmesine geçiş helper'ı */
function switchRibbonTab(tabLabel: string) {
  const tabs = screen.getAllByRole("tab");
  const target = tabs.find((t) => t.textContent === tabLabel);
  if (target) fireEvent.click(target);
}

// Phase 3 servis canlı veri çekmeye çalışır  ile reddet  ile demo moduna düşsün
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

// Loading state geçmek için timer'ı hızlandır
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  vi.mocked(phase3Service.getPhase3Queue).mockImplementation(
    () => new Promise((_, reject) => setTimeout(() => reject(new Error("test: demo mode")), 0)),
  );
  vi.mocked(phase3Service.getPhase3RecordDetail).mockRejectedValue(new Error("test: demo mode"));
  vi.mocked(phase3Service.matchCustomer).mockResolvedValue({
    ok: true,
    recordId: "REC-DEMO",
    customerCode: "CARI-001",
    customerName: "Demo Cari",
    customerMatchStatus: "MATCHED",
  });
  vi.mocked(phase3Service.matchStock).mockResolvedValue({
    ok: true,
    recordId: "REC-DEMO",
    rowIndex: 0,
    stockCode: "STK-001",
    stockMatchStatus: "MATCHED",
    unmatchedCount: 0,
  });
  vi.mocked(phase3Service.mergeRows).mockResolvedValue({
    ok: true,
    recordId: "REC-DEMO",
    targetRowIndex: 0,
    mergedRowIndexes: [0],
    totalAdet: 1,
  });
  vi.mocked(phase3Service.addScrapNote).mockResolvedValue({
    ok: true,
    recordId: "REC-DEMO",
    note: "demo",
    affectedRowCount: 1,
    scrapNoteRequired: true,
  });
  vi.mocked(phase3Service.moveToPhase4).mockResolvedValue({
    ok: true,
    recordId: "REC-DEMO",
  });
  vi.mocked(phase3Service.lookupCustomers).mockResolvedValue([]);
  vi.mocked(phase3Service.lookupStocks).mockResolvedValue([]);
  vi.mocked(phase3Service.updatePhase3Draft).mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderLoaded() {
  const utils = render(<SiparisKontrolPage />);
  // Servis reject  ile catch  ile demo fallback  ile setLoading(false)
  await act(async () => {
    vi.runAllTimersAsync && await vi.runAllTimersAsync();
  });
  // Loading bitmesini bekle
  await waitFor(() => {
    expect(screen.queryByText(/Sipariş verileri yükleniyor/)).toBeNull();
  });
  return utils;
}
function mockLivePhase3Context(overrides?: {
  recordId?: string;
  uuid?: string;
  customerMatchStatus?: "MATCHED" | "UNMATCHED";
  customerCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  fireAciklamasi?: string | null;
  stockMatchStatus?: "MATCHED" | "UNMATCHED";
  stockCode?: string | null;
}) {
  const recordId = overrides?.recordId ?? "REC-LIVE";
  const uuid = overrides?.uuid ?? "uuid-live";
  const customerMatchStatus = overrides?.customerMatchStatus ?? "UNMATCHED";
  const customerCode = overrides?.customerCode ?? null;
  const customerName = overrides?.customerName ?? null;
  const customerPhone = overrides?.customerPhone ?? null;
  const stockMatchStatus = overrides?.stockMatchStatus ?? "UNMATCHED";
  const stockCode = overrides?.stockCode ?? null;

  vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
    items: [
      {
        recordId,
        uuid,
        fileName: recordId.toLowerCase() + ".pdf",
        sourceType: "MANUAL",
        folderType: "MANUEL",
        status: "PHASE3_IN_PROGRESS",
        duplicateFlag: false,
        duplicateReason: null,
        retryCount: 0,
        lastErrorMessage: null,
        createdAt: "2026-03-22T09:00:00Z",
        updatedAt: "2026-03-22T09:05:00Z",
        nextRetryAt: null,
        phase2Ready: true,
      },
    ],
    page: 1,
    pageSize: 25,
    total: 1,
  });

  vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
    header: {
      recordId,
      customerMatchStatus,
      customerCode,
      customerName,
      customerPhone,
      fireAciklamasi: overrides?.fireAciklamasi ?? null,
      sourceType: "MANUAL",
      operatorName: "Operator",
      updatedAt: "2026-03-22T09:05:00Z",
    },
    plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
    lines: [
      {
        rowIndex: 0,
        plateId: "P1",
        materialText: "18mm Sunta Beyaz",
        stockMatchStatus,
        stockCode,
        boy: "100",
        en: "50",
        adet: 1,
        yon: "Boy",
        aciklama: "",
        bantUst: null,
        bantAlt: null,
        bantSol: null,
        bantSag: null,
        ilaveAciklama: "",
        aciklama1: "",
        mergeCandidate: false,
        scrapNoteRequired: false,
        scrapNote: null,
        status: "READY",
      },
    ],
    summary: {
      customerBlocker: customerMatchStatus !== "MATCHED",
      stockBlockerCount: stockMatchStatus === "MATCHED" ? 0 : 1,
      mergePendingCount: 0,
      scrapNoteMissingCount: 0,
      phase4Ready: customerMatchStatus === "MATCHED" && stockMatchStatus === "MATCHED",
    },
  });
}

describe("SiparisKontrolPage", () => {
  it("canlı modda canonical phase3 queue/detail yükler ve cari eşleştirmeyi recordId ile yapar", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-001",
          uuid: "uuid-001",
          fileName: "siparis-001.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-001",
        customerMatchStatus: "UNMATCHED",
        customerCode: null,
        customerName: null,
        customerPhone: "05321234567",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [
        {
          plateId: "P1",
          label: "Plaka 1",
          lineCount: 1,
          blockerCount: 1,
          active: true,
        },
      ],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: "0.4",
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: true,
        stockBlockerCount: 0,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });
    vi.mocked(phase3Service.matchCustomer).mockResolvedValue({
      ok: true,
      recordId: "REC-001",
      customerCode: "CARI-003",
      customerName: "Artema Orman",
      customerMatchStatus: "MATCHED",
    });

    await renderLoaded();

    expect(phase3Service.getPhase3Queue).toHaveBeenCalled();
    expect(phase3Service.getPhase3RecordDetail).toHaveBeenCalledWith("REC-001");
    expect(screen.getByText("05321234567")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.getByText("MANUAL")).toBeInTheDocument();

    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    fireEvent.click(screen.getAllByText("CARI-003")[0]);

    await waitFor(() => {
      expect(phase3Service.matchCustomer).toHaveBeenCalledWith("REC-001", "CARI-003");
    });
  });
  it("canlı modda kayıt seçici değişince yeni phase3 detayını yükler", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-001",
          uuid: "uuid-001",
          fileName: "siparis-001.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
        {
          recordId: "REC-002",
          uuid: "uuid-002",
          fileName: "siparis-002.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_PENDING",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:10:00Z",
          updatedAt: "2026-03-22T09:12:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 2,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail)
      .mockResolvedValueOnce({
        header: {
          recordId: "REC-001",
          customerMatchStatus: "MATCHED",
          customerCode: "CARI-001",
          customerName: "Demo Cari 1",
          sourceType: "MANUAL",
          operatorName: "Operator",
          updatedAt: "2026-03-22T09:05:00Z",
        },
        plateGroups: [
          { plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 0, active: true },
        ],
        lines: [
          {
            rowIndex: 0,
            plateId: "P1",
            materialText: "18mm Sunta Beyaz",
            stockMatchStatus: "MATCHED",
            stockCode: "STK-001",
            boy: "100",
            en: "50",
            adet: 1,
            yon: "Boy",
            aciklama: "",
            bantUst: null,
            bantAlt: null,
            bantSol: null,
            bantSag: null,
            ilaveAciklama: "",
            aciklama1: "",
            mergeCandidate: false,
            scrapNoteRequired: false,
            scrapNote: null,
            status: "READY",
          },
        ],
        summary: {
          customerBlocker: false,
          stockBlockerCount: 0,
          mergePendingCount: 0,
          scrapNoteMissingCount: 0,
          phase4Ready: true,
        },
      })
      .mockResolvedValueOnce({
        header: {
          recordId: "REC-002",
          customerMatchStatus: "MATCHED",
          customerCode: "CARI-002",
          customerName: "Demo Cari 2",
          sourceType: "MANUAL",
          operatorName: "Operator",
          updatedAt: "2026-03-22T09:12:00Z",
        },
        plateGroups: [
          { plateId: "P2", label: "Plaka 2", lineCount: 1, blockerCount: 0, active: true },
        ],
        lines: [
          {
            rowIndex: 0,
            plateId: "P2",
            materialText: "MDF Lake",
            stockMatchStatus: "MATCHED",
            stockCode: "STK-002",
            boy: "200",
            en: "80",
            adet: 2,
            yon: "En",
            aciklama: "",
            bantUst: null,
            bantAlt: null,
            bantSol: null,
            bantSag: null,
            ilaveAciklama: "",
            aciklama1: "",
            mergeCandidate: false,
            scrapNoteRequired: false,
            scrapNote: null,
            status: "READY",
          },
        ],
        summary: {
          customerBlocker: false,
          stockBlockerCount: 0,
          mergePendingCount: 0,
          scrapNoteMissingCount: 0,
          phase4Ready: true,
        },
      });

    await renderLoaded();

    fireEvent.change(screen.getByRole("combobox", { name: "Aktif kayıt seç" }), {
      target: { value: "uuid-002" },
    });

    await waitFor(() => {
      expect(phase3Service.getPhase3RecordDetail).toHaveBeenCalledWith("REC-002");
    });
  });
  it("canlı modda backend summary blocker metriklerini kullanır", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-003",
          uuid: "uuid-003",
          fileName: "siparis-003.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-003",
        customerMatchStatus: "MATCHED",
        customerCode: "CARI-003",
        customerName: "Demo Cari 3",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [
        {
          plateId: "P1",
          label: "Plaka 1",
          lineCount: 1,
          blockerCount: 1,
          active: true,
        },
      ],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: false,
        stockBlockerCount: 1,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });

    await renderLoaded();

    const phase4Button = screen.getByRole("button", { name: /Phase 4/i });
    expect(phase4Button).toBeDisabled();
    expect(phase4Button.getAttribute("title") || "").toMatch(/1 satırda stok eşleşmesi eksik/i);
  });
  it("canlı modda Phase 4 geçiş reddi backend mesajını gösterir", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-002",
          uuid: "uuid-002",
          fileName: "siparis-002.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-002",
        customerMatchStatus: "MATCHED",
        customerCode: "CARI-001",
        customerName: "Demo Cari",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [
        {
          plateId: "P1",
          label: "Plaka 1",
          lineCount: 1,
          blockerCount: 0,
          active: true,
        },
      ],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: false,
        stockBlockerCount: 0,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: true,
      },
    });
    vi.mocked(phase3Service.moveToPhase4).mockResolvedValue({
      ok: false,
      recordId: "REC-002",
      errorCode: "PHASE3_BLOCKER_ACTIVE",
      message: "Backend blocker: export hazir degil",
      status: "PHASE3_IN_PROGRESS",
    });

    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: /Phase 4/i }));

    await waitFor(() => {
      expect(screen.getByText("Backend blocker: export hazir degil")).toBeTruthy();
    });
  });
  it("canlı modda taslak kaydı blockerları kaldırmadan uyarı verir", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-004",
          uuid: "uuid-004",
          fileName: "siparis-004.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-004",
        customerMatchStatus: "UNMATCHED",
        customerCode: null,
        customerName: null,
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [
        {
          plateId: "P1",
          label: "Plaka 1",
          lineCount: 1,
          blockerCount: 1,
          active: true,
        },
      ],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: true,
        stockBlockerCount: 0,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });
    vi.mocked(phase3Service.updatePhase3Draft).mockResolvedValue({
      kayitUuid: "uuid-004",
      hamDosyaAdi: "siparis-004.pdf",
      kaynakKlasor: "MANUAL",
      gelisTarihi: "2026-03-22T09:00:00Z",
      dosyaDurumu: "PHASE3_IN_PROGRESS",
      siparisNo: "REC-004",
      aktifFaz: 3,
      satirlar: [],
      plakalar: [],
      sonGuncelleme: "2026-03-22T09:06:00Z",
    } as never);

    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Taslak Kaydet" }));

    await waitFor(() => {
      expect(phase3Service.updatePhase3Draft).toHaveBeenCalled();
    });
    expect(screen.getByText("Taslak kaydedildi; blockerlar devam ediyor")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Phase 4/i })).toBeDisabled();
  });
  it("ilk render sonrası sayfa kabuğu görünür", async () => {
    render(<SiparisKontrolPage />);
    expect(
      screen.queryByText(/Sipariş verileri yükleniyor/) ?? screen.getByText(/Sipariş Kontrol/),
    ).toBeTruthy();

    await act(async () => {
      vi.runAllTimersAsync && await vi.runAllTimersAsync();
    });
  });

  it("yükleme sonrası sayfa başlığını gösterir", async () => {
    await renderLoaded();
    expect(screen.getByText(/Sipariş Kontrol/)).toBeTruthy();
  });

  it("Header'da sayfa başlığı ve ERP eşleştirme metni gösterir", async () => {
    await renderLoaded();
    expect(screen.getByText(/Sipariş Kontrol.*ERP/)).toBeTruthy();
  });

  it("Senaryo A — eşleşmiş cari kodu header'da görünür", async () => {
    await renderLoaded();
    expect(screen.getAllByText("CARI-001").length).toBeGreaterThan(0);
  });

  it("Senaryo A — Mikro Cari Eşleşmesi başlığı görünür", async () => {
    await renderLoaded();
    expect(screen.getByText("Mikro Cari Eşleşmesi")).toBeTruthy();
  });

  it("Senaryo A — Cari OK rozeti görünür", async () => {
    await renderLoaded();
    expect(screen.getByText("Cari OK")).toBeTruthy();
  });

  it("Senaryo A — Hard Blocker footer mesajı görünür (row #2 eşleşmemiş)", async () => {
    await renderLoaded();
    expect(screen.getByText(/stok eşleşmesi eksik/i)).toBeTruthy();
  });

  it("Senaryo A — kritik merge satırları Merge Kritik rozetiyle görünür", async () => {
    await renderLoaded();
    expect(screen.getAllByText("Merge Kritik").length).toBeGreaterThanOrEqual(2);
  });

  it("Senaryo A — 'Phase 4'e Aktar' butonu disabled", async () => {
    await renderLoaded();
    expect(screen.getByRole("button", { name: /Phase 4/i })).toBeDisabled();
  });

  it("Senaryo C'ye geçince export butonu aktif olur", async () => {
    await renderLoaded();
    // C senaryosu: tüm eşleşmeler tamam
    fireEvent.click(screen.getByRole("button", { name: /^C$/ }));
    expect(screen.getByRole("button", { name: /Phase 4/i })).not.toBeDisabled();
  });

  it("Senaryo B'de header danger state (cari unmatched)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /^B$/ }));
    expect(screen.getByText("Eşleşme Yok")).toBeTruthy();
    // Footer blocker mesajı
    expect(screen.getByText(/Cari eşleşmesi eksik/i)).toBeTruthy();
  });

  it("Senaryo D — Merge rozetleri görünür", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /^D$/ }));
    expect(screen.getAllByText("Merge").length).toBeGreaterThan(0);
  });

  it("Senaryo E — Fire rozetleri görünür", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /^E$/ }));
    expect(screen.getAllByText(/Genel Fire Eksik/).length).toBeGreaterThan(0);
  });

  it("Senaryo E — Phase 4 tooltip'inde fire blocker nedeni görünür", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /^E$/ }));
    const phase4Button = screen.getByRole("button", { name: /Phase 4/i });
    expect(phase4Button).toBeDisabled();
    expect(phase4Button.getAttribute("title") || "").toMatch(/Genel fire açıklaması eksik/i);
  });

  it("grid sütun başlıklarını gösterir", async () => {
    await renderLoaded();
    expect(screen.getByText("Malzeme / Material")).toBeTruthy();
    expect(screen.getByText("U1")).toBeTruthy();
    expect(screen.getByText("Durum")).toBeTruthy();
  });

  it("ERP OK rozeti eşleşmiş satırda görünür", async () => {
    await renderLoaded();
    expect(screen.getAllByText("ERP OK").length).toBeGreaterThan(0);
  });

  it("Stok Eksik rozeti eşleşmemiş satırda görünür", async () => {
    await renderLoaded();
    expect(screen.getByText("Stok Eksik")).toBeTruthy();
  });

  it("Manuel rozeti MANUEL kaynaklı satırda görünür", async () => {
    await renderLoaded();
    // Row #3 satirKaynagi === "MANUEL" (Senaryo A, C'de var)
    expect(screen.getByText("Manuel")).toBeTruthy();
  });

  it("validasyon özeti gösterir", async () => {
    await renderLoaded();
    expect(screen.getByText("Validasyon Özeti")).toBeTruthy();
  });

  it("3 plaka şeridinde görünür", async () => {
    await renderLoaded();
    expect(screen.getByText(/Plaka 1/)).toBeTruthy();
    expect(screen.getByText(/Plaka 2/)).toBeTruthy();
    expect(screen.getByText(/Plaka 3/)).toBeTruthy();
  });

  it("Cari Ara modalı açılır", async () => {
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Esc: çekmeceyi kapat/i)).toBeTruthy();
  });
  it("Escape tuşu Cari modalı kapatır", async () => {
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Esc: çekmeceyi kapat/i)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cari modal arama input'u görünür", async () => {
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    expect(screen.getByPlaceholderText(/Cari kodu veya ünvanı/)).toBeTruthy();
  });

  it("canlı cari lookup düşerse yerel öneri başlığını gösterir", async () => {
    vi.mocked(phase3Service.lookupCustomers).mockRejectedValueOnce(new Error("lookup down"));
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByPlaceholderText(/Cari kodu veya ünvanı/);
    fireEvent.change(input, { target: { value: "CARI-001" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupCustomers).toHaveBeenCalledWith("CARI-001");
    });
    expect(screen.getByText(/Canlı cari lookup alınamadı/i)).toBeTruthy();
    expect(screen.getByText("Yerel Öneriler")).toBeTruthy();
    expect(screen.getAllByText("CARI-001").length).toBeGreaterThan(0);
  });
  it("canlı cari lookup düşer ve yerel öneri de kalmazsa fallback boş mesajını gösterir", async () => {
    vi.mocked(phase3Service.lookupCustomers).mockRejectedValueOnce(new Error("lookup down"));
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByPlaceholderText(/Cari kodu veya ünvanı/);
    fireEvent.change(input, { target: { value: "ZZZ-404" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupCustomers).toHaveBeenCalledWith("ZZZ-404");
    });
    expect(screen.getByText(/Yerel önerilerde eşleşme bulunamadı/i)).toBeTruthy();
  });
  it("canlı cari lookup boş dönünce sonuç yok bilgisini gösterir", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByPlaceholderText(/Cari kodu veya ünvanı/);
    fireEvent.change(input, { target: { value: "CARI-001" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupCustomers).toHaveBeenCalledWith("CARI-001");
    });
    expect(screen.getByText(/Mikro ERP'de bu aramaya uygun cari bulunamadı/i)).toBeTruthy();
    expect(screen.getByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeTruthy();
  });

  it("cari drawer yeniden dene ile aynı sorguyu tekrar tetikler", async () => {
    mockLivePhase3Context();
    vi.mocked(phase3Service.lookupCustomers)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          cariKodu: "CARI-777",
          cariUnvan: "Yeniden Deneme Cari",
          telefon: "0532 000 00 00",
        },
      ]);
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i });
    fireEvent.change(input, { target: { value: "CARI-777" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.click(screen.getByRole("button", { name: /Cari lookup yeniden dene/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupCustomers).toHaveBeenCalledTimes(2);
    });
    expect(phase3Service.lookupCustomers).toHaveBeenLastCalledWith("CARI-777");
    expect(screen.getByText("Yeniden Deneme Cari")).toBeTruthy();
  });
  it("cari drawer empty durumunda Enter ile yeniden denemeyi tetikler", async () => {
    mockLivePhase3Context();
    vi.mocked(phase3Service.lookupCustomers)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          cariKodu: "CARI-778",
          cariUnvan: "Klavye Cari",
          telefon: "0532 111 11 11",
        },
      ]);
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i });
    fireEvent.change(input, { target: { value: "CARI-778" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Enter: yeniden dene \| Esc: aramayı temizle/i)).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupCustomers).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Klavye Cari")).toBeTruthy();
  });
  it("cari drawer arama varken Escape ile sorguyu temizler ve açık kalır", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i }) as HTMLInputElement;
    expect(input.getAttribute("aria-describedby")).toBe("cari-search-help");
    expect(screen.getByText(/Enter: ilk sonucu seç \| Esc: çekmeceyi kapat/i)).toBeTruthy();
    fireEvent.change(input, { target: { value: "CARI-001" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("dialog", { name: /Cari Ara/i })).toBeTruthy();
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeNull();
  });
  it("cari drawer empty durumunda aramayı temizle ile önerilere döner", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "CARI-001" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.click(screen.getByRole("button", { name: /Cari aramasını temizle/i }));

    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeNull();
    expect(screen.getAllByText("CARI-001").length).toBeGreaterThan(0);
  });

  it("cari drawer kapanınca arama ve lookup durumu sıfırlanır", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i });
    fireEvent.change(input, { target: { value: "CARI-001" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cari drawer kapat/i }));
    expect(screen.queryByRole("dialog", { name: /Cari Ara/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const reopenedInput = screen.getByRole("searchbox", { name: /Cari ara/i }) as HTMLInputElement;
    expect(reopenedInput.value).toBe("");
    expect(screen.queryByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeNull();
  });

  it("canlı cari lookup sürerken yükleniyor bilgisini gösterir", async () => {
    vi.mocked(phase3Service.lookupCustomers).mockImplementationOnce(
      () => new Promise(() => undefined) as never,
    );
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByPlaceholderText(/Cari kodu veya ünvanı/);
    fireEvent.change(input, { target: { value: "CARI" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Cari sonuçları güncelleniyor/i)).toBeTruthy();
  });
  it("canlı cari aramasında debounce süresinde eski seçimler kilitlenir", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-012",
          uuid: "uuid-012",
          fileName: "siparis-012.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-012",
        customerMatchStatus: "UNMATCHED",
        customerCode: null,
        customerName: null,
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: true,
        stockBlockerCount: 0,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });

    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i });
    fireEvent.change(input, { target: { value: "CARI" } });

    expect(screen.getByText(/Cari sonuçları güncelleniyor/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Seç" })[0]).toBeDisabled();
  });
  it("canlı cari lookup yanıtı drawer kapandıktan sonra eski sonucu geri yazmaz", async () => {
    let resolveLookup: ((value: phase3Service.WorkflowLookupCustomer[]) => void) | null = null;
    vi.mocked(phase3Service.lookupCustomers).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }) as never,
    );
    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i });
    fireEvent.change(input, { target: { value: "CARI-999" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Cari sonuçları güncelleniyor/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cari drawer kapat/i }));
    expect(screen.queryByRole("dialog", { name: /Cari Ara/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));

    await act(async () => {
      resolveLookup?.([
        {
          cariKodu: "CANLI-999",
          cariUnvan: "Geç Gelen Sonuç",
          telefon: "02121234567",
        },
      ]);
      await Promise.resolve();
    });

    expect(screen.queryByText("CANLI-999")).toBeNull();
    expect(screen.queryByText("Geç Gelen Sonuç")).toBeNull();
  });
  it("canlı cari lookup'ta eski arama yanıtı yeni aramayı ezmez", async () => {
    let resolveOld: ((value: phase3Service.WorkflowLookupCustomer[]) => void) | null = null;
    let resolveNew: ((value: phase3Service.WorkflowLookupCustomer[]) => void) | null = null;
    vi.mocked(phase3Service.lookupCustomers)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }) as never,
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }) as never,
      );

    mockLivePhase3Context();
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByRole("searchbox", { name: /Cari ara/i });

    fireEvent.change(input, { target: { value: "CARI-OLD" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.change(input, { target: { value: "CARI-NEW" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      resolveNew?.([
        {
          cariKodu: "CARI-NEW",
          cariUnvan: "Yeni Sonuç",
          telefon: "02120000001",
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("CARI-NEW")).toBeTruthy();
    });

    await act(async () => {
      resolveOld?.([
        {
          cariKodu: "CARI-OLD",
          cariUnvan: "Eski Sonuç",
          telefon: "02120000000",
        },
      ]);
      await Promise.resolve();
    });

    expect(screen.getByText("CARI-NEW")).toBeTruthy();
    expect(screen.queryByText("CARI-OLD")).toBeNull();
  });

  it("Cari modal Enter  ile ilk sonucu seçer", async () => {
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    const input = screen.getByPlaceholderText(/Cari kodu veya ünvanı/);
    fireEvent.change(input, { target: { value: "CARI-002" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Modal kapandı
    expect(screen.queryByRole("dialog")).toBeNull();
    // CARI-002 seçildi
    expect(screen.getAllByText("CARI-002").length).toBeGreaterThan(0);
  });

  it("canlı cari submit sürerken drawer kapanmaz ve kapat butonu kilitlenir", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-001",
          uuid: "uuid-001",
          fileName: "siparis-001.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-001",
        customerMatchStatus: "UNMATCHED",
        customerCode: null,
        customerName: null,
        customerPhone: "05321234567",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: true,
        stockBlockerCount: 0,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });
    vi.mocked(phase3Service.matchCustomer).mockImplementationOnce(
      () => new Promise(() => undefined) as never,
    );

    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    fireEvent.click(screen.getAllByText("CARI-003")[0]);

    expect(screen.getByText(/Cari eşleştirmesi uygulanıyor/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cari drawer kapat/i })).toBeDisabled();
    expect(screen.getByRole("searchbox", { name: /Cari ara/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Cari eşleştirme drawer arka plan/i));
    expect(screen.getByRole("dialog", { name: /Cari Ara/i })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: /Cari Ara/i })).toBeTruthy();
  });

  it("Cari seçimi header'ı günceller", async () => {
    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    fireEvent.click(screen.getAllByText("CARI-003")[0]);
    expect(screen.getAllByText("CARI-003").length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("cari drawer Seç butonu eşleştirmeyi iki kez tetiklemez", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-010",
          uuid: "uuid-010",
          fileName: "siparis-010.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-010",
        customerMatchStatus: "UNMATCHED",
        customerCode: null,
        customerName: null,
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "18mm Sunta Beyaz",
          stockMatchStatus: "MATCHED",
          stockCode: "STK-001",
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: true,
        stockBlockerCount: 0,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });

    await renderLoaded();
    switchRibbonTab("CARİ");
    fireEvent.click(screen.getByRole("button", { name: "Cari Ara" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Seç" })[0]);

    await waitFor(() => {
      expect(phase3Service.matchCustomer).toHaveBeenCalledTimes(1);
    });
  });

  it("'Stok Ara' butonu başlangıçta disabled", async () => {
    await renderLoaded();
    switchRibbonTab("SATIR");
    expect(screen.getByRole("button", { name: "Stok Ara" })).toBeDisabled();
  });

  it("satıra tıklayınca 'Stok Ara' butonu aktif olur", async () => {
    await renderLoaded();
    // Row 1 malzeme hücresine tıkla
    const matched = screen.getAllByText("18mm Sunta Beyaz");
    fireEvent.click(matched[0]);
    switchRibbonTab("SATIR");
    expect(screen.getByRole("button", { name: "Stok Ara" })).not.toBeDisabled();
  });

  it("Stok Ara modalında stok seçimi satırı günceller", async () => {
    await renderLoaded();
    // Eşleşmemiş satırdaki search ikonunu bul
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Esc: çekmeceyi kapat/i)).toBeTruthy();
    // STK-004'ü seç
    fireEvent.click(screen.getByText("STK-004"));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Stok Eksik rozeti kaybolmalı
    expect(screen.queryByText("Stok Eksik")).toBeNull();
  });

  it("Senaryo A — stok eşleşmesi düzelse de kritik merge blocker exportu kilitler", async () => {
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Esc: çekmeceyi kapat/i)).toBeTruthy();
    fireEvent.click(screen.getByText("STK-001"));
    expect(screen.queryByRole("dialog")).toBeNull();

    const phase4Button = screen.getByRole("button", { name: /Phase 4/i });
    expect(phase4Button).toBeDisabled();
    expect(phase4Button.getAttribute("title") || "").toMatch(/kritik merge grubu bekliyor/i);
  });

  it("Stok modal Enter  ile ilk sonucu seçer", async () => {
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByPlaceholderText(/Stok kodu veya adı/);
    fireEvent.change(input, { target: { value: "STK-005" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("canlı stok submit sürerken drawer kapanmaz ve input kilitlenir", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-005",
          uuid: "uuid-005",
          fileName: "siparis-005.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-005",
        customerMatchStatus: "MATCHED",
        customerCode: "CARI-005",
        customerName: "Demo Cari 5",
        customerPhone: "05320000000",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "Ham MDF",
          stockMatchStatus: "UNMATCHED",
          stockCode: null,
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: false,
        stockBlockerCount: 1,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });
    vi.mocked(phase3Service.matchStock).mockImplementationOnce(
      () => new Promise(() => undefined) as never,
    );

    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    fireEvent.click(screen.getAllByText("STK-001")[0]);

    expect(screen.getByText(/Stok eşleştirmesi uygulanıyor/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Stok drawer kapat/i })).toBeDisabled();
    expect(screen.getByRole("searchbox", { name: /Stok ara/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Stok eşleştirme drawer arka plan/i));
    expect(screen.getByRole("dialog", { name: /Stok Ara/i })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: /Stok Ara/i })).toBeTruthy();
  });

  it("canlı stok lookup düşerse fallback önerilerini gösterir", async () => {
    vi.mocked(phase3Service.lookupStocks).mockRejectedValueOnce(new Error("lookup down"));
    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByPlaceholderText(/Stok kodu veya adı/);
    fireEvent.change(input, { target: { value: "STK-001" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupStocks).toHaveBeenCalledWith("STK-001");
    });
    expect(screen.getByText(/Canlı stok lookup alınamadı/i)).toBeTruthy();
    expect(screen.getByText("Yerel Öneriler")).toBeTruthy();
    expect(screen.getAllByText("STK-001").length).toBeGreaterThan(0);
  });
  it("canlı stok lookup düşer ve yerel öneri de kalmazsa fallback boş mesajını gösterir", async () => {
    vi.mocked(phase3Service.lookupStocks).mockRejectedValueOnce(new Error("lookup down"));
    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByPlaceholderText(/Stok kodu veya adı/);
    fireEvent.change(input, { target: { value: "ZZZ-404" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupStocks).toHaveBeenCalledWith("ZZZ-404");
    });
    expect(screen.getByText(/Yerel önerilerde eşleşme bulunamadı/i)).toBeTruthy();
  });
  it("canlı stok aramasında debounce süresinde eski seçimler kilitlenir", async () => {

    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-013",
          uuid: "uuid-013",
          fileName: "siparis-013.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-013",
        customerMatchStatus: "MATCHED",
        customerCode: "CARI-001",
        customerName: "Demo Cari",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "Ham MDF",
          stockMatchStatus: "UNMATCHED",
          stockCode: null,
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: false,
        stockBlockerCount: 1,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });

    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i });
    fireEvent.change(input, { target: { value: "STK" } });

    expect(screen.getByText(/Stok sonuçları güncelleniyor/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Seç" })[0]).toBeDisabled();
  });
  it("stok drawer yeniden dene ile aynı sorguyu tekrar tetikler", async () => {
    mockLivePhase3Context();
    vi.mocked(phase3Service.lookupStocks)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          stokKodu: "STK-777",
          stokAdi: "Yeniden Deneme Stok",
        },
      ]);
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i });
    fireEvent.change(input, { target: { value: "STK-777" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.click(screen.getByRole("button", { name: /Stok lookup yeniden dene/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupStocks).toHaveBeenCalledTimes(2);
    });
    expect(phase3Service.lookupStocks).toHaveBeenLastCalledWith("STK-777");
    expect(screen.getByText("STK-777")).toBeTruthy();
  });
  it("stok drawer empty durumunda Enter ile yeniden denemeyi tetikler", async () => {
    mockLivePhase3Context();
    vi.mocked(phase3Service.lookupStocks)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          stokKodu: "STK-778",
          stokAdi: "Klavye Stok",
        },
      ]);
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i });
    fireEvent.change(input, { target: { value: "STK-778" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Enter: yeniden dene \| Esc: aramayı temizle/i)).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(phase3Service.lookupStocks).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("STK-778")).toBeTruthy();
  });
  it("stok drawer arama varken Escape ile sorguyu temizler ve açık kalır", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i }) as HTMLInputElement;
    expect(input.getAttribute("aria-describedby")).toBe("stok-search-help");
    expect(screen.getByText(/Enter: ilk uygun sonucu seç \| Esc: çekmeceyi kapat/i)).toBeTruthy();
    fireEvent.change(input, { target: { value: "STK-404" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("dialog", { name: /Stok Ara/i })).toBeTruthy();
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeNull();
  });
  it("stok drawer empty durumunda aramayı temizle ile önerilere döner", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "STK-404" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.click(screen.getByRole("button", { name: /Stok aramasını temizle/i }));

    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeNull();
    expect(screen.getAllByText("STK-001").length).toBeGreaterThan(0);
  });

  it("stok drawer kapanınca arama ve lookup durumu sıfırlanır", async () => {
    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i });
    fireEvent.change(input, { target: { value: "STK-404" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Stok drawer kapat/i }));
    expect(screen.queryByRole("dialog", { name: /Stok Ara/i })).toBeNull();

    fireEvent.click(screen.getAllByTitle("Bu satır için stok eşleştir")[0]);
    const reopenedInput = screen.getByRole("searchbox", { name: /Stok ara/i }) as HTMLInputElement;
    expect(reopenedInput.value).toBe("");
    expect(screen.queryByText(/Canlı lookup'ta sonuç bulunamadı/i)).toBeNull();
  });
  it("stok drawer Seç butonu eşleştirmeyi iki kez tetiklemez", async () => {
    vi.mocked(phase3Service.getPhase3Queue).mockResolvedValue({
      items: [
        {
          recordId: "REC-011",
          uuid: "uuid-011",
          fileName: "siparis-011.pdf",
          sourceType: "MANUAL",
          folderType: "MANUEL",
          status: "PHASE3_IN_PROGRESS",
          duplicateFlag: false,
          duplicateReason: null,
          retryCount: 0,
          lastErrorMessage: null,
          createdAt: "2026-03-22T09:00:00Z",
          updatedAt: "2026-03-22T09:05:00Z",
          nextRetryAt: null,
          phase2Ready: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    vi.mocked(phase3Service.getPhase3RecordDetail).mockResolvedValue({
      header: {
        recordId: "REC-011",
        customerMatchStatus: "MATCHED",
        customerCode: "CARI-001",
        customerName: "Demo Cari",
        sourceType: "MANUAL",
        operatorName: "Operator",
        updatedAt: "2026-03-22T09:05:00Z",
      },
      plateGroups: [{ plateId: "P1", label: "Plaka 1", lineCount: 1, blockerCount: 1, active: true }],
      lines: [
        {
          rowIndex: 0,
          plateId: "P1",
          materialText: "Ham MDF",
          stockMatchStatus: "UNMATCHED",
          stockCode: null,
          boy: "100",
          en: "50",
          adet: 1,
          yon: "Boy",
          aciklama: "",
          bantUst: null,
          bantAlt: null,
          bantSol: null,
          bantSag: null,
          ilaveAciklama: "",
          aciklama1: "",
          mergeCandidate: false,
          scrapNoteRequired: false,
          scrapNote: null,
          status: "READY",
        },
      ],
      summary: {
        customerBlocker: false,
        stockBlockerCount: 1,
        mergePendingCount: 0,
        scrapNoteMissingCount: 0,
        phase4Ready: false,
      },
    });

    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Seç" })[0]);

    await waitFor(() => {
      expect(phase3Service.matchStock).toHaveBeenCalledTimes(1);
    });
  });
  it("canlı stok lookup yanıtı drawer kapandıktan sonra eski sonucu geri yazmaz", async () => {
    let resolveLookup: ((value: { stokKodu: string; stokAdi: string }[]) => void) | null = null;
    vi.mocked(phase3Service.lookupStocks).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }) as never,
    );
    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i });
    fireEvent.change(input, { target: { value: "STK-999" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Stok sonuçları güncelleniyor/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Stok drawer kapat/i }));
    expect(screen.queryByRole("dialog", { name: /Stok Ara/i })).toBeNull();

    fireEvent.click(screen.getAllByTitle("Bu satır için stok eşleştir")[0]);

    await act(async () => {
      resolveLookup?.([
        {
          stokKodu: "CANLI-STK-999",
          stokAdi: "Geç Gelen Stok",
        },
      ]);
      await Promise.resolve();
    });

    expect(screen.queryByText("CANLI-STK-999")).toBeNull();
    expect(screen.queryByText("Geç Gelen Stok")).toBeNull();
  });
  it("canlı stok lookup'ta eski arama yanıtı yeni aramayı ezmez", async () => {
    let resolveOld: ((value: { stokKodu: string; stokAdi: string }[]) => void) | null = null;
    let resolveNew: ((value: { stokKodu: string; stokAdi: string }[]) => void) | null = null;
    vi.mocked(phase3Service.lookupStocks)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }) as never,
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }) as never,
      );

    mockLivePhase3Context();
    await renderLoaded();
    const searchBtns = screen.getAllByTitle("Bu satır için stok eşleştir");
    fireEvent.click(searchBtns[0]);
    const input = screen.getByRole("searchbox", { name: /Stok ara/i });

    fireEvent.change(input, { target: { value: "STK-OLD" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.change(input, { target: { value: "STK-NEW" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      resolveNew?.([
        {
          stokKodu: "STK-NEW",
          stokAdi: "Yeni Stok",
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("STK-NEW")).toBeTruthy();
    });

    await act(async () => {
      resolveOld?.([
        {
          stokKodu: "STK-OLD",
          stokAdi: "Eski Stok",
        },
      ]);
      await Promise.resolve();
    });

    expect(screen.getByText("STK-NEW")).toBeTruthy();
    expect(screen.queryByText("STK-OLD")).toBeNull();
  });

  it("'Birleştir' başlangıçta disabled", async () => {
    await renderLoaded();
    switchRibbonTab("SATIR");
    expect(screen.getByRole("button", { name: "Birleştir" })).toBeDisabled();
  });

  it("Fire butonu satır seçmeden genel fire modalını açar", async () => {
    await renderLoaded();
    switchRibbonTab("KONTROL");
    fireEvent.click(screen.getByRole("button", { name: "Fire" }));
    expect(screen.getByRole("dialog", { name: "Genel Fire Açıklaması" })).toBeTruthy();
  });

  it("2 satır seçince 'Birleştir' aktif olur ve modal açılır", async () => {
    await renderLoaded();
    const rows_ = screen.getAllByRole("row").slice(1); // thead hariç
    fireEvent.click(rows_[0]);
    fireEvent.click(rows_[1]);
    switchRibbonTab("SATIR");
    const mergeBtn = screen.getByRole("button", { name: "Birleştir" });
    expect(mergeBtn).not.toBeDisabled();
    fireEvent.click(mergeBtn);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("footer 'Taslak Kaydet' butonu görünür", async () => {
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Taslak Kaydet" })).toBeTruthy();
  });

  it("demo modda kaydet aksiyonları pasif görünür", async () => {
    await renderLoaded();
    switchRibbonTab("KAYIT");
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Taslak Kaydet" })).toBeDisabled();
  });

  it("'Hata Tetikle' demo butonu error state'i gösterir", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByTitle("Hata state'ini tetikle"));
    expect(screen.getByText(/Veri alınırken hata oluştu/)).toBeTruthy();
    // Yeniden Dene butonu görünür
    expect(screen.getByRole("button", { name: "Yeniden Dene" })).toBeTruthy();
  });

  it("demo senaryo butonları A-E görünür", async () => {
    await renderLoaded();
    ["A", "B", "C", "D", "E"].forEach((s) => {
      expect(screen.getByRole("button", { name: s })).toBeTruthy();
    });
  });

  it("satır detay paneli genel fire açıklamasını gösterir", async () => {
    mockLivePhase3Context({
      recordId: "REC-001",
      uuid: "uuid-001",
      customerMatchStatus: "MATCHED",
      customerCode: "CARI-001",
      customerName: "Demo Cari",
      fireAciklamasi: "Genel fire açıklaması: kesim toleransı",
    });

    await renderLoaded();

    const rows = screen.getAllByRole("row");
    fireEvent.doubleClick(rows[1]);

    await waitFor(() => {
      expect(screen.getByRole("complementary", { name: "Satır #1 detayı" })).toBeTruthy();
    });
    expect(screen.getByText("Genel Fire Açıklaması")).toBeTruthy();
    expect(screen.getByText("Genel fire açıklaması: kesim toleransı")).toBeTruthy();
  });

  it("'Sipariş No' info chip görünür", async () => {
    await renderLoaded();
    expect(screen.getByText("SIP-2026-001")).toBeTruthy();
  });
});






















































