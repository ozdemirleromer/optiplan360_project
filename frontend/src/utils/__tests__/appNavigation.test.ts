// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { navigateToAppPage, subscribeToAppNavigation } from "../appNavigation";

describe("appNavigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("orderId ile uygulama navigasyon eventi dispatch eder", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAppNavigation(listener);

    navigateToAppPage("siparis-fisi", "test-suite", "ord-55");

    expect(listener).toHaveBeenCalledWith({
      page: "siparis-fisi",
      source: "test-suite",
      orderId: "ord-55",
    });

    unsubscribe();
  });

  it("unsubscribe sonrasi yeni eventleri dinlemez", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAppNavigation(listener);

    unsubscribe();
    navigateToAppPage("orders", "test-suite");

    expect(listener).not.toHaveBeenCalled();
  });
});
