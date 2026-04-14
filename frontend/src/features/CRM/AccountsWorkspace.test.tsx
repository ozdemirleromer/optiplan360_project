// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountsWorkspace } from "./AccountsWorkspace";
import { crmService } from "../../services/crmService";

vi.mock("../../stores/notificationStore", () => ({
  notificationHelpers: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../services/crmService", () => ({
  crmService: {
    listAccounts: vi.fn(),
    listAddresses: vi.fn(),
    listContacts: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
  },
}));

describe("AccountsWorkspace", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(crmService.listAccounts).mockResolvedValue([]);
    vi.mocked(crmService.listAddresses).mockResolvedValue([]);
    vi.mocked(crmService.listContacts).mockResolvedValue([]);
    vi.mocked(crmService.createAccount).mockResolvedValue({
      id: "acc-1",
      companyName: "Deneme Hesap",
      isActive: true,
      createdAt: "2026-03-30T00:00:00Z",
      updatedAt: "2026-03-30T00:00:00Z",
    } as never);
  });

  it("yeni cari modalinda mecburi bilgi ozeti ile submit kilidini gosterir", async () => {
    render(<AccountsWorkspace openCreateOnMount onCreateOpenHandled={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText("Mecburi Bilgi Durumu")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mecburi Bilgileri Tamamla (1)" })).toBeDisabled();
    });

    fireEvent.change(screen.getByLabelText(/Firma Adı/i), { target: { value: "Acme Mobilya" } });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: "Cari Kartı Oluştur" });
      expect(submitButton).toBeEnabled();
    });
  });
});
