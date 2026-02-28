import type { CSSProperties } from "react";
import { MoreHorizontal } from "lucide-react";
import { Sparkline } from "../../../components/Shared";

export interface MissionMetricItem {
  id: string;
  title: string;
  value: string;
  hint: string;
  toneColor: string;
  sparkData: number[];
}

interface MissionMetricCardProps {
  item: MissionMetricItem;
  index?: number;
}

function hexToRgb(value: string): string {
  const normalized = value.replace("#", "");
  if (normalized.length !== 6) {
    return "6,182,212";
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function MissionMetricCard({ item, index = 0 }: MissionMetricCardProps) {
  const metricStyle = {
    "--metric-color": item.toneColor,
    "--metric-rgb": hexToRgb(item.toneColor),
    "--metric-delay": String(index),
  } as CSSProperties;

  return (
    <article className="ai-ops-metric-card" style={metricStyle}>
      <header>
        <div>
          <p>{item.title}</p>
          <strong>{item.value}</strong>
        </div>
        <button type="button" aria-label={`${item.title} aksiyonlari`}>
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
      </header>

      <div className="ai-ops-metric-chart">
        <Sparkline data={item.sparkData} color={item.toneColor} width={228} height={48} />
      </div>

      <footer>
        <span>{item.hint}</span>
        <span className="ai-ops-breathing-dot" aria-hidden="true" />
      </footer>
    </article>
  );
}
