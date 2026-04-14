// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { OrderEditor } from "./OrderEditor";

vi.mock("../../components/Layout", () => ({
  TopBar: ({ title, subtitle, breadcrumbs }: { title: string; subtitle: string; breadcrumbs?: string[] }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{breadcrumbs?.join(" > ")}</div>
    </div>
  ),
}));

vi.mock("./OrderEntry", () => ({
  OrderEntryScreen: ({ orderId }: { orderId?: string }) => <div>OrderEntryScreen {orderId}</div>,
}));

vi.mock("./OrderOptimization/OptiPlanStrictOrderEntry", () => ({
  OptiPlanStrictOrderEntry: () => <div>StrictOrderEntry</div>,
}));

describe("OrderEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("mevcut siparis verildiginde gercek order entry ekranini acar", () => {
    render(<OrderEditor order={{ id: "ord-7" } as never} />);

    expect(screen.getByText(ORDER_ROUTE_META.orderForm.title)).toBeInTheDocument();
    expect(screen.getByText(/OrderEntryScreen ord-7/i)).toBeInTheDocument();
    expect(screen.getByText(`${ORDER_ROUTE_META.orderList.title} > ${ORDER_ROUTE_META.orderForm.title}`)).toBeInTheDocument();
    expect(screen.queryByText("StrictOrderEntry")).not.toBeInTheDocument();
  });

  it("siparis yoksa yeni siparis akisinda kalir", () => {
    render(<OrderEditor />);

    expect(screen.getByText(ORDER_ROUTE_META.newOrder.title)).toBeInTheDocument();
    expect(screen.getByText("StrictOrderEntry")).toBeInTheDocument();
    expect(screen.getByText(`${ORDER_ROUTE_META.orderList.title} > ${ORDER_ROUTE_META.newOrder.title}`)).toBeInTheDocument();
    expect(screen.queryByText(/OrderEntryScreen/i)).not.toBeInTheDocument();
  });
});
