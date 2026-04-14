import type {
  WorkflowBandThickness,
  WorkflowCustomerMatch,
  WorkflowPlate,
  WorkflowPreviewRow,
  WorkflowRecord,
  WorkflowRow,
  WorkflowSourceFolder,
  WorkflowStockMatch,
} from "./optiplanWorkflowTypes";

export type ConfidenceField = "boy" | "en" | "adet";
export type WorkflowErrorStatus = Extract<WorkflowRecord["dosyaDurumu"], "HATALI">;
export type WorkflowExportStatus = "BASARILI" | "HATALI" | "KISMI_BASARILI" | "BILINMIYOR";

export interface WorkflowTransferBlockingIssue {
  code: string;
  message: string;
}

export interface WorkflowCommercialFieldProfile {
  key: string;
  label: string;
  owner: string;
  ready: boolean;
  value: string;
  note: string;
}

export interface WorkflowAuditEntry {
  id: string;
  text: string;
  createdAt: string;
}

export type WorkflowAuditEvent =
  | { type: "ocr-approved"; rowId: string; field: ConfidenceField }
  | { type: "phase-saved"; phase: 2 | 3 }
  | { type: "customer-matched"; cariKodu: string }
  | { type: "stock-matched"; stokKodu: string }
  | { type: "row-added"; rowId: string }
  | { type: "row-removed"; rowId: string }
  | { type: "row-restored"; rowId: string }
  | { type: "plate-added"; plateRef: string }
  | { type: "export-completed"; durum: WorkflowExportStatus }
  | { type: "marked-error"; note: string };

export interface FolderSettingsDraft {
  whatsappRawKlasoru: string;
  scannerRawKlasoru: string;
  manuelRawKlasoru: string;
  emailRawKlasoru: string;
  islenmisKlasoru: string;
  hataliKlasoru: string;
}

export type FolderDraftKey = keyof FolderSettingsDraft;

export const FOLDER_FIELD_LABELS: Record<FolderDraftKey, string> = {
  whatsappRawKlasoru: "Whatsapp klasörü",
  scannerRawKlasoru: "Scanner klasörü",
  manuelRawKlasoru: "Manuel klasörü",
  emailRawKlasoru: "Email klasörü",
  islenmisKlasoru: "İşlenmiş klasörü",
  hataliKlasoru: "Hatalı klasörü",
};

export const FOLDER_SETTINGS_FIELDS: Array<{ key: FolderDraftKey; label: string }> = [
  { key: "whatsappRawKlasoru", label: "Whatsapp klasörü" },
  { key: "scannerRawKlasoru", label: "Scanner klasörü" },
  { key: "manuelRawKlasoru", label: "Manuel klasörü" },
  { key: "emailRawKlasoru", label: "Email klasörü" },
  { key: "islenmisKlasoru", label: "İşlenmiş klasörü" },
  { key: "hataliKlasoru", label: "Hatalı klasörü" },
];

export const LOW_CONFIDENCE_THRESHOLD = 80;

export function createAuditEntry(event: WorkflowAuditEvent): WorkflowAuditEntry {
  const text = buildAuditMessage(event);
  return {
    id: `${Date.now()}-${Math.random()}`,
    text,
    createdAt: new Date().toISOString(),
  };
}

export function buildAuditMessage(event: WorkflowAuditEvent): string {
  switch (event.type) {
    case "ocr-approved":
      return `OCR onayı verildi: ${event.rowId} / ${event.field}`;
    case "phase-saved":
      return `Phase ${event.phase} kaydedildi`;
    case "customer-matched":
      return `Cari eşleşti: ${event.cariKodu}`;
    case "stock-matched":
      return `Stok eşleşti: ${event.stokKodu}`;
    case "row-added":
      return `Yeni satır eklendi: ${event.rowId}`;
    case "row-removed":
      return `Satır pasife alındı: ${event.rowId}`;
    case "row-restored":
      return `Pasif satır geri alındı: ${event.rowId}`;
    case "plate-added":
      return `Yeni plaka tanımlandı: ${event.plateRef}`;
    case "export-completed":
      return `Export tamamlandı: ${event.durum}`;
    case "marked-error":
      return `Hata işaretlendi: ${event.note || "Operatör notu yok"}`;
  }
}

