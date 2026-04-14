import { describe, expect, it } from "vitest";

import {
  appendHealthHistoryPoint,
  buildHealthHistoryPoint,
  getHistoryServiceNames,
  MAX_HISTORY_POINTS,
} from "./healthHistory";

function buildHealthStatus(timestamp: string, latencies: Record<string, number>) {
  return {
    status: "healthy" as const,
    timestamp,
    services: Object.fromEntries(
      Object.entries(latencies).map(([serviceName, latencyMs]) => [
        serviceName,
        {
          status: "healthy",
          latency_ms: latencyMs,
          last_check: timestamp,
          details: { source: "test" },
        },
      ]),
    ),
  };
}

describe("healthHistory", () => {
  it("health snapshotini chart noktasina cevirir", () => {
    const point = buildHealthHistoryPoint(
      buildHealthStatus("2026-03-30T09:00:00Z", {
        atomic_export: 45.46,
        lock_service: 12.04,
      }),
    );

    expect(point).toMatchObject({
      capturedAt: "2026-03-30T09:00:00Z",
      atomic_export: 45.5,
      lock_service: 12,
    });
    expect(point.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("ayni timestamp tekrar gelirse son noktayi gunceller", () => {
    const first = appendHealthHistoryPoint(
      [],
      buildHealthStatus("2026-03-30T09:00:00Z", {
        atomic_export: 45,
      }),
    );

    const updated = appendHealthHistoryPoint(
      first,
      buildHealthStatus("2026-03-30T09:00:00Z", {
        atomic_export: 61,
      }),
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ atomic_export: 61 });
  });

  it("rolling pencereyi son 24 olcumle sinirlar", () => {
    let history: ReturnType<typeof appendHealthHistoryPoint> = [];

    for (let index = 0; index < MAX_HISTORY_POINTS + 2; index += 1) {
      const timestamp = new Date(Date.UTC(2026, 2, 30, 0, index, 0)).toISOString();
      history = appendHealthHistoryPoint(
        history,
        buildHealthStatus(timestamp, {
          atomic_export: index,
          checkpoint_service: index + 10,
        }),
      );
    }

    expect(history).toHaveLength(MAX_HISTORY_POINTS);
    expect(history[0]).toMatchObject({
      capturedAt: "2026-03-30T00:02:00.000Z",
      atomic_export: 2,
    });
    expect(history[MAX_HISTORY_POINTS - 1]).toMatchObject({
      capturedAt: "2026-03-30T00:25:00.000Z",
      atomic_export: 25,
    });
    expect(getHistoryServiceNames(history)).toEqual(["atomic_export", "checkpoint_service"]);
  });
});