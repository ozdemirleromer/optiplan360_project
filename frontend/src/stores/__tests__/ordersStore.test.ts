import { describe, it, expect, beforeEach, vi } from "vitest";
import { useOrdersStore } from "../ordersStore";
import type { Order } from "../../types";

// ordersService modülünü mock'la — ağ çağrısı yok
vi.mock("../../services/ordersService", () => ({
  ordersService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

// apiClient — getAuthToken: test token döner
vi.mock("../../services/apiClient", () => ({
  getAuthToken: vi.fn(() => "test-token"),
}));

import { ordersService } from "../../services/ordersService";

const mockList = ordersService.list as ReturnType<typeof vi.fn>;
const mockCreate = ordersService.create as ReturnType<typeof vi.fn>;
const mockUpdate = ordersService.update as ReturnType<typeof vi.fn>;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord-1",
    cust: "Test Müşteri",
    phone: "05001234567",
    mat: "Beyaz",
    thick: 18,
    parts: 4,
    status: "NEW",
    date: "2024-01-01",
    upd: "2024-01-01",
    priority: "normal",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOrdersStore.setState({
    orders: [],
    isLoading: false,
    error: null,
    initialized: false,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ordersStore — setOrders", () => {
  it("state'i verilen liste ile değiştirir", () => {
    const list = [makeOrder({ id: "ord-1" }), makeOrder({ id: "ord-2" })];
    useOrdersStore.getState().setOrders(list);
    expect(useOrdersStore.getState().orders).toHaveLength(2);
    expect(useOrdersStore.getState().orders[0].id).toBe("ord-1");
  });

  it("boş liste ile tüm siparişleri temizler", () => {
    useOrdersStore.setState({ orders: [makeOrder()] });
    useOrdersStore.getState().setOrders([]);
    expect(useOrdersStore.getState().orders).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ordersStore — upsertOrder", () => {
  it("liste boşsa yeni siparişi başa ekler", () => {
    const order = makeOrder({ id: "ord-new" });
    useOrdersStore.getState().upsertOrder(order);
    expect(useOrdersStore.getState().orders).toHaveLength(1);
    expect(useOrdersStore.getState().orders[0].id).toBe("ord-new");
  });

  it("aynı id varsa günceller, uzunluk değişmez", () => {
    const original = makeOrder({ id: "ord-1", cust: "Eski" });
    useOrdersStore.setState({ orders: [original] });

    const updated = makeOrder({ id: "ord-1", cust: "Yeni" });
    useOrdersStore.getState().upsertOrder(updated);

    const state = useOrdersStore.getState().orders;
    expect(state).toHaveLength(1);
    expect(state[0].cust).toBe("Yeni");
  });

  it("farklı id varsa listeye ekler", () => {
    useOrdersStore.setState({ orders: [makeOrder({ id: "ord-1" })] });
    useOrdersStore.getState().upsertOrder(makeOrder({ id: "ord-2" }));
    expect(useOrdersStore.getState().orders).toHaveLength(2);
  });

  it("parts sayısal değilse ensurePartsCount ile normalize eder", () => {
    const order = { ...makeOrder({ id: "ord-x" }), parts: [] as unknown as number };
    useOrdersStore.getState().upsertOrder(order);
    expect(typeof useOrdersStore.getState().orders[0].parts).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ordersStore — setOrderStatus", () => {
  it("verilen siparişin statusunu değiştirir", () => {
    useOrdersStore.setState({ orders: [makeOrder({ id: "ord-1", status: "NEW" })] });
    useOrdersStore.getState().setOrderStatus("ord-1", "APPROVED");
    expect(useOrdersStore.getState().orders[0].status).toBe("APPROVED");
  });

  it("diğer siparişlerin statusunu değiştirmez", () => {
    useOrdersStore.setState({
      orders: [
        makeOrder({ id: "ord-1", status: "NEW" }),
        makeOrder({ id: "ord-2", status: "DRAFT" }),
      ],
    });
    useOrdersStore.getState().setOrderStatus("ord-1", "APPROVED");
    expect(useOrdersStore.getState().orders[1].status).toBe("DRAFT");
  });

  it("upd alanını 'az önce' olarak günceller", () => {
    useOrdersStore.setState({ orders: [makeOrder({ id: "ord-1", upd: "2024-01-01" })] });
    useOrdersStore.getState().setOrderStatus("ord-1", "COMPLETED");
    expect(useOrdersStore.getState().orders[0].upd).toBe("az önce");
  });

  it("eşleşmeyen id ile state değişmez", () => {
    const original = makeOrder({ id: "ord-1", status: "NEW" });
    useOrdersStore.setState({ orders: [original] });
    useOrdersStore.getState().setOrderStatus("ord-999", "DONE");
    expect(useOrdersStore.getState().orders[0].status).toBe("NEW");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ordersStore — fetchOrders", () => {
  it("başarılı API çağrısı sonrası orders state'ini doldurur", async () => {
    const remote = [makeOrder({ id: "ord-remote", parts: 3 })];
    mockList.mockResolvedValueOnce(remote);

    await useOrdersStore.getState().fetchOrders();

    expect(useOrdersStore.getState().orders).toHaveLength(1);
    expect(useOrdersStore.getState().orders[0].id).toBe("ord-remote");
    expect(useOrdersStore.getState().isLoading).toBe(false);
    expect(useOrdersStore.getState().initialized).toBe(true);
  });

  it("API hatası sonrası error mesajını set eder", async () => {
    mockList.mockRejectedValueOnce(new Error("ağ hatası"));

    await useOrdersStore.getState().fetchOrders();

    expect(useOrdersStore.getState().error).toBe("ağ hatası");
    expect(useOrdersStore.getState().isLoading).toBe(false);
    expect(useOrdersStore.getState().initialized).toBe(true);
  });

  it("zaten isLoading=true ise çift çağrı engellenir", async () => {
    useOrdersStore.setState({ isLoading: true });

    await useOrdersStore.getState().fetchOrders();

    expect(mockList).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ordersStore — saveOrder (yeni kayıt)", () => {
  it("optimistic update sonra API'den dönen kayıtla state'i günceller", async () => {
    const order = makeOrder({ id: "ord-new" });
    const serverResponse = makeOrder({ id: "ord-new", cust: "API-cevabı" });
    mockCreate.mockResolvedValueOnce(serverResponse);

    const result = await useOrdersStore.getState().saveOrder(order);

    expect(result.ok).toBe(true);
    expect(useOrdersStore.getState().orders[0].cust).toBe("API-cevabı");
  });

  it("API başarısız olursa rollback yapar", async () => {
    // Başlangıç: boş liste
    mockCreate.mockRejectedValueOnce(new Error("sunucu hatası"));

    const result = await useOrdersStore.getState().saveOrder(makeOrder({ id: "ord-fail" }));

    expect(result.ok).toBe(false);
    expect(result.message).toBe("sunucu hatası");
    // Rollback: önceki state (boş) geri döner
    expect(useOrdersStore.getState().orders).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ordersStore — saveOrder (güncelleme)", () => {
  it("mevcut sipariş güncellenir — update API çağrılır", async () => {
    const existing = makeOrder({ id: "ord-existing" });
    useOrdersStore.setState({ orders: [existing] });

    const serverResponse = makeOrder({ id: "ord-existing", cust: "Güncellendi" });
    mockUpdate.mockResolvedValueOnce(serverResponse);

    const result = await useOrdersStore.getState().saveOrder(existing);

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(useOrdersStore.getState().orders[0].cust).toBe("Güncellendi");
  });

  it("update API hatası sonrası rollback eski siparişi geri getirir", async () => {
    const existing = makeOrder({ id: "ord-existing", cust: "Orijinal" });
    useOrdersStore.setState({ orders: [existing] });

    mockUpdate.mockRejectedValueOnce(new Error("güncelleme hatası"));

    const result = await useOrdersStore.getState().saveOrder(
      makeOrder({ id: "ord-existing", cust: "Deneme" })
    );

    expect(result.ok).toBe(false);
    // Rollback: orijinal cust değeri korunur
    expect(useOrdersStore.getState().orders[0].cust).toBe("Orijinal");
  });
});