export function sortAuditEntriesDesc(entries: WorkflowAuditEntry[]): WorkflowAuditEntry[] {
  return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function formatAuditTimestamp(createdAt: string): string {
  if (!createdAt) return "—";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function appendAuditEvent(entries: WorkflowAuditEntry[], event: WorkflowAuditEvent): WorkflowAuditEntry[] {
  return [createAuditEntry(event), ...entries].slice(0, 20);
}

export function parseNumericInput(value: string): number | "" {
  const normalized = value.trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : "";
}

export function exportStatusTone(status: WorkflowExportStatus): string {
  if (status === "BASARILI") return "rgba(16,185,129,.16)";
  if (status === "KISMI_BASARILI") return "rgba(245,158,11,.16)";
  if (status === "HATALI") return "rgba(248,113,113,.16)";
  return "rgba(59,130,246,.16)";
}

export function workflowStatusTone(label: string): string {
  if (label === "Hatalı") return "rgba(248,113,113,.16)";
  if (label === "Tamamlandı") return "rgba(16,185,129,.16)";
  return "rgba(59,130,246,.16)";
}

export function validateFolderSettings(folderDraft: FolderSettingsDraft): Partial<Record<FolderDraftKey, string>> {
  const errors: Partial<Record<FolderDraftKey, string>> = {};
  const normalizedValues = new Set<string>();

  (Object.keys(folderDraft) as FolderDraftKey[]).forEach((key) => {
    const value = folderDraft[key].trim();
    if (!value) {
      errors[key] = "Klasör yolu zorunludur.";
      return;
    }

    const normalizedPath = value.replace(/\\/g, "/");
    const normalized = normalizedPath.replace(/\/+$/, "").toLowerCase();
    if (!/^(?:[a-zA-Z]:\/|\/)/.test(normalizedPath)) {
      errors[key] = "Geçerli bir mutlak klasör yolu giriniz.";
      return;
    }

    if (normalizedValues.has(normalized)) {
      errors[key] = "Bu klasör yolu başka bir alanla aynı olamaz.";
      return;
    }

    normalizedValues.add(normalized);
  });

  return errors;
}

export function filterCustomerMatches(matches: WorkflowCustomerMatch[], query: string): WorkflowCustomerMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return matches;

  return matches.filter(
    (item) => item.cariKodu.toLowerCase().includes(normalizedQuery) || item.cariUnvan.toLowerCase().includes(normalizedQuery),
  );
}

export function filterStockMatches(matches: WorkflowStockMatch[], query: string): WorkflowStockMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return matches;

  return matches.filter(
    (item) => item.stokKodu.toLowerCase().includes(normalizedQuery) || item.stokAdi.toLowerCase().includes(normalizedQuery),
  );
}

export function updateRecord(records: WorkflowRecord[], kayitUuid: string, updater: (record: WorkflowRecord) => WorkflowRecord): WorkflowRecord[] {
  return records.map((record) => (record.kayitUuid === kayitUuid ? updater(record) : record));
}

export function isRowFieldLowConfidence(row: WorkflowRow, field: ConfidenceField): boolean {
  return row.confidence[field] < LOW_CONFIDENCE_THRESHOLD;
}

export function isPhase2Approved(record: WorkflowRecord): boolean {
  return record.rows.every((row) => {
    const fields: ConfidenceField[] = ["boy", "en", "adet"];
    return fields.every((field) => !isRowFieldLowConfidence(row, field) || row.confidenceApproved[field]);
  });
}

