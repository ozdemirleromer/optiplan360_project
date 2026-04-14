import { describe, expect, it } from "vitest";
import { recordSelectorSummary } from "./siparisKontrolUtils";
import type { WorkflowRecord } from "../../services/optiplanWorkflowService";

function buildWorkflowRecord(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  return {
    kayitUuid: "uuid-test",
    hamDosyaAdi: "siparis-test.pdf",
    kaynakKlasor: "MANUEL",
    gelisTarihi: null,
    dosyaDurumu: "PHASE3_IN_PROGRESS",
    orijinalDosyaYolu: "",
    dosyaHash: "hash-test",
    ocrHamJson: null,
    ayristirilmisOcrAlanlari: null,
    okunanCariUnvan: "",
    okunanCariTelefon: "",
    aiGuvenSkoruOzeti: null,
    revizyonAdayiUyarisi: "",
    cariUnvan: "",
    cariKodu: "",
    siparisNo: "REC-TEST",
    termin: "",
    teslimTarihi: "",
    teslimatAdresi: "",
    odemeSekli: "",
    malzeme: "",
    stokKodu: "",
    bantKalinligi: "" as WorkflowRecord["bantKalinligi"],
    grainVarsayilan: 0 as WorkflowRecord["grainVarsayilan"],
    plakaBoyMm: 2800,
    plakaEnMm: 2100,
    fireAciklamasi: "",
    retryNo: 0,
    revizyonNo: 0,
    aktifFaz: 3,
    dosyaBoyutu: null,
    islemeKilidi: null,
    kilidZamani: null,
    sonDenemeZamani: null,
    sonrakiDenemeZamani: null,
    sonHataMesaji: null,
    ocrSaglayici: null,
    ocrIslemSuresiMs: null,
    satirlar: [],
    cikarilanSatirlar: [],
    auditKayitlari: [],
    plakalar: [],
    exportKayitlari: [],
    hataKayitlari: [],
    imageUrl: "",
    duplicateFlag: false,
    kaynakKlasorTipi: "MANUEL",
    ...overrides,
  };
}

function buildWorkflowRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "row-1",
    satirSirasi: 1,
    malzeme: "MDF-18MM",
    boy: 2800,
    en: 600,
    adet: 4,
    grain: 0,
    bilgi: "",
    u1: false,
    u2: false,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    satirKaynagi: "OCR",
    plakaRef: "P1",
    bantKalinligiOverride: "",
    hucreGuvenSkorlari: {},
    satirGuvenSkorOzeti: {},
    boyOnay: "BEKLEMEDE",
    enOnay: "BEKLEMEDE",
    adetOnay: "BEKLEMEDE",
    boyOperatorDegeri: null,
    enOperatorDegeri: null,
    adetOperatorDegeri: null,
    onaylayanId: null,
    onayZamani: null,
    bboxJson: null,
    ...overrides,
  };
}

describe("recordSelectorSummary", () => {
  it("genel fire notu varsa fire eksik sayısını sıfırlar", () => {
    const record = buildWorkflowRecord({
      fireAciklamasi: "Genel fire açıklaması: kesim toleransı",
      satirlar: [
        buildWorkflowRow({
          bilgi: "fire gerekli",
          delik1: "fire notu",
        }),
      ] as WorkflowRecord["satirlar"],
    });

    expect(recordSelectorSummary(record)).toEqual({
      eksikStok: 0,
      fireEksik: 0,
    });
  });

  it("genel fire notu yoksa fire gerektiren satırları sayar", () => {
    const record = buildWorkflowRecord({
      satirlar: [
        buildWorkflowRow({
          malzeme: "MDF-18MM",
          bilgi: "standart",
        }),
        buildWorkflowRow({
          satirSirasi: 2,
          bilgi: "birinci satır",
          delik1: "fire nedeni",
        }),
        buildWorkflowRow({
          satirSirasi: 3,
          bilgi: "fire notu gerekli",
        }),
      ] as WorkflowRecord["satirlar"],
    });

    expect(recordSelectorSummary(record)).toEqual({
      eksikStok: 0,
      fireEksik: 2,
    });
  });
});
