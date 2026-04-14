// @vitest-environment jsdom

import type { ComponentPropsWithoutRef } from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SiparisFisiPage from "./SiparisFisiPage";
import type { Order } from "../../types";

const mockState = vi.hoisted(() => {
  const order = {
    id: "ord-42",
    orderNo: "SIP-0042",
    cust: "ACME Mobilya",
    phone: "555 0100",
    mat: "MDF",
    plate: "2100x2800",
    thick: 18,
    parts: 12,
    status: "NEW",
    date: "2026-03-12T08:00:00.000Z",
    upd: "2026-03-13T10:15:00.000Z",
    grp: "GOVDE",
    priority: "normal",
  } as Order;

  return {
    order,
    orders: [order],
    fetchOrders: vi.fn().mockResolvedValue(undefined),
    updateOrder: vi.fn(),
    initialized: true,
    isLoading: false,
    error: null,
    navigateToAppPage: vi.fn(),
    exportToPDF: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../stores/ordersStore", () => ({
  useOrdersStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

vi.mock("../../utils/appNavigation", () => ({
  navigateToAppPage: mockState.navigateToAppPage,
}));

vi.mock("../../utils/export", () => ({
  exportToPDF: mockState.exportToPDF,
}));

vi.mock("../../components/Layout", () => ({
  TopBar: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="topbar">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock("../../components/Shared", () => ({
  Button: ({ children, variant, size, ...props }: ComponentPropsWithoutRef<"button"> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

class MockWebSocket {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
  }
}

describe("SiparisFisiPage", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("Düzenle butonu mevcut siparişi siparis-duzenleme rotasına taşır", () => {
    render(<SiparisFisiPage preferredOrderId="ord-42" />);

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));

    expect(mockState.navigateToAppPage).toHaveBeenCalledWith("siparis-duzenleme", "siparis-fisi", "ord-42");
  });

  it("PDF butonu görünür sipariş alanını PDF utiline yollar", async () => {
    render(<SiparisFisiPage preferredOrderId="ord-42" />);

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => {
      expect(mockState.exportToPDF).toHaveBeenCalledTimes(1);
    });

    const [element, filename] = mockState.exportToPDF.mock.calls[0] as [HTMLElement, string];
    expect(element).toBeInstanceOf(HTMLElement);
    expect(element.textContent).toContain("SIP-0042");
    expect(filename).toBe("siparis-fisi-SIP-0042.pdf");
  });

  it("E-posta butonu mevcut sipariş için mailto compose draft açar", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(<SiparisFisiPage preferredOrderId="ord-42" />);

    fireEvent.click(screen.getByRole("button", { name: "E-posta" }));

    expect(openSpy).toHaveBeenCalledTimes(1);

    const [mailtoUrl, target, features] = openSpy.mock.calls[0] as [string, string, string];
    expect(mailtoUrl).toMatch(/^mailto:\?subject=/);
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");

    const decodedMailto = decodeURIComponent(mailtoUrl);
    expect(decodedMailto).toContain("subject=Sipariş Fişi - SIP-0042");
    expect(decodedMailto).toContain("Müşteri: ACME Mobilya");
    expect(decodedMailto).toContain("Telefon: 555 0100");
    expect(decodedMailto).toContain("Malzeme: MDF");
  });
});
