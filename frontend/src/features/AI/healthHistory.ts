import type { HealthStatus } from "../../services/aiIntegrationService";

export const MAX_HISTORY_POINTS = 24;

export type HealthHistoryPoint = {
  time: string;
  capturedAt: string;
} & Record<string, string | number>;

export function buildHealthHistoryPoint(status: HealthStatus): HealthHistoryPoint {
  const point: HealthHistoryPoint = {
    time: new Date(status.timestamp).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    capturedAt: status.timestamp,
  };

  Object.entries(status.services).forEach(([serviceName, serviceStatus]) => {
    point[serviceName] = Number(serviceStatus.latency_ms.toFixed(1));
  });

  return point;
}

export function appendHealthHistoryPoint(
  currentHistory: HealthHistoryPoint[],
  status: HealthStatus,
): HealthHistoryPoint[] {
  const nextPoint = buildHealthHistoryPoint(status);
  const lastPoint = currentHistory[currentHistory.length - 1];

  if (lastPoint?.capturedAt === nextPoint.capturedAt) {
    return [
      ...currentHistory.slice(0, Math.max(currentHistory.length - 1, 0)),
      nextPoint,
    ];
  }

  return [...currentHistory, nextPoint].slice(-MAX_HISTORY_POINTS);
}

export function getHistoryServiceNames(historyData: HealthHistoryPoint[]): string[] {
  return Array.from(
    new Set(
      historyData.flatMap((point) =>
        Object.keys(point).filter((key) => key !== "time" && key !== "capturedAt"),
      ),
    ),
  );
}