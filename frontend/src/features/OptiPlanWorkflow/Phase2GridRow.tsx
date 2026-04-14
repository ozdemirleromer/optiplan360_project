import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

import type { WorkflowRow } from "../../services/optiplanWorkflowService";
import { Button } from "../../components/Shared";
import { ensurePhase2RenderDebugHelpers, type Phase2RenderDebugWindow } from "./phase2RenderDebug";
import type { BooleanField, ConfidenceField, NumericField, RowEditState } from "./phase2GridTypes";
import { Phase2GridCell } from "./Phase2GridCell";

export type Phase2GridRowProps = {
  row: WorkflowRow;
  rowIndex: number;
  approvedSet: ReadonlySet<ConfidenceField>;
  rowEdit: RowEditState | undefined;
  saving: boolean;
  selected: boolean;
  rowPendingCount: number;
  rowMinConf: number;
  confidenceFields: ConfidenceField[];
  fieldLabel: Record<ConfidenceField, string>;
  sl700: string;
  sl750: string;
  colorSuccess: string;
  colorWarning: string;
  tdStyle: CSSProperties;
  rowIndexCellStyle: CSSProperties;
  rowIndexInnerStyle: CSSProperties;
  rowApproveBtnStyle: CSSProperties;
  boolLabelStyle: CSSProperties;
  boolInputStyle: CSSProperties;
  cellInnerStyle: CSSProperties;
  cellFooterStyle: CSSProperties;
  getRowFieldScore: (row: WorkflowRow, field: ConfidenceField) => number;
  isLowConfidence: (score: number) => boolean;
  isNumericField: (field: ConfidenceField) => boolean;
  isBooleanField: (field: ConfidenceField) => boolean;
  confidenceColor: (score: number) => string;
  getCellStyle: (isNumeric: boolean, low: boolean, approved: boolean, scoreColor: string) => CSSProperties;
  getNumericInputStyle: (low: boolean, approved: boolean, scoreColor: string) => CSSProperties;
  getScoreTextStyle: (approved: boolean, scoreColor: string) => CSSProperties;
  getApproveButtonStyle: (scoreColor: string) => CSSProperties;
  onSelectRow: (rowId: string | null) => void;
  onSelectField: (field: ConfidenceField | null) => void;
  onApproveAllInRow: (rowId: string) => void;
  onApproveCell: (rowId: string, field: ConfidenceField) => void;
  onBooleanCellEdit: (rowId: string, field: BooleanField, value: boolean) => void;
  onNumericCellEdit: (rowId: string, field: NumericField, rawValue: string) => void;
  onCellKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>, rowId: string, fieldIdx: number, rowIdx: number) => void;
  onRemoveRow: (rowId: string) => Promise<void>;
};

