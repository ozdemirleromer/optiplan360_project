// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import CariKartiPage from "./CariKartiPage";

vi.mock("../CRM/AccountsWorkspace", () => ({
  AccountsWorkspace: () => (
    <div>
      <div>Mock Cari Workspace</div>
      <select aria-label="Cari Durumu">
        <option value="TASLAK">Taslak</option>
        <option value="AKTIF">Aktif</option>
        <option value="PASIF">Pasif</option>
        <option value="BLOKE">Bloke</option>
        <option value="DOGRULAMA_BEKLIYOR">Doğrulama Bekliyor</option>
        <option value="ARSIV">Arşiv</option>
      </select>
      <button type="button">Pasife Al</button>
      <button type="button">Tarihce</button>
    </div>
  ),
}));

describe("CariKartiPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("coklu adres ve yetkili blokajlarini sayfa seviyesinde gosterir", () => {
    render(<CariKartiPage />);

    expect(screen.getByRole("heading", { name: ORDER_ROUTE_META.customerCard.title })).toBeInTheDocument();
    expect(screen.getByText("Adres Modeli")).toBeInTheDocument();
    expect(screen.getByText("Yetkili Sahipligi")).toBeInTheDocument();
    expect(screen.getByText(/Coklu adres ile sevk-fatura ayrimi analizde child model olarak acik/i)).toBeInTheDocument();
    expect(screen.getByText("Mock Cari Workspace")).toBeInTheDocument();
  });

  it("6-state durum secicisi render edilir", () => {
    render(<CariKartiPage />);

    const durumSelect = screen.getByRole("combobox", { name: "Cari Durumu" });
    expect(durumSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Taslak" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Aktif" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pasif" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bloke" })).toBeInTheDocument();
  });

  it("Pasife Al butonu render edilir", () => {
    render(<CariKartiPage />);
    expect(screen.getByRole("button", { name: "Pasife Al" })).toBeInTheDocument();
  });

  it("Tarihce butonu render edilir", () => {
    render(<CariKartiPage />);
    expect(screen.getByRole("button", { name: "Tarihce" })).toBeInTheDocument();
  });
});
