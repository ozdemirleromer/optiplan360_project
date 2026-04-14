// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockCardComponent from "./StockCardComponent";
import { apiRequest } from "../../services/apiClient";
import { integrationService } from "../../services/integrationService";

vi.mock("../../services/apiClient", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../../services/integrationService", () => ({
  integrationService: {
    listEntityMaps: vi.fn(),
    listOutbox: vi.fn(),
    listErrors: vi.fn(),
    listAudit: vi.fn(),
  },
}));

describe("StockCardComponent", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(integrationService.listEntityMaps).mockResolvedValue([] as never);
    vi.mocked(integrationService.listOutbox).mockResolvedValue([] as never);
    vi.mocked(integrationService.listErrors).mockResolvedValue([] as never);
    vi.mocked(integrationService.listAudit).mockResolvedValue([] as never);

    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === "/stock/stock-cards") {
        return [
          {
            id: "stk-1",
            stockCode: "STK-001",
            stockName: "Suntalam Beyaz",
            unit: "ADET",
            purchasePrice: 100,
            salePrice: 150,
            totalQuantity: 50,
            availableQuantity: 40,
            reservedQuantity: 10,
            thickness: "18 mm",
            color: "Beyaz",
            warehouseLocation: "A-01",
            isActive: true,
            lastSyncDate: "2026-03-12T08:30:00Z",
          },
        ];
      }

      if (path === "/stock/stock-cards/low-stock/alert?threshold=10") {
        return { items: [] };
      }

      if (path === "/stock/stock-cards/summary/stats") {
        return {
          totalStockCards: 1,
          activeStockCards: 1,
          inactiveStockCards: 0,
          totalStockMovements: 0,
          lastMovementDate: "2026-03-12T08:30:00Z",
        };
      }

      if (path === "/stock/stock-cards/STK-001") {
        return {
          id: "stk-1",
          stockCode: "STK-001",
          stockName: "Suntalam Beyaz",
          purchasePrice: 100,
          totalQuantity: 50,
          availableQuantity: 40,
          reservedQuantity: 10,
          salePrice: 150,
          color: "Beyaz",
          thickness: "18 mm",
          warehouseLocation: "A-01",
          unit: "ADET",
          isActive: true,
          lastSyncDate: "2026-03-12T08:30:00Z",
          barkodlar: [{ id: "bc-1", barcode: "869000000001" }],
          satisFiyatlari: [{ id: "sp-1", priceType: "LISTE", amount: 150 }],
          movements: [],
        };
      }

      throw new Error(`Beklenmeyen path: ${path}`);
    });
  });

  it("stok detayinda barkod ve satis fiyat child tablolarini teknik panel ile birlikte gosterir", async () => {
    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getByText("STK-001")).toBeInTheDocument();
    });

    expect(screen.queryByText(/^Sync:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("STK-001"));

    await waitFor(() => {
      expect(screen.getByText("Genel Bilgiler")).toBeInTheDocument();
      expect(screen.getAllByText("Suntalam Beyaz").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Stok çalışma alanı")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Fiyat ve Stok/i }));
    expect(screen.getByText("Ticari Bilgiler")).toBeInTheDocument();
    expect(screen.getByText("Depo ve Miktar")).toBeInTheDocument();
    expect(screen.getAllByText(/₺150[,.]00/).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /Barkodlar \(1\)/i }));
    expect(screen.getByRole("region", { name: "Barkod Alt Gridi" })).toBeInTheDocument();
    expect(screen.getByText("869000000001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Satış Fiyatları \(1\)/i }));
    expect(screen.getByRole("region", { name: "Satış Fiyatları Alt Gridi" })).toBeInTheDocument();
    expect(screen.getByText("LISTE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Teknik/i }));
    expect(screen.getByText("Stok Teknik Paneli")).toBeInTheDocument();
    expect(screen.getByText("Eşleme kaydı yok")).toBeInTheDocument();
    expect(screen.getByText("Outbox kaydı yok")).toBeInTheDocument();

    expect(screen.queryByText("Barkod ve fiyat child yapıları henüz açılmadı")).not.toBeInTheDocument();
    expect(screen.queryByText("Child Koleksiyon Blokajı")).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/stock/stock-cards/STK-001");
  });

  it("stok kartinda sifir fiyatlari gizlemez", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === "/stock/stock-cards") {
        return [
          {
            id: "stk-2",
            stockCode: "STK-002",
            stockName: "Ham MDF",
            unit: "ADET",
            purchasePrice: 0,
            salePrice: 0,
            totalQuantity: 20,
            availableQuantity: 20,
            reservedQuantity: 0,
            thickness: "8 mm",
            color: "Ham",
            warehouseLocation: "B-01",
            isActive: true,
            lastSyncDate: null,
          },
        ];
      }

      if (path === "/stock/stock-cards/low-stock/alert?threshold=10") {
        return { items: [] };
      }

      if (path === "/stock/stock-cards/summary/stats") {
        return {
          totalStockCards: 1,
          activeStockCards: 1,
          inactiveStockCards: 0,
          totalStockMovements: 0,
          lastMovementDate: null,
        };
      }

      if (path === "/stock/stock-cards/STK-002") {
        return {
          id: "stk-2",
          stockCode: "STK-002",
          stockName: "Ham MDF",
          purchasePrice: 0,
          totalQuantity: 20,
          availableQuantity: 20,
          reservedQuantity: 0,
          salePrice: 0,
          color: "Ham",
          thickness: "8 mm",
          warehouseLocation: "B-01",
          unit: "ADET",
          isActive: true,
          lastSyncDate: null,
          barkodlar: [],
          satisFiyatlari: [],
          movements: [],
        };
      }

      throw new Error(`Beklenmeyen path: ${path}`);
    });

    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getByText("STK-002")).toBeInTheDocument();
      expect(screen.getAllByText(/₺0[,.]00/).length).toBeGreaterThanOrEqual(2);
    });

    fireEvent.click(screen.getByText("STK-002"));

    await waitFor(() => {
      expect(screen.getAllByText("Ham MDF").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Fiyat ve Stok/i }));
    expect(screen.getByText("Satış Fiyatı")).toBeInTheDocument();
    expect(screen.getByText("Alış Fiyatı")).toBeInTheDocument();
    expect(screen.getAllByText(/₺0[,.]00/).length).toBeGreaterThanOrEqual(2);
  });

  it("yeni stok olusturma akisi barkod ve satis fiyati child payloadini backend kontratina gore gonderir", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/stock/stock-cards" && options?.method === "POST") {
        return {
          id: "stk-3",
          stockCode: "STK-003",
          stockName: "Yeni Cocuklu Kart",
          unit: "ADET",
          purchasePrice: 88,
          salePrice: 120,
          totalQuantity: 15,
          availableQuantity: 15,
          reservedQuantity: 0,
          thickness: "18 mm",
          color: "Antrasit",
          warehouseLocation: "C-01",
          isActive: true,
          lastSyncDate: null,
          barkodlar: [{ id: "bc-3", barcode: "8691111111111" }],
          satisFiyatlari: [{ id: "sp-3", priceType: "LISTE", amount: 120 }],
          movements: [],
        };
      }

      if (path === "/stock/stock-cards") {
        return [];
      }

      if (path === "/stock/stock-cards/low-stock/alert?threshold=10") {
        return { items: [] };
      }

      if (path === "/stock/stock-cards/summary/stats") {
        return {
          totalStockCards: 0,
          activeStockCards: 0,
          inactiveStockCards: 0,
          totalStockMovements: 0,
          lastMovementDate: null,
        };
      }

      throw new Error(`Beklenmeyen path: ${path}`);
    });

    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i })[0]);

    fireEvent.change(screen.getByLabelText("Stok Kodu *"), { target: { value: "STK-003" } });
    fireEvent.change(screen.getByLabelText("Stok Adı *"), { target: { value: "Yeni Cocuklu Kart" } });
    fireEvent.change(screen.getByLabelText("Birim *"), { target: { value: "ADET" } });
    fireEvent.change(screen.getByLabelText("Alış Fiyatı"), { target: { value: "88" } });
    fireEvent.change(screen.getByLabelText("Satış Fiyatı"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Toplam Stok"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Kalınlık"), { target: { value: "18 mm" } });
    fireEvent.change(screen.getByLabelText("Renk"), { target: { value: "Antrasit" } });
    fireEvent.change(screen.getByLabelText("Depo Yeri"), { target: { value: "C-01" } });
    fireEvent.change(screen.getByLabelText("Barkod 1"), { target: { value: "8691111111111" } });
    fireEvent.change(screen.getByLabelText("Fiyat Tipi"), { target: { value: "LISTE" } });
    fireEvent.change(screen.getByLabelText("Tutar"), { target: { value: "120" } });

    fireEvent.click(screen.getByRole("button", { name: "Stok Kartını Oluştur" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/stock/stock-cards", {
        method: "POST",
        body: JSON.stringify({
          stock_code: "STK-003",
          stock_name: "Yeni Cocuklu Kart",
          unit: "ADET",
          purchase_price: 88,
          sale_price: 120,
          total_quantity: 15,
          thickness: "18 mm",
          color: "Antrasit",
          warehouse_location: "C-01",
          material_type: null,
          width_mm: null,
          height_mm: null,
          barkodlar: [{ barcode: "8691111111111" }],
          satis_fiyatlari: [{ price_type: "LISTE", amount: 120 }],
        }),
      });
      expect(screen.getByText("Yeni Cocuklu Kart")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Barkodlar \(1\)/i }));
    expect(screen.getByText("8691111111111")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Satış Fiyatları \(1\)/i }));
    expect(screen.getByText("LISTE")).toBeInTheDocument();
  });

  it("yeni stok modalinda mecburi bilgi ozeti ile submit kilidini gosterir", async () => {
    render(<StockCardComponent openCreateOnMount onCreateOpenHandled={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText("Mecburi Bilgi Durumu")).toBeInTheDocument();
    });

    const lockedButton = screen.getByRole("button", { name: "Mecburi Bilgileri Tamamla (2)" });
    expect(lockedButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Stok Kodu *"), { target: { value: "STK-008" } });
    fireEvent.change(screen.getByLabelText("Stok Adı *"), { target: { value: "Mecburi Alan Karti" } });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: "Stok Kartını Oluştur" });
      expect(submitButton).toBeEnabled();
    });
  });

  it("yeni stok olusturma akisi ana ve child alanlari trimlenmis payload ile gonderir", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/stock/stock-cards" && options?.method === "POST") {
        return {
          id: "stk-6",
          stockCode: "STK-006",
          stockName: "Trimli Kart",
          unit: "ADET",
          purchasePrice: 45,
          salePrice: 60,
          totalQuantity: 9,
          availableQuantity: 9,
          reservedQuantity: 0,
          thickness: "18 mm",
          color: "Beyaz",
          warehouseLocation: "D-02",
          isActive: true,
          lastSyncDate: null,
          barkodlar: [{ id: "bc-6", barcode: "8696666666666" }],
          satisFiyatlari: [{ id: "sp-6", priceType: "LISTE", amount: 60 }],
          movements: [],
        };
      }

      if (path === "/stock/stock-cards") {
        return [];
      }

      if (path === "/stock/stock-cards/low-stock/alert?threshold=10") {
        return { items: [] };
      }

      if (path === "/stock/stock-cards/summary/stats") {
        return {
          totalStockCards: 0,
          activeStockCards: 0,
          inactiveStockCards: 0,
          totalStockMovements: 0,
          lastMovementDate: null,
        };
      }

      throw new Error(`Beklenmeyen path: ${path}`);
    });

    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i })[0]);

    fireEvent.change(screen.getByLabelText("Stok Kodu *"), { target: { value: "  STK-006  " } });
    fireEvent.change(screen.getByLabelText("Stok Adı *"), { target: { value: "  Trimli Kart  " } });
    fireEvent.change(screen.getByLabelText("Birim *"), { target: { value: "ADET" } });
    fireEvent.change(screen.getByLabelText("Alış Fiyatı"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Satış Fiyatı"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Toplam Stok"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Kalınlık"), { target: { value: " 18 mm " } });
    fireEvent.change(screen.getByLabelText("Renk"), { target: { value: " Beyaz " } });
    fireEvent.change(screen.getByLabelText("Depo Yeri"), { target: { value: " D-02 " } });
    fireEvent.change(screen.getByLabelText("Barkod 1"), { target: { value: " 8696666666666 " } });
    fireEvent.change(screen.getByLabelText("Fiyat Tipi"), { target: { value: " LISTE " } });
    fireEvent.change(screen.getByLabelText("Tutar"), { target: { value: "60" } });

    fireEvent.click(screen.getByRole("button", { name: "Stok Kartını Oluştur" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/stock/stock-cards", {
        method: "POST",
        body: JSON.stringify({
          stock_code: "STK-006",
          stock_name: "Trimli Kart",
          unit: "ADET",
          purchase_price: 45,
          sale_price: 60,
          total_quantity: 9,
          thickness: "18 mm",
          color: "Beyaz",
          warehouse_location: "D-02",
          material_type: null,
          width_mm: null,
          height_mm: null,
          barkodlar: [{ barcode: "8696666666666" }],
          satis_fiyatlari: [{ price_type: "LISTE", amount: 60 }],
        }),
      });
    });
  });

  it("yeni stok kartinda ayni barkod iki kez girildiginde create islemini durdurur", async () => {
    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i })[0]);

    fireEvent.change(screen.getByLabelText("Stok Kodu *"), { target: { value: "STK-004" } });
    fireEvent.change(screen.getByLabelText("Stok Adı *"), { target: { value: "Merrer Barkodlu Kart" } });
    fireEvent.change(screen.getByLabelText("Barkod 1"), { target: { value: "8691111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /Yeni barkod sat/i }));
    fireEvent.change(screen.getByLabelText("Barkod 2"), { target: { value: "8691111111111" } });

    fireEvent.click(screen.getByRole("button", { name: "Stok Kartını Oluştur" }));

    await waitFor(() => {
      expect(screen.getByText("Aynı barkod bir stok kartında tekrar edemez")).toBeInTheDocument();
    });

    expect(apiRequest).not.toHaveBeenCalledWith(
      "/stock/stock-cards",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("yeni stok kartinda ayni fiyat tipi iki kez girildiginde create islemini durdurur", async () => {
    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i })[0]);

    fireEvent.change(screen.getByLabelText("Stok Kodu *"), { target: { value: "STK-005" } });
    fireEvent.change(screen.getByLabelText("Stok Adı *"), { target: { value: "Merrer Fiyat Tipli Kart" } });
    fireEvent.change(screen.getByLabelText("Fiyat Tipi"), { target: { value: "LISTE" } });
    fireEvent.change(screen.getByLabelText("Tutar"), { target: { value: "125" } });
    fireEvent.click(screen.getByRole("button", { name: /Fiyat Satırı Ekle/i }));

    const priceTypeInputs = screen.getAllByLabelText("Fiyat Tipi");
    const amountInputs = screen.getAllByLabelText("Tutar");
    fireEvent.change(priceTypeInputs[1], { target: { value: "LISTE" } });
    fireEvent.change(amountInputs[1], { target: { value: "140" } });

    fireEvent.click(screen.getByRole("button", { name: "Stok Kartını Oluştur" }));

    await waitFor(() => {
      expect(screen.getByText("Aynı fiyat tipi bir stok kartında tekrar edemez")).toBeInTheDocument();
    });

    expect(apiRequest).not.toHaveBeenCalledWith(
      "/stock/stock-cards",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("yeni stok kartinda eksik satis fiyati satiri oldugunda create islemini durdurur", async () => {
    render(<StockCardComponent />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Yeni Stok Kartı/i })[0]);

    fireEvent.change(screen.getByLabelText("Stok Kodu *"), { target: { value: "STK-007" } });
    fireEvent.change(screen.getByLabelText("Stok Adı *"), { target: { value: "Eksik Fiyat Satiri" } });
    fireEvent.change(screen.getByLabelText("Fiyat Tipi"), { target: { value: "LISTE" } });

    fireEvent.click(screen.getByRole("button", { name: "Stok Kartını Oluştur" }));

    await waitFor(() => {
      expect(screen.getByText("Satış fiyat satırlarında fiyat tipi ve tutar birlikte girilmelidir")).toBeInTheDocument();
    });

    expect(apiRequest).not.toHaveBeenCalledWith(
      "/stock/stock-cards",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("barkod ve satis fiyat alt gridleri bos kayit durumunda bos durum mesaji gosterir", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === "/stock/stock-cards") {
        return [{ id: "stk-empty", stockCode: "STK-EMPTY", stockName: "Bos Alt Grid", unit: "ADET", stockType: "HAMMADDE", category: "", isActive: true, stockQuantity: 0, minStockLevel: 0, salePrice: 0, purchasePrice: 0, color: "", thickness: "", warehouseLocation: "", lastSyncDate: null }];
      }
      if (path === "/stock/stock-cards/STK-EMPTY") {
        return { id: "stk-empty", stockCode: "STK-EMPTY", stockName: "Bos Alt Grid", unit: "ADET", stockType: "HAMMADDE", category: "", isActive: true, stockQuantity: 0, minStockLevel: 0, salePrice: 0, purchasePrice: 0, color: "", thickness: "", warehouseLocation: "", lastSyncDate: null, barkodlar: [], satisFiyatlari: [], movements: [] };
      }
      return [];
    });

    render(<StockCardComponent />);

    await waitFor(() => expect(screen.getByText("STK-EMPTY")).toBeInTheDocument());
    fireEvent.click(screen.getByText("STK-EMPTY"));

    await waitFor(() => {
      expect(screen.getAllByText("Bos Alt Grid").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Barkodlar \(0\)/i }));
    expect(screen.getByRole("region", { name: "Barkod Alt Gridi" })).toBeInTheDocument();
    expect(screen.getByText("Barkod kaydı yok")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Satış Fiyatları \(0\)/i }));
    expect(screen.getByRole("region", { name: "Satış Fiyatları Alt Gridi" })).toBeInTheDocument();
    expect(screen.getByText("Satış fiyatı kaydı yok")).toBeInTheDocument();
  });

});
