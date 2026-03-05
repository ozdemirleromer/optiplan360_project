import { COLORS, TYPOGRAPHY, RADIUS } from "./constants";

interface PriorityBadgeProps {
  priority: "high" | "normal" | "low" | "urgent";
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  const config = {
    urgent: { color: COLORS.danger, label: "Acil" },
    high: { color: COLORS.danger, label: "Yüksek" },
    normal: { color: COLORS.primary, label: "Normal" },
    low: { color: COLORS.muted, label: "Düşük" },
  } as const;

  const c = config[priority] || config.normal;

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: RADIUS.full,
        background: `${c.color}18`,
        border: `1px solid ${c.color}30`,
        color: c.color,
        fontSize: 10,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {c.label}
    </span>
  );
};

