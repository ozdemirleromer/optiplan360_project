import { useMemo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from "react";

import type { WorkflowRecord, WorkflowRow } from "../../services/optiplanWorkflowService";
import type { CellBlocker } from "../../types/phase2_types";
import { BlockerExplanation } from "./BlockerExplanation";
import { Phase2GridRow } from "./Phase2GridRow";
import { EMPTY_APPROVED_FIELDS, isBooleanField, isNumericField } from "./phase2GridConstants";
import type { ConfidenceField, RowEditState } from "./phase2GridTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Stil Sabitler
// ─────────────────────────────────────────────────────────────────────────────

const scrollHintBaseStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const scrollHintLabelStyle: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const scrollHintDescStyle: CSSProperties = {
  fontSize: 11,
};

const gridScrollStyle: CSSProperties = {
  overflowX: "auto",
  overscrollBehaviorX: "contain",
};

const tableBaseStyle: CSSProperties = {
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const theadRowStyle: CSSProperties = {
  borderBottom: "inherit",
};

const blockerPanelBaseStyle: CSSProperties = {
  padding: "10px 16px",
  borderTop: "inherit",
  display: "grid",
  gap: 8,
};

const blockerHeaderStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
};

const blockerContentStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const blockerLabelStyle: CSSProperties = {
  fontSize: 10,
};

const auditPanelBaseStyle: CSSProperties = {
  padding: "8px 16px",
  borderTop: "inherit",
};

const auditHeaderStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const auditEntryStyle: CSSProperties = {
  fontSize: 10,
  padding: "2px 0",
};

type RowMetrics = {
  pendingApprovals: number;
  minConfidence: number;
};

type Phase2GridPanelProps = {
  activeRecord: WorkflowRecord;
  isNarrowViewport: boolean;
  gridScrollRef: MutableRefObject<HTMLDivElement | null>;
  confidenceFields: ConfidenceField[];
  fieldLabel: Record<ConfidenceField, string>;
  approvedCells: Record<string, Set<ConfidenceField>>;
  rowEdits: Record<string, RowEditState>;
  rowMetricsById: Map<string, RowMetrics>;
  saving: boolean;
  selectedRowId: string | null;
  tdStyle: CSSProperties;
  thStyle: CSSProperties;
  cardStyle: CSSProperties;
  cardHeaderStyle: CSSProperties;
  cardTitleStyle: CSSProperties;
  rowIndexCellStyle: CSSProperties;
  rowIndexInnerStyle: CSSProperties;
  rowApproveBtnStyle: CSSProperties;
  boolLabelStyle: CSSProperties;
  boolInputStyle: CSSProperties;
  cellInnerStyle: CSSProperties;
  cellFooterStyle: CSSProperties;
  phase2GridMinWidth: number;
  colNo: number;
  colNumeric: number;
  colBool: number;
  colConf: number;
  colStatus: number;
  colAction: number;
  sl200: string;
  sl400: string;
  sl700: string;
  sl750: string;
  sl800: string;
  colorPrimary: string;
  colorSuccess: string;
  colorWarning: string;
  getRowFieldScore: (row: WorkflowRow, field: ConfidenceField) => number;
  isLowConfidence: (score: number, threshold?: number) => boolean;
  confidenceColor: (score: number, threshold?: number) => string;
  getCellStyle: (isNumeric: boolean, low: boolean, approved: boolean, scoreColor: string) => CSSProperties;
  getNumericInputStyle: (low: boolean, approved: boolean, scoreColor: string) => CSSProperties;
  getScoreTextStyle: (approved: boolean, scoreColor: string) => CSSProperties;
  getApproveButtonStyle: (scoreColor: string) => CSSProperties;
  cellBlockerEntries: Array<[string, CellBlocker[]]>;
  onSelectRow: (rowId: string | null) => void;
  onSelectField: (field: ConfidenceField | null) => void;
  onApproveAllInRow: (rowId: string) => void;
  onApproveCell: (rowId: string, field: ConfidenceField) => void;
  onBooleanCellEdit: (rowId: string, field: "u1" | "u2" | "k1" | "k2", value: boolean) => void;
  onNumericCellEdit: (rowId: string, field: "boy" | "en" | "adet", rawValue: string) => void;
  onCellKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>, rowId: string, fieldIdx: number, rowIdx: number) => void;
  onRemoveRow: (rowId: string) => Promise<void>;
};

