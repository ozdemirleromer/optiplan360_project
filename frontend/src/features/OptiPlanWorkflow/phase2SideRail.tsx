import type { ComponentProps, CSSProperties } from "react";

import type { BandEdgeField, BandReviewEntry } from "./phase2BandReview";
import { BAND_EDGE_FIELDS, BAND_LABELS } from "./phase2BandReview";
import { SummaryChip } from "./phase2MiniPanels";
import { UndoHistoryPanel } from "./UndoHistoryPanel";

const railBaseStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  alignItems: "start",
};

const sectionBodyStyle: CSSProperties = {
  padding: "10px 14px",
  display: "grid",
  gap: 8,
};

const compactBodyStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 11,
};

const splitHeaderStyle: CSSProperties = {
  justifyContent: "space-between",
  gap: 8,
};

const wrapRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const infoBlockStyle: CSSProperties = {
  display: "block",
  marginBottom: 2,
};

const lineBlockStyle: CSSProperties = {
  display: "block",
};

function getRailLayoutStyle(isNarrowViewport: boolean): CSSProperties {
  return {
    ...railBaseStyle,
    gridTemplateColumns: isNarrowViewport ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))",
  };
}

function getStatusPanelStyle(
  exportReady: boolean,
  colorSuccess: string,
  colorWarning: string,
  colorWarningLight: string
): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 3,
    background: exportReady ? `${colorSuccess}12` : `${colorWarning}${colorWarningLight}`,
    border: `1px solid ${exportReady ? colorSuccess : colorWarning}`,
    display: "grid",
    gap: 8,
  };
}

function getStatusHeaderStyle(statusColor: string): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: statusColor,
  };
}

function getStatusMetaStyle(statusColor: string): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    color: statusColor,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
}

function getBandHeaderBoxStyle(hasIssue: boolean, colorWarning: string, colorWarningLight: string, colorPrimary: string): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 3,
    background: hasIssue ? `${colorWarning}${colorWarningLight}` : `${colorPrimary}14`,
    border: `1px solid ${hasIssue ? colorWarning : colorPrimary}`,
    display: "grid",
    gap: 4,
  };
}

function getBandGridStyle(isNarrowViewport: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isNarrowViewport ? "minmax(0, 1fr)" : "1fr 1fr",
    gap: 6,
  };
}

function getBandChipStyle(active: boolean, chipColor: string, sl700: string, sl900: string): CSSProperties {
  return {
    padding: "8px 9px",
    borderRadius: 3,
    border: `1px solid ${active ? chipColor : sl700}`,
    background: active ? `${chipColor}12` : sl900,
    display: "grid",
    gap: 3,
  };
}

function getIssueBannerStyle(colorWarning: string, colorWarningLight: string): CSSProperties {
  return {
    padding: "6px 8px",
    borderRadius: 3,
    border: `1px solid ${colorWarning}`,
    background: `${colorWarning}${colorWarningLight}`,
    color: colorWarning,
    fontSize: 10,
    fontWeight: 700,
  };
}

function getDecisionStatusStyle(validateError: string | null, processingDecision: boolean, sl400: string, sl800: string, colorDanger: string): CSSProperties {
  return {
    padding: "6px 8px",
    borderRadius: 3,
    fontSize: 11,
    color: validateError ? colorDanger : sl400,
    background: sl800,
  };
}

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

type Phase2SideRailProps = {
  isNarrowViewport: boolean;
  cardStyle: CSSProperties;
  cardHeaderStyle: CSSProperties;
  cardTitleStyle: CSSProperties;
  headerSecondaryBtnStyle: CSSProperties;
  blockerSummary: BlockerSummary | null;
  bandSummary: BandSummary;
  selectedBandRow: { id: string } | null;
  selectedBandReview: Record<BandEdgeField, BandReviewEntry> | null;
  selectedBandRowNumber: number | null;
  selectedBandThickness: string | null;
  selectedBandActiveCount: number;
  selectedBandHasIssue: boolean;
  showOperatorHelp: boolean;
  setShowOperatorHelp: (next: boolean | ((prev: boolean) => boolean)) => void;
  operatorShortcutLines: string[];
  phase2ScopeLines: string[];
  showDecisionHistory: boolean;
  setShowDecisionHistory: (next: boolean | ((prev: boolean) => boolean)) => void;
  undoTimeline: ComponentProps<typeof UndoHistoryPanel>["events"];
  validateError: string | null;
  processingDecision: boolean;
  validateLoading: boolean;
  saving: boolean;
  hasActiveRecord: boolean;
  processingUndo: boolean;
  pendingUndoEventId: string | null;
  onUndo: (eventId: string) => void;
  confidenceColor: (score: number, threshold?: number) => string;
  colorSuccess: string;
  colorWarning: string;
  colorWarningLight: string;
  colorPrimary: string;
  colorDanger: string;
  sl200: string;
  sl400: string;
  sl700: string;
  sl800: string;
  sl900: string;
};

