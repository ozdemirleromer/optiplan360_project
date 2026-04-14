// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import StokKartiPage from "./StokKartiPage";

vi.mock("../Stock/StockCardComponent", () => ({
  default: () => <div>Mock Stock Workspace</div>,
}));

describe("StokKartiPage", () => {
  it("stok sayfasinda kalan dogrulanmamis alanlari gorunur blocker olarak tasir", () => {
    render(<StokKartiPage />);

    expect(screen.getByRole("heading", { name: ORDER_ROUTE_META.stockCard.title })).toBeInTheDocument();
    expect(screen.getByText("Çoklu Birim ve Depo Detayı")).toBeInTheDocument();
    expect(screen.getByText(/Barkod ve satış fiyat alt gridleri uygulandı/i)).toBeInTheDocument();
    expect(screen.queryByText("Teknik Mapping Belirsizligi")).not.toBeInTheDocument();
    expect(screen.queryByText("Child Koleksiyon Blokaji")).not.toBeInTheDocument();
    expect(screen.getByText("Mock Stock Workspace")).toBeInTheDocument();
  });
});
