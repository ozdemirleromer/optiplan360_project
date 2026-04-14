// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpotlightSearch } from "../SpotlightSearch";

describe("SpotlightSearch", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hizli erisim sonucunda siparis teklif stok cari sirasini korur", () => {
    render(<SpotlightSearch isOpen onClose={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByText("Hızlı Erişim")).toBeInTheDocument();

    const siparis = screen.getByText("Sipariş Fişi");
    const teklif = screen.getByText("Teklif Fişi");
    const stok = screen.getByText("Stok Kartı");
    const cari = screen.getByText("Cari Kartı");

    expect(siparis.compareDocumentPosition(teklif) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(teklif.compareDocumentPosition(stok) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stok.compareDocumentPosition(cari) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("siparisler sonucunu liste rotasina yonlendirir", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(<SpotlightSearch isOpen onClose={onClose} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Siparişler"));

    expect(onNavigate).toHaveBeenCalledWith("orders");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("teklif fisini bagimsiz modul rotasina yonlendirir", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(<SpotlightSearch isOpen onClose={onClose} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Teklif Fişi"));

    expect(onNavigate).toHaveBeenCalledWith("teklif-fisi");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("workflow ve optiplan job kayitlarini ortak katalogdan aratir", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(<SpotlightSearch isOpen onClose={onClose} onNavigate={onNavigate} />);

    fireEvent.change(screen.getByPlaceholderText(/Sayfa, sipariş veya işlem ara/i), {
      target: { value: "OptiPlanning Job" },
    });

    fireEvent.click(screen.getByText("OptiPlanning Job"));

    expect(onNavigate).toHaveBeenCalledWith("optiplan-order");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("yeni siparis aksiyonunu order-editor rotasina baglar", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(<SpotlightSearch isOpen onClose={onClose} onNavigate={onNavigate} />);

    fireEvent.change(screen.getByPlaceholderText(/Sayfa, sipariş veya işlem ara/i), {
      target: { value: "Yeni Sipariş" },
    });

    fireEvent.click(screen.getByText("Yeni Sipariş"));

    expect(onNavigate).toHaveBeenCalledWith("order-editor");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