function Phase2GridRowImpl({
  row,
  rowIndex,
  approvedSet,
  rowEdit,
  saving,
  selected,
  rowPendingCount,
  rowMinConf,
  confidenceFields,
  fieldLabel,
  sl700,
  sl750,
  colorSuccess,
  colorWarning,
  tdStyle,
  rowIndexCellStyle,
  rowIndexInnerStyle,
  rowApproveBtnStyle,
  boolLabelStyle,
  boolInputStyle,
  cellInnerStyle,
  cellFooterStyle,
  getRowFieldScore,
  isLowConfidence,
  isNumericField,
  isBooleanField,
  confidenceColor,
  getCellStyle,
  getNumericInputStyle,
  getScoreTextStyle,
  getApproveButtonStyle,
  onSelectRow,
  onSelectField,
  onApproveAllInRow,
  onApproveCell,
  onBooleanCellEdit,
  onNumericCellEdit,
  onCellKeyDown,
  onRemoveRow,
}: Phase2GridRowProps) {
  const rowRenderCountRef = useRef(0);
  const debugWindow = typeof window !== "undefined"
    ? window as Phase2RenderDebugWindow
    : null;

  const renderTelemetryEnabled = import.meta.env.DEV
    && Boolean(debugWindow?.__PHASE2_RENDER_DEBUG__);
  const renderLogEvery = Math.max(1, debugWindow?.__PHASE2_RENDER_DEBUG_EVERY__ ?? 25);

  const rowStyle = useMemo<CSSProperties>(
    () => ({
      borderBottom: `1px solid ${sl700}`,
      background: selected ? sl750 : "transparent",
      cursor: "default",
      transition: "background .1s",
    }),
    [selected, sl700, sl750],
  );

  const rowIndexTextStyle = useMemo<CSSProperties>(() => ({ fontSize: 11 }), []);

  const confidenceCellStyle = useMemo<CSSProperties>(
    () => ({ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }),
    [tdStyle],
  );

  const statusCellStyle = useMemo<CSSProperties>(
    () => ({ ...tdStyle, textAlign: "center" }),
    [tdStyle],
  );

  const confidenceTextStyle = useMemo<CSSProperties>(
    () => ({ fontSize: 11, fontWeight: 700, color: confidenceColor(rowMinConf) }),
    [confidenceColor, rowMinConf],
  );

  const statusBadgeStyle = useMemo<CSSProperties>(
    () => ({
      padding: "2px 6px",
      borderRadius: 999,
      border: `1px solid ${rowPendingCount === 0 ? colorSuccess : colorWarning}`,
      background: rowPendingCount === 0 ? `${colorSuccess}14` : `${colorWarning}14`,
      color: rowPendingCount === 0 ? colorSuccess : colorWarning,
      fontSize: 9,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }),
    [colorSuccess, colorWarning, rowPendingCount],
  );

  const handleRowKeyboardSelect = useCallback(
    (event: ReactKeyboardEvent<HTMLTableRowElement>) => {
      if (event.currentTarget !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onSelectRow(row.id);
      const firstCellInput = document.querySelector<HTMLInputElement>(`[data-cell="${row.id}-0"]`);
      firstCellInput?.focus();
    },
    [onSelectRow, row.id],
  );

  useEffect(() => {
    if (!renderTelemetryEnabled || !debugWindow) return;
    ensurePhase2RenderDebugHelpers(debugWindow);
    debugWindow.__PHASE2_RENDER_METRICS__ ??= {};
    debugWindow.__PHASE2_RENDER_METRICS__[row.id] = (debugWindow.__PHASE2_RENDER_METRICS__[row.id] ?? 0) + 1;
    rowRenderCountRef.current += 1;

    const count = rowRenderCountRef.current;
    if (count === 1 || count % renderLogEvery === 0) {
      console.debug("[Phase2GridRow] render", {
        rowId: row.id,
        count,
        selected,
        pending: rowPendingCount,
      });
    }
  }, [debugWindow, renderLogEvery, renderTelemetryEnabled, row.id, rowPendingCount, selected]);

  return (
    <tr
      data-testid={`row-${row.id}`}
      onClick={() => onSelectRow(row.id)}
      onKeyDown={handleRowKeyboardSelect}
      tabIndex={0}
      aria-label={`Satır ${rowIndex + 1} seç`}
      style={rowStyle}
    >
      <td style={rowIndexCellStyle}>
        <div style={rowIndexInnerStyle}>
          <span style={rowIndexTextStyle}>{rowIndex + 1}</span>
          {rowPendingCount > 0 ? (
            <button
              type="button"
              aria-label={`Satır ${rowIndex + 1} tümünü onayla`}
              title={`Satır ${rowIndex + 1} — tüm düşük güven hücrelerini onayla`}
              onClick={(e) => { e.stopPropagation(); onApproveAllInRow(row.id); }}
              style={rowApproveBtnStyle}
            >
              Tümü
            </button>
          ) : null}
        </div>
      </td>

      {confidenceFields.map((field, fieldIdx) => {
        const score = getRowFieldScore(row, field);
        const low = isLowConfidence(score);
        const approved = approvedSet.has(field);
        const editVal = rowEdit?.[field];
        const displayVal = editVal !== undefined ? editVal : row[field];
        const scoreColor = confidenceColor(score);

        return (
          <Phase2GridCell
            key={field}
            rowId={row.id}
            rowIndex={rowIndex}
            field={field}
            fieldLabel={fieldLabel[field]}
            fieldIdx={fieldIdx}
            score={score}
            low={low}
            approved={approved}
            displayVal={displayVal}
            isBool={isBooleanField(field)}
            isNumeric={isNumericField(field)}
            cellStyle={getCellStyle(isNumericField(field), low, approved, scoreColor)}
            numericInputStyle={getNumericInputStyle(low, approved, scoreColor)}
            scoreTextStyle={getScoreTextStyle(approved, scoreColor)}
            approveButtonStyle={getApproveButtonStyle(scoreColor)}
            boolLabelStyle={boolLabelStyle}
            boolInputStyle={boolInputStyle}
            cellInnerStyle={cellInnerStyle}
            cellFooterStyle={cellFooterStyle}
            onSelectRow={onSelectRow}
            onSelectField={onSelectField}
            onApproveCell={onApproveCell}
            onBooleanCellEdit={onBooleanCellEdit}
            onNumericCellEdit={onNumericCellEdit}
            onCellKeyDown={onCellKeyDown}
          />
        );
      })}

      <td style={confidenceCellStyle}>
        <span style={confidenceTextStyle}>
          %{rowMinConf}
        </span>
      </td>

      <td style={statusCellStyle}>
        <span style={statusBadgeStyle}>
          {rowPendingCount === 0 ? "Hazır" : `${rowPendingCount} bkl.`}
        </span>
      </td>

      <td style={tdStyle}>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void onRemoveRow(row.id)}
          disabled={saving}
          title="Satırı kaldır"
        >
          Kaldır
        </Button>
      </td>
    </tr>
  );
}

