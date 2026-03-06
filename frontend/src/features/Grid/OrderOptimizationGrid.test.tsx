import { type CSSProperties } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockRows } from "../Orders/OrderEditor/workbenchUtils";
import { OrderOptimizationGrid } from "../Orders/OrderOptimization/OrderOptimizationGrid";

describe("OrderOptimizationGrid", () => {
  it("renders with 100 mock rows without mounting the entire dataset at once", () => {
    const firstCellRef = { current: null as HTMLInputElement | null };

    render(
      <div
        style={
          {
            "--op-main-bg": "#F3F4F6",
            "--op-surface-bg": "#FFFFFF",
            "--op-border": "#D1D5DB",
            "--op-accent": "#0078D4",
            "--op-danger": "#EF4444",
            "--op-text": "#0F0F0F",
            "--op-muted": "#0F0F0F",
            "--op-index-bg": "#F3F4F6",
          } as CSSProperties
        }
      >
        <OrderOptimizationGrid
          items={createMockRows(100)}
          plateBoy="2,800.00"
          notice={{ text: "Render Test", tone: "default" }}
          firstCellRef={firstCellRef}
          onItemChange={vi.fn()}
          onAddItem={vi.fn()}
          onRemoveItem={vi.fn()}
          onDuplicateItem={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText("Malzeme")).toBeInTheDocument();
    expect(screen.getByText("BOY")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });
});