export function normalizeExportFilename(record: WorkflowRecord): string {
  const parts = [record.cariKodu || record.cariUnvan, record.siparisNo || record.hamDosyaAdi, `R${record.revizyonNo}`, `T${record.retryNo}`]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean)
    .join("_");

  return parts
    .replace(/[^A-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "EXPORT";
}

export function toPreviewRows(record: WorkflowRecord): WorkflowPreviewRow[] {
  return record.rows.map((row) => ({
    id: row.id,
    pCodeMat: row.malzeme || "MALZEME",
    pLength: Number(row.boy || 0),
    pWidth: Number(row.en || 0),
    pMinq: Number(row.adet || 0),
    pGrain: row.grain,
    pIdesc: row.bilgi || "",
    pEdgeMatUp: row.u1 ? "1" : "",
    pEgdeMatLo: row.u2 ? "1" : "",
    pEdgeMatSx: row.k1 ? "1" : "",
    pEdgeMatDx: row.k2 ? "1" : "",
    pIidesc: row.delik1 || "",
    pDesc1: row.delik2 || "",
  }));
}

export function statusLabel(status: WorkflowRecord["dosyaDurumu"]): string {
  if (status === "TAMAMLANDI") return "Tamamlandı";
  if (status === "HATALI") return "Hatalı";
  if (status === "EXPORT_ONIZLEME") return "OptiPlanning";
  if (status === "SIPARIS_DUZENLEME") return "Sipariş Kontrol";
  if (status === "OCR_KONTROL") return "OCR Kontrol";
  return "OCR Havuzu";
}

export function phase1FolderCounts(records: { kaynakKlasor: string }[]): Record<WorkflowSourceFolder, number> {
  return records.reduce(
    (acc, item) => {
      if (item.kaynakKlasor in acc) {
        (acc as Record<string, number>)[item.kaynakKlasor] += 1;
      }
      return acc;
    },
    {
      whatsapp_raw: 0,
      scanner_raw: 0,
      manuel_raw: 0,
      email_raw: 0,
    },
  );
}

export function validateRows(record: WorkflowRecord): string[] {
  const errors: string[] = [];
  for (const row of record.rows) {
    errors.push(...validateRow(row));
  }
  return errors;
}

export function getWorkflowTransferBlockingIssues(record: WorkflowRecord): WorkflowTransferBlockingIssue[] {
  const issues: WorkflowTransferBlockingIssue[] = [];

  if (!record.cariKodu?.trim()) {
    issues.push({
      code: "E_WORKFLOW_ACCOUNT_REQUIRED",
      message: "Cari kodu secilmeden teknik aktarim baslatilamaz.",
    });
  }

  if (!record.stokKodu?.trim()) {
    issues.push({
      code: "E_WORKFLOW_STOCK_REQUIRED",
      message: "Stok referansi secilmeden teknik aktarim baslatilamaz.",
    });
  }

  if (!record.termin?.trim()) {
    issues.push({
      code: "E_WORKFLOW_TERM_REQUIRED",
      message: "Termin olmadan export asamasina gecilemez.",
    });
  }

  return issues;
}

export function buildWorkflowCommercialFieldProfile(record: WorkflowRecord): WorkflowCommercialFieldProfile[] {
  return [
    {
      key: "cariKodu",
      label: "Cari Kodu",
      owner: "Header / Cari Master",
      ready: Boolean(record.cariKodu?.trim()),
      value: record.cariKodu?.trim() || "Eksik",
      note: "Musteri eslesmesi ve downstream ERP handoff bu kod uzerinden kapanir.",
    },
    {
      key: "stokKodu",
      label: "Stok Referansi",
      owner: "Header / Stok Master",
      ready: Boolean(record.stokKodu?.trim()),
      value: record.stokKodu?.trim() || "Eksik",
      note: "Workflow ciktisi tek kanonik stok referansi ile export edilir.",
    },
    {
      key: "termin",
      label: "Termin",
      owner: "Header / Planlama",
      ready: Boolean(record.termin?.trim()),
      value: record.termin?.trim() || "Eksik",
      note: "Planlama ve faz gecisi icin zorunlu tarih.",
    },
    {
      key: "teslimTarihi",
      label: "Teslim Tarihi",
      owner: "Header / Operasyon",
      ready: Boolean(record.teslimTarihi?.trim()),
      value: record.teslimTarihi?.trim() || "Eksik",
      note: "Sevk planlama ve ticari handoff ayni tarih setine bakar.",
    },
    {
      key: "teslimatAdresi",
      label: "Teslimat Adresi",
      owner: "Header / Sevkiyat",
      ready: Boolean(record.teslimatAdresi?.trim()),
      value: record.teslimatAdresi?.trim() || "Eksik",
      note: "Belge handoff setinde acik teslim noktasi tasinir.",
    },
    {
      key: "odemeSekli",
      label: "Odeme Sekli",
      owner: "Header / Ticari",
      ready: Boolean(record.odemeSekli?.trim()),
      value: record.odemeSekli?.trim() || "Eksik",
      note: "Ticari belge aktariminda tek alanla tasinir.",
    },
  ];
}

export function validateRow(row: WorkflowRow): string[] {
  const errors: string[] = [];
  if (!row.malzeme.trim()) {
    errors.push(`Satır ${row.id}: Malzeme zorunlu`);
  }
  if (!(Number(row.boy) > 0)) {
    errors.push(`Satır ${row.id}: Boy 0'dan büyük olmalı`);
  }
  if (!(Number(row.en) > 0)) {
    errors.push(`Satır ${row.id}: En 0'dan büyük olmalı`);
  }
  if (!(Number(row.adet) > 0)) {
    errors.push(`Satır ${row.id}: Adet 0'dan büyük olmalı`);
  }
  return errors;
}

export function canProceedToPhase4(record: WorkflowRecord | null, rowValidationErrors: string[], hasFolderValidationErrors: boolean): boolean {
  if (!record) return false;
  return Boolean(
    getWorkflowTransferBlockingIssues(record).length === 0 &&
    rowValidationErrors.length === 0 &&
    !hasFolderValidationErrors,
  );
}

export function buildEmptyRow(record: WorkflowRecord): WorkflowRow {
  return {
    id: `row-${Date.now()}`,
    malzeme: record.malzeme || "",
    boy: "",
    en: "",
    adet: 1,
    grain: record.grainVarsayilan,
    bilgi: "",
    u1: false,
    u2: false,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    plakaRef: record.activePlateRef || record.plates[0]?.plakaRef || "PLAKA-1",
    satirKaynagi: "MANUEL",
    bantKalinligiOverride: "",
    confidence: { boy: 100, en: 100, adet: 100 },
    confidenceApproved: { boy: true, en: true, adet: true },
  };
}

export function buildNewPlate(record: WorkflowRecord): WorkflowPlate {
  const index = record.plates.length + 1;
  const ref = `PLAKA-${index}`;
  return {
    plakaRef: ref,
    etiket: `${ref} (${record.plakaEnMm}x${record.plakaBoyMm})`,
    plakaBoyMm: record.plakaBoyMm,
    plakaEnMm: record.plakaEnMm,
  };
}

export function applyBandOverride(row: WorkflowRow, value: WorkflowBandThickness | ""): WorkflowRow {
  return {
    ...row,
    bantKalinligiOverride: value,
  };
}
