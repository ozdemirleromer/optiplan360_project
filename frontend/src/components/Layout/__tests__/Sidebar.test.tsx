// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar";
import type { User } from "../../../types";

const mockUser: User = {
  id: "user-1",
  username: "operator",
  email: "operator@example.com",
  role: "OPERATOR",
  fullName: "Operatör Kullanıcı",
  active: true,
  createdAt: "2026-03-11T10:00:00Z",
};

function clickNavLabel(label: string) {
  const button = screen.getByRole("button", { name: label });
  fireEvent.click(button);
}

afterEach(() => {
  cleanup();
});

describe("Sidebar", () => {
  it("siparis teklif stok cari modul sirasini korur", () => {
    render(
      <Sidebar
        page="siparis-fisi"
        onNav={vi.fn()}
        userRole="OPERATOR"
        currentUser={mockUser}
        badgeCounts={{}}
      />,
    );

    const siparis = screen.getByText("Sipariş Fişi");
    const teklif = screen.getByText("Teklif Fişi");
    const stok = screen.getByText("Stok Kartı");
    const cari = screen.getByText("Cari Kartı");

    expect(siparis.compareDocumentPosition(teklif) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(teklif.compareDocumentPosition(stok) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stok.compareDocumentPosition(cari) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ebatlama birimi 4 faz sirasini korur ve modul grubu ardindan gelir", () => {
    render(
      <Sidebar
        page="siparis-fisi"
        onNav={vi.fn()}
        userRole="OPERATOR"
        currentUser={mockUser}
        badgeCounts={{}}
      />,
    );

    const ocrHavuzu = screen.getAllByText("OCR Havuzu")[0];
    const ocrKontrol = screen.getAllByText("OCR Kontrol")[0];
    const siparisKontrol = screen.getAllByText("Sipariş Kontrol")[0];
    const optiPlanning = screen.getAllByText("OptiPlanning")[0];
    const siparisFisi = screen.getAllByText("Sipariş Fişi")[0];
    const teklifFisi = screen.getAllByText("Teklif Fişi")[0];

    expect(ocrHavuzu.compareDocumentPosition(ocrKontrol) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ocrKontrol.compareDocumentPosition(siparisKontrol) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(siparisKontrol.compareDocumentPosition(optiPlanning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(optiPlanning.compareDocumentPosition(siparisFisi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(siparisFisi.compareDocumentPosition(teklifFisi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("siparis listesi ana rotayi orders sayfasina baglar", () => {
    const onNav = vi.fn();

    render(
      <Sidebar
        page="siparis-fisi"
        onNav={onNav}
        userRole="OPERATOR"
        currentUser={mockUser}
        badgeCounts={{}}
      />,
    );

    clickNavLabel("Sipariş Listesi");

    expect(onNav).toHaveBeenCalledWith("orders");
  });

  it("ocr kontrol etiketini ve rotasini birlikte korur", () => {
    const onNav = vi.fn();

    render(
      <Sidebar
        page="ocr-kontrol"
        onNav={onNav}
        userRole="OPERATOR"
        currentUser={mockUser}
        badgeCounts={{}}
      />,
    );

    clickNavLabel("OCR Kontrol");

    expect(onNav).toHaveBeenCalledWith("ocr-kontrol");
  });

  it("admin ayarlar grubunda sistem ayarlari rotasi gorunur", () => {
    const onNav = vi.fn();

    render(
      <Sidebar
        page="config"
        onNav={onNav}
        userRole="ADMIN"
        currentUser={{ ...mockUser, role: "ADMIN" }}
        badgeCounts={{}}
      />,
    );

    clickNavLabel("Sistem Ayarları");

    expect(onNav).toHaveBeenCalledTimes(1);
    expect(onNav).toHaveBeenNthCalledWith(1, "config");
  });
});
