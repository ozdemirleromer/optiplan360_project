import { useMemo } from "react";

import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import {
  BAND_EDGE_FIELDS,
  countActiveBandEdges,
  getBandReview,
  getEffectiveBandThickness,
} from "./phase2BandReview";
import { CONFIDENCE_FIELDS, EMPTY_APPROVED_FIELDS } from "./phase2GridConstants";
import type { ConfidenceField } from "./phase2GridTypes";
import { getRowFieldScore } from "./phase2WorkflowUtils";

type BlockerSummary = {
  totalRows: number;
  lowCells: number;
  pendingApprovals: number;
  approvedCells: number;
  exportReady: boolean;
};

type BandSummary = {
  rowsWithBand: number;
  activeEdges: number;
  missingThickness: number;
};

type UsePhase2DerivedStateParams = {
  activeRecord: WorkflowRecord | null;
  approvedCells: Record<string, Set<ConfidenceField>>;
  selectedRowId: string | null;
  isLowConfidence: (score: number, threshold?: number) => boolean;
};

export function usePhase2DerivedState({
  activeRecord,
  approvedCells,
  selectedRowId,
  isLowConfidence,
}: UsePhase2DerivedStateParams) {
  const { canApprove, blockerSummary } = useMemo(() => {
    if (!activeRecord) {
      return { canApprove: false, blockerSummary: null as BlockerSummary | null };
    }

    let lowCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;

    for (const row of activeRecord.satirlar) {
      const approvedSet = approvedCells[row.id] ?? EMPTY_APPROVED_FIELDS;
      for (const field of CONFIDENCE_FIELDS) {
        const score = getRowFieldScore(row, field);
        if (isLowConfidence(score)) {
          lowCount += 1;
          if (approvedSet.has(field)) {
            approvedCount += 1;
          } else {
            pendingCount += 1;
          }
        }
      }
    }

    return {
      canApprove: pendingCount === 0,
      blockerSummary: {
        totalRows: activeRecord.satirlar.length,
        lowCells: lowCount,
        pendingApprovals: pendingCount,
        approvedCells: approvedCount,
        exportReady: pendingCount === 0,
      },
    };
  }, [activeRecord, approvedCells, isLowConfidence]);

  const bandSummary = useMemo<BandSummary>(() => {
    if (!activeRecord) {
      return { rowsWithBand: 0, activeEdges: 0, missingThickness: 0 };
    }

    let rowsWithBand = 0;
    let activeEdges = 0;
    let missingThickness = 0;

    for (const row of activeRecord.satirlar) {
      const edgeCount = countActiveBandEdges(row);
      if (edgeCount === 0) continue;
      rowsWithBand += 1;
      activeEdges += edgeCount;
      if (!getEffectiveBandThickness(row, activeRecord)) {
        missingThickness += 1;
      }
    }

    return { rowsWithBand, activeEdges, missingThickness };
  }, [activeRecord]);

  const selectedBandRow = useMemo(() => {
    if (!activeRecord) return null;
    return activeRecord.satirlar.find((row) => row.id === selectedRowId) ?? activeRecord.satirlar[0] ?? null;
  }, [activeRecord, selectedRowId]);

  const selectedBandReview = useMemo(
    () => (selectedBandRow ? getBandReview(selectedBandRow) : null),
    [selectedBandRow],
  );

  const selectedBandRowNumber = useMemo(() => {
    if (!activeRecord || !selectedBandRow) return null;
    const idx = activeRecord.satirlar.findIndex((row) => row.id === selectedBandRow.id);
    return idx >= 0 ? idx + 1 : null;
  }, [activeRecord, selectedBandRow]);

  const selectedBandThickness = selectedBandRow && activeRecord
    ? getEffectiveBandThickness(selectedBandRow, activeRecord)
    : null;

  const selectedBandActiveCount = selectedBandReview
    ? BAND_EDGE_FIELDS.filter((edge) => selectedBandReview[edge].active).length
    : 0;

  const selectedBandHasIssue = selectedBandActiveCount > 0 && !selectedBandThickness;

  return {
    canApprove,
    blockerSummary,
    bandSummary,
    selectedBandRow,
    selectedBandReview,
    selectedBandRowNumber,
    selectedBandThickness,
    selectedBandActiveCount,
    selectedBandHasIssue,
  };
}
