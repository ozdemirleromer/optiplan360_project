import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./apiClient";

describe("apiClient path routing", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("/api ile başlayan path'lerde /api/v1 prefix eklemez", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiRequest<{ ok: boolean }>("/api/phase3/queue", {
      method: "GET",
      skipAuth: true,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/phase3/queue");
  });

  it("/api ile başlamayan path'lerde canonical /api/v1 base kullanır", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiRequest<{ ok: boolean }>("/optiplan-workflow/records", {
      method: "GET",
      skipAuth: true,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/optiplan-workflow/records");
  });
});