export function Phase2SideRail({
  isNarrowViewport,
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  headerSecondaryBtnStyle,
  blockerSummary,
  bandSummary,
  selectedBandRow,
  selectedBandReview,
  selectedBandRowNumber,
  selectedBandThickness,
  selectedBandActiveCount,
  selectedBandHasIssue,
  showOperatorHelp,
  setShowOperatorHelp,
  operatorShortcutLines,
  phase2ScopeLines,
  showDecisionHistory,
  setShowDecisionHistory,
  undoTimeline,
  validateError,
  processingDecision,
  validateLoading,
  saving,
  hasActiveRecord,
  processingUndo,
  pendingUndoEventId,
  onUndo,
  confidenceColor,
  colorSuccess,
  colorWarning,
  colorWarningLight,
  colorPrimary,
  colorDanger,
  sl200,
  sl400,
  sl700,
  sl800,
  sl900,
}: Phase2SideRailProps) {
  return (
    <aside
      role="region"
      aria-label="Phase 2 Doğrulama Özeti"
      data-layout-mode={isNarrowViewport ? "stacked" : "rail"}
      style={getRailLayoutStyle(isNarrowViewport)}
    >
      {blockerSummary ? (
        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Doğrulama Özeti</span>
          </div>
          <div style={sectionBodyStyle}>
            <div style={getStatusPanelStyle(blockerSummary.exportReady, colorSuccess, colorWarning, colorWarningLight)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong style={getStatusHeaderStyle(blockerSummary.exportReady ? colorSuccess : colorWarning)}>
                  {blockerSummary.exportReady ? "Phase 3 Aktarıma Hazır" : "Onay Bekleyen Alanlar Var"}
                </strong>
                <span style={getStatusMetaStyle(blockerSummary.exportReady ? colorSuccess : colorWarning)}>
                  {blockerSummary.exportReady ? "Ready" : `${blockerSummary.pendingApprovals} bekliyor`}
                </span>
              </div>
              <div style={wrapRowStyle}>
                <SummaryChip label="Satır" value={String(blockerSummary.totalRows)} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
                <SummaryChip label="Şüpheli" value={String(blockerSummary.lowCells)} warn={blockerSummary.lowCells > 0} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
                <SummaryChip label="Bekleyen" value={String(blockerSummary.pendingApprovals)} warn={blockerSummary.pendingApprovals > 0} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
                <SummaryChip label="Onaylı" value={String(blockerSummary.approvedCells)} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
                <SummaryChip label="Durum" value={blockerSummary.exportReady ? "Hazır" : "Bekl."} warn={!blockerSummary.exportReady} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {selectedBandRow && selectedBandReview ? (
        <section style={cardStyle} data-testid="band-review-panel">
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Bant Kontrolü</span>
          </div>
          <div style={sectionBodyStyle}>
            <div style={getBandHeaderBoxStyle(selectedBandHasIssue, colorWarning, colorWarningLight, colorPrimary)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 11, color: sl200 }}>
                  Satır {selectedBandRowNumber ?? "—"} · {selectedBandActiveCount} aktif kenar
                </strong>
                <span
                  data-testid="band-effective-thickness"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: selectedBandHasIssue ? colorWarning : colorPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Etkin Kalınlık: {selectedBandThickness ?? "YOK"}
                </span>
              </div>
              <span style={{ fontSize: 10, color: sl400 }}>
                7 alan grid sabittir; bant alanları ayrı kontrol yüzeyinde izlenir.
              </span>
            </div>

            <div style={getBandGridStyle(isNarrowViewport)}>
              {BAND_EDGE_FIELDS.map((edge) => {
                const review = selectedBandReview[edge];
                const chipColor = review.active
                  ? (review.confidence != null ? confidenceColor(review.confidence) : colorPrimary)
                  : sl400;
                return (
                  <div
                    key={edge}
                    data-testid={`band-chip-${edge}`}
                    style={getBandChipStyle(review.active, chipColor, sl700, sl900)}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <strong style={{ fontSize: 10, color: sl200 }}>{BAND_LABELS[edge]}</strong>
                      <span style={{ fontSize: 9, fontWeight: 700, color: chipColor }}>
                        {review.active ? "Aktif" : "Kapalı"}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: sl200 }}>{review.value ?? "—"}</span>
                    <span style={{ fontSize: 9, color: review.confidence != null ? chipColor : sl400 }}>
                      {review.confidence != null ? `%${Math.round(review.confidence)}` : "OCR skoru yok"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={wrapRowStyle}>
              <SummaryChip label="Bantlı Satır" value={String(bandSummary.rowsWithBand)} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
              <SummaryChip label="Aktif Kenar" value={String(bandSummary.activeEdges)} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
              <SummaryChip label="Kalınlık Eksik" value={String(bandSummary.missingThickness)} warn={bandSummary.missingThickness > 0} colorWarning={colorWarning} colorWarningLight={colorWarningLight} sl700={sl700} sl900={sl900} sl200={sl200} sl400={sl400} />
            </div>

            {selectedBandHasIssue ? (
              <div style={getIssueBannerStyle(colorWarning, colorWarningLight)}>
                Bant işaretleri algılandı fakat kalınlık bilgisi eksik. Phase 3 öncesi kontrol edin.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={{ ...cardHeaderStyle, ...splitHeaderStyle }}>
          <span style={cardTitleStyle}>Operatör Yardımı</span>
          <button
            type="button"
            aria-expanded={showOperatorHelp}
            aria-controls="phase2-operator-help"
            onClick={() => setShowOperatorHelp((prev) => !prev)}
            style={headerSecondaryBtnStyle}
          >
            {showOperatorHelp ? "Gizle" : "Göster"}
          </button>
        </div>
        {showOperatorHelp ? (
          <div id="phase2-operator-help" style={{ ...sectionBodyStyle, fontSize: 11, color: sl400, lineHeight: 1.7 }}>
            <div>
              <strong style={{ ...infoBlockStyle, color: sl200 }}>Klavye Kısayolları</strong>
              {operatorShortcutLines.map((line) => (
                <span key={line} style={lineBlockStyle}>{line}</span>
              ))}
            </div>
            <div>
              <strong style={{ ...infoBlockStyle, color: sl200 }}>Phase 2 Kapsam Notu</strong>
              {phase2ScopeLines.map((line) => (
                <span key={line} style={lineBlockStyle}>{line}</span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...compactBodyStyle, color: sl400 }}>
            Kısayollar ve faz notları gerektiğinde açılır.
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ ...cardHeaderStyle, ...splitHeaderStyle }}>
          <span style={cardTitleStyle}>Karar Geçmişi</span>
          <button
            type="button"
            aria-expanded={showDecisionHistory}
            aria-controls="phase2-decision-history"
            onClick={() => setShowDecisionHistory((prev) => !prev)}
            style={headerSecondaryBtnStyle}
          >
            {showDecisionHistory ? "Gizle" : `Göster (${undoTimeline.length})`}
          </button>
        </div>
        {showDecisionHistory ? (
          <div id="phase2-decision-history" style={{ ...compactBodyStyle, display: "grid", gap: 8 }}>
            {(validateError || processingDecision || validateLoading) ? (
              <div style={getDecisionStatusStyle(validateError, processingDecision, sl400, sl800, colorDanger)}>
                {validateError
                  ? `Doğrulama: ${validateError}`
                  : processingDecision
                    ? "Hücre kararı kaydediliyor..."
                    : "Doğrulama çalışıyor..."}
              </div>
            ) : null}
            <UndoHistoryPanel
              events={undoTimeline}
              disabled={saving || !hasActiveRecord}
              processingUndo={processingUndo}
              pendingUndoEventId={pendingUndoEventId}
              onUndo={onUndo}
            />
          </div>
        ) : (
          <div style={{ ...compactBodyStyle, color: sl400 }}>
            Son kararlar gerektiğinde açılır. Kayıtlı olay: <strong style={{ color: sl200 }}>{undoTimeline.length}</strong>
          </div>
        )}
      </section>
    </aside>
  );
}
