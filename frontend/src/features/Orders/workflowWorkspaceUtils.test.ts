import { describe, expect, it, vi } from "vitest";
import type { WorkflowRecord } from "./optiplanWorkflowTypes";
import {
  appendAuditEvent,
  applyBandOverride,
  buildAuditMessage,
  buildEmptyRow,
  buildNewPlate,
  FOLDER_SETTINGS_FIELDS,
  filterCustomerMatches,
  filterStockMatches,
  canProceedToPhase4,
  createAuditEntry,
  exportStatusTone,
  formatAuditTimestamp,
  isPhase2Approved,
  isRowFieldLowConfidence,
  normalizeExportFilename,
  parseNumericInput,
  phase1FolderCounts,
  sortAuditEntriesDesc,
  statusLabel,
  toPreviewRows,
  updateRecord,
  validateFolderSettings,
  validateRow,
  validateRows,
  workflowStatusTone,
} from "./workflowWorkspaceUtils";

function sampleRecord(): WorkflowRecord {
  return {
    kayitUuid: "wf-001",
    hamDosyaAdi: "ornek siparis.pdf",
    kaynakKlasor: "whatsapp_raw",
    gelisTarihi: "2026-03-11T09:15:00Z",
    dosyaDurumu: "OCR_HAVUZU",
    orijinalDosyaYolu: "x",
    dosyaHash: "y",
    okunanCariUnvan: "Ozdemir",
    okunanCariTelefon: "0532",
    aiGuvenSkoruOzeti: "",
    revizyonAdayiUyarisi: "",
    cariUnvan: "Ozdemir",
    cariKodu: "CR-1",
    siparisNo: "SIP 001",
    termin: "2026-03-14",
    teslimTarihi: "2026-03-20",
    teslimatAdresi: "Depo A - Istanbul",
    odemeSekli: "HAVALE",
    malzeme: "MDF",
    stokKodu: "STK-1",
    bantKalinligi: "1 MM",
    grainVarsayilan: 3,
    plakaBoyMm: 2800,
    plakaEnMm: 2100,
    fireAciklamasi: "",
    retryNo: 0,
    revizyonNo: 1,
    xmlFireActive: false,
    selectedFormats: { xlsx: true },
    previewMode: "tek_dosya",
    activePlateRef: "PLAKA-1",
    plates: [{ plakaRef: "PLAKA-1", etiket: "PLAKA-1", plakaBoyMm: 2800, plakaEnMm: 2100 }],
    rows: [
      {
        id: "row-1",
        malzeme: "MDF",
        boy: 450,
        en: 320,
        adet: 2,
        grain: 3,
        bilgi: "",
        u1: true,
        u2: false,
        k1: false,
        k2: false,
        delik1: "",
        delik2: "",
        plakaRef: "PLAKA-1",
        satirKaynagi: "OCR",
        bantKalinligiOverride: "",
        confidence: { boy: 70, en: 90, adet: 95 },
        confidenceApproved: { boy: false, en: true, adet: true },
      },
    ],
    removedRows: [],
    auditTrail: [],
  };
}

