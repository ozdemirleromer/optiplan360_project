import { CSSProperties, useEffect, useState } from "react";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";
import { COLORS, TYPOGRAPHY, RADIUS } from "./constants";

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  change?: number;
  color: string;
  sparkData?: number[];
}

export const KPICard = ({ icon, label, value, change, color, sparkData }: KPICardProps) => {
  const [display, setDisplay] = useState(0);
  const numVal = typeof value === "number" ? value : Number.parseFloat(value);
  const isNum = Number.isFinite(numVal);

  useEffect(() => {
    if (!isNum) return;
    let start = 0;
    const step = Math.max(1, Math.ceil(numVal / 28));
    let rafId: number;
    const animate = () => {
      start += step;
      if (start >= numVal) {
        setDisplay(numVal);
      } else {
        setDisplay(start);
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [numVal, isNum]);

  return (
    <Card hoverable style={{ height: "100%", position: "relative", overflow: "hidden" } as CSSProperties}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
              color: COLORS.muted,
              margin: "0 0 8px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: 30,
              fontWeight: TYPOGRAPHY.fontWeight.bold,
              color: COLORS.text,
              margin: 0,
              fontFamily: TYPOGRAPHY.fontFamily.heading,
              letterSpacing: "-0.02em",
            }}
          >
            {isNum ? Math.round(display * 10) / 10 : value}
          </p>
          {change !== undefined ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: RADIUS.full,
                  fontSize: 11,
                  fontWeight: TYPOGRAPHY.fontWeight.semibold,
                  background: change > 0 ? COLORS.success.light : COLORS.danger.light,
                  color: change > 0 ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT,
                }}
              >
                {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
              </span>
              <span style={{ fontSize: 11, color: COLORS.gray[400] }}>vs dün</span>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: RADIUS.lg,
              background: `${color}18`,
              border: `1px solid ${color}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
              color,
            }}
          >
            {icon}
          </div>
          {sparkData ? <Sparkline data={sparkData} color={color} /> : null}
        </div>
      </div>
    </Card>
  );
};
