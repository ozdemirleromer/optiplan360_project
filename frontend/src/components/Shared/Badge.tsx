import type { CSSProperties } from "react";
import { COLORS, RADIUS, TYPOGRAPHY, getStatusConfig } from "./constants";

interface BadgeProps {
  status?: string;
  variant?: "success" | "secondary" | "warning" | "danger" | "info";
  children?: React.ReactNode;
  animated?: boolean;
  style?: CSSProperties;
}

export function Badge({ status, variant = "secondary", children, animated = false, style }: BadgeProps) {
  if (status) {
    const statusConfig = getStatusConfig();
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    const isActive = status === "IN_PRODUCTION" || status === "NEW";

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: RADIUS.full,
          background: `${config.color}18`,
          border: `1px solid ${config.color}30`,
          fontSize: 12,
          fontWeight: TYPOGRAPHY.fontWeight.semibold,
          color: config.color,
          transition: "all .2s ease",
          ...style,
        }}
      >
        {animated || isActive ? (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: config.color,
              animation: "pulse-dot 1.5s ease-in-out infinite",
            }}
          />
        ) : (
          <span style={{ fontSize: 12 }}>{config.icon}</span>
        )}
        {config.label}
      </span>
    );
  }

  const variantMap: Record<NonNullable<BadgeProps["variant"]>, { bg: string; border: string; color: string }> = {
    success: { bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.35)", color: COLORS.success.DEFAULT },
    secondary: { bg: "rgba(115,115,115,0.15)", border: "rgba(115,115,115,0.35)", color: COLORS.gray[300] },
    warning: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.35)", color: COLORS.warning.DEFAULT },
    danger: { bg: "rgba(244,63,94,0.15)", border: "rgba(244,63,94,0.35)", color: COLORS.danger.DEFAULT },
    info: { bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)", color: COLORS.info.DEFAULT },
  };

  const selected = variantMap[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 12px",
        borderRadius: RADIUS.full,
        background: selected.bg,
        border: `1px solid ${selected.border}`,
        fontSize: 12,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        color: selected.color,
        transition: "all .2s ease",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
