// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountsTab } from "./CRMPage";
import { crmService } from "../../services/crmService";
import { integrationService } from "../../services/integrationService";

vi.mock("../../services/crmService");
vi.mock("../../services/integrationService");

describe("AccountsTab", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    vi.mocked(crmService.listAccounts).mockResolvedValue([
      {
        id: "acc-1",
        companyName: "Demo Cari",
        taxId: "1234567890",
        phone: "0212 000 00 00",
        mikroCariKod: "CARI-001",
        creditLimit: 50000,
        paymentTermDays: 30,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as never);

    vi.mocked(crmService.createAccount).mockResolvedValue({
      id: "acc-2",
      companyName: "Yeni Cari",
      creditLimit: 0,
      paymentTermDays: 0,
      plakaBirimFiyat: 0,
      bantMetreFiyat: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
    vi.mocked(crmService.updateAccount).mockResolvedValue({
      id: "acc-1",
      companyName: "Demo Cari",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
    vi.mocked(crmService.deleteAccount).mockResolvedValue({ message: "ok" } as never);

    vi.mocked(crmService.listContacts).mockResolvedValue([] as never);
    vi.mocked(crmService.createContact).mockResolvedValue({
      id: "contact-1",
      accountId: "acc-1",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      title: "Satın Alma Müdürü",
      department: "Satın Alma",
      phone: "02125554433",
      mobile: "+905320001122",
      email: "ayse@example.com",
      isPrimary: true,
      notes: "Oncelikli iletisim",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);

    vi.mocked(integrationService.listEntityMaps).mockResolvedValue([
      {
        id: "map-1",
        entityType: "ACCOUNT",
        internalId: "acc-1",
        externalId: "CARI-001",
        externalSystem: "MIKRO",
        isActive: true,
        lastSyncedAt: "2026-03-11T09:30:00Z",
        createdAt: "2026-03-11T09:00:00Z",
      },
    ] as never);

    vi.mocked(integrationService.listOutbox).mockResolvedValue([
      {
        id: "out-1",
        entityType: "ACCOUNT",
        entityId: "acc-1",
        operation: "UPSERT",
        payload: {},
        status: "FAILED",
        retryCount: 1,
        maxRetries: 3,
        errorMessage: "Mikro timeout",
        createdAt: "2026-03-11T09:00:00Z",
        processedAt: "2026-03-11T09:32:00Z",
      },
    ] as never);

    vi.mocked(integrationService.listErrors).mockResolvedValue([
      {
        id: "err-1",
        entityType: "ACCOUNT",
        entityId: "acc-1",
        errorCode: "E_TIMEOUT",
        errorMessage: "Mikro timeout",
        isResolved: false,
        createdAt: "2026-03-11T09:31:00Z",
      },
    ] as never);

    vi.mocked(integrationService.listAudit).mockResolvedValue([
      {
        id: "audit-1",
        action: "MAP_CREATE",
        entityType: "ACCOUNT",
        entityId: "acc-1",
        createdAt: "2026-03-11T09:33:00Z",
      },
    ] as never);
  });

  it("secili cari icin readonly teknik paneli doldurur", async () => {
    render(<AccountsTab />);

    await waitFor(() => expect(screen.getAllByText("Demo Cari").length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByText("Demo Cari")[0]);

    await waitFor(() => {
      expect(screen.getByText("Vergi ve Resmi Bilgiler")).toBeInTheDocument();
      expect(screen.getByText("Adresler")).toBeInTheDocument();
      expect(screen.getByText("Risk ve Limit")).toBeInTheDocument();
      expect(screen.getByText("Cari Teknik Paneli")).toBeInTheDocument();
      expect(screen.getByText("Mikro eslesti")).toBeInTheDocument();
      expect(screen.getByText("MIKRO / CARI-001")).toBeInTheDocument();
      expect(screen.getByText("FAILED")).toBeInTheDocument();
      expect(screen.getByText("Mikro timeout")).toBeInTheDocument();
    });

    expect(screen.queryByText("Mikro Kod: CARI-001")).not.toBeInTheDocument();

    expect(crmService.listContacts).toHaveBeenCalledWith({ account_id: "acc-1" });
    expect(integrationService.listEntityMaps).toHaveBeenCalledWith({
      entity_type: "ACCOUNT",
      internal_id: "acc-1",
    });
    expect(integrationService.listOutbox).toHaveBeenCalledWith({
      entity_type: "ACCOUNT",
      entity_id: "acc-1",
    });
  });

  it("create modalinda sifir numeric alanlari payload'a korur", async () => {
    render(<AccountsTab openCreateOnMount />);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Yeni Cari Oluştur" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Mikro Cari Kodu")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Firma Adı"), { target: { value: "Yeni Cari" } });
    fireEvent.change(screen.getByLabelText("Kredi Limiti"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Vade (Gun)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Plaka Birim Fiyat (TL)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Bant Metre Fiyat (TL)"), { target: { value: "0" } });

    fireEvent.click(screen.getByRole("button", { name: "Cari Kartı Oluştur" }));

    await waitFor(() => {
      expect(crmService.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: "Yeni Cari",
          account_type: "CORPORATE",
          credit_limit: 0,
          payment_term_days: 0,
          plaka_birim_fiyat: 0,
          bant_metre_fiyat: 0,
        }),
      );
    });

    const createPayload = vi.mocked(crmService.createAccount).mock.calls[0]?.[0];
    expect(createPayload).toBeDefined();
    expect(createPayload).not.toHaveProperty("mikro_cari_kod");

    await waitFor(() => {
      expect(screen.getByText((_, element) => element?.textContent === "Plaka: 0 TL/adet")).toBeInTheDocument();
      expect(screen.getByText((_, element) => element?.textContent === "Bant: 0 TL/m")).toBeInTheDocument();
      expect(screen.getByText((_, element) => element?.textContent === "Vade: 0 gün")).toBeInTheDocument();
    });
  });

  it("filtreleri backend liste cagrisina tasir", async () => {
    render(<AccountsTab />);

    const waitForFilterSurface = async () => {
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Hesap Tipi Filtre" })).toBeInTheDocument();
        expect(screen.getByLabelText("Sehir")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mikro Durumu" })).toBeInTheDocument();
      });
    };

    await waitFor(() => expect(crmService.listAccounts).toHaveBeenCalled());
    await waitForFilterSurface();
    vi.mocked(crmService.listAccounts).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Hesap Tipi Filtre" }));
    fireEvent.click(screen.getByText("Bireysel"));

    await waitFor(() => {
      expect(crmService.listAccounts).toHaveBeenLastCalledWith({
        search: undefined,
        is_active: true,
        account_type: "INDIVIDUAL",
        city: undefined,
        has_mikro_cari_kod: undefined,
      });
    });

    await waitForFilterSurface();
    fireEvent.change(screen.getByLabelText("Sehir"), { target: { value: "Ankara" } });

    await waitFor(() => {
      expect(crmService.listAccounts).toHaveBeenLastCalledWith({
        search: undefined,
        is_active: true,
        account_type: "INDIVIDUAL",
        city: "Ankara",
        has_mikro_cari_kod: undefined,
      });
    });

    await waitForFilterSurface();
    fireEvent.click(screen.getByRole("button", { name: "Mikro Durumu" }));
    fireEvent.click(screen.getByText("Mikro bekleyenler"));

    await waitFor(() => {
      expect(crmService.listAccounts).toHaveBeenLastCalledWith({
        search: undefined,
        is_active: true,
        account_type: "INDIVIDUAL",
        city: "Ankara",
        has_mikro_cari_kod: false,
      });
    });

    await waitForFilterSurface();
    fireEvent.click(screen.getByText("Pasifleri goster"));

    await waitFor(() => {
      expect(crmService.listAccounts).toHaveBeenLastCalledWith({
        search: undefined,
        is_active: undefined,
        account_type: "INDIVIDUAL",
        city: "Ankara",
        has_mikro_cari_kod: false,
      });
    });
  });

  it("pasife alma aksiyonu delete servisini tetikler", async () => {
    render(<AccountsTab />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Pasife Al" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Pasife Al" })[0]);

    await waitFor(() => {
      expect(crmService.deleteAccount).toHaveBeenCalledWith("acc-1");
    });
  });

  it("yetkili modalinda trimlenmis alanlari payload olarak gonderir ve listede gosterir", async () => {
    render(<AccountsTab />);

    await waitFor(() => expect(screen.getAllByText("Demo Cari").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Demo Cari")[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Yeni Yetkili" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni Yetkili" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Yeni Yetkili Oluştur" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Ad"), { target: { value: "  Ayşe  " } });
    fireEvent.change(screen.getByLabelText("Soyad"), { target: { value: "  Yılmaz " } });
    fireEvent.change(screen.getByLabelText("Unvan"), { target: { value: " Satın Alma Müdürü " } });
    fireEvent.change(screen.getByLabelText("Departman"), { target: { value: " Satın Alma " } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: " 0212 555 44 33 " } });
    fireEvent.change(screen.getByLabelText("Mobil"), { target: { value: " +90 532 000 11 22 " } });
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: " AYSE@EXAMPLE.COM " } });
    fireEvent.click(screen.getByLabelText("Birincil yetkili olarak isaretle"));
    fireEvent.change(screen.getByLabelText("Notlar"), { target: { value: " Oncelikli iletisim " } });

    fireEvent.click(screen.getByRole("button", { name: "Yetkili Oluştur" }));

    await waitFor(() => {
      expect(crmService.createContact).toHaveBeenCalledWith({
        account_id: "acc-1",
        first_name: "Ayşe",
        last_name: "Yılmaz",
        title: "Satın Alma Müdürü",
        department: "Satın Alma",
        phone: "0212 555 44 33",
        mobile: "+90 532 000 11 22",
        email: "ayse@example.com",
        is_primary: true,
        notes: "Oncelikli iletisim",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Ayşe Yılmaz")).toBeInTheDocument();
      expect(screen.getByText("Birincil")).toBeInTheDocument();
      expect(screen.getByText("Satın Alma Müdürü")).toBeInTheDocument();
      expect(screen.getByText("ayse@example.com")).toBeInTheDocument();
      expect(screen.getByText("02125554433")).toBeInTheDocument();
    });
  });

  it("yetkili modalinda ad veya soyad eksiginde servis cagrisi yapmaz", async () => {
    render(<AccountsTab />);

    await waitFor(() => expect(screen.getAllByText("Demo Cari").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Demo Cari")[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Yeni Yetkili" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni Yetkili" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Yeni Yetkili Oluştur" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Ad"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Soyad"), { target: { value: "Yılmaz" } });
    fireEvent.click(screen.getByRole("button", { name: "Yetkili Oluştur" }));

    await waitFor(() => {
      expect(screen.getByText("Yetkili adı zorunludur.")).toBeInTheDocument();
    });

    expect(crmService.createContact).not.toHaveBeenCalled();
  });
});
