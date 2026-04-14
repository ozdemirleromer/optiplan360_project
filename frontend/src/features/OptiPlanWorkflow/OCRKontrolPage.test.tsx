// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OCRKontrolPage } from "./OCRKontrolPage";

// ─── Mock: servis ─────────────────────────────────────────────────────────────

const serviceMocks = vi.hoisted(() => ({
  listRecords: vi.fn(),
  getRecord: vi.fn(),
  updatePhase2: vi.fn(),
  approvePhase2: vi.fn(),
  removeRow: vi.fn(),
  restoreRow: vi.fn(),
  markError: vi.fn(),
  getPhase2GateStatus: vi.fn(),
  getPhase2AuditTrail: vi.fn(),
  undoPhase2Decision: vi.fn(),
  decidePhase2Cell: vi.fn(),
  validatePhase2Cell: vi.fn(),
}));

const createObjectUrlMock = vi.fn(() => "blob:ocr-preview");
const revokeObjectUrlMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("../../services/optiplanWorkflowService", () => ({
  optiplanWorkflowService: {
    listRecords: serviceMocks.listRecords,
    getRecord: serviceMocks.getRecord,
    updatePhase2: serviceMocks.updatePhase2,
    approvePhase2: serviceMocks.approvePhase2,
    removeRow: serviceMocks.removeRow,
    restoreRow: serviceMocks.restoreRow,
    markError: serviceMocks.markError,
    getPhase2GateStatus: serviceMocks.getPhase2GateStatus,
    getPhase2AuditTrail: serviceMocks.getPhase2AuditTrail,
    undoPhase2Decision: serviceMocks.undoPhase2Decision,
    decidePhase2Cell: serviceMocks.decidePhase2Cell,
    validatePhase2Cell: serviceMocks.validatePhase2Cell,
  },
}));

// ─── Mock: Layout ─────────────────────────────────────────────────────────────

