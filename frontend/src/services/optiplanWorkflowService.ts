import { apiRequest } from "./apiClient";
import type {
  AuditTrailResponse,
  BatchApproveCommitResponse,
  BatchApproveDryRunResponse,
  BatchApproveQuery,
  CellDecideRequest,
  CellDecideResponse,
  Phase3GateStatusResponse,
  UndoResponse,
  ValidateCellResponse,
} from "../types/phase2_types";
import type {
  WorkflowAuditTrailEntry as LegacyWorkflowAuditTrailEntry,
  WorkflowBandThickness as LegacyWorkflowBandThickness,
  WorkflowCustomerMatch as LegacyWorkflowCustomerMatch,
  WorkflowDataset as LegacyWorkflowDataset,
  WorkflowFileStatus as LegacyWorkflowFileStatus,
  WorkflowGrain as LegacyWorkflowGrain,
  WorkflowPlate as LegacyWorkflowPlate,
  WorkflowPreviewRow as LegacyWorkflowPreviewRow,
  WorkflowRecord as LegacyWorkflowRecord,
  WorkflowRow as LegacyWorkflowRow,
  WorkflowRowSource as LegacyWorkflowRowSource,
  WorkflowSourceFolder as LegacyWorkflowSourceFolder,
  WorkflowStockMatch as LegacyWorkflowStockMatch,
} from "../features/Orders/optiplanWorkflowTypes";

export type WorkflowSourceFolder = LegacyWorkflowSourceFolder;
export type WorkflowBandThickness = LegacyWorkflowBandThickness | "";
export type WorkflowGrain = LegacyWorkflowGrain;

export interface FolderSettings {
  programKokKlasoru: string;
  whatsappRawKlasoru: string;
  scannerRawKlasoru: string;
  manuelRawKlasoru: string;
  emailRawKlasoru: string;
  islenmisKlasoru: string;
  arsivKlasoru: string;
  xmlOkumaKlasoru: string;
  xlsxCiktiKlasoru: string;
  opjCiktiKlasoru: string;
  hataliKlasoru: string;
  fisEvrakNoFormati: string;
  arsivZamanDamgasiFormati: string;
  xlsxAktifMi: boolean;
  opjAktifMi: boolean;
  watcherAktifMi: boolean;
  yenidenDenemeSayisi: number;
}

export type WorkflowLookupCustomer = LegacyWorkflowCustomerMatch;
export type WorkflowLookupStock = LegacyWorkflowStockMatch;

export interface WorkflowPlate {
  id: string;
  plakaRef: string;
  etiket: string;
  plakaBoyMm: number;
  plakaEnMm: number;
  genelListedeMi: boolean;
}

export type CellApprovalStatus = "BEKLEMEDE" | "ONAYLANDI" | "DUZELTILDI";

export interface WorkflowRow {
  id: string;
  satirSirasi: number;
  malzeme: string;
  boy: number | null;
  en: number | null;
  adet: number | null;
  grain: WorkflowGrain;
  bilgi: string;
  u1: boolean;
  u2: boolean;
  k1: boolean;
  k2: boolean;
  delik1: string;
  delik2: string;
  satirKaynagi: string;
  plakaRef: string;
  bantKalinligiOverride: WorkflowBandThickness;
  hucreGuvenSkorlari: Record<string, number>;
  satirGuvenSkorOzeti: Record<string, unknown>;
  // Phase 2 — per-cell onay
  boyOnay: CellApprovalStatus;
  enOnay: CellApprovalStatus;
  adetOnay: CellApprovalStatus;
  boyOperatorDegeri: number | null;
  enOperatorDegeri: number | null;
  adetOperatorDegeri: number | null;
  onaylayanId: number | null;
  onayZamani: string | null;
  bboxJson: Record<string, unknown>[] | null;
}

export interface WorkflowAuditRecord {
  id: string | number;
  satirId: string | null;
  alanAdi: string;
  eskiDeger: string | null;
  yeniDeger: string | null;
  userId: number | null;
  islemTipi: string | null;
  createdAt: string | null;
}

export type WorkflowExportFormat = "xlsx";

