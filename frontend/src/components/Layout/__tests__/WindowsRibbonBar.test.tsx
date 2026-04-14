// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowsRibbonBar } from "../WindowsRibbonBar";

describe("WindowsRibbonBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("siparis sekmesinde liste yeni fis teklif export ve optiplanning job sirasini korur", () => {
    render(<WindowsRibbonBar activePage="siparis-fisi" onNavigate={vi.fn()} />);

    const siparisListesi = screen.getByText("Sipariş Listesi");
    const yeniSiparis = screen.getByText("Yeni Sipariş");
    const ocrHavuzu = screen.getByText("OCR Havuzu");

    expect(siparisListesi.compareDocumentPosition(yeniSiparis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(yeniSiparis.compareDocumentPosition(ocrHavuzu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("workflow sayfalari siparis sekmesini aktif davranista tutar", () => {
    render(<WindowsRibbonBar activePage="ocr-kontrol" onNavigate={vi.fn()} />);

    expect(screen.getByText("Yeni Sipariş")).toBeInTheDocument();
    expect(screen.getByText("Sipariş Listesi")).toBeInTheDocument();
    expect(screen.getByText("OCR Havuzu")).toBeInTheDocument();
  });

  it("yeni siparis aksiyonunu order-editor rotasina baglar", () => {
    const onNavigate = vi.fn();

    render(<WindowsRibbonBar activePage="siparis-fisi" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Yeni Sipariş"));

    expect(onNavigate).toHaveBeenCalledWith("order-editor");
  });

  it("cari islemleri sekmesini varsayilan cari karti rotasina baglar", () => {
    const onNavigate = vi.fn();

    render(<WindowsRibbonBar activePage="siparis-fisi" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Cari İşlemleri" }));

    expect(onNavigate).toHaveBeenCalledWith("card-management");
  });
});