export const Phase2GridRow = memo(
  Phase2GridRowImpl,
  (prev, next) => (
    prev.row === next.row
    && prev.rowIndex === next.rowIndex
    && prev.approvedSet === next.approvedSet
    && prev.rowEdit === next.rowEdit
    && prev.saving === next.saving
    && prev.selected === next.selected
    && prev.rowPendingCount === next.rowPendingCount
    && prev.rowMinConf === next.rowMinConf
    && prev.onSelectRow === next.onSelectRow
    && prev.onSelectField === next.onSelectField
    && prev.onApproveAllInRow === next.onApproveAllInRow
    && prev.onApproveCell === next.onApproveCell
    && prev.onBooleanCellEdit === next.onBooleanCellEdit
    && prev.onNumericCellEdit === next.onNumericCellEdit
    && prev.onCellKeyDown === next.onCellKeyDown
    && prev.onRemoveRow === next.onRemoveRow
    && prev.getRowFieldScore === next.getRowFieldScore
    && prev.isLowConfidence === next.isLowConfidence
    && prev.isNumericField === next.isNumericField
    && prev.isBooleanField === next.isBooleanField
    && prev.confidenceColor === next.confidenceColor
    && prev.getCellStyle === next.getCellStyle
    && prev.getNumericInputStyle === next.getNumericInputStyle
    && prev.getScoreTextStyle === next.getScoreTextStyle
    && prev.getApproveButtonStyle === next.getApproveButtonStyle
    && prev.confidenceFields === next.confidenceFields
    && prev.fieldLabel === next.fieldLabel
    && prev.tdStyle === next.tdStyle
    && prev.rowIndexCellStyle === next.rowIndexCellStyle
    && prev.rowIndexInnerStyle === next.rowIndexInnerStyle
    && prev.rowApproveBtnStyle === next.rowApproveBtnStyle
    && prev.boolLabelStyle === next.boolLabelStyle
    && prev.boolInputStyle === next.boolInputStyle
    && prev.cellInnerStyle === next.cellInnerStyle
    && prev.cellFooterStyle === next.cellFooterStyle
    && prev.sl700 === next.sl700
    && prev.sl750 === next.sl750
    && prev.colorSuccess === next.colorSuccess
    && prev.colorWarning === next.colorWarning
  ),
);
