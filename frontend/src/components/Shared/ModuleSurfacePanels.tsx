import type { LucideIcon } from "lucide-react";

import { Card } from "./Card";
import { COLORS, RADIUS, primaryRgba } from "./constants";

export interface ModuleSurfacePanelItem {
  title: string;
  detail: string;
  icon: LucideIcon;
}

interface ModuleSurfaceInsightGridProps {
  items: ModuleSurfacePanelItem[];
}

interface ModuleSurfaceBlockerListProps {
  items: ModuleSurfacePanelItem[];
}

type ModuleSurfacePanelTone = "info" | "warning";

function ModuleSurfacePanelCard({
  item,
  tone,
}: {
  item: ModuleSurfacePanelItem;
  tone: ModuleSurfacePanelTone;
}) {
  const Icon = item.icon;
  const isWarning = tone === "warning";

  return (
    <Card
      style={{
        borderRadius: RADIUS.lg,
        border: isWarning ? `1px solid ${primaryRgba(0.28)}` : `1px solid ${COLORS.border}`,
        background: isWarning
          ? `linear-gradient(180deg, ${primaryRgba(0.08)}, ${COLORS.bg.elevated ?? COLORS.bg.surface})`
          : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: RADIUS.md,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: isWarning ? primaryRgba(0.14) : primaryRgba(0.12),
            color: isWarning ? COLORS.warning : COLORS.primary,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{item.title}</div>
          <div style={{ fontSize: 12, lineHeight: isWarning ? 1.7 : 1.6, color: COLORS.muted }}>{item.detail}</div>
        </div>
      </div>
    </Card>
  );
}

export function ModuleSurfaceInsightGrid({ items }: ModuleSurfaceInsightGridProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
      {items.map((item) => (
        <ModuleSurfacePanelCard key={item.title} item={item} tone="info" />
      ))}
    </div>
  );
}

export function ModuleSurfaceBlockerList({ items }: ModuleSurfaceBlockerListProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <ModuleSurfacePanelCard key={item.title} item={item} tone="warning" />
      ))}
    </div>
  );
}
