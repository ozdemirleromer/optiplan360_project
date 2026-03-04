import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CariCardsIntroScreen } from "../components/CRM/CariCardsIntroScreen";
import { StockCardsIntroScreen } from "../components/Stock/StockCardsIntroScreen";
import { APP_NAVIGATION_EVENT, type AppNavigationDetail } from "../utils/appNavigation";

function captureNavigationEvents() {
  const events: AppNavigationDetail[] = [];
  const listener = (event: Event) => {
    events.push((event as CustomEvent<AppNavigationDetail>).detail);
  };

  window.addEventListener(APP_NAVIGATION_EVENT, listener as EventListener);

  return {
    events,
    dispose: () => window.removeEventListener(APP_NAVIGATION_EVENT, listener as EventListener),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Intro screen secondary actions", () => {
  it("navigates to reports from cari intro secondary button", () => {
    const tracker = captureNavigationEvents();

    render(<CariCardsIntroScreen />);

    fireEvent.click(screen.getByRole("button", { name: /bakiye raporlarını görüntüle/i }));

    expect(tracker.events).toEqual([{ page: "reports-analytics", source: "cari-cards-intro" }]);
    tracker.dispose();
  });

  it("uses custom cari reports handler when supplied", () => {
    const onOpenReports = vi.fn();
    const tracker = captureNavigationEvents();

    render(<CariCardsIntroScreen onOpenReports={onOpenReports} />);

    fireEvent.click(screen.getByRole("button", { name: /bakiye raporlarını görüntüle/i }));

    expect(onOpenReports).toHaveBeenCalledTimes(1);
    expect(tracker.events).toEqual([]);
    tracker.dispose();
  });

  it("navigates to reports from stock intro secondary button", () => {
    const tracker = captureNavigationEvents();

    render(<StockCardsIntroScreen />);

    fireEvent.click(screen.getByRole("button", { name: /raporları görüntüle/i }));

    expect(tracker.events).toEqual([{ page: "reports-analytics", source: "stock-cards-intro" }]);
    tracker.dispose();
  });

  it("uses custom stock reports handler when supplied", () => {
    const onOpenReports = vi.fn();
    const tracker = captureNavigationEvents();

    render(<StockCardsIntroScreen onOpenReports={onOpenReports} />);

    fireEvent.click(screen.getByRole("button", { name: /raporları görüntüle/i }));

    expect(onOpenReports).toHaveBeenCalledTimes(1);
    expect(tracker.events).toEqual([]);
    tracker.dispose();
  });
});
