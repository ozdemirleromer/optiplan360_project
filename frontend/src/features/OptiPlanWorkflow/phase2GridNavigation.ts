import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { WorkflowRow } from "../../services/optiplanWorkflowService";
import { CONFIDENCE_FIELDS } from "./phase2GridConstants";
import type { ConfidenceField } from "./phase2GridTypes";

export function focusPhase2GridCell(
  gridRoot: ParentNode | null | undefined,
  rowId: string,
  fieldIdx: number,
): boolean {
  const selector = `[data-cell="${rowId}-${fieldIdx}"]`;
  const input = gridRoot?.querySelector<HTMLInputElement>(selector)
    ?? document.querySelector<HTMLInputElement>(selector);

  if (!input) return false;
  input.focus();
  return true;
}

type HandlePhase2GridCellKeyDownParams = {
  event: ReactKeyboardEvent<HTMLInputElement>;
  rowId: string;
  fieldIdx: number;
  rowIdx: number;
  rows: WorkflowRow[];
  confidenceThreshold: number;
  approvedSet: ReadonlySet<ConfidenceField>;
  focusCell: (rowId: string, fieldIdx: number) => boolean;
  setSelectedRowId: (rowId: string | null) => void;
  handleApproveCell: (rowId: string, field: ConfidenceField) => void;
  getRowFieldScore: (row: WorkflowRow, field: ConfidenceField) => number;
  isLowConfidence: (score: number, threshold: number) => boolean;
};

export function handlePhase2GridCellKeyDown({
  event,
  rowId,
  fieldIdx,
  rowIdx,
  rows,
  confidenceThreshold,
  approvedSet,
  focusCell,
  setSelectedRowId,
  handleApproveCell,
  getRowFieldScore,
  isLowConfidence,
}: HandlePhase2GridCellKeyDownParams): void {
  const totalFields = CONFIDENCE_FIELDS.length;

  if (event.key === "Tab" && !event.shiftKey) {
    event.preventDefault();
    const nextFieldIdx = fieldIdx + 1;
    if (nextFieldIdx < totalFields) {
      focusCell(rowId, nextFieldIdx);
    } else if (rowIdx + 1 < rows.length) {
      const nextRow = rows[rowIdx + 1];
      focusCell(nextRow.id, 0);
      setSelectedRowId(nextRow.id);
    }
    return;
  }

  if (event.key === "Tab" && event.shiftKey) {
    event.preventDefault();
    const prevFieldIdx = fieldIdx - 1;
    if (prevFieldIdx >= 0) {
      focusCell(rowId, prevFieldIdx);
    } else if (rowIdx > 0) {
      const prevRow = rows[rowIdx - 1];
      focusCell(prevRow.id, totalFields - 1);
      setSelectedRowId(prevRow.id);
    }
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const field = CONFIDENCE_FIELDS[fieldIdx];
    const activeRow = rows[rowIdx];
    if (activeRow) {
      const score = getRowFieldScore(activeRow, field);
      if (isLowConfidence(score, confidenceThreshold) && !approvedSet.has(field)) {
        handleApproveCell(rowId, field);
      }
    }

    if (rowIdx + 1 < rows.length) {
      const nextRow = rows[rowIdx + 1];
      focusCell(nextRow.id, fieldIdx);
      setSelectedRowId(nextRow.id);
    }
    return;
  }

  if (event.key === "F2" && event.shiftKey) {
    event.preventDefault();
    handleApproveCell(rowId, CONFIDENCE_FIELDS[fieldIdx]);
    const nextFieldIdx = fieldIdx + 1;
    if (nextFieldIdx < totalFields) {
      focusCell(rowId, nextFieldIdx);
    } else if (rowIdx + 1 < rows.length) {
      const nextRow = rows[rowIdx + 1];
      focusCell(nextRow.id, 0);
      setSelectedRowId(nextRow.id);
    }
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    handleApproveCell(rowId, CONFIDENCE_FIELDS[fieldIdx]);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusCell(rowId, Math.min(fieldIdx + 1, totalFields - 1));
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusCell(rowId, Math.max(fieldIdx - 1, 0));
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (rowIdx + 1 < rows.length) {
      const nextRow = rows[rowIdx + 1];
      focusCell(nextRow.id, fieldIdx);
      setSelectedRowId(nextRow.id);
    }
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (rowIdx > 0) {
      const prevRow = rows[rowIdx - 1];
      focusCell(prevRow.id, fieldIdx);
      setSelectedRowId(prevRow.id);
    }
  }
}
