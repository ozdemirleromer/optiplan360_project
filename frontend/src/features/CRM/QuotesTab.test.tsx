// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { navigateToAppPage } from "../../utils/appNavigation";
import { QuotesTab } from "./CRMPage";

vi.mock("../../utils/appNavigation", () => ({
  navigateToAppPage: vi.fn(),
}));

describe("QuotesTab", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("teklif tekrar yuzeyini kapatip kullaniciyi bagimsiz Teklif Fisi modülüne yonlendirir", () => {
    render(<QuotesTab />);

    expect(screen.getByText("Teklif Yuzeyi Tekillestirildi")).toBeInTheDocument();
    expect(screen.getByText("Mükerrer teklif yüzeyi kapatildi")).toBeInTheDocument();
    expect(screen.queryByText("+ Yeni Teklif")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Teklif Fisi'ni Ac" }));

    expect(navigateToAppPage).toHaveBeenCalledWith(ORDER_ROUTE_META.quoteForm.page, "crm-quotes-tab");
  });
});
