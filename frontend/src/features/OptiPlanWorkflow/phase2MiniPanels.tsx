import { type CSSProperties } from "react";

const queueBadgeBaseStyle: CSSProperties = {
  padding: "1px 5px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 700,
};

const blockerBannerBaseStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const blockerTextStyle: CSSProperties = { flex: 1 };
const blockerPendingTextStyle: CSSProperties = { fontWeight: 400, marginLeft: 6, color: "#b45309" };

const blockerApproveButtonBaseStyle: CSSProperties = {
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const summaryChipBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 9px",
  borderRadius: 999,
};

const summaryChipLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const infoFieldContainerStyle: CSSProperties = { display: "grid", gap: 2 };
const infoFieldLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const infoFieldValueStyle: CSSProperties = { fontSize: 12 };

type RecordQueueStatusBadgeProps = {
  lowCellCount: number;
  colorWarning: string;
  colorSuccess: string;
};

export function RecordQueueStatusBadge({
  lowCellCount,
  colorWarning,
  colorSuccess,
}: RecordQueueStatusBadgeProps) {
  const isWarn = lowCellCount > 0;
  const color = isWarn ? colorWarning : colorSuccess;
  const queueBadgeStyle: CSSProperties = {
    ...queueBadgeBaseStyle,
    background: `${color}20`,
    border: `1px solid ${color}`,
    color,
  };

  return (
    <span style={queueBadgeStyle}>
      {isWarn ? `Uyarı ${lowCellCount}` : "Hazır"}
    </span>
  );
}

type BlockerWarningBannerProps = {
  pendingCount: number;
  onApproveLowOnly: () => void;
  colorWarning: string;
  colorWarningLight: string;
  colorWarningLightest: string;
  radiusSm?: number;
};

export function BlockerWarningBanner({
  pendingCount,
  onApproveLowOnly,
  colorWarning,
  colorWarningLight,
  colorWarningLightest,
  radiusSm,
}: BlockerWarningBannerProps) {
  const bannerStyle: CSSProperties = {
    ...blockerBannerBaseStyle,
    borderRadius: radiusSm ?? 4,
    background: `${colorWarning}${colorWarningLight}`,
    border: `1px solid ${colorWarning}`,
    color: colorWarning,
  };

  const approveButtonStyle: CSSProperties = {
    ...blockerApproveButtonBaseStyle,
    border: `1px solid ${colorWarning}`,
    background: `${colorWarning}${colorWarningLightest}`,
    color: "#92400e",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={bannerStyle}
    >
      <span aria-hidden="true">!</span>
      <span style={blockerTextStyle}>
        Onaysız düşük güvenli hücreler var — Phase 3'e geçmek için tüm turuncu hücreleri onaylayın.
        {pendingCount > 0 ? (
          <span style={blockerPendingTextStyle}>
            ({pendingCount} onay bekliyor)
          </span>
        ) : null}
      </span>
      <button
        type="button"
        aria-label="Tüm düşük güvenli hücreleri onayla"
        onClick={onApproveLowOnly}
        style={approveButtonStyle}
      >
        Tümünü Onayla
      </button>
    </div>
  );
}

type SummaryChipProps = {
  label: string;
  value: string;
  warn?: boolean;
  colorWarning: string;
  colorWarningLight: string;
  sl700: string;
  sl900: string;
  sl200: string;
  sl400: string;
};

export function SummaryChip({
  label,
  value,
  warn,
  colorWarning,
  colorWarningLight,
  sl700,
  sl900,
  sl200,
  sl400,
}: SummaryChipProps) {
  const summaryChipStyle: CSSProperties = {
    ...summaryChipBaseStyle,
    border: `1px solid ${warn ? colorWarning : sl700}`,
    background: warn ? `${colorWarning}${colorWarningLight}` : sl900,
  };

  const summaryValueStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: warn ? colorWarning : sl200,
  };

  return (
    <div style={summaryChipStyle}>
      <span style={{ ...summaryChipLabelStyle, color: sl400 }}>
        {label}
      </span>
      <span style={summaryValueStyle}>
        {value}
      </span>
    </div>
  );
}

type InfoFieldProps = {
  label: string;
  value: string;
  sl200: string;
  sl400: string;
};

export function InfoField({ label, value, sl200, sl400 }: InfoFieldProps) {
  return (
    <div style={infoFieldContainerStyle}>
      <span style={{ ...infoFieldLabelStyle, color: sl400 }}>
        {label}
      </span>
      <span style={{ ...infoFieldValueStyle, color: sl200 }}>{value}</span>
    </div>
  );
}

export type SharedCardStyles = {
  cardStyle: CSSProperties;
  cardHeaderStyle: CSSProperties;
  cardTitleStyle: CSSProperties;
};
