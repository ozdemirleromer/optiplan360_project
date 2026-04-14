// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { AlertTriangle, Boxes } from "lucide-react";
import { describe, expect, it } from "vitest";

import { ModuleSurfaceBlockerList, ModuleSurfaceInsightGrid } from "./ModuleSurfacePanels";

describe("ModuleSurfacePanels", () => {
  it("info ve blocker panellerinde dogrulanmis kart metinlerini korur", () => {
    render(
      <div>
        <ModuleSurfaceInsightGrid
          items={[
            {
              title: "Stok yuzeyi",
              detail: "Kontrol bandi ana uygulama kart yuzeyine oturur.",
              icon: Boxes,
            },
          ]}
        />
        <ModuleSurfaceBlockerList
          items={[
            {
              title: "Child Koleksiyon Blokaji",
              detail: "Barkod ve fiyat listeleri alt grid olarak dogrulandi.",
              icon: AlertTriangle,
            },
          ]}
        />
      </div>,
    );

    expect(screen.getByText("Stok yuzeyi")).toBeInTheDocument();
    expect(screen.getByText("Kontrol bandi ana uygulama kart yuzeyine oturur.")).toBeInTheDocument();
    expect(screen.getByText("Child Koleksiyon Blokaji")).toBeInTheDocument();
    expect(screen.getByText("Barkod ve fiyat listeleri alt grid olarak dogrulandi.")).toBeInTheDocument();
  });
});
