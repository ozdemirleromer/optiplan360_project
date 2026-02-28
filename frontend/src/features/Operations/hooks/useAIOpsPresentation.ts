import { useMemo } from "react";
import { COLORS } from "../../../components/Shared/constants";
import type { MissionMetricItem } from "../components/MissionMetricCard";
import type { MissionOrderRow } from "../components/OrdersHoverTable";
import type { AIOpsStats } from "./useAIOpsData";
import { toHumanCount, toPercent } from "./useAIOpsData";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "secondary";

export interface AIOpsRiskItem {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger";
}

export interface AIOpsPresentationModel {
  integrationToneLabel: string;
  badgeVariant: BadgeVariant;
  metricCards: MissionMetricItem[];
  missionOrders: MissionOrderRow[];
  riskItems: ReadonlyArray<AIOpsRiskItem>;
}

const HEALTH_TO_BADGE: Record<string, BadgeVariant> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DISCONNECTED: "danger",
  UNKNOWN: "secondary",
};

function getStatusToneMap(): Record<string, { label: string; color: string }> {
  return {
    HEALTHY: { label: "Sağlam", color: COLORS.success.DEFAULT },
    DEGRADED: { label: "Dalgalanma", color: COLORS.warning.DEFAULT },
    DISCONNECTED: { label: "Bağlantı Yok", color: COLORS.danger.DEFAULT },
    UNKNOWN: { label: "Bilinmiyor", color: COLORS.muted },
  };
}

export function useAIOpsPresentation(stats: AIOpsStats): AIOpsPresentationModel {
  const statusToneMap = getStatusToneMap();
  const integrationTone = statusToneMap[stats.integrationsHealth] ?? statusToneMap.UNKNOWN;
  const badgeVariant: BadgeVariant = HEALTH_TO_BADGE[stats.integrationsHealth] ?? "secondary";

  const metricCards = useMemo<MissionMetricItem[]>(
    () => [
      {
        id: "skill-layer",
        title: "Beceri Katmanı",
        value: toPercent(stats.paymentCollectionRate),
        hint: `${toHumanCount(stats.ordersTotal)} aktif operasyon`,
        toneColor: "#06b6d4",
        sparkData: [38, 41, 39, 46, 52, 49, 56, 58, Math.max(12, Math.round(stats.paymentCollectionRate))],
      },
      {
        id: "subagent-main",
        title: "Alt Ajan",
        value: toHumanCount(stats.integrationsRunning),
        hint: `${toHumanCount(stats.integrationsOutbox)} iş kuyrukta`,
        toneColor: "#8b5cf6",
        sparkData: [10, 14, 12, 18, 15, 20, 17, 21, Math.max(4, stats.integrationsRunning + 8)],
      },
      {
        id: "orders-throughput",
        title: "Sipariş Verimi",
        value: toHumanCount(stats.ordersProduction),
        hint: `${toHumanCount(stats.ordersReady)} hazır`,
        toneColor: "#22c55e",
        sparkData: [11, 13, 15, 16, 14, 18, 20, 19, Math.max(6, stats.ordersProduction)],
      },
      {
        id: "stock-watch",
        title: "Stok Takibi",
        value: toHumanCount(stats.stockLowCount),
        hint: `${toHumanCount(stats.stockActive)} aktif stok karti`,
        toneColor: "#f59e0b",
        sparkData: [8, 9, 7, 10, 12, 11, 9, 13, Math.max(3, stats.stockLowCount + 4)],
      },
    ],
    [
      stats.integrationsOutbox,
      stats.integrationsRunning,
      stats.ordersProduction,
      stats.ordersReady,
      stats.ordersTotal,
      stats.paymentCollectionRate,
      stats.stockActive,
      stats.stockLowCount,
    ],
  );

  const missionOrders = useMemo<MissionOrderRow[]>(
    () => [
      {
        id: "ORD-9012",
        name: "OptiPlan360 / Laminat Kapak",
        station: "İstasyon 1",
        status: "confirmed",
        eta: "14 dk",
      },
      {
        id: "ORD-9013",
        name: "OptiPlan360 / MDF Panel",
        station: "İstasyon 2",
        status: "processing",
        eta: "22 dk",
      },
      {
        id: "ORD-9014",
        name: "OptiPlan360 / Kutu Profil",
        station: "İstasyon 3",
        status: stats.integrationsOutbox > 0 ? "queued" : "confirmed",
        eta: stats.integrationsOutbox > 0 ? "Beklemede" : "12 dk",
      },
      {
        id: "ORD-9015",
        name: "OptiPlan360 / Özel Seri",
        station: "Kontrol",
        status: stats.integrationsErrors > 0 ? "blocked" : "processing",
        eta: stats.integrationsErrors > 0 ? "Onay bekliyor" : "16 dk",
      },
    ],
    [stats.integrationsErrors, stats.integrationsOutbox],
  );

  const riskItems = useMemo<ReadonlyArray<AIOpsRiskItem>>(
    () => [
      {
        label: "Tahsilat",
        value: toPercent(stats.paymentCollectionRate),
        tone: stats.paymentCollectionRate > 80 ? "ok" : "warn",
      },
      {
        label: "Senkron Hata",
        value: toHumanCount(stats.integrationsErrors),
        tone: stats.integrationsErrors > 0 ? "danger" : "ok",
      },
      {
        label: "Outbox Baskısı",
        value: toHumanCount(stats.integrationsOutbox),
        tone: stats.integrationsOutbox > 5 ? "warn" : "ok",
      },
      {
        label: "Düşük Stok",
        value: toHumanCount(stats.stockLowCount),
        tone: stats.stockLowCount > 10 ? "danger" : "ok",
      },
    ],
    [
      stats.integrationsErrors,
      stats.integrationsOutbox,
      stats.paymentCollectionRate,
      stats.stockLowCount,
    ],
  );

  return {
    integrationToneLabel: integrationTone.label,
    badgeVariant,
    metricCards,
    missionOrders,
    riskItems,
  };
}