describe("workflowWorkspaceUtils", () => {
  it("düşük güven alanını tespit eder", () => {
    const record = sampleRecord();
    expect(isRowFieldLowConfidence(record.rows[0], "boy")).toBe(true);
    expect(isRowFieldLowConfidence(record.rows[0], "en")).toBe(false);
  });

  it("phase2 onay kontrolünü uygular", () => {
    const record = sampleRecord();
    expect(isPhase2Approved(record)).toBe(false);
    record.rows[0].confidenceApproved.boy = true;
    expect(isPhase2Approved(record)).toBe(true);
  });

  it("dosya adını normalize eder", () => {
    const record = sampleRecord();
    const normalized = normalizeExportFilename(record);
    expect(normalized).toContain("CR-1");
    expect(normalized).toContain("R1");
    expect(normalized).toContain("T0");
  });

  it("preview satırlarını dönüştürür", () => {
    const record = sampleRecord();
    const rows = toPreviewRows(record);
    expect(rows).toHaveLength(1);
    expect(rows[0].pLength).toBe(450);
    expect(rows[0].pCodeMat).toBe("MDF");
  });

  it("durum etiketini map eder", () => {
    expect(statusLabel("OCR_HAVUZU")).toBe("OCR Havuzu");
    expect(statusLabel("HATALI")).toBe("Hatalı");
  });

  it("klasör sayaçlarını çıkarır", () => {
    const first = sampleRecord();
    const second = { ...sampleRecord(), kayitUuid: "wf-002", kaynakKlasor: "scanner_raw" as const };
    const counts = phase1FolderCounts([first, second]);
    expect(counts.whatsapp_raw).toBe(1);
    expect(counts.scanner_raw).toBe(1);
  });

  it("satır validasyonlarını üretir", () => {
    const record = sampleRecord();
    record.rows[0].malzeme = "";
    record.rows[0].boy = 0;
    const errors = validateRows(record);
    expect(errors.length).toBeGreaterThan(1);
  });

  it("boş satır oluşturur", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    const row = buildEmptyRow(sampleRecord());
    expect(row.id).toBe("row-1234");
    expect(row.satirKaynagi).toBe("MANUEL");
    vi.restoreAllMocks();
  });

  it("yeni plaka oluşturur", () => {
    const plate = buildNewPlate(sampleRecord());
    expect(plate.plakaRef).toBe("PLAKA-2");
  });

  it("bant override uygular", () => {
    const row = sampleRecord().rows[0];
    expect(applyBandOverride(row, "2 MM").bantKalinligiOverride).toBe("2 MM");
  });

  it("kayıt güncelleme yardımcısını uygular", () => {
    const record = sampleRecord();
    const updated = updateRecord([record], "wf-001", (item) => ({ ...item, cariKodu: "CR-2" }));
    expect(updated[0].cariKodu).toBe("CR-2");
  });

  it("klasör ayarlarında mutlak yol ve tekrar validasyonu yapar", () => {
    const errors = validateFolderSettings({
      whatsappRawKlasoru: "optiplan/inbox/whatsapp",
      scannerRawKlasoru: "C:/optiplan/inbox/whatsapp",
      manuelRawKlasoru: "C:/optiplan/inbox/manual",
      emailRawKlasoru: "C:/optiplan/inbox/email",
      islenmisKlasoru: "C:/optiplan/processed",
      hataliKlasoru: "C:/optiplan/inbox/manual",
    });

    expect(errors.whatsappRawKlasoru).toBe("Geçerli bir mutlak klasör yolu giriniz.");
    expect(errors.hataliKlasoru).toBe("Bu klasör yolu başka bir alanla aynı olamaz.");
  });

  it("cari ve stok filtre yardımcısı aramayı daraltır", () => {
    const filteredCustomers = filterCustomerMatches(
      [
        { cariKodu: "CR-001", cariUnvan: "Ozdemir Mobilya", telefon: "0532" },
        { cariKodu: "CR-999", cariUnvan: "Omega Ahsap", telefon: "0544" },
      ],
      "omega",
    );
    expect(filteredCustomers).toHaveLength(1);
    expect(filteredCustomers[0].cariKodu).toBe("CR-999");

    const filteredStocks = filterStockMatches(
      [
        { stokKodu: "STK-001", stokAdi: "BEYAZ MDFLAM" },
        { stokKodu: "STK-999", stokAdi: "SIYAH MDFLAM" },
      ],
      "siyah",
    );
    expect(filteredStocks).toHaveLength(1);
    expect(filteredStocks[0].stokKodu).toBe("STK-999");
  });

  it("klasör form şemasında tüm alanlar tanımlıdır", () => {
    expect(FOLDER_SETTINGS_FIELDS).toHaveLength(6);
    expect(FOLDER_SETTINGS_FIELDS.map((item) => item.key)).toEqual([
      "whatsappRawKlasoru",
      "scannerRawKlasoru",
      "manuelRawKlasoru",
      "emailRawKlasoru",
      "islenmisKlasoru",
      "hataliKlasoru",
    ]);
  });

  it("tek satır validasyonunu üretir", () => {
    const row = {
      ...sampleRecord().rows[0],
      malzeme: "",
      boy: 0,
      en: 0,
      adet: 0,
    };
    const errors = validateRow(row);
    expect(errors).toHaveLength(4);
  });

  it("phase4 guard yardımcısı tüm koşulları birlikte değerlendirir", () => {
    const record = sampleRecord();
    record.cariKodu = "CR-001";
    record.stokKodu = "STK-001";

    expect(canProceedToPhase4(record, [], false)).toBe(true);
    record.termin = "";
    expect(canProceedToPhase4(record, [], false)).toBe(false);
    record.termin = "2026-03-14";
    expect(canProceedToPhase4(record, ["Satır hatası"], false)).toBe(false);
    expect(canProceedToPhase4(record, [], true)).toBe(false);
    expect(canProceedToPhase4(null, [], false)).toBe(false);
  });

  it("audit mesajını ve kaydını üretir", () => {
    vi.spyOn(Date, "now").mockReturnValue(111);
    vi.spyOn(global.Math, "random").mockReturnValue(0.5);
    const text = buildAuditMessage({ type: "customer-matched", cariKodu: "CR-001" });
    expect(text).toBe("Cari eşleşti: CR-001");

    const entry = createAuditEntry({ type: "plate-added", plateRef: "PLAKA-3" });
    expect(entry.id).toBe("111-0.5");
    expect(entry.text).toBe("Yeni plaka tanımlandı: PLAKA-3");
    vi.restoreAllMocks();
  });

  it("audit kayıtlarını tarihe göre sıralar", () => {
    const sorted = sortAuditEntriesDesc([
      { id: "1", text: "ilk", createdAt: "2026-03-10T10:00:00Z" },
      { id: "2", text: "son", createdAt: "2026-03-12T10:00:00Z" },
    ]);
    expect(sorted[0].id).toBe("2");
  });

  it("audit zaman damgasını geçersiz değerde güvenli fallback ile formatlar", () => {
    expect(formatAuditTimestamp("gecersiz")).toBe("—");
    expect(formatAuditTimestamp("")).toBe("—");
    expect(formatAuditTimestamp("2026-03-12T10:00:00Z")).not.toBe("—");
  });

  it("sayi parse yardimcisi bos ve gecersiz girdiyi temizler", () => {
    expect(parseNumericInput("42")).toBe(42);
    expect(parseNumericInput(" ")).toBe("");
    expect(parseNumericInput("abc")).toBe("");
  });

  it("export durumuna gore ton degerini dondurur", () => {
    expect(exportStatusTone("BASARILI")).toContain("16,185,129");
    expect(exportStatusTone("KISMI_BASARILI")).toContain("245,158,11");
    expect(exportStatusTone("HATALI")).toContain("248,113,113");
    expect(exportStatusTone("BILINMIYOR")).toContain("59,130,246");
  });

  it("workflow durum etiketine gore rozet tonunu dondurur", () => {
    expect(workflowStatusTone("Tamamlandı")).toContain("16,185,129");
    expect(workflowStatusTone("Hatalı")).toContain("248,113,113");
    expect(workflowStatusTone("OCR Havuzu")).toContain("59,130,246");
  });

  it("appendAuditEvent yeni kaydı başa ekler ve limiti korur", () => {
    const base = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      text: `Kayıt ${index}`,
      createdAt: "2026-03-10T10:00:00Z",
    }));

    const next = appendAuditEvent(base, { type: "stock-matched", stokKodu: "STK-001" });
    expect(next).toHaveLength(20);
    expect(next[0].text).toBe("Stok eşleşti: STK-001");
  });
});
