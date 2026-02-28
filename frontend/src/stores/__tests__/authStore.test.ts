import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../authStore";
import type { User } from "../../types";

const MOCK_USER: User = {
  id: "1",
  username: "testuser",
  email: "test@example.com",
  role: "OPERATOR",
  fullName: "Test User",
  active: true,
  createdAt: "2024-01-01T00:00:00Z",
};

// Reset store state between tests
beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    token: null,
    user: null,
  });
});

describe("authStore — login", () => {
  it("sets isAuthenticated to true", () => {
    useAuthStore.getState().login("tok123", MOCK_USER);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("stores the token", () => {
    useAuthStore.getState().login("tok123", MOCK_USER);
    expect(useAuthStore.getState().token).toBe("tok123");
  });

  it("stores the user object", () => {
    useAuthStore.getState().login("tok123", MOCK_USER);
    expect(useAuthStore.getState().user).toEqual(MOCK_USER);
  });
});

describe("authStore — logout", () => {
  it("clears authentication state", () => {
    useAuthStore.getState().login("tok123", MOCK_USER);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });
});

describe("authStore — initial state", () => {
  it("starts unauthenticated", () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
