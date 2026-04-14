import { type CSSProperties } from "react";

import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import { RecordQueueStatusBadge } from "./phase2MiniPanels";

const footerBarBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  flexWrap: "wrap",
};

const footerMetaGroupStyle: CSSProperties = { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" };
const footerMainTextStyle: CSSProperties = { fontSize: 12, fontWeight: 700 };
const footerMetaTextStyle: CSSProperties = { fontSize: 11 };

const queueCountBadgeBaseStyle: CSSProperties = {
  padding: "1px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
};

const queueTrackStyle: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(220px, 260px)",
  gap: 8,
  overflowX: "auto",
  overflowY: "hidden",
  padding: "10px 12px 12px",
};

const queueTitleStyle: CSSProperties = { fontSize: 12, wordBreak: "break-word", lineHeight: 1.35 };
const queueMetaStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 10 };

type FooterActionBarProps = {
  canApprove: boolean;
  pendingCount: number;
  fileName: string | null;
  saving: boolean;
  phase3Label: string;
  phase3Title: string;
  onPhase3: () => void;
  radiusSm?: number;
  colorSuccess: string;
  colorWarning: string;
  colorWarningLight: string;
  sl200: string;
  sl400: string;
  headerPrimaryBtnStyle: CSSProperties;
  headerDisabledBtnStyle: CSSProperties;
};

export function FooterActionBar({
  canApprove,
  pendingCount,
  fileName,
  saving,
  phase3Label,
  phase3Title,
  onPhase3,
  radiusSm,
  colorSuccess,
  colorWarning,
  colorWarningLight,
  sl200,
  sl400,
  headerPrimaryBtnStyle,
  headerDisabledBtnStyle,
}: FooterActionBarProps) {
  const footerBarStyle: CSSProperties = {
    ...footerBarBaseStyle,
    borderRadius: radiusSm ?? 4,
    border: `1px solid ${canApprove ? colorSuccess : colorWarning}`,
    background: canApprove ? `${colorSuccess}12` : `${colorWarning}${colorWarningLight}`,
  };

  return (
    <section
      role="region"
      aria-label="OCR Kontrol Durum Özeti"
      style={footerBarStyle}
    >
      <div style={footerMetaGroupStyle}>
        <span style={{ ...footerMainTextStyle, color: canApprove ? colorSuccess : colorWarning }}>
          {canApprove ? "Blocker temizlendi — Phase 3'e aktarıma hazır" : "Onaysız düşük güvenli alanlar var — Phase 3'e aktarım engellendi"}
        </span>
        {pendingCount > 0 ? (
          <span style={{ ...footerMetaTextStyle, color: sl400 }}>
            Onay bekleyen: <strong style={{ color: sl200 }}>{pendingCount}</strong>
          </span>
        ) : null}
        {fileName ? (
          <span style={{ ...footerMetaTextStyle, color: sl400 }}>
            Seçili: <strong style={{ color: sl200 }}>{fileName}</strong>
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onPhase3}
        disabled={saving || !canApprove || !fileName}
        title={phase3Title}
        style={canApprove && fileName ? headerPrimaryBtnStyle : headerDisabledBtnStyle}
      >
        {phase3Label}
      </button>
    </section>
  );
}

type QueuePanelProps = {
  records: WorkflowRecord[];
  activeUuid: string | null;
  lowCellsByUuid: Map<string, number>;
  onSelect: (uuid: string) => void;
  cardStyle: CSSProperties;
  cardHeaderStyle: CSSProperties;
  cardTitleStyle: CSSProperties;
  colorPrimary: string;
  colorWarning: string;
  colorSuccess: string;
  sl900: string;
  sl700: string;
  sl200: string;
  sl400: string;
};

export function QueuePanel({
  records,
  activeUuid,
  lowCellsByUuid,
  onSelect,
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  colorPrimary,
  colorWarning,
  colorSuccess,
  sl900,
  sl700,
  sl200,
  sl400,
}: QueuePanelProps) {
  const queueCountBadgeStyle: CSSProperties = {
    ...queueCountBadgeBaseStyle,
    background: `${colorPrimary}18`,
    color: colorPrimary,
    border: `1px solid ${colorPrimary}40`,
  };

  return (
    <section style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Kuyruk Rail</span>
        <span style={queueCountBadgeStyle}>
          {records.length}
        </span>
      </div>
      <div style={queueTrackStyle}>
        {records.map((record) => {
          const active = record.kayitUuid === activeUuid;
          const low = lowCellsByUuid.get(record.kayitUuid) ?? 0;
          const queueCardStyle: CSSProperties = {
            display: "grid",
            gap: 6,
            minHeight: 72,
            textAlign: "left",
            padding: "10px 12px",
            background: active ? `${colorPrimary}12` : sl900,
            border: `1px solid ${active ? colorPrimary : sl700}`,
            borderRadius: 3,
            cursor: "pointer",
            color: sl200,
            transition: "background .1s, border-color .1s",
          };

          return (
            <button
              key={record.kayitUuid}
              type="button"
              onClick={() => onSelect(record.kayitUuid)}
              style={queueCardStyle}
            >
              <div style={{ ...queueTitleStyle, fontWeight: active ? 700 : 500 }}>
                {record.hamDosyaAdi}
              </div>
              <div style={{ ...queueMetaStyle, color: sl400 }}>
                <span>{record.satirlar.length} satır</span>
                <RecordQueueStatusBadge
                  lowCellCount={low}
                  colorWarning={colorWarning}
                  colorSuccess={colorSuccess}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
