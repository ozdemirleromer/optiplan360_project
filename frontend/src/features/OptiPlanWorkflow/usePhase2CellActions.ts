import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import { CONFIDENCE_FIELDS, isNumericField } from "./phase2GridConstants";
import type { BooleanField, ConfidenceField, NumericField, RowEditState } from "./phase2GridTypes";
import { getRowFieldScore } from "./phase2WorkflowUtils";

type CellBlocker = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type DecideCellInput = {
  recordUuid: string;
  rowId: string;
  fieldType: ConfidenceField;
  action: "APPROVE";
  value?: number;
  reason: string;
};

type ValidateCellInput = {
  fieldType: NumericField;
  value: number;
  originalOcrValue?: string;
  currentConfidence?: number;
};

type ValidateCellResult = {
  blockers: CellBlocker[];
};

type UsePhase2CellActionsParams = {
  activeRecord: WorkflowRecord | null;
  activeUuid: string | null;
  confidenceThreshold: number;
  isLowConfidence: (score: number, threshold?: number) => boolean;
  decideCell: (input: DecideCellInput) => Promise<unknown>;
  validateCell: (input: ValidateCellInput) => Promise<ValidateCellResult | null | undefined>;
  setApprovedCells: Dispatch<SetStateAction<Record<string, Set<ConfidenceField>>>>;
  setRowEdits: Dispatch<SetStateAction<Record<string, RowEditState>>>;
  setCellBlockers: Dispatch<SetStateAction<Record<string, CellBlocker[]>>>;
};

export function usePhase2CellActions({
  activeRecord,
  activeUuid,
  confidenceThreshold,
  isLowConfidence,
  decideCell,
  validateCell,
  setApprovedCells,
  setRowEdits,
  setCellBlockers,
}: UsePhase2CellActionsParams) {
  const handleApproveCell = useCallback((rowId: string, field: ConfidenceField) => {
    setApprovedCells((prev) => {
      const next = { ...prev };
      const set = new Set(next[rowId] ?? []);
      set.add(field);
      next[rowId] = set;
      return next;
    });

    if (!activeUuid) return;
    const row = activeRecord?.satirlar.find((item) => item.id === rowId);
    if (!row) return;

    if (isNumericField(field)) {
      void decideCell({
        recordUuid: activeUuid,
        rowId,
        fieldType: field,
        action: "APPROVE",
        value: Number(row[field] ?? 0),
        reason: "OPERATOR_APPROVED",
      });
    }
  }, [activeRecord, activeUuid, decideCell, setApprovedCells]);

  const handleApproveAllInRow = useCallback((rowId: string) => {
    setApprovedCells((prev) => {
      const next = { ...prev };
      next[rowId] = new Set(CONFIDENCE_FIELDS);
      return next;
    });
  }, [setApprovedCells]);

  const handleApproveAllInRecord = useCallback(() => {
    if (!activeRecord) return;
    setApprovedCells((prev) => {
      const next = { ...prev };
      for (const row of activeRecord.satirlar) {
        next[row.id] = new Set(CONFIDENCE_FIELDS);
      }
      return next;
    });
  }, [activeRecord, setApprovedCells]);

  const handleApproveLowConfidenceOnly = useCallback(() => {
    if (!activeRecord) return;
    setApprovedCells((prev) => {
      const next = { ...prev };
      for (const row of activeRecord.satirlar) {
        const set = new Set(next[row.id] ?? []);
        for (const field of CONFIDENCE_FIELDS) {
          const score = getRowFieldScore(row, field);
          if (isLowConfidence(score, confidenceThreshold)) {
            set.add(field);
          }
        }
        next[row.id] = set;
      }
      return next;
    });
  }, [activeRecord, confidenceThreshold, isLowConfidence, setApprovedCells]);

  const handleNumericCellEdit = useCallback((rowId: string, field: NumericField, rawValue: string) => {
    const parsed = rawValue === "" ? null : Number(rawValue);
    const numericValue = Number.isFinite(parsed) ? parsed : null;

    setRowEdits((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: numericValue },
    }));
    handleApproveCell(rowId, field);

    if (numericValue == null) {
      setCellBlockers((prev) => {
        const key = `${rowId}:${field}`;
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const row = activeRecord?.satirlar.find((item) => item.id === rowId);
    void validateCell({
      fieldType: field,
      value: numericValue,
      originalOcrValue: row?.[field] == null ? undefined : String(row[field]),
      currentConfidence: row ? getRowFieldScore(row, field) : undefined,
    }).then((result) => {
      const key = `${rowId}:${field}`;
      setCellBlockers((prev) => {
        const next = { ...prev };
        if (!result || result.blockers.length === 0) {
          delete next[key];
        } else {
          next[key] = result.blockers;
        }
        return next;
      });
    });
  }, [activeRecord, handleApproveCell, setCellBlockers, setRowEdits, validateCell]);

  const handleBooleanCellEdit = useCallback((rowId: string, field: BooleanField, value: boolean) => {
    setRowEdits((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: value },
    }));
    handleApproveCell(rowId, field);
  }, [handleApproveCell, setRowEdits]);

  return {
    handleApproveCell,
    handleApproveAllInRow,
    handleApproveAllInRecord,
    handleApproveLowConfidenceOnly,
    handleNumericCellEdit,
    handleBooleanCellEdit,
  };
}
