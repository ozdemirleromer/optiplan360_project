// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { SimpleDashboard } from "./SimpleDashboard";

const stations = [
  {
    id: 1,
    name: "Kesim 1",
    active: true,
    lastScan: "10:00",
    istasyonDurumu: "Hazır",
    todayScans: 4,
  },
];

describe("SimpleDashboard", () => {
  it("yeni siparis CTA etiketini route metasindan uretir", () => {
    const onNewOrder = vi.fn();

    render(
      <SimpleDashboard
        currentUser={{ name: "Operatör Test" }}
        stations={stations}
        onNewOrder={onNewOrder}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: ORDER_ROUTE_META.newOrder.navLabel }));

    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  it("siparis hizli eylemini liste rotasina baglar", () => {
    const onNav = vi.fn();

    render(
      <SimpleDashboard
        currentUser={{ name: "Operatör Test" }}
        stations={stations}
        onNav={onNav}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: ORDER_ROUTE_META.orderList.title }));

    expect(onNav).toHaveBeenCalledWith(ORDER_ROUTE_META.orderList.page);
  });
});