export interface WorkflowExportFileArtifact {
  fileFormat: WorkflowExportFormat;
  fileName: string;
  filePath: string;
  downloadPath: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface WorkflowExportManifest {
  manifestVersion: string;
  kayitUuid: string;
  exportId: string | null;
  dosyaAdi: string;
  revizyonNo: number;
  retryNo: number;
  requestedFormats: WorkflowExportFormat[];
  generatedFormats: WorkflowExportFormat[];
  rowCount: number;
  createdAt: string | null;
}

export interface WorkflowExportRecord {
  id: string;
  dosyaAdi: string;
  xlsxAktifMi: boolean;
  requestedFormats: WorkflowExportFormat[];
  generatedFormats: WorkflowExportFormat[];
  generatedDosyalar: WorkflowExportFileArtifact[];
  generatedFiles: string[];
  durum: string;
  exportManifest: WorkflowExportManifest | null;
  manifestVersion: string | null;
  retryNo: number;
  revizyonNo: number;
  createdAt: string | null;
}

export interface WorkflowErrorRecord {
  id: string;
  cariUnvan: string | null;
  siparisNo: string | null;
  hamDosyaAdi: string;
  kaynakKlasor: string;
  hataFazi: string;
  hataNedeni: string;
  denemeNo: number;
  saglayici: string | null;
  tarihSaat: string | null;
  operatorNotu: string | null;
}

export interface WorkflowRecord {
  kayitUuid: string;
  hamDosyaAdi: string;
  kaynakKlasor: string;
  gelisTarihi: string | null;
  dosyaDurumu: string;
  orijinalDosyaYolu: string;
  dosyaHash: string;
  ocrHamJson: Record<string, unknown> | null;
  ayristirilmisOcrAlanlari: Record<string, unknown> | null;
  okunanCariUnvan: string;
  okunanCariTelefon: string;
  aiGuvenSkoruOzeti: Record<string, unknown> | null;
  revizyonAdayiUyarisi: string;
  cariUnvan: string;
  cariKodu: string;
  siparisNo: string;
  termin: string;
  teslimTarihi: string;
  teslimatAdresi: string;
  odemeSekli: string;
  malzeme: string;
  stokKodu: string;
  bantKalinligi: WorkflowBandThickness;
  grainVarsayilan: WorkflowGrain;
  plakaBoyMm: number | null;
  plakaEnMm: number | null;
  fireAciklamasi: string;
  retryNo: number;
  revizyonNo: number;
  aktifFaz: number;
  // Phase 1 — pipeline tracking
  dosyaBoyutu: number | null;
  islemeKilidi: string | null;
  kilidZamani: string | null;
  sonDenemeZamani: string | null;
  sonrakiDenemeZamani: string | null;
  sonHataMesaji: string | null;
  ocrSaglayici: string | null;
  ocrIslemSuresiMs: number | null;
  satirlar: WorkflowRow[];
  cikarilanSatirlar: WorkflowRow[];
  auditKayitlari: WorkflowAuditRecord[];
  plakalar: WorkflowPlate[];
  exportKayitlari: WorkflowExportRecord[];
  hataKayitlari: WorkflowErrorRecord[];
  imageUrl: string;
  sonGuncelleme?: string | null;   // opsiyonel – backend güncelleme zamanı
  duplicateFlag: boolean | null;   // spec §6.1 — yineleme tespiti
  kaynakKlasorTipi: string | null; // spec §6.1 — klasör tipi (e.g. "watched", "manual")
}

export interface WorkflowExportPreview {
  kayitUuid: string;
  dosyaAdi: string;
  xlsxAktifMi: boolean;
  revizyonNo: number;
  satirlar: Array<Record<string, string | number>>;
  durum?: "BASARILI" | "HATALI" | "KISMI_BASARILI";
  generatedFiles?: string[];
  generatedFileDetails?: WorkflowExportFileArtifact[];
  exportManifest: WorkflowExportManifest;
}

export interface WorkflowExportRunResult {
  success: boolean;
  message: string;
  durum: "BASARILI" | "HATALI" | "KISMI_BASARILI" | "BILINMIYOR";
  generatedFiles: string[];
  generatedFileDetails: WorkflowExportFileArtifact[];
  exportManifest: WorkflowExportManifest | null;
}

export interface WorkflowExportTelemetryFilters {
  kayitUuid?: string;
  fromTs?: string;
  toTs?: string;
  limit?: number;
  offset?: number;
}

export interface WorkflowExportStatusAnomalyItem {
  id: number;
  kayitUuid: string;
  alanAdi: string;
  eskiDeger: string | null;
  yeniDeger: string | null;
  createdAt: string | null;
}

export interface WorkflowExportStatusAnomalySummary {
  totalRecords: number;
  distinctRecords: number;
  lastCreatedAt: string | null;
  statusBreakdown: Record<string, number>;
}

export interface WorkflowExportStatusAnomalyResponse {
  limit: number;
  offset: number;
  filters: {
    kayitUuid: string | null;
    fromTs: string | null;
    toTs: string | null;
  };
  summary: WorkflowExportStatusAnomalySummary;
  items: WorkflowExportStatusAnomalyItem[];
}

interface WorkflowExportStatusAnomalyItemApi {
  id: number;
  kayit_uuid: string;
  alan_adi: string;
  eski_deger: string | null;
  yeni_deger: string | null;
  created_at: string | null;
}

interface WorkflowExportStatusAnomalySummaryApi {
  total_records: number;
  distinct_records: number;
  last_created_at: string | null;
  status_breakdown: Record<string, number>;
}

interface WorkflowExportStatusAnomalyResponseApi {
  limit: number;
  offset: number;
  filters: {
    kayit_uuid: string | null;
    from: string | null;
    to: string | null;
  };
  summary: WorkflowExportStatusAnomalySummaryApi;
  items: WorkflowExportStatusAnomalyItemApi[];
}

type Phase2ConfidenceField = "boy" | "en" | "adet";

function normalizeRowSource(value: unknown, fallback: LegacyWorkflowRowSource = "OCR"): LegacyWorkflowRowSource {
  const source = String(value ?? fallback).trim().toUpperCase();
  return source === "MANUEL" ? "MANUEL" : "OCR";
}

function mapStatus(status: string): LegacyWorkflowFileStatus {
  if (status.includes("PHASE_2")) return "OCR_KONTROL";
  if (status.includes("PHASE_3")) return "SIPARIS_DUZENLEME";
  if (status.includes("PHASE_4")) return "EXPORT_ONIZLEME";
  if (status.includes("HATALI")) return "HATALI";
  return "OCR_HAVUZU";
}

function toLegacyPlate(plate: WorkflowPlate): LegacyWorkflowPlate {
  return {
    plakaRef: plate.plakaRef,
    etiket: plate.etiket,
    plakaBoyMm: plate.plakaBoyMm,
    plakaEnMm: plate.plakaEnMm,
  };
}

function toLegacyRow(row: WorkflowRow): LegacyWorkflowRow {
  const normalizedSource = normalizeRowSource(row.satirKaynagi, "OCR");
  const approvedFields = Array.isArray(row.satirGuvenSkorOzeti?.onaylanan_hucreler)
    ? row.satirGuvenSkorOzeti.onaylanan_hucreler.map((item) => String(item))
    : [];
  const isApproved = (field: Phase2ConfidenceField, score: number) => approvedFields.includes(field) || score >= 80;
  return {
    id: row.id,
    malzeme: row.malzeme,
    boy: row.boy ?? "",
    en: row.en ?? "",
    adet: row.adet ?? "",
    grain: row.grain,
    bilgi: row.bilgi,
    u1: row.u1,
    u2: row.u2,
    k1: row.k1,
    k2: row.k2,
    delik1: row.delik1,
    delik2: row.delik2,
    plakaRef: row.plakaRef,
    satirKaynagi: normalizedSource,
    bantKalinligiOverride: row.bantKalinligiOverride || "",
    confidence: {
      boy: Number(row.hucreGuvenSkorlari.boy ?? 100),
      en: Number(row.hucreGuvenSkorlari.en ?? 100),
      adet: Number(row.hucreGuvenSkorlari.adet ?? 100),
    },
    confidenceApproved: {
      boy: isApproved("boy", Number(row.hucreGuvenSkorlari.boy ?? 100)),
      en: isApproved("en", Number(row.hucreGuvenSkorlari.en ?? 100)),
      adet: isApproved("adet", Number(row.hucreGuvenSkorlari.adet ?? 100)),
    },
  };
}

function buildLegacyAuditText(record: WorkflowAuditRecord): string {
  const formatTransition = () => {
    if (record.eskiDeger == null && record.yeniDeger == null) {
      return "";
    }
    return ` (${record.eskiDeger ?? "∅"} -> ${record.yeniDeger ?? "∅"})`;
  };

  switch (record.alanAdi) {
    case "phase2_row_removed":
      return `Satır pasife alındı: ${record.satirId ?? "-"}`;
    case "phase2_row_restored":
      return `Pasif satır geri alındı: ${record.satirId ?? "-"}`;
    case "phase3_row_created":
      return `Yeni satır kalıcı kayda eklendi: ${record.satirId ?? "-"}`;
    case "export_durum":
      return `Export denemesi kaydedildi${formatTransition()}`;
    case "export_durum_anomali":
      return `Export durum anomalisi kaydedildi${formatTransition()}`;
    default:
      if (record.alanAdi.startsWith("phase3_row.")) {
        return `Satır alanı güncellendi: ${record.alanAdi.replace("phase3_row.", "")}${formatTransition()}`;
      }
      return `${record.alanAdi} güncellendi${formatTransition()}`;
  }
}

function toLegacyAuditEntry(record: WorkflowAuditRecord): LegacyWorkflowAuditTrailEntry {
  return {
    id: String(record.id),
    text: buildLegacyAuditText(record),
    createdAt: record.createdAt ?? "",
    satirId: record.satirId,
    alanAdi: record.alanAdi,
    eskiDeger: record.eskiDeger,
    yeniDeger: record.yeniDeger,
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatConfidenceSummary(summary: Record<string, unknown> | null, rowCount: number): string {
  if (!summary) {
    return rowCount > 0 ? `${rowCount} OCR satırı bulundu, güven özeti yok.` : "OCR güven özeti bulunamadı.";
  }

  const lineCount = toNumberOrNull(summary.line_count) ?? rowCount;
  const avgConfidence = toNumberOrNull(summary.avg_confidence);
  const minConfidence = toNumberOrNull(summary.min_confidence);
  const reviewRequired = Boolean(summary.review_required);

  const parts = [
    lineCount > 0 ? `${lineCount} OCR satırı` : "OCR satırı yok",
    avgConfidence != null ? `Ort. güven ${avgConfidence.toFixed(0)}` : null,
    minConfidence != null ? `Min. güven ${minConfidence.toFixed(0)}` : null,
    reviewRequired ? "manuel kontrol gerekli" : "otomatik kabul sınırında",
  ].filter((item): item is string => Boolean(item));

  return parts.join(" · ");
}

function deriveLegacyOcrSignals(record: WorkflowRecord) {
  const raw = record.ocrHamJson ?? {};
  const summary = record.aiGuvenSkoruOzeti;
  return {
    summaryText: formatConfidenceSummary(summary, record.satirlar.length),
    engine: raw.engine == null ? null : String(raw.engine),
    status: raw.status == null ? null : String(raw.status),
    documentKind: raw.document_kind == null ? null : String(raw.document_kind),
    reviewRequired: Boolean(summary?.review_required),
    lineCount: toNumberOrNull(summary?.line_count) ?? record.satirlar.length,
    avgConfidence: toNumberOrNull(summary?.avg_confidence),
    minConfidence: toNumberOrNull(summary?.min_confidence),
  };
}

function toLegacyRecord(record: WorkflowRecord, settings?: FolderSettings): LegacyWorkflowRecord {
  const ocrSignals = deriveLegacyOcrSignals(record);
  const selectedFormats = {
    xlsx: settings?.xlsxAktifMi ?? true,
  };
  const activePlateRef = record.plakalar[0]?.plakaRef ?? "PLAKA-1";
  return {
    kayitUuid: record.kayitUuid,
    hamDosyaAdi: record.hamDosyaAdi,
    kaynakKlasor: record.kaynakKlasor as LegacyWorkflowRecord["kaynakKlasor"],
    gelisTarihi: record.gelisTarihi ?? new Date().toISOString(),
    dosyaDurumu: mapStatus(record.dosyaDurumu),
    orijinalDosyaYolu: record.orijinalDosyaYolu,
    dosyaHash: record.dosyaHash,
    okunanCariUnvan: record.okunanCariUnvan,
    okunanCariTelefon: record.okunanCariTelefon,
    aiGuvenSkoruOzeti: ocrSignals.summaryText,
    aiGuvenSkoruDetayi: record.aiGuvenSkoruOzeti,
    ocrEngine: ocrSignals.engine,
    ocrDurumu: ocrSignals.status,
    ocrBelgeTuru: ocrSignals.documentKind,
    ocrReviewRequired: ocrSignals.reviewRequired,
    ocrSatirSayisi: ocrSignals.lineCount,
    ocrOrtGuven: ocrSignals.avgConfidence,
    ocrMinGuven: ocrSignals.minConfidence,
    revizyonAdayiUyarisi: record.revizyonAdayiUyarisi,
    cariUnvan: record.cariUnvan,
    cariKodu: record.cariKodu,
    siparisNo: record.siparisNo,
    termin: record.termin,
    teslimTarihi: record.teslimTarihi,
    teslimatAdresi: record.teslimatAdresi,
    odemeSekli: record.odemeSekli,
    malzeme: record.malzeme,
    stokKodu: record.stokKodu,
    bantKalinligi: (record.bantKalinligi || "0.40 MM") as LegacyWorkflowRecord["bantKalinligi"],
    grainVarsayilan: record.grainVarsayilan,
    plakaBoyMm: record.plakaBoyMm ?? 0,
    plakaEnMm: record.plakaEnMm ?? 0,
    fireAciklamasi: record.fireAciklamasi,
    retryNo: record.retryNo,
    revizyonNo: record.revizyonNo,
    rawImageUrl: record.imageUrl,
    xmlFireActive: false,
    selectedFormats,
    previewMode: "tek_dosya",
    activePlateRef,
    plates: record.plakalar.map(toLegacyPlate),
    rows: record.satirlar.map(toLegacyRow),
    removedRows: record.cikarilanSatirlar.map(toLegacyRow),
    auditTrail: record.auditKayitlari.map(toLegacyAuditEntry),
  };
}

function fromLegacyRow(row: LegacyWorkflowRow): WorkflowRow {
  const normalizedSource = normalizeRowSource(row.satirKaynagi, "MANUEL");
  const approvedFields = (Object.entries(row.confidenceApproved) as Array<[Phase2ConfidenceField, boolean]>)
    .filter(([, approved]) => approved)
    .map(([field]) => field);
  return {
    id: row.id,
    satirSirasi: 1,
    malzeme: row.malzeme,
    boy: row.boy === "" ? null : Number(row.boy),
    en: row.en === "" ? null : Number(row.en),
    adet: row.adet === "" ? null : Number(row.adet),
    grain: row.grain,
    bilgi: row.bilgi,
    u1: row.u1,
    u2: row.u2,
    k1: row.k1,
    k2: row.k2,
    delik1: row.delik1,
    delik2: row.delik2,
    satirKaynagi: normalizedSource,
    plakaRef: row.plakaRef,
    bantKalinligiOverride: row.bantKalinligiOverride,
    hucreGuvenSkorlari: row.confidence as unknown as Record<string, number>,
    satirGuvenSkorOzeti: {
      onaylanan_hucreler: approvedFields,
    },
    boyOnay: "BEKLEMEDE" as CellApprovalStatus,
    enOnay: "BEKLEMEDE" as CellApprovalStatus,
    adetOnay: "BEKLEMEDE" as CellApprovalStatus,
    boyOperatorDegeri: null,
    enOperatorDegeri: null,
    adetOperatorDegeri: null,
    onaylayanId: null,
    onayZamani: null,
    bboxJson: null,
  };
}

function fromLegacyRecord(record: LegacyWorkflowRecord): {
  kayitUuid: string;
  phase2Rows: WorkflowRow[];
  phase3Rows: WorkflowRow[];
  plates: WorkflowPlate[];
} {
  return {
    kayitUuid: record.kayitUuid,
    phase2Rows: record.rows.map(fromLegacyRow),
    phase3Rows: record.rows.map(fromLegacyRow),
    plates: record.plates.map((plate) => ({
      id: plate.plakaRef,
      plakaRef: plate.plakaRef,
      etiket: plate.etiket,
      plakaBoyMm: plate.plakaBoyMm,
      plakaEnMm: plate.plakaEnMm,
      genelListedeMi: false,
    })),
  };
}

function toLegacyPreviewRows(preview: WorkflowExportPreview): LegacyWorkflowPreviewRow[] {
  return (preview.satirlar ?? []).map((row, index) => ({
    id: `preview-${index}`,
    pCodeMat: String(row["[P_CODE_MAT]"] ?? ""),
    pLength: Number(row["[P_LENGTH]"] ?? 0),
    pWidth: Number(row["[P_WIDTH]"] ?? 0),
    pMinq: Number(row["[P_MINQ]"] ?? 0),
    pGrain: Number(row["[P_GRAIN]"] ?? 0),
    pIdesc: String(row["[P_IDESC]"] ?? ""),
    pEdgeMatUp: (row["[P_EDGE_MAT_UP]"] ?? "") as LegacyWorkflowPreviewRow["pEdgeMatUp"],
    pEgdeMatLo: (row["[P_EGDE_MAT_LO]"] ?? "") as LegacyWorkflowPreviewRow["pEgdeMatLo"],
    pEdgeMatSx: (row["[P_EDGE_MAT_SX]"] ?? "") as LegacyWorkflowPreviewRow["pEdgeMatSx"],
    pEdgeMatDx: (row["[P_EDGE_MAT_DX]"] ?? "") as LegacyWorkflowPreviewRow["pEdgeMatDx"],
    pIidesc: String(row["[P_IIDESC]"] ?? ""),
    pDesc1: String(row["[P_DESC1]"] ?? ""),
  }));
}

function buildExportResultMessage(
  preview: WorkflowExportPreview,
  fileLabels: string[],
  durum: WorkflowExportRunResult["durum"],
): string {
  if (fileLabels.length > 0) {
    const prefix = durum === "KISMI_BASARILI" ? "Kısmi export üretildi" : "Export üretildi";
    return `${prefix}: ${fileLabels.join(", ")}`;
  }

  if (durum === "HATALI") {
    return "Export tamamlanamadı.";
  }

  if (durum === "KISMI_BASARILI") {
    return "Export kısmi başarılı.";
  }

  if (durum === "BILINMIYOR") {
    return "Export sonucu belirsiz.";
  }

  return "Export işlemi tamamlandı.";
}

function normalizeExportDurum(value: WorkflowExportPreview["durum"]): WorkflowExportRunResult["durum"] {
  if (value === "BASARILI" || value === "HATALI" || value === "KISMI_BASARILI") {
    return value;
  }
  return "BILINMIYOR";
}

function mapExportPreviewToRunResult(preview: WorkflowExportPreview): WorkflowExportRunResult {
  const files = preview.generatedFiles ?? [];
  const generatedFileDetails = preview.generatedFileDetails ?? [];
  const durum = normalizeExportDurum(preview.durum);
  const fileLabels = generatedFileDetails.length > 0 ? generatedFileDetails.map((item) => item.fileName) : files;

  return {
    success: durum === "BASARILI" || durum === "KISMI_BASARILI",
    message: buildExportResultMessage(preview, fileLabels, durum),
    durum,
    generatedFiles: files,
    generatedFileDetails,
    exportManifest: preview.exportManifest ?? null,
  };
}

function normalizeExportFileArtifact(payload: Record<string, unknown>): WorkflowExportFileArtifact {
  return {
    fileFormat: String(payload.fileFormat ?? payload.file_format ?? "xlsx") as WorkflowExportFormat,
    fileName: String(payload.fileName ?? payload.file_name ?? ""),
    filePath: String(payload.filePath ?? payload.file_path ?? ""),
    downloadPath: String(payload.downloadPath ?? payload.download_path ?? ""),
    sizeBytes: Number(payload.sizeBytes ?? payload.size_bytes ?? 0),
    checksumSha256: String(payload.checksumSha256 ?? payload.checksum_sha256 ?? ""),
  };
}

function normalizeExportManifest(payload: Record<string, unknown> | null | undefined): WorkflowExportManifest | null {
  if (!payload) {
    return null;
  }
  return {
    manifestVersion: String(payload.manifestVersion ?? payload.manifest_version ?? ""),
    kayitUuid: String(payload.kayitUuid ?? payload.kayit_uuid ?? ""),
    exportId: payload.exportId == null && payload.export_id == null ? null : String(payload.exportId ?? payload.export_id),
    dosyaAdi: String(payload.dosyaAdi ?? payload.dosya_adi ?? ""),
    revizyonNo: Number(payload.revizyonNo ?? payload.revizyon_no ?? 0),
    retryNo: Number(payload.retryNo ?? payload.retry_no ?? 0),
    requestedFormats: Array.isArray(payload.requestedFormats ?? payload.requested_formats)
      ? ((payload.requestedFormats ?? payload.requested_formats) as unknown[]).map((item) => String(item) as WorkflowExportFormat)
      : [],
    generatedFormats: Array.isArray(payload.generatedFormats ?? payload.generated_formats)
      ? ((payload.generatedFormats ?? payload.generated_formats) as unknown[]).map((item) => String(item) as WorkflowExportFormat)
      : [],
    rowCount: Number(payload.rowCount ?? payload.row_count ?? 0),
    createdAt: (payload.createdAt ?? payload.created_at) == null ? null : String(payload.createdAt ?? payload.created_at),
  };
}

function normalizeExportRecord(payload: Record<string, unknown>): WorkflowExportRecord {
  const generatedDosyalar = Array.isArray(payload.generatedDosyalar ?? payload.generated_dosyalar)
    ? ((payload.generatedDosyalar ?? payload.generated_dosyalar) as unknown[]).map((item) => normalizeExportFileArtifact(item as Record<string, unknown>))
    : [];
  return {
    id: String(payload.id ?? ""),
    dosyaAdi: String(payload.dosyaAdi ?? payload.dosya_adi ?? ""),
    xlsxAktifMi: Boolean(payload.xlsxAktifMi ?? payload.xlsx_aktif_mi),
    requestedFormats: Array.isArray(payload.requestedFormats ?? payload.requested_formats)
      ? ((payload.requestedFormats ?? payload.requested_formats) as unknown[]).map((item) => String(item) as WorkflowExportFormat)
      : [],
    generatedFormats: Array.isArray(payload.generatedFormats ?? payload.generated_formats)
      ? ((payload.generatedFormats ?? payload.generated_formats) as unknown[]).map((item) => String(item) as WorkflowExportFormat)
      : [],
    generatedDosyalar,
    generatedFiles: Array.isArray(payload.generatedFiles ?? payload.generated_files)
      ? ((payload.generatedFiles ?? payload.generated_files) as unknown[]).map((item) => String(item))
      : generatedDosyalar.map((item) => item.filePath),
    durum: String(payload.durum ?? ""),
    exportManifest: normalizeExportManifest((payload.exportManifest ?? payload.export_manifest) as Record<string, unknown> | null | undefined),
    manifestVersion: (payload.manifestVersion ?? payload.manifest_version) == null
      ? null
      : String(payload.manifestVersion ?? payload.manifest_version),
    retryNo: Number(payload.retryNo ?? payload.retry_no ?? 0),
    revizyonNo: Number(payload.revizyonNo ?? payload.revizyon_no ?? 0),
    createdAt: (payload.createdAt ?? payload.created_at) == null ? null : String(payload.createdAt ?? payload.created_at),
  };
}

function normalizeExportPreview(payload: Record<string, unknown>): WorkflowExportPreview {
  return {
    kayitUuid: String(payload.kayitUuid ?? payload.kayit_uuid ?? ""),
    dosyaAdi: String(payload.dosyaAdi ?? payload.dosya_adi ?? ""),
    xlsxAktifMi: Boolean(payload.xlsxAktifMi ?? payload.xlsx_aktif_mi),
    revizyonNo: Number(payload.revizyonNo ?? payload.revizyon_no ?? 0),
    satirlar: Array.isArray(payload.satirlar)
      ? ((payload.satirlar as unknown[]) as Array<Record<string, string | number>>)
      : [],
    durum:
      (payload.durum == null ? undefined : String(payload.durum)) as WorkflowExportPreview["durum"],
    generatedFiles: Array.isArray(payload.generatedFiles ?? payload.generated_files)
      ? ((payload.generatedFiles ?? payload.generated_files) as unknown[]).map((item) => String(item))
      : [],
    generatedFileDetails: Array.isArray(payload.generatedFileDetails ?? payload.generated_file_details)
      ? ((payload.generatedFileDetails ?? payload.generated_file_details) as unknown[]).map((item) =>
          normalizeExportFileArtifact(item as Record<string, unknown>),
        )
      : [],
    exportManifest:
      normalizeExportManifest(
        (payload.exportManifest ?? payload.export_manifest) as Record<string, unknown> | null | undefined,
      ) ?? {
        manifestVersion: "",
        kayitUuid: "",
        exportId: null,
        dosyaAdi: "",
        revizyonNo: 0,
        retryNo: 0,
        requestedFormats: [],
        generatedFormats: [],
        rowCount: 0,
        createdAt: null,
      },
  };
}

function normalizeFolderSettings(payload: Record<string, unknown>): FolderSettings {
  return {
    programKokKlasoru: String(payload.programKokKlasoru ?? payload.program_kok_klasoru ?? ""),
    whatsappRawKlasoru: String(payload.whatsappRawKlasoru ?? payload.whatsapp_raw_klasoru ?? ""),
    scannerRawKlasoru: String(payload.scannerRawKlasoru ?? payload.scanner_raw_klasoru ?? ""),
    manuelRawKlasoru: String(payload.manuelRawKlasoru ?? payload.manuel_raw_klasoru ?? ""),
    emailRawKlasoru: String(payload.emailRawKlasoru ?? payload.email_raw_klasoru ?? ""),
    islenmisKlasoru: String(payload.islenmisKlasoru ?? payload.islenmis_klasoru ?? ""),
    arsivKlasoru: String(payload.arsivKlasoru ?? payload.arsiv_klasoru ?? ""),
    xmlOkumaKlasoru: String(payload.xmlOkumaKlasoru ?? payload.xml_okuma_klasoru ?? ""),
    xlsxCiktiKlasoru: String(payload.xlsxCiktiKlasoru ?? payload.xlsx_cikti_klasoru ?? ""),
    opjCiktiKlasoru: String(payload.opjCiktiKlasoru ?? payload.opj_cikti_klasoru ?? ""),
    hataliKlasoru: String(payload.hataliKlasoru ?? payload.hatali_klasoru ?? ""),
    fisEvrakNoFormati: String(payload.fisEvrakNoFormati ?? payload.fis_evrak_no_formati ?? ""),
    arsivZamanDamgasiFormati: String(
      payload.arsivZamanDamgasiFormati ?? payload.arsiv_zaman_damgasi_formati ?? "",
    ),
    xlsxAktifMi: Boolean(payload.xlsxAktifMi ?? payload.xlsx_aktif_mi),
    opjAktifMi: Boolean(payload.opjAktifMi ?? payload.opj_aktif_mi ?? false),
    watcherAktifMi: Boolean(payload.watcherAktifMi ?? payload.watcher_aktif_mi),
    yenidenDenemeSayisi: Number(payload.yenidenDenemeSayisi ?? payload.yeniden_deneme_sayisi ?? 0),
  };
}

function mapExportStatusAnomalyResponse(
  payload: WorkflowExportStatusAnomalyResponseApi,
): WorkflowExportStatusAnomalyResponse {
  return {
    limit: payload.limit,
    offset: payload.offset,
    filters: {
      kayitUuid: payload.filters.kayit_uuid,
      fromTs: payload.filters.from,
      toTs: payload.filters.to,
    },
    summary: {
      totalRecords: payload.summary.total_records,
      distinctRecords: payload.summary.distinct_records,
      lastCreatedAt: payload.summary.last_created_at,
      statusBreakdown: payload.summary.status_breakdown,
    },
    items: payload.items.map((item) => ({
      id: item.id,
      kayitUuid: item.kayit_uuid,
      alanAdi: item.alan_adi,
      eskiDeger: item.eski_deger,
      yeniDeger: item.yeni_deger,
      createdAt: item.created_at,
    })),
  };
}

function normalizeRow(row: Record<string, unknown>): WorkflowRow {
  const normalizedSource = normalizeRowSource(row.satirKaynagi ?? row.satir_kaynagi, "OCR");
  return {
    id: String(row.id ?? ""),
    satirSirasi: Number(row.satirSirasi ?? row.satir_sirasi ?? 0),
    malzeme: String(row.malzeme ?? ""),
    boy: row.boy == null ? null : Number(row.boy),
    en: row.en == null ? null : Number(row.en),
    adet: row.adet == null ? null : Number(row.adet),
    grain: Number(row.grain ?? 3) as WorkflowGrain,
    bilgi: String(row.bilgi ?? ""),
    u1: Boolean(row.u1),
    u2: Boolean(row.u2),
    k1: Boolean(row.k1),
    k2: Boolean(row.k2),
    delik1: String(row.delik_1 ?? row.delik1 ?? ""),
    delik2: String(row.delik_2 ?? row.delik2 ?? ""),
    satirKaynagi: normalizedSource,
    plakaRef: String(row.plakaRef ?? row.plaka_ref ?? ""),
    bantKalinligiOverride: String(
      row.bantKalinligiOverride ?? row.bant_kalinligi_override ?? "",
    ) as WorkflowBandThickness,
    hucreGuvenSkorlari:
      (row.hucreGuvenSkorlari as Record<string, number> | null) ??
      (row.hucre_guven_skorlari as Record<string, number> | null) ??
      {},
    satirGuvenSkorOzeti:
      (row.satirGuvenSkorOzeti as Record<string, number | string> | null) ??
      (row.satir_guven_skor_ozeti as Record<string, number | string> | null) ??
      {},
    boyOnay: String(row.boyOnay ?? row.boy_onay ?? "BEKLEMEDE") as CellApprovalStatus,
    enOnay: String(row.enOnay ?? row.en_onay ?? "BEKLEMEDE") as CellApprovalStatus,
    adetOnay: String(row.adetOnay ?? row.adet_onay ?? "BEKLEMEDE") as CellApprovalStatus,
    boyOperatorDegeri:
      (row.boyOperatorDegeri ?? row.boy_operator_degeri) == null
        ? null
        : Number(row.boyOperatorDegeri ?? row.boy_operator_degeri),
    enOperatorDegeri:
      (row.enOperatorDegeri ?? row.en_operator_degeri) == null
        ? null
        : Number(row.enOperatorDegeri ?? row.en_operator_degeri),
    adetOperatorDegeri:
      (row.adetOperatorDegeri ?? row.adet_operator_degeri) == null
        ? null
        : Number(row.adetOperatorDegeri ?? row.adet_operator_degeri),
    onaylayanId:
      (row.onaylayanId ?? row.onaylayan_id) == null
        ? null
        : Number(row.onaylayanId ?? row.onaylayan_id),
    onayZamani:
      ((row.onayZamani ?? row.onay_zamani) as string | null) ?? null,
    bboxJson:
      (row.bboxJson as Record<string, unknown>[] | null) ??
      (row.bbox_json as Record<string, unknown>[] | null) ??
      null,
  };
}

function normalizeAuditRecord(record: Record<string, unknown>): WorkflowAuditRecord {
  return {
    id: String(record.id ?? ""),
    satirId: (record.satirId ?? record.satir_id) == null ? null : String(record.satirId ?? record.satir_id),
    alanAdi: String(record.alanAdi ?? record.alan_adi ?? ""),
    eskiDeger: (record.eskiDeger ?? record.eski_deger) == null ? null : String(record.eskiDeger ?? record.eski_deger),
    yeniDeger: (record.yeniDeger ?? record.yeni_deger) == null ? null : String(record.yeniDeger ?? record.yeni_deger),
    userId: (record.userId ?? record.user_id) == null ? null : Number(record.userId ?? record.user_id),
    islemTipi: (record.islemTipi ?? record.islem_tipi) == null ? null : String(record.islemTipi ?? record.islem_tipi),
    createdAt: (record.createdAt ?? record.created_at) == null ? null : String(record.createdAt ?? record.created_at),
  };
}

function normalizeRecord(record: Record<string, unknown>): WorkflowRecord {
  const kayitUuid = String(record.kayitUuid ?? record.kayit_uuid ?? "");
  return {
    kayitUuid,
    hamDosyaAdi: String(record.hamDosyaAdi ?? record.ham_dosya_adi ?? ""),
    kaynakKlasor: String(record.kaynakKlasor ?? record.kaynak_klasor ?? ""),
    gelisTarihi: ((record.gelisTarihi ?? record.gelis_tarihi) as string | null) ?? null,
    dosyaDurumu: String(record.dosyaDurumu ?? record.dosya_durumu ?? ""),
    orijinalDosyaYolu: String(record.orijinalDosyaYolu ?? record.orijinal_dosya_yolu ?? ""),
    dosyaHash: String(record.dosyaHash ?? record.dosya_hash ?? ""),
    ocrHamJson:
      (record.ocrHamJson as Record<string, unknown> | null) ??
      (record.ocr_ham_json as Record<string, unknown> | null) ??
      null,
    ayristirilmisOcrAlanlari:
      (record.ayristirilmisOcrAlanlari as Record<string, unknown> | null) ??
      (record.ayristirilmis_ocr_alanlari as Record<string, unknown> | null) ??
      null,
    okunanCariUnvan: String(record.okunanCariUnvan ?? record.okunan_cari_unvan ?? ""),
    okunanCariTelefon: String(record.okunanCariTelefon ?? record.okunan_cari_telefon ?? ""),
    aiGuvenSkoruOzeti:
      (record.aiGuvenSkoruOzeti as Record<string, unknown> | null) ??
      (record.ai_guven_skoru_ozeti as Record<string, unknown> | null) ??
      null,
    revizyonAdayiUyarisi: String(record.revizyonAdayiUyarisi ?? record.revizyon_adayi_uyarisi ?? ""),
    cariUnvan: String(record.cariUnvan ?? record.cari_unvan ?? ""),
    cariKodu: String(record.cariKodu ?? record.cari_kodu ?? ""),
    siparisNo: String(record.siparisNo ?? record.siparis_no ?? ""),
    termin: String(record.termin ?? ""),
    teslimTarihi: String(record.teslimTarihi ?? record.teslim_tarihi ?? ""),
    teslimatAdresi: String(record.teslimatAdresi ?? record.teslimat_adresi ?? ""),
    odemeSekli: String(record.odemeSekli ?? record.odeme_sekli ?? ""),
    malzeme: String(record.malzeme ?? ""),
    stokKodu: String(record.stokKodu ?? record.stok_kodu ?? ""),
    bantKalinligi: String(record.bantKalinligi ?? record.bant_kalinligi ?? "") as WorkflowBandThickness,
    grainVarsayilan: Number(record.grainVarsayilan ?? record.grain_varsayilan ?? 3) as WorkflowGrain,
    plakaBoyMm:
      (record.plakaBoyMm ?? record.plaka_boy_mm) == null ? null : Number(record.plakaBoyMm ?? record.plaka_boy_mm),
    plakaEnMm:
      (record.plakaEnMm ?? record.plaka_en_mm) == null ? null : Number(record.plakaEnMm ?? record.plaka_en_mm),
    fireAciklamasi: String(record.fireAciklamasi ?? record.fire_aciklamasi ?? ""),
    retryNo: Number(record.retryNo ?? record.retry_no ?? 0),
    revizyonNo: Number(record.revizyonNo ?? record.revizyon_no ?? 0),
    aktifFaz: Number(record.aktifFaz ?? record.aktif_faz ?? 1),
    dosyaBoyutu:
      (record.dosyaBoyutu ?? record.dosya_boyutu) == null ? null : Number(record.dosyaBoyutu ?? record.dosya_boyutu),
    islemeKilidi:
      ((record.islemeKilidi ?? record.isleme_kilidi) as string | null) ?? null,
    kilidZamani:
      ((record.kilidZamani ?? record.kilid_zamani) as string | null) ?? null,
    sonDenemeZamani:
      ((record.sonDenemeZamani ?? record.son_deneme_zamani) as string | null) ?? null,
    sonrakiDenemeZamani:
      ((record.sonrakiDenemeZamani ?? record.sonraki_deneme_zamani) as string | null) ?? null,
    sonHataMesaji:
      ((record.sonHataMesaji ?? record.son_hata_mesaji) as string | null) ?? null,
    ocrSaglayici:
      ((record.ocrSaglayici ?? record.ocr_saglayici) as string | null) ?? null,
    ocrIslemSuresiMs:
      (record.ocrIslemSuresiMs ?? record.ocr_islem_suresi_ms) == null
        ? null
        : Number(record.ocrIslemSuresiMs ?? record.ocr_islem_suresi_ms),
    satirlar: Array.isArray(record.satirlar) ? record.satirlar.map((row) => normalizeRow(row as Record<string, unknown>)) : [],
    cikarilanSatirlar: Array.isArray(record.cikarilanSatirlar ?? record.cikarilan_satirlar)
      ? ((record.cikarilanSatirlar ?? record.cikarilan_satirlar) as unknown[]).map((row) =>
          normalizeRow(row as Record<string, unknown>),
        )
      : [],
    auditKayitlari: Array.isArray(record.auditKayitlari ?? record.audit_kayitlari)
      ? ((record.auditKayitlari ?? record.audit_kayitlari) as unknown[]).map((item) =>
          normalizeAuditRecord(item as Record<string, unknown>),
        )
      : [],
    plakalar: Array.isArray(record.plakalar) ? (record.plakalar as WorkflowPlate[]) : [],
    exportKayitlari: Array.isArray(record.exportKayitlari ?? record.export_kayitlari)
      ? ((record.exportKayitlari ?? record.export_kayitlari) as unknown[]).map((item) =>
          normalizeExportRecord(item as Record<string, unknown>),
        )
      : [],
    hataKayitlari: Array.isArray(record.hataKayitlari ?? record.hata_kayitlari)
      ? ((record.hataKayitlari ?? record.hata_kayitlari) as WorkflowErrorRecord[])
      : [],
    imageUrl: `/api/v1/optiplan-workflow/records/${kayitUuid}/image`,
    duplicateFlag:
      (record.duplicateFlag ?? record.duplicate_flag) == null
        ? null
        : Boolean(record.duplicateFlag ?? record.duplicate_flag),
    kaynakKlasorTipi:
      ((record.kaynakKlasorTipi ?? record.kaynak_klasor_tipi) as string | null) ?? null,
  };
}

function serializeRow(row: WorkflowRow) {
  return {
    id: row.id || undefined,
    satir_sirasi: row.satirSirasi,
    malzeme: row.malzeme || null,
    boy: row.boy,
    en: row.en,
    adet: row.adet,
    grain: row.grain,
    bilgi: row.bilgi || null,
    u1: row.u1,
    u2: row.u2,
    k1: row.k1,
    k2: row.k2,
    delik_1: row.delik1 || null,
    delik_2: row.delik2 || null,
    satir_kaynagi: normalizeRowSource(row.satirKaynagi, "OCR"),
    plaka_ref: row.plakaRef || null,
    bant_kalinligi_override: row.bantKalinligiOverride || null,
    hucre_guven_skorlari: row.hucreGuvenSkorlari,
    satir_guven_skor_ozeti: row.satirGuvenSkorOzeti,
  };
}

function normalizeGateStatusResponse(
  response: Record<string, unknown>,
): Phase3GateStatusResponse {
  const summaryRaw = (response.summary ?? {}) as Record<string, unknown>;
  return {
    canProceed: Boolean(response.canProceed),
    message: String(response.message ?? ""),
    blockerReasons: Array.isArray(response.blockerReasons)
      ? (response.blockerReasons as Phase3GateStatusResponse["blockerReasons"])
      : [],
    summary: {
      totalBlockers: Number(summaryRaw.totalBlockers ?? 0),
      criticalCount: Number(summaryRaw.criticalCount ?? 0),
      warningCount: Number(summaryRaw.warningCount ?? 0),
    },
    gateCheckTime: String(response.gateCheckTime ?? new Date().toISOString()),
  };
}

function buildIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const optiplanWorkflowService = {
  async getFolderSettings(): Promise<FolderSettings> {
    const response = await apiRequest<Record<string, unknown>>("/optiplan-workflow/folder-settings", {
      method: "GET",
    });
    return normalizeFolderSettings(response);
  },

  async updateFolderSettings(payload: Partial<FolderSettings>): Promise<FolderSettings> {
    const response = await apiRequest<Record<string, unknown>>("/optiplan-workflow/folder-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return normalizeFolderSettings(response);
  },

  async manualImport(file: File, kaynakKlasor: WorkflowSourceFolder, forceDuplicate = false): Promise<WorkflowRecord> {
    const form = new FormData();
    form.append("file", file);
    form.append("kaynak_klasor", kaynakKlasor);
    form.append("force_duplicate", String(forceDuplicate));
    const record = await apiRequest<Record<string, unknown>>("/optiplan-workflow/records/manual-import", {
      method: "POST",
      body: form,
    });
    return normalizeRecord(record);
  },

  async scanWatchFolders(): Promise<WorkflowRecord[]> {
    const response = await apiRequest<{ records: Array<Record<string, unknown>> }>("/optiplan-workflow/records/scan", {
      method: "POST",
    });
    return (response.records ?? []).map(normalizeRecord);
  },

  async listRecords(): Promise<WorkflowRecord[]> {
    const response = await apiRequest<{ records: Array<Record<string, unknown>> }>("/optiplan-workflow/records", {
      method: "GET",
    });
    return (response.records ?? []).map(normalizeRecord);
  },

  async getRecord(kayitUuid: string): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}`, {
      method: "GET",
    });
    return normalizeRecord(record);
  },

  async getLegacyRecord(kayitUuid: string): Promise<LegacyWorkflowRecord> {
    const [settings, record] = await Promise.all([this.getFolderSettings(), this.getRecord(kayitUuid)]);
    return toLegacyRecord(record, settings);
  },

  async updatePhase2(
    kayitUuid: string,
    payload: {
      rows: WorkflowRow[];
      okunanCariUnvan: string;
      okunanCariTelefon: string;
      aiGuvenSkoruOzeti: Record<string, unknown> | null;
      revizyonAdayiUyarisi: string;
    },
  ): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/phase2`, {
      method: "PUT",
      body: JSON.stringify({
        rows: payload.rows.map((row) => ({
          id: row.id,
          boy: row.boy,
          en: row.en,
          adet: row.adet,
          malzeme: row.malzeme || null,
          grain: row.grain,
          bilgi: row.bilgi || null,
          delik_1: row.delik1 || null,
          hucre_guven_skorlari: row.hucreGuvenSkorlari,
          satir_guven_skor_ozeti: row.satirGuvenSkorOzeti,
        })),
        okunan_cari_unvan: payload.okunanCariUnvan,
        okunan_cari_telefon: payload.okunanCariTelefon,
        ai_guven_skoru_ozeti: payload.aiGuvenSkoruOzeti,
        revizyon_adayi_uyarisi: payload.revizyonAdayiUyarisi,
      }),
    });
    return normalizeRecord(record);
  },

  async approvePhase2(kayitUuid: string): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/phase2/approve`, {
      method: "POST",
    });
    return normalizeRecord(record);
  },

  async approvePhase2Cells(
    kayitUuid: string,
    approvals: { satirId: string; alan: "boy" | "en" | "adet"; aksiyon: "ONAYLA" | "DUZELT"; yeniDeger?: number | null }[],
  ): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/phase2/cell-approve`, {
      method: "POST",
      body: JSON.stringify({
        approvals: approvals.map((a) => ({
          satir_id: a.satirId,
          alan: a.alan,
          aksiyon: a.aksiyon,
          yeni_deger: a.yeniDeger ?? null,
        })),
      }),
    });
    return normalizeRecord(record);
  },

  async validatePhase2Cell(payload: {
    fieldType: "boy" | "en" | "adet";
    value: number;
    originalOcrValue?: string;
    currentConfidence?: number;
  }): Promise<ValidateCellResponse> {
    const response = await apiRequest<Record<string, unknown>>("/workflow/phase2/validate-cell", {
      method: "POST",
      body: JSON.stringify({
        field_type: payload.fieldType,
        value: payload.value,
        original_ocr_value: payload.originalOcrValue ?? null,
        current_confidence: payload.currentConfidence ?? null,
      }),
    });

    return {
      isValid: Boolean(response.isValid),
      blockers: Array.isArray(response.blockers)
        ? (response.blockers as ValidateCellResponse["blockers"])
        : [],
      message: String(response.message ?? ""),
      proposedValue:
        typeof response.proposedValue === "number" ? response.proposedValue : undefined,
    };
  },

  async decidePhase2Cell(payload: CellDecideRequest): Promise<CellDecideResponse> {
    const response = await apiRequest<Record<string, unknown>>("/workflow/phase2/cell-decide", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: payload.recordUuid,
        row_id: payload.rowId,
        field_type: payload.fieldType,
        action: payload.action,
        value: payload.value ?? null,
        reason: payload.reason ?? null,
        error_category: payload.errorCategory ?? null,
        operator_note: payload.operatorNote ?? null,
        idempotency_key: payload.idempotencyKey ?? buildIdempotencyKey("cell"),
      }),
    });

    return {
      success: Boolean(response.success),
      message: String(response.message ?? ""),
      idempotencyId:
        typeof response.idempotencyId === "string" ? response.idempotencyId : undefined,
      cached: Boolean(response.cached),
      cellState:
        (response.cellState as CellDecideResponse["cellState"]) ?? {
          rowId: payload.rowId,
          fieldType: payload.fieldType,
          approved: payload.action === "APPROVE",
        },
      nextBlockingCell:
        (response.nextBlockingCell as CellDecideResponse["nextBlockingCell"]) ?? undefined,
      gateStatus: response.gateStatus === "READY" ? "READY" : "BLOCKED",
    };
  },

  async getPhase2GateStatus(recordUuid: string): Promise<Phase3GateStatusResponse> {
    const response = await apiRequest<Record<string, unknown>>(
      `/workflow/phase2/${encodeURIComponent(recordUuid)}/phase3-gate-status`,
      { method: "GET" },
    );
    return normalizeGateStatusResponse(response);
  },

  async getPhase2AuditTrail(
    recordUuid: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<AuditTrailResponse> {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 50));
    params.set("offset", String(options.offset ?? 0));
    const response = await apiRequest<Record<string, unknown>>(
      `/workflow/phase2/${encodeURIComponent(recordUuid)}/audit-trail?${params.toString()}`,
      { method: "GET" },
    );

    return {
      recordUuid: String(response.recordUuid ?? recordUuid),
      totalEvents: Number(response.totalEvents ?? 0),
      events: Array.isArray(response.events)
        ? (response.events as AuditTrailResponse["events"])
        : [],
    };
  },

  async undoPhase2Decision(payload: {
    recordUuid: string;
    decisionEventId: string;
    idempotencyKey?: string;
  }): Promise<UndoResponse> {
    const response = await apiRequest<Record<string, unknown>>("/workflow/phase2/undo", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: payload.recordUuid,
        decision_event_id: payload.decisionEventId,
        idempotency_key: payload.idempotencyKey ?? buildIdempotencyKey("undo"),
      }),
    });

    return {
      success: Boolean(response.success),
      message: String(response.message ?? ""),
      revertedEventId: String(response.revertedEventId ?? ""),
      gateStatus: response.gateStatus === "READY" ? "READY" : "BLOCKED",
    };
  },

  async batchApprovePhase2DryRun(payload: {
    recordUuid: string;
    query: BatchApproveQuery;
  }): Promise<BatchApproveDryRunResponse> {
    const response = await apiRequest<Record<string, unknown>>("/workflow/phase2/batch-approve-dry-run", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: payload.recordUuid,
        query: {
          field_type: payload.query.fieldType ?? null,
          confidence_range: payload.query.confidenceRange ?? null,
          reason: payload.query.reason ?? null,
        },
      }),
    });

    return {
      dryRunId: String(response.dryRunId ?? ""),
      affectedCount: Number(response.affectedCount ?? 0),
      affectedCells: Array.isArray(response.affectedCells)
        ? (response.affectedCells as BatchApproveDryRunResponse["affectedCells"])
        : [],
      estimatedImpact:
        (response.estimatedImpact as BatchApproveDryRunResponse["estimatedImpact"]) ?? {
          blockersRemaining: 0,
          gateStatusAfter: "BLOCKED",
        },
    };
  },

  async batchApprovePhase2Commit(payload: {
    recordUuid: string;
    query: BatchApproveQuery;
    dryRunId?: string;
    idempotencyKey?: string;
  }): Promise<BatchApproveCommitResponse> {
    const response = await apiRequest<Record<string, unknown>>("/workflow/phase2/batch-approve-commit", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: payload.recordUuid,
        query: {
          field_type: payload.query.fieldType ?? null,
          confidence_range: payload.query.confidenceRange ?? null,
          reason: payload.query.reason ?? null,
        },
        dry_run_id: payload.dryRunId ?? null,
        idempotency_key: payload.idempotencyKey ?? buildIdempotencyKey("batch"),
      }),
    });

    return {
      success: Boolean(response.success),
      appliedCount: Number(response.appliedCount ?? 0),
      message: String(response.message ?? ""),
      gateStatus: response.gateStatus === "READY" ? "READY" : "BLOCKED",
    };
  },

  async removeRow(kayitUuid: string, rowId: string): Promise<LegacyWorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/rows/${rowId}/remove`, {
      method: "POST",
    });
    const settings = await this.getFolderSettings();
    return toLegacyRecord(normalizeRecord(record), settings);
  },

  async restoreRow(kayitUuid: string, removedRowId: string): Promise<LegacyWorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/removed-rows/${removedRowId}/restore`, {
      method: "POST",
    });
    const settings = await this.getFolderSettings();
    return toLegacyRecord(normalizeRecord(record), settings);
  },

  async updatePhase3(
    kayitUuid: string,
    payload: {
      cariUnvan: string;
      cariKodu: string;
      siparisNo: string;
      termin: string;
      teslimTarihi: string;
      teslimatAdresi: string;
      odemeSekli: string;
      malzeme: string;
      stokKodu: string;
      bantKalinligi: WorkflowBandThickness;
      grainVarsayilan: WorkflowGrain;
      plakaBoyMm: number | null;
      plakaEnMm: number | null;
      fireAciklamasi: string;
      rows: WorkflowRow[];
      plates: WorkflowPlate[];
    },
  ): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/phase3`, {
      method: "PUT",
      body: JSON.stringify({
        cari_unvan: payload.cariUnvan,
        cari_kodu: payload.cariKodu,
        siparis_no: payload.siparisNo,
        termin: payload.termin || null,
        teslim_tarihi: payload.teslimTarihi || null,
        teslimat_adresi: payload.teslimatAdresi || null,
        odeme_sekli: payload.odemeSekli || null,
        malzeme: payload.malzeme,
        stok_kodu: payload.stokKodu,
        bant_kalinligi: payload.bantKalinligi || null,
        grain_varsayilan: payload.grainVarsayilan,
        plaka_boy_mm: payload.plakaBoyMm,
        plaka_en_mm: payload.plakaEnMm,
        fire_aciklamasi: payload.fireAciklamasi || null,
        rows: payload.rows.map(serializeRow),
        plates: payload.plates.map((plate) => ({
          id: plate.id || undefined,
          plaka_ref: plate.plakaRef,
          etiket: plate.etiket,
          plaka_boy_mm: plate.plakaBoyMm,
          plaka_en_mm: plate.plakaEnMm,
          genel_listede_mi: plate.genelListedeMi,
        })),
      }),
    });
    return normalizeRecord(record);
  },

  async exportPreview(
    kayitUuid: string,
    xlsxAktifMi: boolean,
  ): Promise<WorkflowExportPreview> {
    const response = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/export/preview`, {
      method: "POST",
      body: JSON.stringify({
        xlsx_aktif_mi: xlsxAktifMi,
      }),
    });
    return normalizeExportPreview(response);
  },

  async exportRecord(
    kayitUuid: string,
    xlsxAktifMi: boolean,
  ): Promise<WorkflowExportPreview> {
    const response = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/export`, {
      method: "POST",
      body: JSON.stringify({
        xlsx_aktif_mi: xlsxAktifMi,
      }),
    });
    return normalizeExportPreview(response);
  },

  async markError(kayitUuid: string, hataFazi: string, hataNedeni: string, operatorNotu: string): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/error`, {
      method: "POST",
      body: JSON.stringify({
        hata_fazi: hataFazi,
        hata_nedeni: hataNedeni,
        operator_notu: operatorNotu || null,
      }),
    });
    return normalizeRecord(record);
  },

  async retryRecord(kayitUuid: string): Promise<WorkflowRecord> {
    const record = await apiRequest<Record<string, unknown>>(`/optiplan-workflow/records/${kayitUuid}/retry`, {
      method: "POST",
    });
    return normalizeRecord(record);
  },

  async lookupCustomers(query: string): Promise<WorkflowLookupCustomer[]> {
    const response = await apiRequest<{ items: WorkflowLookupCustomer[] }>(
      `/optiplan-workflow/lookup/customers?q=${encodeURIComponent(query)}`,
      { method: "GET" },
    );
    return response.items ?? [];
  },

  async lookupStocks(query: string): Promise<WorkflowLookupStock[]> {
    const response = await apiRequest<{ items: WorkflowLookupStock[] }>(
      `/optiplan-workflow/lookup/stocks?q=${encodeURIComponent(query)}`,
      { method: "GET" },
    );
    return response.items ?? [];
  },

  async loadWorkspace(): Promise<LegacyWorkflowDataset> {
    const settings = await this.getFolderSettings();
    const list = await this.listRecords();
    const details = await Promise.all(list.map((item) => this.getRecord(item.kayitUuid)));
    const customerMap = new Map<string, LegacyWorkflowCustomerMatch>();
    const stockMap = new Map<string, LegacyWorkflowStockMatch>();
    for (const item of details) {
      const customerQuery = [item.okunanCariUnvan, item.okunanCariTelefon].filter(Boolean).join(" ").trim();
      if (customerQuery) {
        const customers = await this.lookupCustomers(customerQuery);
        customers.forEach((customer) => {
          customerMap.set(customer.cariKodu, customer);
        });
      }
      const stockQuery = [item.malzeme, item.plakaBoyMm, item.plakaEnMm].filter(Boolean).join(" ").trim();
      if (stockQuery) {
        const stocks = await this.lookupStocks(stockQuery);
        stocks.forEach((stock) => {
          stockMap.set(stock.stokKodu, stock);
        });
      }
    }
    return {
      records: details.map((item) => toLegacyRecord(item, settings)),
      customerMatches: [...customerMap.values()],
      stockMatches: [...stockMap.values()],
    };
  },

  async savePhase2(record: LegacyWorkflowRecord): Promise<LegacyWorkflowRecord> {
    const payload = fromLegacyRecord(record);
    const updated = await this.updatePhase2(record.kayitUuid, {
      rows: payload.phase2Rows,
      okunanCariUnvan: record.okunanCariUnvan,
      okunanCariTelefon: record.okunanCariTelefon,
      aiGuvenSkoruOzeti: record.aiGuvenSkoruDetayi ?? null,
      revizyonAdayiUyarisi: record.revizyonAdayiUyarisi,
    });
    const approved = record.dosyaDurumu === "SIPARIS_DUZENLEME" ? await this.approvePhase2(record.kayitUuid) : updated;
    const settings = await this.getFolderSettings();
    return toLegacyRecord(approved, settings);
  },

  async savePhase3(record: LegacyWorkflowRecord): Promise<LegacyWorkflowRecord> {
    const payload = fromLegacyRecord(record);
    const updated = await this.updatePhase3(record.kayitUuid, {
      cariUnvan: record.cariUnvan,
      cariKodu: record.cariKodu,
      siparisNo: record.siparisNo,
      termin: record.termin,
      teslimTarihi: record.teslimTarihi,
      teslimatAdresi: record.teslimatAdresi,
      odemeSekli: record.odemeSekli,
      malzeme: record.malzeme,
      stokKodu: record.stokKodu,
      bantKalinligi: record.bantKalinligi,
      grainVarsayilan: record.grainVarsayilan,
      plakaBoyMm: record.plakaBoyMm,
      plakaEnMm: record.plakaEnMm,
      fireAciklamasi: record.fireAciklamasi,
      rows: payload.phase3Rows,
      plates: payload.plates,
    });
    const settings = await this.getFolderSettings();
    return toLegacyRecord(updated, settings);
  },

  async getExportPreview(record: LegacyWorkflowRecord, fallbackRows: LegacyWorkflowPreviewRow[]): Promise<LegacyWorkflowPreviewRow[]> {
    try {
      const preview = await this.exportPreview(
        record.kayitUuid,
        record.selectedFormats.xlsx,
      );
      return toLegacyPreviewRows(preview);
    } catch {
      return fallbackRows;
    }
  },

  async runExport(
    record: LegacyWorkflowRecord,
    _previewRows: LegacyWorkflowPreviewRow[]
  ): Promise<WorkflowExportRunResult> {
    return this.runExportByRecordId(record.kayitUuid, record.selectedFormats.xlsx);
  },

  async runExportByRecordId(kayitUuid: string, xlsxAktifMi: boolean): Promise<WorkflowExportRunResult> {
    const preview = await this.exportRecord(kayitUuid, xlsxAktifMi);
    return mapExportPreviewToRunResult(preview);
  },

  async getExportStatusAnomalies(filters: WorkflowExportTelemetryFilters = {}): Promise<WorkflowExportStatusAnomalyResponse> {
    const params = new URLSearchParams();
    params.set("limit", String(filters.limit ?? 50));
    params.set("offset", String(filters.offset ?? 0));
    if (filters.kayitUuid) {
      params.set("kayit_uuid", filters.kayitUuid);
    }
    if (filters.fromTs) {
      params.set("from", filters.fromTs);
    }
    if (filters.toTs) {
      params.set("to", filters.toTs);
    }

    const response = await apiRequest<WorkflowExportStatusAnomalyResponseApi>(
      `/optiplan-workflow/telemetry/export-status-anomalies?${params.toString()}`,
      { method: "GET" },
    );
    return mapExportStatusAnomalyResponse(response);
  },

  async markAsError(kayitUuid: string): Promise<LegacyWorkflowRecord> {
    const record = await this.markError(kayitUuid, "PHASE_UI", "Okunamayan Siparis", "");
    const settings = await this.getFolderSettings();
    return toLegacyRecord(record, settings);
  },
};


