import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

const authMock = vi.hoisted(() => ({
  generateToken: vi.fn(() => "mock-token"),
}));

type MockResponse = {
  statusCode: number | null;
  jsonPayload: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: null,
    jsonPayload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      if (this.statusCode === null) {
        this.statusCode = 200;
      }
      return this;
    },
  };

  return response;
}

function createMockRouter() {
  const handlers: Record<string, (req: { body?: unknown; user?: unknown }, res: MockResponse) => unknown> = {};
  const router = {
    handlers,
    post(path: string, handler: (req: { body?: unknown; user?: unknown }, res: MockResponse) => unknown) {
      handlers[`POST ${path}`] = handler;
      return router;
    },
    get(path: string, handler: (req: { body?: unknown; user?: unknown }, res: MockResponse) => unknown) {
      handlers[`GET ${path}`] = handler;
      return router;
    },
  };

  return router;
}

vi.mock("express", () => {
  const express = Object.assign(() => ({ use: vi.fn() }), {
    Router: () => createMockRouter(),
    json: () => (_req: unknown, _res: unknown, next?: () => void) => next?.(),
  });

  return { default: express };
}, { virtual: true });

vi.mock("../../src/middleware/auth", () => authMock);

import { createAuthRoutes } from "../../src/features/orchestration/http/auth-routes";
import { getDemoLoginNotice, isDemoLoginEnabled } from "../../src/features/orchestration/http/demo-auth";

afterEach(() => {
  vi.clearAllMocks();
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

describe("Orchestrator demo auth", () => {
  it("allows the demo login outside production and exposes the demo notice", () => {
    process.env.NODE_ENV = "development";

    const router = createAuthRoutes() as ReturnType<typeof createMockRouter>;
    const handler = router.handlers["POST /login"];

    expect(isDemoLoginEnabled()).toBe(true);
    expect(getDemoLoginNotice()).toBe("Demo giriş: admin / admin");
    expect(handler).toEqual(expect.any(Function));

    const response = createMockResponse();
    handler({ body: { username: "admin", password: "admin" } }, response);

    expect(response.statusCode).toBe(200);
    expect(response.jsonPayload).toMatchObject({
      success: true,
      token: "mock-token",
      user: {
        id: "user-123",
        username: "admin",
        email: "admin@optiplan360.local",
        role: "ADMIN",
      },
    });
    expect(authMock.generateToken).toHaveBeenCalledWith("user-123", "admin@optiplan360.local", "ADMIN");
  });

  it("hides demo login in production", () => {
    process.env.NODE_ENV = "production";

    const router = createAuthRoutes() as ReturnType<typeof createMockRouter>;
    const handler = router.handlers["POST /login"];

    expect(isDemoLoginEnabled()).toBe(false);
    expect(getDemoLoginNotice()).toBe("Demo giriş üretim ortamında kapalıdır.");
    expect(handler).toEqual(expect.any(Function));

    const response = createMockResponse();
    handler({ body: { username: "admin", password: "admin" } }, response);

    expect(response.statusCode).toBe(404);
    expect(response.jsonPayload).toMatchObject({
      error: {
        code: "E_NOT_FOUND",
        message: "Endpoint bulunamadı",
      },
    });
    expect(authMock.generateToken).not.toHaveBeenCalled();
  });
});