export function Phase2GridPanel({
  activeRecord,
  isNarrowViewport,
  gridScrollRef,
  confidenceFields,
  fieldLabel,
  approvedCells,
  rowEdits,
  rowMetricsById,
  saving,
  selectedRowId,
  tdStyle,
  thStyle,
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  rowIndexCellStyle,
  rowIndexInnerStyle,
  rowApproveBtnStyle,
  boolLabelStyle,
  boolInputStyle,
  cellInnerStyle,
  cellFooterStyle,
  phase2GridMinWidth,
  colNo,
  colNumeric,
  colBool,
  colConf,
  colStatus,
  colAction,
  sl200,
  sl400,
  sl700,
  sl750,
  sl800,
  colorPrimary,
  colorSuccess,
  colorWarning,
  getRowFieldScore,
  isLowConfidence,
  confidenceColor,
  getCellStyle,
  getNumericInputStyle,
  getScoreTextStyle,
  getApproveButtonStyle,
  cellBlockerEntries,
  onSelectRow,
  onSelectField,
  onApproveAllInRow,
  onApproveCell,
  onBooleanCellEdit,
  onNumericCellEdit,
  onCellKeyDown,
  onRemoveRow,
}: Phase2GridPanelProps) {
  const rowViewModels = useMemo(
    () =>
      activeRecord.satirlar.map((row, idx) => {
        const approvedSet = approvedCells[row.id] ?? EMPTY_APPROVED_FIELDS;
        const rowMetrics = rowMetricsById.get(row.id);
        return {
          row,
          rowIndex: idx,
          approvedSet,
          rowEdit: rowEdits[row.id],
          rowPendingCount: rowMetrics?.pendingApprovals ?? 0,
          rowMinConf: rowMetrics?.minConfidence ?? 100,
        };
      }),
    [activeRecord.satirlar, approvedCells, rowEdits, rowMetricsById],
  );

  const visibleCellBlockerEntries = useMemo(
    () => cellBlockerEntries.slice(0, 5),
    [cellBlockerEntries],
  );

  const scrollHintStyle = useMemo(
    () => ({
      ...scrollHintBaseStyle,
      borderBottom: `1px solid ${sl700}`,
      background: `${colorPrimary}14`,
      color: sl200,
    } as CSSProperties),
    [colorPrimary, sl700, sl200]
  );

  const gridTableStyle = useMemo(
    () => ({
      ...tableBaseStyle,
      width: isNarrowViewport ? phase2GridMinWidth : "100%",
      minWidth: phase2GridMinWidth,
    } as CSSProperties),
    [isNarrowViewport, phase2GridMinWidth]
  );

  const theadRowFullStyle = useMemo(
    () => ({
      ...theadRowStyle,
      background: sl750,
      borderBottom: `1px solid ${sl700}`,
    } as CSSProperties),
    [sl750, sl700]
  );

  const blockerPanelStyle = useMemo(
    () => ({
      ...blockerPanelBaseStyle,
      borderTop: `1px solid ${sl700}`,
      background: sl800,
    } as CSSProperties),
    [sl700, sl800]
  );

  const blockHeaderFullStyle = useMemo(
    () => ({
      ...blockerHeaderStyle,
      color: sl200,
    } as CSSProperties),
    [sl200]
  );

  const blockerLabelFullStyle = useMemo(
    () => ({
      ...blockerLabelStyle,
      color: sl400,
    } as CSSProperties),
    [sl400]
  );

  const auditPanelStyle = useMemo(
    () => ({
      ...auditPanelBaseStyle,
      borderTop: `1px solid ${sl700}`,
    } as CSSProperties),
    [sl700]
  );

  const auditHeaderFullStyle = useMemo(
    () => ({
      ...auditHeaderStyle,
      color: sl400,
    } as CSSProperties),
    [sl400]
  );

  const auditEntryFullStyle = useMemo(
    () => ({
      ...auditEntryStyle,
      color: sl400,
      borderBottom: `1px solid ${sl700}`,
    } as CSSProperties),
    [sl400, sl700]
  );

  return (
    <section style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Doğrulama — BOY, EN, ADET, U1, U2, K1, K2</span>
        <span style={{ fontSize: 11, color: sl400 }}>
          Turuncu = düşük güven, manuel onay gerekli
        </span>
      </div>
      {isNarrowViewport ? (
        <div
          data-testid="phase2-grid-scroll-hint"
          style={scrollHintStyle}
        >
          <strong style={{ ...scrollHintLabelStyle, color: colorPrimary }}>
            Dar Ekran Modu
          </strong>
          <span style={{ ...scrollHintDescStyle, color: sl400 }}>
            7 alan sabit kalır; grid yatay kaydırılarak kullanılır.
          </span>
        </div>
      ) : null}
      <div
        data-testid="phase2-grid-scroll"
        data-layout-mode={isNarrowViewport ? "horizontal-scroll" : "full-width"}
        ref={gridScrollRef}
        style={gridScrollStyle}
      >
        <table
          style={gridTableStyle}
        >
          <colgroup>
            <col style={{ width: colNo }} />
            {confidenceFields.map((field) => (
              <col
                key={field}
                style={{
                  width: isBooleanField(field) ? colBool : colNumeric,
                }}
              />
            ))}
            <col style={{ width: colConf }} />
            <col style={{ width: colStatus }} />
            <col style={{ width: colAction }} />
          </colgroup>
          <thead>
            <tr style={theadRowFullStyle}>
              <th style={thStyle}>#</th>
              {confidenceFields.map((field) => (
                <th
                  key={field}
                  style={{
                    ...thStyle,
                    color: sl200,
                    borderLeft: isNumericField(field)
                      ? `2px solid ${colorWarning}20`
                      : `1px solid ${sl700}`,
                    textAlign: isBooleanField(field) ? "center" : "right",
                  }}
                >
                  {fieldLabel[field]}
                </th>
              ))}
              <th style={{ ...thStyle, color: sl400, textAlign: "center" }}>Conf.</th>
              <th style={{ ...thStyle, color: sl400, textAlign: "center" }}>Durum</th>
              <th style={{ ...thStyle, color: sl400 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rowViewModels.map(({ row, rowIndex, approvedSet, rowEdit, rowPendingCount, rowMinConf }) => {
              return (
                <Phase2GridRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  approvedSet={approvedSet}
                  rowEdit={rowEdit}
                  saving={saving}
                  selected={row.id === selectedRowId}
                  rowPendingCount={rowPendingCount}
                  rowMinConf={rowMinConf}
                  confidenceFields={confidenceFields}
                  fieldLabel={fieldLabel}
                  sl700={sl700}
                  sl750={sl750}
                  colorSuccess={colorSuccess}
                  colorWarning={colorWarning}
                  tdStyle={tdStyle}
                  rowIndexCellStyle={rowIndexCellStyle}
                  rowIndexInnerStyle={rowIndexInnerStyle}
                  rowApproveBtnStyle={rowApproveBtnStyle}
                  boolLabelStyle={boolLabelStyle}
                  boolInputStyle={boolInputStyle}
                  cellInnerStyle={cellInnerStyle}
                  cellFooterStyle={cellFooterStyle}
                  getRowFieldScore={getRowFieldScore}
                  isLowConfidence={isLowConfidence}
                  isNumericField={isNumericField}
                  isBooleanField={isBooleanField}
                  confidenceColor={confidenceColor}
                  getCellStyle={getCellStyle}
                  getNumericInputStyle={getNumericInputStyle}
                  getScoreTextStyle={getScoreTextStyle}
                  getApproveButtonStyle={getApproveButtonStyle}
                  onSelectRow={onSelectRow}
                  onSelectField={onSelectField}
                  onApproveAllInRow={onApproveAllInRow}
                  onApproveCell={onApproveCell}
                  onBooleanCellEdit={onBooleanCellEdit}
                  onNumericCellEdit={onNumericCellEdit}
                  onCellKeyDown={onCellKeyDown}
                  onRemoveRow={onRemoveRow}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {cellBlockerEntries.length > 0 ? (
        <div style={blockerPanelStyle}>
          <div style={blockHeaderFullStyle}>Hücre Doğrulama Blockerları</div>
          {visibleCellBlockerEntries.map(([key, blockers]) => {
            const [rowId, fieldType] = key.split(":");
            return (
              <div key={key} style={blockerContentStyle}>
                <div style={blockerLabelFullStyle}>
                  Satır: {rowId} · Alan: {fieldType?.toUpperCase()}
                </div>
                <BlockerExplanation blocker={blockers[0]} />
              </div>
            );
          })}
        </div>
      ) : null}

      {activeRecord.auditKayitlari.length > 0 ? (
        <div style={auditPanelStyle}>
          <div style={auditHeaderFullStyle}>
            Audit İzi
          </div>
          {activeRecord.auditKayitlari.slice(-3).map((entry, i) => (
            <div key={i} style={auditEntryFullStyle}>
              {String(entry)}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
