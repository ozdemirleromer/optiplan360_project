import type { ReactNode } from "react";

import { COLORS, RADIUS, primaryRgba } from "./constants";

interface MasterSpecMetric {
  label: string;
  value: string;
  hint?: string;
}

interface MasterSpecBannerProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  roleTitle?: string;
  roleDescription?: string;
  decisionTitle?: string;
  decisionText?: string;
  chips?: string[];
  metrics?: MasterSpecMetric[];
  actions?: ReactNode;
  tone?: "default" | "subtle";
}

export function MasterSpecBanner({
  eyebrow = "",
  title,
  subtitle,
  roleTitle = "",
  roleDescription = "",
  decisionTitle = "Nihai Karar",
  decisionText,
  chips = [],
  metrics = [],
  actions,
  tone = "default",
}: MasterSpecBannerProps) {
  const isSubtle = tone === "subtle";

  return (
    <section
      style={{
        display: "grid",
        gap: 16,
        padding: "22px 24px",
        borderRadius: RADIUS.xl,
        border: `1px solid ${isSubtle ? "rgba(148, 163, 184, 0.24)" : primaryRgba(0.2)}`,
        background: isSubtle
          ? "linear-gradient(135deg, rgba(30, 58, 138, 0.86) 0%, rgba(30, 64, 175, 0.78) 55%, rgba(15, 23, 42, 0.78) 100%)"
          : `linear-gradient(135deg, ${COLORS.primary} 0%, ${primaryRgba(0.92)} 100%)`,
        color: "#f8fafc",
        boxShadow: isSubtle ? "0 20px 48px rgba(15, 23, 42, 0.24)" : "0 24px 56px rgba(15, 23, 42, 0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 8, maxWidth: 920 }}>
          {eyebrow ? (
            <span
              style={{
                display: "inline-flex",
                width: "fit-content",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.16)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </span>
          ) : null}
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(241, 245, 249, 0.86)" }}>
            {subtitle}
          </div>
        </div>

        {actions ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              padding: isSubtle ? "8px" : 0,
              borderRadius: isSubtle ? RADIUS.lg : 0,
              background: isSubtle ? "rgba(15, 23, 42, 0.2)" : "transparent",
              border: isSubtle ? "1px solid rgba(148, 163, 184, 0.22)" : "none",
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>

      {(roleTitle || decisionText) ? (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {roleTitle ? (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "14px 16px",
            borderRadius: RADIUS.lg,
            border: "1px solid rgba(255,255,255,0.14)",
            background: isSubtle ? "rgba(15, 23, 42, 0.16)" : "rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>{roleTitle}</span>
          {roleDescription ? (
            <span style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(241, 245, 249, 0.82)" }}>
              {roleDescription}
            </span>
          ) : null}
        </div>
        ) : null}

        {decisionText ? (
          <div
            style={{
              display: "grid",
              gap: 6,
              padding: "14px 16px",
              borderRadius: RADIUS.lg,
              border: "1px solid rgba(255,255,255,0.14)",
              background: isSubtle ? "rgba(15, 23, 42, 0.16)" : "rgba(255,255,255,0.08)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {decisionTitle}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(241, 245, 249, 0.88)" }}>
              {decisionText}
            </span>
          </div>
        ) : null}
      </div>
      ) : null}

      {chips.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: isSubtle ? "rgba(15, 23, 42, 0.18)" : "rgba(255,255,255,0.1)",
                fontSize: 12,
                fontWeight: 700,
                color: "#f8fafc",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {metrics.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {metrics.map((metric) => (
            <div
              key={metric.label}
              style={{
                display: "grid",
                gap: 4,
                padding: "14px 16px",
                borderRadius: RADIUS.lg,
                border: "1px solid rgba(255,255,255,0.14)",
                background: isSubtle ? "rgba(15, 23, 42, 0.3)" : "rgba(15, 23, 42, 0.18)",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226, 232, 240, 0.76)" }}>
                {metric.label}
              </span>
              <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{metric.value}</span>
              {metric.hint ? (
                <span style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(226, 232, 240, 0.76)" }}>
                  {metric.hint}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
