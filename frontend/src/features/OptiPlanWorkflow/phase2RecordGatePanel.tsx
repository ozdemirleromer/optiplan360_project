import type { CSSProperties } from "react";
import { useMemo } from "react";

import type { Phase3GateStatusResponse } from "../../types/phase2_types";
import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import { BlockerExplanation } from "./BlockerExplanation";
import { BlockerSummaryPanel } from "./BlockerSummaryPanel";
import { InfoField } from "./phase2MiniPanels";

type GateBlocker = NonNullable<Phase3GateStatusResponse["blockerReasons"]>[number];

type BlockerSummary = {
  totalRows: number;
  lowCells: number;
  pendingApprovals: number;
  approvedCells: number;
  exportReady: boolean;
};

type Phase2RecordGatePanelProps = {
  activeRecord: WorkflowRecord;
  gateStatus: Phase3GateStatusResponse | null;
  gateLoading: boolean;
  blockerDetails: GateBlocker[];
  blockerSummary: BlockerSummary | null;
  confidenceThreshold: number;
  isNarrowViewport: boolean;
  cardStyle: CSSProperties;
  sl200: string;
  sl400: string;
  colorSuccess: string;
  colorWarning: string;
};

const containerStyle: CSSProperties = {
  padding: "10px 16px",
  display: "grid",
  gap: 10,
};

const headerFlexStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const headerLeftStyle: CSSProperties = {
  display: "grid",
  gap: 3,
};

const headerLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const headerValueStyle: CSSProperties = {
  fontSize: 15,
};

const headerRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const gateBadgeBaseStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  letterSpacing: "0.05em",
};

const warningTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const blockersContainerStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const blockerLoadingStyle: CSSProperties = {
  fontSize: 12,
};

const summaryMarginStyle: CSSProperties = {
  marginTop: 10,
};

export function Phase2RecordGatePanel({
  activeRecord,
  gateStatus,
  gateLoading,
  blockerDetails,
  blockerSummary,
  confidenceThreshold,
  isNarrowViewport,
  cardStyle,
  sl200,
  sl400,
  colorSuccess,
  colorWarning,
}: Phase2RecordGatePanelProps) {
  const gateBadgeStyle = useMemo(
    () => ({
      ...gateBadgeBaseStyle,
      border: `1px solid ${gateStatus?.canProceed ? colorSuccess : colorWarning}`,
      background: gateStatus?.canProceed ? `${colorSuccess}14` : `${colorWarning}14`,
      color: gateStatus?.canProceed ? colorSuccess : colorWarning,
    }),
    [gateStatus?.canProceed, colorSuccess, colorWarning]
  );

  const detailGridColumns = useMemo(() => ({
    ...detailGridStyle,
    gridTemplateColumns: isNarrowViewport ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
  }), [isNarrowViewport]);

  return (
    <section style={cardStyle} aria-label="Kayıt Özeti ve Gate">
      <div style={containerStyle}>
        <div style={headerFlexStyle}>
          <div style={headerLeftStyle}>
            <span style={{ ...headerLabelStyle, color: sl400 }}>
              Kayıt Özeti
            </span>
            <strong style={{ ...headerValueStyle, color: sl200 }}>{activeRecord.hamDosyaAdi}</strong>
          </div>
          <div style={headerRightStyle}>
            <span style={gateBadgeStyle}>
              {gateStatus?.canProceed ? "PHASE 3 READY" : "PHASE 3 BLOCKED"}
            </span>
            {activeRecord.revizyonAdayiUyarisi ? (
              <span style={{ ...warningTextStyle, color: colorWarning }}>
                ⚠ {activeRecord.revizyonAdayiUyarisi}
              </span>
            ) : null}
          </div>
        </div>

        <div style={detailGridColumns}>
          <InfoField label="Okunan Cari Ünvan" value={activeRecord.okunanCariUnvan || "—"} sl200={sl200} sl400={sl400} />
          <InfoField label="Okunan Cari Telefon" value={activeRecord.okunanCariTelefon || "—"} sl200={sl200} sl400={sl400} />
          <InfoField label="Kaynak Klasör" value={activeRecord.kaynakKlasor || "—"} sl200={sl200} sl400={sl400} />
          <InfoField
            label="Gate"
            value={gateLoading ? "Kontrol ediliyor" : (gateStatus?.canProceed ? "Hazır" : "Engelli")}
            sl200={sl200}
            sl400={sl400}
          />
        </div>

        <div style={blockersContainerStyle}>
          {gateLoading ? (
            <span style={{ ...blockerLoadingStyle, color: sl400 }}>Gate durumu güncelleniyor...</span>
          ) : blockerDetails.length === 0 ? (
            <span style={{ ...blockerLoadingStyle, color: sl400 }}>Gate blocker bulunmuyor.</span>
          ) : (
            blockerDetails.slice(0, 2).map((b, i) => (
              <BlockerExplanation
                key={`${b.rowId}-${b.fieldType}-${i}`}
                blocker={{
                  reasonCode: b.reasonCode,
                  operatorMessage: b.operatorMessage,
                  isBlocker: b.severity === "critical" || b.severity === "warning",
                  severity: b.severity,
                  confidenceScore: b.confidenceScore,
                }}
              />
            ))
          )}
        </div>

        {blockerSummary ? (
          <div style={summaryMarginStyle}>
            <BlockerSummaryPanel
              summary={blockerSummary}
              confidenceThreshold={confidenceThreshold}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
