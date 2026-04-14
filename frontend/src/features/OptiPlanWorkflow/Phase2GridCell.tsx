import { memo, useCallback, useEffect, useMemo } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

import { ensurePhase2RenderDebugHelpers, type Phase2RenderDebugWindow } from "./phase2RenderDebug";
import type { BooleanField, ConfidenceField, NumericField } from "./phase2GridTypes";

export type Phase2GridCellProps = {
  rowId: string;
  rowIndex: number;
  field: ConfidenceField;
  fieldLabel: string;
  fieldIdx: number;
  score: number;
  low: boolean;
  approved: boolean;
  displayVal: number | boolean | null | undefined;
  isBool: boolean;
  isNumeric: boolean;
  cellStyle: CSSProperties;
  numericInputStyle: CSSProperties;
  scoreTextStyle: CSSProperties;
  approveButtonStyle: CSSProperties;
  boolLabelStyle: CSSProperties;
  boolInputStyle: CSSProperties;
  cellInnerStyle: CSSProperties;
  cellFooterStyle: CSSProperties;
  onSelectRow: (rowId: string | null) => void;
  onSelectField: (field: ConfidenceField | null) => void;
  onApproveCell: (rowId: string, field: ConfidenceField) => void;
  onBooleanCellEdit: (rowId: string, field: BooleanField, value: boolean) => void;
  onNumericCellEdit: (rowId: string, field: NumericField, rawValue: string) => void;
  onCellKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>, rowId: string, fieldIdx: number, rowIdx: number) => void;
};

function Phase2GridCellImpl({
  rowId,
  rowIndex,
  field,
  fieldLabel,
  fieldIdx,
  score,
  low,
  approved,
  displayVal,
  isBool,
  isNumeric,
  cellStyle,
  numericInputStyle,
  scoreTextStyle,
  approveButtonStyle,
  boolLabelStyle,
  boolInputStyle,
  cellInnerStyle,
  cellFooterStyle,
  onSelectRow,
  onSelectField,
  onApproveCell,
  onBooleanCellEdit,
  onNumericCellEdit,
  onCellKeyDown,
}: Phase2GridCellProps) {
  const debugWindow = typeof window !== "undefined"
    ? window as Phase2RenderDebugWindow
    : null;
  const renderTelemetryEnabled = import.meta.env.DEV
    && Boolean(debugWindow?.__PHASE2_RENDER_DEBUG__);

  useEffect(() => {
    if (!renderTelemetryEnabled || !debugWindow) return;
    ensurePhase2RenderDebugHelpers(debugWindow);
    debugWindow.__PHASE2_RENDER_FIELD_METRICS__ ??= {};
    const key = `${rowId}:${field}`;
    debugWindow.__PHASE2_RENDER_FIELD_METRICS__[key] = (debugWindow.__PHASE2_RENDER_FIELD_METRICS__[key] ?? 0) + 1;
  }, [debugWindow, field, renderTelemetryEnabled, rowId]);

  const inputAriaLabel = useMemo(
    () => `${fieldLabel} değeri satır ${rowIndex + 1}`,
    [fieldLabel, rowIndex],
  );

  const inputDataCell = useMemo(
    () => `${rowId}-${fieldIdx}`,
    [fieldIdx, rowId],
  );

  const handleCellFocus = useCallback(() => {
    onSelectRow(rowId);
    onSelectField(field);
  }, [field, onSelectField, onSelectRow, rowId]);

  const handleCellKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      onCellKeyDown(event, rowId, fieldIdx, rowIndex);
    },
    [fieldIdx, onCellKeyDown, rowId, rowIndex],
  );

  const handleBooleanChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onBooleanCellEdit(rowId, field as BooleanField, event.target.checked);
    },
    [field, onBooleanCellEdit, rowId],
  );

  const handleNumericChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onNumericCellEdit(rowId, field as NumericField, event.target.value);
    },
    [field, onNumericCellEdit, rowId],
  );

  const handleApproveClick = useCallback(() => {
    onApproveCell(rowId, field);
  }, [field, onApproveCell, rowId]);

  return (
    <td data-testid={`cell-${rowId}-${field}`} style={cellStyle}>
      <div style={cellInnerStyle}>
        {isBool ? (
          <label style={boolLabelStyle}>
            <input
              aria-label={inputAriaLabel}
              data-cell={inputDataCell}
              type="checkbox"
              checked={Boolean(displayVal)}
              onChange={handleBooleanChange}
              onFocus={handleCellFocus}
              onKeyDown={handleCellKeyDown}
              style={boolInputStyle}
            />
          </label>
        ) : null}
        {isNumeric ? (
          <input
            aria-label={inputAriaLabel}
            data-cell={inputDataCell}
            type="number"
            value={typeof displayVal === "number" ? displayVal : ""}
            onChange={handleNumericChange}
            onFocus={handleCellFocus}
            onKeyDown={handleCellKeyDown}
            style={numericInputStyle}
          />
        ) : null}
        <div style={cellFooterStyle}>
          <span style={scoreTextStyle}>{approved ? "✓ Onaylı" : `%${score}`}</span>
          {low && !approved ? (
            <button
              type="button"
              aria-label={`${fieldLabel} onayla satır ${rowIndex + 1} (F2)`}
              title="Onayla (F2)"
              onClick={handleApproveClick}
              style={approveButtonStyle}
            >
              Onayla
            </button>
          ) : null}
        </div>
      </div>
    </td>
  );
}

export const Phase2GridCell = memo(
  Phase2GridCellImpl,
  (prev, next) => (
    prev.rowId === next.rowId
    && prev.rowIndex === next.rowIndex
    && prev.field === next.field
    && prev.fieldLabel === next.fieldLabel
    && prev.fieldIdx === next.fieldIdx
    && prev.score === next.score
    && prev.low === next.low
    && prev.approved === next.approved
    && prev.displayVal === next.displayVal
    && prev.isBool === next.isBool
    && prev.isNumeric === next.isNumeric
    && prev.cellStyle === next.cellStyle
    && prev.numericInputStyle === next.numericInputStyle
    && prev.scoreTextStyle === next.scoreTextStyle
    && prev.approveButtonStyle === next.approveButtonStyle
    && prev.boolLabelStyle === next.boolLabelStyle
    && prev.boolInputStyle === next.boolInputStyle
    && prev.cellInnerStyle === next.cellInnerStyle
    && prev.cellFooterStyle === next.cellFooterStyle
    && prev.onSelectRow === next.onSelectRow
    && prev.onSelectField === next.onSelectField
    && prev.onApproveCell === next.onApproveCell
    && prev.onBooleanCellEdit === next.onBooleanCellEdit
    && prev.onNumericCellEdit === next.onNumericCellEdit
    && prev.onCellKeyDown === next.onCellKeyDown
  ),
);
