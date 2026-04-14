import type { WorkflowRecord, WorkflowRow } from "../../services/optiplanWorkflowService";
import type { BooleanField } from "./phase2GridTypes";

export type BandEdgeField = BooleanField;

export type BandReviewEntry = {
  active: boolean;
  value: string | null;
  confidence: number | null;
  sourceText: string | null;
};

export const BAND_EDGE_FIELDS: BandEdgeField[] = ["u1", "u2", "k1", "k2"];

export const BAND_LABELS: Record<BandEdgeField, string> = {
  u1: "U1 / Üst",
  u2: "U2 / Alt",
  k1: "K1 / Sol",
  k2: "K2 / Sağ",
};

export function toBandReviewEntry(raw: unknown, activeFallback: boolean, valueFallback: string | null): BandReviewEntry {
  const payload = typeof raw === "object" && raw !== null
    ? raw as Record<string, unknown>
    : {};

  const rawConfidence = payload.confidence;
  let confidence: number | null = null;
  if (typeof rawConfidence === "number" && Number.isFinite(rawConfidence)) {
    confidence = rawConfidence;
  } else if (typeof rawConfidence === "string" && rawConfidence.trim() !== "") {
    const parsed = Number(rawConfidence);
    confidence = Number.isFinite(parsed) ? parsed : null;
  }

  const rawValue = payload.value;
  const value = typeof rawValue === "string" && rawValue.trim() !== ""
    ? rawValue.trim()
    : valueFallback;

  const rawSourceText = payload.source_text ?? payload.sourceText;
  const sourceText = typeof rawSourceText === "string" && rawSourceText.trim() !== ""
    ? rawSourceText.trim()
    : null;

  return {
    active: typeof payload.active === "boolean" ? payload.active : activeFallback,
    value,
    confidence,
    sourceText,
  };
}

export function getEffectiveBandThickness(row: WorkflowRow, record: WorkflowRecord): string | null {
  const localValue = row.bantKalinligiOverride?.trim();
  if (localValue) return localValue;

  const recordValue = record.bantKalinligi?.trim();
  return recordValue || null;
}

export function getBandReview(row: WorkflowRow): Record<BandEdgeField, BandReviewEntry> {
  const summary = row.satirGuvenSkorOzeti as Record<string, unknown>;
  const rawReview = (summary.band_review ?? summary.bandReview ?? {}) as Record<string, unknown>;
  const fallbackValue = row.bantKalinligiOverride?.trim() || null;

  return {
    u1: toBandReviewEntry(rawReview.u1, row.u1, row.u1 ? fallbackValue : null),
    u2: toBandReviewEntry(rawReview.u2, row.u2, row.u2 ? fallbackValue : null),
    k1: toBandReviewEntry(rawReview.k1, row.k1, row.k1 ? fallbackValue : null),
    k2: toBandReviewEntry(rawReview.k2, row.k2, row.k2 ? fallbackValue : null),
  };
}

export function countActiveBandEdges(row: WorkflowRow): number {
  const bandReview = getBandReview(row);
  return BAND_EDGE_FIELDS.filter((edge) => bandReview[edge].active).length;
}
