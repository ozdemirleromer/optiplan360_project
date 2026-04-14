// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeklifFisiPage from "./TeklifFisiPage";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { crmService } from "../../services/crmService";
import { integrationService } from "../../services/integrationService";

vi.mock("../../services/crmService");
vi.mock("../../services/integrationService");

describe("TeklifFisiPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.spyOn(window, "print").mockImplementation(() => undefined);

    vi.mocked(crmService.listQuotes).mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "QT-001",
        accountId: "acc-1",
        accountName: "Demo Cari",
        title: "Mutfak dolabi teklifi",
        total: 12500,
        status: "DRAFT",
        revision: 1,
        subtotal: 10416.67,
        taxRate: 20,
        taxAmount: 2083.33,
        discountRate: 0,
        discountAmount: 0,
        currency: "TRY",
        validUntil: "2026-03-20T00:00:00Z",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "Operatör A",
      },
      {
        id: "q2",
        quoteNumber: "QT-010",
        accountId: "acc-2",
        accountName: "Beta Cari",
        title: "Ofis teklifi",
        total: 9800,
        status: "SENT",
        revision: 1,
        subtotal: 8166.67,
        taxRate: 20,
        taxAmount: 1633.33,
        discountRate: 0,
        discountAmount: 0,
        currency: "TRY",
        validUntil: "2026-04-15T00:00:00Z",
        createdAt: new Date().toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        createdBy: "Operatör B",
      },
    ] as never);

    vi.mocked(crmService.createQuote).mockResolvedValue({
      id: "q3",
      quoteNumber: "QT-011",
      accountId: "acc-1",
      accountName: "Demo Cari",
      title: "Yeni Teklif",
      total: 3420,
      subtotal: 3000,
      taxRate: 10,
      taxAmount: 300,
      discountRate: 5,
      discountAmount: 150,
      status: "DRAFT",
      revision: 1,
      currency: "TRY",
      validUntil: "2026-04-01T00:00:00Z",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: [],
    } as never);

    vi.mocked(crmService.listAccounts).mockResolvedValue([
      {
        id: "acc-1",
        companyName: "Demo Cari",
        mikroCariKod: "CARI-001",
        phone: "05001112233",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "acc-2",
        companyName: "Beta Cari",
        mikroCariKod: "CARI-010",
        phone: "05004445566",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as never);

    vi.mocked(crmService.getQuote).mockResolvedValue({
      id: "q1",
      quoteNumber: "QT-001",
      accountId: "acc-1",
      accountName: "Demo Cari",
      title: "Mutfak dolabi teklifi",
      description: "Ust ve alt modul teklif ozetidir.",
      total: 12500,
      subtotal: 10416.67,
      taxRate: 20,
      taxAmount: 2083.33,
      discountRate: 0,
      discountAmount: 0,
      status: "DRAFT",
      revision: 1,
      currency: "TRY",
      validUntil: "2026-03-20T00:00:00Z",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Operatör A",
      lines: [
        {
          id: "line-1",
          quoteId: "q1",
          lineNumber: 1,
          productCode: "STK-001",
          description: "Alt dolap govde seti",
          quantity: 4,
          unit: "ADET",
          unitPrice: 2500,
          discountRate: 0,
          taxRate: 20,
          lineTotal: 10000,
        },
      ],
    } as never);

    vi.mocked(integrationService.listEntityMaps).mockResolvedValue([
      {
        id: "map-1",
        entityType: "QUOTE",
        internalId: "q1",
        externalId: "TEK-001",
        externalSystem: "MIKRO",
        isActive: true,
        lastSyncedAt: "2026-03-11T10:05:00Z",
        createdAt: "2026-03-11T10:00:00Z",
      },
    ] as never);

    vi.mocked(integrationService.listOutbox).mockResolvedValue([
      {
        id: "out-1",
        entityType: "QUOTE",
        entityId: "q1",
        operation: "UPSERT",
        payload: {},
        status: "SUCCESS",
        retryCount: 0,
        maxRetries: 3,
        createdAt: "2026-03-11T10:00:00Z",
        processedAt: "2026-03-11T10:06:00Z",
      },
    ] as never);

    vi.mocked(integrationService.listErrors).mockResolvedValue([] as never);
    vi.mocked(integrationService.listAudit).mockResolvedValue([
      {
        id: "audit-1",
        action: "SYNC_END",
        entityType: "QUOTE",
        entityId: "q1",
        createdAt: "2026-03-11T10:07:00Z",
      },
    ] as never);
  });

  it("teklif fisini tablo bazli liste ve sade ticari alanlarla gosterir", async () => {
    render(<TeklifFisiPage />);

    expect(screen.getByRole("heading", { name: ORDER_ROUTE_META.quoteForm.title })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Belge Numarası/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cari/i })).toBeInTheDocument();
      expect(screen.getByText("Müşteri ve Teklif Bilgileri")).toBeInTheDocument();
      expect(screen.getByText("Toplamlar")).toBeInTheDocument();
      expect(screen.getByText("Satır Detayı")).toBeInTheDocument();
      expect(screen.getByText("STK-001")).toBeInTheDocument();
      expect(screen.getByText("Alt dolap govde seti")).toBeInTheDocument();
      expect(screen.getByText("Cari Kodu")).toBeInTheDocument();
      expect(screen.getByText("Telefon")).toBeInTheDocument();
      expect(screen.getAllByText("Belge Numarası").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/Damar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Malzeme:/i)).not.toBeInTheDocument();
  });

  it("liste kolonlarini siralayabilir", async () => {
    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/QT-/).length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Toplam/i }));

    const quoteCodes = screen.getAllByText(/QT-/).map((node) => node.textContent);
    expect(quoteCodes[0]).toBe("QT-010");
  });

  it("uyari kartinda eksik gecerlilik satir ve cari eslemesini gosterir", async () => {
    vi.mocked(crmService.listQuotes).mockResolvedValueOnce([
      {
        id: "q-warn",
        quoteNumber: "QT-WARN",
        accountId: "acc-3",
        accountName: "Eslemesiz Cari",
        title: "Uyari Teklifi",
        total: 0,
        status: "DRAFT",
        revision: 1,
        subtotal: 0,
        taxRate: 20,
        taxAmount: 0,
        discountRate: 0,
        discountAmount: 0,
        currency: "TRY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as never);

    vi.mocked(crmService.listAccounts).mockResolvedValueOnce([
      {
        id: "acc-3",
        companyName: "Eslemesiz Cari",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as never);

    vi.mocked(crmService.getQuote).mockResolvedValueOnce({
      id: "q-warn",
      quoteNumber: "QT-WARN",
      accountId: "acc-3",
      accountName: "Eslemesiz Cari",
      title: "Uyari Teklifi",
      total: 0,
      subtotal: 0,
      taxRate: 20,
      taxAmount: 0,
      discountRate: 0,
      discountAmount: 0,
      status: "DRAFT",
      revision: 1,
      currency: "TRY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: [],
    } as never);

    vi.mocked(integrationService.listEntityMaps).mockResolvedValueOnce([] as never);
    vi.mocked(integrationService.listOutbox).mockResolvedValueOnce([] as never);
    vi.mocked(integrationService.listErrors).mockResolvedValueOnce([] as never);
    vi.mocked(integrationService.listAudit).mockResolvedValueOnce([] as never);

    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByText("İşlem Durumu")).toBeInTheDocument();
      expect(screen.getByText(/Geçerlilik tarihi eksik/i)).toBeInTheDocument();
      expect(screen.getByText(/Satır bilgisi girilmemiş/i)).toBeInTheDocument();
      expect(screen.getByText(/Müşteri cari eşlemesi eksik/i)).toBeInTheDocument();
    });
  });

  it("teknik ozeti varsayilan kapali tutar ve istenince gosterir", async () => {
    vi.mocked(integrationService.listOutbox).mockResolvedValue([
      {
        id: "out-quote-err",
        entityType: "QUOTE",
        entityId: "q1",
        operation: "UPSERT",
        payload: {},
        status: "FAILED",
        retryCount: 1,
        maxRetries: 3,
        nextRetryAt: "2026-03-11T10:10:00Z",
        errorMessage: "Mikro P1 read-only mod aktif",
        createdAt: "2026-03-11T10:08:00Z",
      },
    ] as never);
    vi.mocked(integrationService.listErrors).mockResolvedValue([
      {
        id: "err-quote-1",
        entityType: "QUOTE",
        entityId: "q1",
        errorCode: "E_MIKRO_READ_ONLY",
        errorMessage: "Mikro P1 read-only mod aktif",
        isResolved: false,
        createdAt: "2026-03-11T10:09:00Z",
      },
    ] as never);

    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Teknik aktarim ozeti" })).toBeInTheDocument();
    });

    expect(screen.queryByText("Teknik Aktarım Özeti")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Teknik aktarim ozeti" }));

    await waitFor(() => {
      expect(screen.getByText("Teknik Aktarım Özeti")).toBeInTheDocument();
      expect(screen.getByText("E_MIKRO_READ_ONLY")).toBeInTheDocument();
    });
  });

  it("olusturma akisini coklu satirli sihirbaz olarak gosterir", async () => {
    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Yeni Teklif" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni Teklif" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Yeni Teklif Olustur" })).toBeInTheDocument();
      expect(screen.getByText("Teklif Üst Bilgileri")).toBeInTheDocument();
      expect(screen.getByText("Satır Girişi ve Toplamlar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cari Hesap" }));
    fireEvent.click(screen.getByRole("option", { name: "Demo Cari" }));

    expect(screen.getByLabelText("Cari Kodu")).toHaveValue("CARI-001");
    expect(screen.getByLabelText("Telefon")).toHaveValue("05001112233");
    expect(String(screen.getByLabelText("Belge Numarası").getAttribute("value"))).toMatch(/^TF-\d{4}-\d{6}$/);

    expect(screen.getByRole("button", { name: "Yeni satir ekle" })).toBeInTheDocument();
    expect(screen.getByLabelText("Stok Adi 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yeni satir ekle" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Stok Adi 2")).toBeInTheDocument();
    });
  });

  it("olusturma sihirbazi coklu satir payload gonderir", async () => {
    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Yeni Teklif" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni Teklif" }));
    fireEvent.click(screen.getByRole("button", { name: "Cari Hesap" }));
    fireEvent.click(screen.getByRole("option", { name: "Demo Cari" }));
    fireEvent.change(screen.getByLabelText("Gecerlilik Tarihi"), { target: { value: "2026-04-01" } });

    fireEvent.change(screen.getByLabelText("Stok Kodu 1"), { target: { value: "STK-001" } });
    fireEvent.change(screen.getByLabelText("Stok Adi 1"), { target: { value: "Alt dolap govde seti" } });
    fireEvent.change(screen.getByLabelText("Miktar 1"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Birim Fiyat 1"), { target: { value: "1500" } });
    fireEvent.change(screen.getByLabelText("Vergi 1"), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Yeni satir ekle" }));
    fireEvent.change(screen.getByLabelText("Stok Kodu 2"), { target: { value: "STK-002" } });
    fireEvent.change(screen.getByLabelText("Stok Adi 2"), { target: { value: "Ust kapak seti" } });
    fireEvent.change(screen.getByLabelText("Miktar 2"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Birim Fiyat 2"), { target: { value: "2200" } });
    fireEvent.change(screen.getByLabelText("Vergi 2"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Teklif Oluştur" }));

    await waitFor(() => {
      expect(crmService.createQuote).toHaveBeenCalledWith({
        account_id: "acc-1",
        title: expect.stringMatching(/^TF-\d{4}-\d{6}$/),
        document_no: expect.stringMatching(/^TF-\d{4}-\d{6}$/),
        tax_rate: 0,
        discount_rate: 0,
        currency: "TRY",
        valid_until: "2026-04-01",
        lines: [
          {
            product_code: "STK-001",
            description: "Alt dolap govde seti",
            quantity: 2,
            unit: "ADET",
            unit_price: 1500,
            discount_rate: 0,
            tax_rate: 10,
          },
          {
            product_code: "STK-002",
            description: "Ust kapak seti",
            quantity: 1,
            unit: "ADET",
            unit_price: 2200,
            discount_rate: 0,
            tax_rate: 0,
          },
        ],
      });
    });
  });

  it("vergi bos secilirse satirda vergi 0 olarak gonderilir", async () => {
    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Yeni Teklif" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni Teklif" }));
    fireEvent.click(screen.getByRole("button", { name: "Cari Hesap" }));
    fireEvent.click(screen.getByRole("option", { name: "Demo Cari" }));
    fireEvent.change(screen.getByLabelText("Gecerlilik Tarihi"), { target: { value: "2026-04-02" } });
    fireEvent.change(screen.getByLabelText("Stok Adi 1"), { target: { value: "Deneme stok" } });
    fireEvent.change(screen.getByLabelText("Vergi 1"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Teklif Oluştur" }));

    await waitFor(() => {
      expect(crmService.createQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              tax_rate: 0,
            }),
          ],
        }),
      );
    });
  });

  it("baski onizleme dialogunu acar ve yazdir aksiyonunu tetikler", async () => {
    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Baski onizleme" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Baski onizleme" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Baski Onizleme" })).toBeInTheDocument();
      expect(screen.getByText("Mikro düzenine yakın baskı önizleme yüzeyi")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Yazdir" }));
    expect(window.print).toHaveBeenCalled();
  });

  it("uygun durumlarda siparise donustur aksiyonunu gosterir", async () => {
    vi.mocked(crmService.convertQuoteToOrder).mockResolvedValue({
      ok: true,
      message: "Siparis olusturuldu.",
      order_id: "ord-1",
      order_number: "SIP-001",
    } as never);

    render(<TeklifFisiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Siparise Donustur" })).toBeInTheDocument();
    });
  });
});