vi.mock("../../components/Layout", () => ({
  TopBar: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock("../../utils/appNavigation", () => ({
  navigateToAppPage: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(id: string, boy = 800, en = 600, adet = 2, boyScore = 95, enScore = 95, adetScore = 95) {
  return {
    id,
    satirSirasi: 1,
    malzeme: "18MM Beyaz",
    boy,
    en,
    adet,
    grain: 3,
    bilgi: "",
    u1: false,
    u2: false,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    satirKaynagi: "OCR",
    plakaRef: "",
    bantKalinligiOverride: "",
    hucreGuvenSkorlari: {
      boy: boyScore,
      en: enScore,
      adet: adetScore,
      malzeme: 96,
      grain: 97,
      bilgi: 98,
      delik1: 99,
      delik_1: 99,
      delik: 99,
    },
    satirGuvenSkorOzeti: {},
  };
}

function makeRecord(uuid: string, rows: ReturnType<typeof makeRow>[], removedRows: ReturnType<typeof makeRow>[] = []) {
  return {
    kayitUuid: uuid,
    hamDosyaAdi: `dosya_${uuid.slice(0, 4)}.pdf`,
    kaynakKlasor: "C:/raw",
    gelisTarihi: "2026-03-16T10:00:00",
    dosyaDurumu: "PHASE_2_OCR_KONTROL",
    orijinalDosyaYolu: "",
    dosyaHash: "",
    ocrHamJson: null,
    ayristirilmisOcrAlanlari: null,
    okunanCariUnvan: "Test Cari A.Ş.",
    okunanCariTelefon: "0555 123 4567",
    aiGuvenSkoruOzeti: null,
    revizyonAdayiUyarisi: "",
    cariUnvan: "",
    cariKodu: "",
    siparisNo: "",
    termin: "",
    teslimTarihi: "",
    teslimatAdresi: "",
    odemeSekli: "",
    malzeme: "18MM Beyaz",
    stokKodu: "",
    bantKalinligi: "",
    grainVarsayilan: 3,
    plakaBoyMm: null,
    plakaEnMm: null,
    fireAciklamasi: "",
    retryNo: 0,
    revizyonNo: 0,
    aktifFaz: 2,
    satirlar: rows,
    cikarilanSatirlar: removedRows,
    auditKayitlari: [],
    plakalar: [],
    exportKayitlari: [],
    hataKayitlari: [],
    imageUrl: "/api/v1/optiplan-workflow/records/test-uuid/image",
  };
}

function makeQueueRecord(record: ReturnType<typeof makeRecord>) {
  return {
    ...record,
    satirlar: [],
    cikarilanSatirlar: [],
  };
}

const BAND_REVIEW_ROW = {
  ...makeRow("row-a", 800, 600, 2, 95, 92, 90),
  u1: true,
  k2: true,
  bantKalinligiOverride: "2 MM",
  satirGuvenSkorOzeti: {
    band_review: {
      u1: { active: true, value: "2 MM", confidence: 82, source_text: "2MM" },
      u2: { active: false, value: null, confidence: 97, source_text: "" },
      k1: { active: false, value: null, confidence: 96, source_text: "" },
      k2: { active: true, value: "2 MM", confidence: 84, source_text: "2MM" },
    },
  },
};

const HIGH_CONF_RECORD = makeRecord("uuid-1111", [BAND_REVIEW_ROW]);

const LOW_CONF_RECORD = makeRecord("uuid-2222", [
  makeRow("row-b", 1200, 800, 4, 45, 95, 80), // boy %45 → düşük güven
]);

const LOW_CONF_RECORD_ALL_LOW = makeRecord("uuid-3333", [
  makeRow("row-c", 900, 700, 3, 40, 35, 60), // hepsi düşük
]);

const DEFAULT_GATE_STATUS = {
  canProceed: false,
  message: "Onay bekleyen alanlar var",
  blockerReasons: [],
  summary: {
    totalBlockers: 0,
    criticalCount: 0,
    warningCount: 0,
  },
  gateCheckTime: "2026-03-18T10:00:00Z",
};

const DEFAULT_AUDIT_TRAIL = {
  recordUuid: "uuid-1111",
  totalEvents: 2,
  events: [
    {
      id: "evt-1",
      createdAt: "2026-03-18T10:00:00Z",
      recordUuid: "uuid-1111",
      rowId: "row-a",
      fieldType: "boy",
      eventType: "CELL_DECIDED",
      oldValue: 800,
      newValue: 800,
      actorUserId: 1,
      actorUserName: "Operatör",
      decisionReason: "OPERATOR_APPROVED",
      operatorNote: null,
    },
    {
      id: "evt-2",
      createdAt: "2026-03-18T09:59:00Z",
      recordUuid: "uuid-1111",
      rowId: "row-a",
      fieldType: "en",
      eventType: "CELL_DECIDED",
      oldValue: 600,
      newValue: 600,
      actorUserId: 1,
      actorUserName: "Operatör",
      decisionReason: "OPERATOR_APPROVED",
      operatorNote: null,
    },
  ],
};

function getPhase3Buttons() {
  return screen.getAllByRole("button", { name: /phase 3'e aktar/i });
}

function getPhase3PrimaryButton() {
  return getPhase3Buttons()[0];
}

// ─── Testler ──────────────────────────────────────────────────────────────────

describe("OCRKontrolPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(
      new Response(new Blob(["image-bytes"], { type: "image/png" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
    localStorage.setItem(
      "optiplan-auth-storage",
      JSON.stringify({
        state: {
          token: "test-token",
        },
      }),
    );
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    window.dispatchEvent(new Event("resize"));
    serviceMocks.listRecords.mockResolvedValue([HIGH_CONF_RECORD]);
    serviceMocks.getRecord.mockImplementation(async (uuid: string) => {
      const knownRecords = [HIGH_CONF_RECORD, LOW_CONF_RECORD, LOW_CONF_RECORD_ALL_LOW];
      return knownRecords.find((record) => record.kayitUuid === uuid) ?? HIGH_CONF_RECORD;
    });
    serviceMocks.updatePhase2.mockResolvedValue(HIGH_CONF_RECORD);
    serviceMocks.approvePhase2.mockResolvedValue(HIGH_CONF_RECORD);
    serviceMocks.removeRow.mockResolvedValue(HIGH_CONF_RECORD);
    serviceMocks.restoreRow.mockResolvedValue(HIGH_CONF_RECORD);
    serviceMocks.markError.mockResolvedValue(HIGH_CONF_RECORD);
    serviceMocks.getPhase2GateStatus.mockResolvedValue(DEFAULT_GATE_STATUS);
    serviceMocks.getPhase2AuditTrail.mockResolvedValue(DEFAULT_AUDIT_TRAIL);
    serviceMocks.undoPhase2Decision.mockResolvedValue({
      success: true,
      message: "Geri alındı",
      revertedEventId: "evt-1",
      gateStatus: "BLOCKED",
    });
    serviceMocks.decidePhase2Cell.mockResolvedValue({
      success: true,
      message: "Kaydedildi",
      cached: false,
      cellState: { rowId: "row-a", fieldType: "boy", approved: true },
      gateStatus: "BLOCKED",
    });
    serviceMocks.validatePhase2Cell.mockResolvedValue({
      isValid: true,
      blockers: [],
      message: "OK",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("yükleme aşamasında yükleniyor mesajı gösterir", () => {
    serviceMocks.listRecords.mockReturnValue(new Promise(() => undefined));
    render(<OCRKontrolPage />);
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
  });

  it("Phase 2 kayıtları listeler ve sabit iki panel iskeletini açar", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      const els = screen.getAllByText(`dosya_${HIGH_CONF_RECORD.kayitUuid.slice(0, 4)}.pdf`);
      expect(els[0]).toBeInTheDocument();
    });
    expect(screen.getByTestId("phase2-fixed-split-shell")).toBeInTheDocument();
  });

  it("dar ekranda sabit iki paneli stacked moda geçirir", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1100 });
    window.dispatchEvent(new Event("resize"));

    render(<OCRKontrolPage />);

    await waitFor(() => {
      expect(screen.getByTestId("phase2-fixed-split-shell")).toHaveAttribute("data-layout-mode", "stacked");
      expect(screen.getByRole("region", { name: "Phase 2 Doğrulama Özeti" })).toHaveAttribute("data-layout-mode", "stacked");
      expect(screen.getByTestId("phase2-grid-scroll")).toHaveAttribute("data-layout-mode", "horizontal-scroll");
    });
    expect(screen.getByTestId("phase2-grid-scroll-hint")).toHaveTextContent("7 alan sabit kalır");
  });

  it("liste kaydı detay taşımadığında satırları detail endpointten yükler", async () => {
    serviceMocks.listRecords.mockResolvedValue([makeQueueRecord(HIGH_CONF_RECORD)]);
    serviceMocks.getRecord.mockResolvedValue(HIGH_CONF_RECORD);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Boy" })).toBeInTheDocument();
    });

    expect(serviceMocks.getRecord).toHaveBeenCalledWith("uuid-1111");
    for (const label of ["Boy", "En", "Adet", "U1", "U2", "K1", "K2"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument();
      expect(screen.getByLabelText(new RegExp(`${label} değeri satır 1`, "i"))).toBeInTheDocument();
    }
  });

  it("7 alanlı yapıyı korurken bant kontrol panelini gösterir", async () => {
    render(<OCRKontrolPage />);
    const panel = await screen.findByTestId("band-review-panel");

    expect(panel).toHaveTextContent("Bant Kontrolü");
    expect(panel).toHaveTextContent("7 alan grid sabittir");
    expect(screen.queryByRole("columnheader", { name: /Bant/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("band-chip-u1")).toHaveTextContent("Aktif");
    expect(screen.getByTestId("band-chip-k2")).toHaveTextContent("Aktif");
    expect(screen.getByTestId("band-effective-thickness")).toHaveTextContent("2 MM");
  });

  it("Phase 1/3 durumundaki kayıtları göstermez", async () => {
    const phase1Record = { ...HIGH_CONF_RECORD, kayitUuid: "uuid-p1", dosyaDurumu: "PHASE_1_OCR_HAVUZU" };
    serviceMocks.listRecords.mockResolvedValue([phase1Record]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByText(/bekleyen kayıt yok/i)).toBeInTheDocument();
    });
  });

  it("kuyruk boşsa bilgi mesajı gösterir", async () => {
    serviceMocks.listRecords.mockResolvedValue([]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByText(/bekleyen kayıt yok/i)).toBeInTheDocument();
    });
  });

  it("kuyruk boşsa Phase 3'e Aktar butonu disabled görünür", async () => {
    serviceMocks.listRecords.mockResolvedValue([]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      const phase3Buttons = screen.getAllByRole("button", { name: /Phase 3'e Aktar/i });
      expect(phase3Buttons.length).toBeGreaterThan(0);
      phase3Buttons.forEach((button) => expect(button).toBeDisabled());
    });
  });

  it("kuyruk boşsa split-screen çalışma alanı bilgisini gösterir", async () => {
    serviceMocks.listRecords.mockResolvedValue([]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByText(/Split-screen çalışma alanı her zaman sabittir; kayıt seçildiğinde içerik dolar/i)).toBeInTheDocument();
      expect(screen.getByTestId("phase2-fixed-split-shell")).toBeInTheDocument();
    });
  });

  it("Sipariş Düzenle butonu tüm hücreler yüksek güvenli olduğunda aktif olur", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(getPhase3PrimaryButton()).not.toBeDisabled();
    });
  });

  it("düşük güvenli hücre varsa Sipariş Düzenle butonu devre dışıdır", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(getPhase3PrimaryButton()).toBeDisabled();
    });
  });

  it("düşük güvenli hücre turuncu arka planla gösterilir", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      // Boy hücresi düşük güvenli olduğu için cell-row-b-boy data-testid'i var
      const cell = screen.getByTestId("cell-row-b-boy");
      expect(cell).toBeInTheDocument();
      // hücrenin arka planı turuncu olmalı (#d9770618)
      expect(cell).toHaveStyle({ background: "#d9770618" });
    });
  });

  it("Onayla butonuna tıklayınca hücre onaylanır ve turuncu uyarı aksiyonu kaybolur", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Boy onayla satır 1/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Boy onayla satır 1/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Boy onayla satır 1/i })).not.toBeInTheDocument();
      expect(screen.getByText("✓ Onaylı")).toBeInTheDocument();
    });
  });

  it("tüm düşük güven hücreler onaylandıktan sonra Sipariş Düzenle aktif olur", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Boy onayla satır 1/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Boy onayla satır 1/i }));
    await waitFor(() => {
      expect(getPhase3PrimaryButton()).not.toBeDisabled();
    });
  });

  it("düşük güven hücre onayı eksikse Sipariş Düzenle disabled reason gösterir", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(getPhase3Buttons().length).toBeGreaterThan(0);
    });
    const phase3Button = getPhase3PrimaryButton();
    expect(phase3Button).toBeDisabled();
    expect(phase3Button).toHaveAttribute(
      "title",
      "Tüm düşük güven hücreleri onaylanmadan Phase 3'e geçilemez.",
    );
  });

  it("Sipariş Düzenle tıklanınca 7 alan payload'i ile updatePhase2 ve approvePhase2 çağrılır", async () => {
    serviceMocks.listRecords.mockResolvedValue([HIGH_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(getPhase3PrimaryButton()).not.toBeDisabled();
    });

    // U1/U2/K1/K2 are boolean checkboxes — toggle them
    fireEvent.click(screen.getByLabelText(/U1 değeri satır 1/i));
    fireEvent.click(screen.getByLabelText(/U2 değeri satır 1/i));

    fireEvent.click(getPhase3PrimaryButton());
    await waitFor(() => {
      expect(serviceMocks.updatePhase2).toHaveBeenCalledWith(
        "uuid-1111",
        expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({
              boy: 800,
              en: 600,
              adet: 2,
              u1: false,
              u2: true,
            }),
          ]),
        }),
      );
      expect(serviceMocks.approvePhase2).toHaveBeenCalledWith("uuid-1111");
    });
  });

  it("backend blocker rejection geldiğinde Phase 3 geçiş hatasını alertte gösterir", async () => {
    serviceMocks.approvePhase2.mockRejectedValue(new Error("blocker pending approvals"));
    render(<OCRKontrolPage />);

    await waitFor(() => {
      expect(getPhase3PrimaryButton()).not.toBeDisabled();
    });

    fireEvent.click(getPhase3PrimaryButton());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Phase 3'e geçiş engellendi: blocker pending approvals");
      expect(serviceMocks.updatePhase2).toHaveBeenCalledWith(
        "uuid-1111",
        expect.objectContaining({ rows: expect.any(Array) }),
      );
      expect(serviceMocks.approvePhase2).toHaveBeenCalledWith("uuid-1111");
    });
  });

  it("Kaldır butonuna tıklanınca removeRow çağrılır", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /kaldır/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /kaldır/i }));
    await waitFor(() => {
      expect(serviceMocks.removeRow).toHaveBeenCalledWith("uuid-1111", "row-a");
    });
  });

  it("kaldırılan satır listede gösterilir ve Geri Al butonu çalışır", async () => {
    const recordWithRemoved = makeRecord(
      "uuid-4444",
      [makeRow("row-x", 800, 600, 2)],
      [makeRow("row-removed", 500, 400, 1)],
    );
    serviceMocks.listRecords.mockResolvedValue([recordWithRemoved]);
    serviceMocks.getRecord.mockResolvedValue(recordWithRemoved);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /geri al/i })).toBeInTheDocument();
    });

    const restoreButton = screen
      .getAllByRole("button", { name: /geri al/i })
      .find((button) => button.getAttribute("title") == null);
    expect(restoreButton).toBeDefined();
    fireEvent.click(restoreButton!);

    await waitFor(() => {
      expect(serviceMocks.restoreRow).toHaveBeenCalledWith("uuid-4444", "row-removed");
    });
  });

  it("Hatalı butonuna tıklanınca modal açılır", async () => {
    render(<OCRKontrolPage />);
    // Yükleme bitmesini bekle
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^hatalı görsel$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^hatalı görsel$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("modal iptal butonu modalı kapatır", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^hatalı görsel$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^hatalı görsel$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // "İptal" butonu — Turkish İ nedeniyle exact string kullan
    fireEvent.click(screen.getByText("İptal"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Hatalı İşaretle modalında onaylanınca markError çağrılır", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^hatalı görsel$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^hatalı görsel$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // Modal içindeki "Hatalı İşaretle" butonu — Turkish İ nedeniyle text içeriğiyle bul
    const allButtons = screen.getAllByRole("button");
    const confirmBtn = allButtons.find((btn) => btn.textContent === "Hatalı İşaretle");
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(serviceMocks.markError).toHaveBeenCalledWith(
        "uuid-1111",
        "phase2",
        "Operatör hatası işaretledi",
        "",
      );
    });
  });

  it("Phase 2 doğrulama özeti paneli render edilir ve yardım paneli açılabilir", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Phase 2 Doğrulama Özeti" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Göster" })).toBeInTheDocument();
    expect(screen.queryByText("Klavye Kısayolları")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Göster" }));

    expect(screen.getByText("Klavye Kısayolları")).toBeInTheDocument();
    expect(screen.getByText("Phase 2 Kapsam Notu")).toBeInTheDocument();
  });

  it("Phase 2 ekranında cari/stok eşleme aksiyonları görünmez", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.queryByRole("searchbox", { name: "Cari Ara" })).not.toBeInTheDocument();
      expect(screen.queryByRole("searchbox", { name: "Stok Ara" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mevcut Cari Seç" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Yeni Cari Aç" })).not.toBeInTheDocument();
    });
  });

  it("hata durumunda alert gösterir", async () => {
    serviceMocks.listRecords.mockRejectedValue(new Error("Sunucu hatası"));
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Sunucu hatası");
    });
  });

  it("belge bilgileri panelinde cari ve kaynak klasör gösterilir", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Cari A.Ş.")).toBeInTheDocument();
      expect(screen.getByText("C:/raw")).toBeInTheDocument();
    });
  });

  // ─── Ö-R: Yeni testler ────────────────────────────────────────────────────────

  it("Tümünü Onayla butonuna tıklanınca tüm düşük güven hücreler onaylanır", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD_ALL_LOW]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tüm düşük güvenli hücreleri onayla" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Tüm düşük güvenli hücreleri onayla" }));
    await waitFor(() => {
      expect(getPhase3PrimaryButton()).not.toBeDisabled();
    });
  });

  it("satır 'Tümü' butonuna tıklanınca o satırın hücreleri onaylanır", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Satır 1 tümünü onayla/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Satır 1 tümünü onayla/i }));
    await waitFor(() => {
      // low_conf_record sadece boy düşük — tümünü onayla Phase 3'ü açar
      expect(getPhase3PrimaryButton()).not.toBeDisabled();
    });
  });

  it("görsel yükleme hatası fallback paneli gösterilir", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByAltText(/OCR görseli/i)).toBeInTheDocument();
    });
    const img = screen.getByAltText(/OCR görseli/i);
    fireEvent.error(img);
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Görsel yüklenemedi" })).toBeInTheDocument();
    });
  });

  it("footer bar 'OCR Kontrol Durum Özeti' region olarak render edilir", async () => {
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "OCR Kontrol Durum Özeti" })).toBeInTheDocument();
    });
  });

  it("Undo panelinde geri al butonu undo servisini çağırır", async () => {
    render(<OCRKontrolPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Göster \(2\)/i }));

    await waitFor(() => {
      expect(screen.getAllByTitle("Bu işlemi geri al").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByTitle("Bu işlemi geri al")[0]);

    await waitFor(() => {
      expect(serviceMocks.undoPhase2Decision).toHaveBeenCalledWith(
        expect.objectContaining({
          recordUuid: "uuid-1111",
          decisionEventId: "evt-1",
        }),
      );
    });
  });

  it("Undo sırasında sadece seçilen event satırı pending görünür", async () => {
    let resolveUndo: ((value: { success: boolean; message: string; revertedEventId: string; gateStatus: string }) => void) | null = null;
    serviceMocks.undoPhase2Decision.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUndo = resolve;
        }),
    );

    render(<OCRKontrolPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Göster \(2\)/i }));

    await waitFor(() => {
      expect(screen.getAllByTitle("Bu işlemi geri al").length).toBeGreaterThanOrEqual(2);
    });

    const buttonsBefore = screen.getAllByRole("button", { name: "Geri Al" });
    fireEvent.click(buttonsBefore[0]);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Geri Alınıyor..." })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Geri Al" }).length).toBeGreaterThanOrEqual(1);
    });

    resolveUndo?.({
      success: true,
      message: "Geri alındı",
      revertedEventId: "evt-1",
      gateStatus: "BLOCKED",
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Geri Alınıyor..." })).not.toBeInTheDocument();
    });
  });

  it("düşük güven kayıt için 'Uyarı' badge kuyrukta görünür", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByText(/Uyarı \d+/)).toBeInTheDocument();
    });
  });

  it("hücre değeri değiştirince otomatik onaylanır (Ö-F)", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Boy onayla satır 1/i })).toBeInTheDocument();
    });
    // input değerini değiştir — otomatik onaylama tetiklenmeli
    const boyInput = screen.getByLabelText(/Boy değeri satır 1/i);
    fireEvent.change(boyInput, { target: { value: "900" } });
    await waitFor(() => {
      expect(serviceMocks.validatePhase2Cell).toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /Boy onayla satır 1/i })).not.toBeInTheDocument();
      expect(screen.getByText("✓ Onaylı")).toBeInTheDocument();
    });
  });

  it("hücre focus olduğunda sol panelde odak alanı metni görünür", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Boy değeri satır 1/i)).toBeInTheDocument();
    });

    fireEvent.focus(screen.getByLabelText(/Boy değeri satır 1/i));
    expect(await screen.findByText("Odak: Boy — bbox sarı")).toBeInTheDocument();
  });

  it("grid input odaktayken Ctrl+A global toplu onay kısayolunu tetiklemez", async () => {
    serviceMocks.listRecords.mockResolvedValue([LOW_CONF_RECORD]);
    render(<OCRKontrolPage />);

    const boyInput = await screen.findByLabelText(/Boy değeri satır 1/i);
    fireEvent.focus(boyInput);
    fireEvent.keyDown(boyInput, { key: "a", ctrlKey: true });

    expect(screen.getByRole("button", { name: /Boy onayla satır 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tüm düşük güvenli hücreleri onayla/i })).toBeInTheDocument();
  });
});

















