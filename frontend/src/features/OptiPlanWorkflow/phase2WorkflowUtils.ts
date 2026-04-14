import type { WorkflowRecord, WorkflowRow } from "../../services/optiplanWorkflowService";
import { CONFIDENCE_FIELDS } from "./phase2GridConstants";
import type { ConfidenceField } from "./phase2GridTypes";

export type RowConfidenceMetrics = {
  pendingApprovals: number;
  minConfidence: number;
};

export function getRowFieldScore(row: WorkflowRow, field: ConfidenceField): number {
  return Number(row.hucreGuvenSkorlari[field] ?? 100);
}

export function countLowCells(
  record: WorkflowRecord,
  isLowConfidence: (score: number, threshold?: number) => boolean,
): number {
  let count = 0;

  for (const row of record.satirlar) {
    for (const field of CONFIDENCE_FIELDS) {
      if (isLowConfidence(getRowFieldScore(row, field))) {
        count += 1;
      }
    }
  }

  return count;
}

export function getRowConfidenceMetrics(
  row: WorkflowRow,
  approvedSet: ReadonlySet<ConfidenceField>,
  threshold: number,
  isLowConfidence: (score: number, threshold?: number) => boolean,
): RowConfidenceMetrics {
  let pendingApprovals = 0;
  let minConfidence = 100;

  for (const field of CONFIDENCE_FIELDS) {
    const score = getRowFieldScore(row, field);
    if (score < minConfidence) {
      minConfidence = score;
    }
    if (isLowConfidence(score, threshold) && !approvedSet.has(field)) {
      pendingApprovals += 1;
    }
  }

  return { pendingApprovals, minConfidence };
}

export function pickNextPhase2Uuid(records: WorkflowRecord[], excludedUuid: string): string | null {
  const next = records.find(
    (record) => record.kayitUuid !== excludedUuid && record.dosyaDurumu.includes("PHASE_2"),
  );

  return next?.kayitUuid ?? null;
}

export function buildWhatsAppDraft(record: WorkflowRecord, note: string): string {
  const name = record.okunanCariUnvan || "Değerli Müşteri";
  const file = record.hamDosyaAdi || "gönderilen belge";
  const phone = record.okunanCariTelefon ? `\nMüşteri Tel: ${record.okunanCariTelefon}` : "";
  const noteSection = note.trim() ? `\n\nNot: ${note.trim()}` : "";

  return (
    `Sayın ${name},\n\n`
    + `"${file}" adlı görselde OCR işlemi sırasında bir sorun tespit edildi.\n`
    + "Lütfen belgeyi tekrar gönderiniz veya destek için bizimle iletişime geçiniz."
    + `${phone}${noteSection}\n\nSaygılarımızla.`
  );
}
