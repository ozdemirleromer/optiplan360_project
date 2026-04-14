// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ORDER_ROUTE_META } from "../../Layout/orderNavigationContract";
import { EmptyOrdersState } from "../LoadingStates";

describe("EmptyOrdersState", () => {
  it("yeni siparis CTA etiketini route metasindan uretir", () => {
    const onCreateOrder = vi.fn();

    render(<EmptyOrdersState onCreateOrder={onCreateOrder} />);

    const primaryAction = screen.getByRole("button", { name: `+ ${ORDER_ROUTE_META.newOrder.navLabel}` });
    fireEvent.click(primaryAction);

    expect(primaryAction).toBeInTheDocument();
    expect(onCreateOrder).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Excel Import" })).not.toBeInTheDocument();
  });
});
