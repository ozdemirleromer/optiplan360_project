import { create } from "zustand";
import { ORDERS_DATA } from "../data/mockData";
import { getAuthToken } from "../services/apiClient";
import { ordersService } from "../services/ordersService";
import { getPartCount } from "../utils/orderParts";
import type { Order, OrderStatus, OrderInput } from "../types";

function ensurePartsCount(order: Order): Order {
  if (typeof order.parts === "number") return order;
  return { ...order, parts: getPartCount(order.parts, 0) };
}

interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  fetchOrders: () => Promise<void>;
  setOrders: (orders: Order[]) => void;
  upsertOrder: (order: Order) => void;
  saveOrder: (order: Order) => Promise<{ ok: boolean; message?: string }>;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: ORDERS_DATA as Order[],
  isLoading: false,
  error: null,
  initialized: false,

  fetchOrders: async () => {
    if (get().isLoading) return;

    const token = getAuthToken();
    if (!token) {
      set({ initialized: true, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const orders = await ordersService.list();
      set({ orders: orders.map(ensurePartsCount), initialized: true, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Siparişler alınamadı",
        initialized: true,
        isLoading: false,
      });
    }
  },

  setOrders: (orders) => set({ orders }),

  upsertOrder: (order) =>
    set((state) => {
      const safe = ensurePartsCount(order);
      const index = state.orders.findIndex((item) => item.id === safe.id);
      if (index === -1) {
        return { orders: [safe, ...state.orders] };
      }

      const next = [...state.orders];
      next[index] = safe;
      return { orders: next };
    }),

  saveOrder: async (order) => {
    // Mevcut state'in anlık kopyasını al — hata durumunda geri dönmek için
    const previousOrders = get().orders;

    // Optimistic update: kullanıcıya anında geri bildirim
    get().upsertOrder(order);

    try {
      const isExisting = previousOrders.some((item) => item.id === order.id);
      let saved: Order;

      if (isExisting) {
        saved = await ordersService.update(order.id, {
          cust: order.cust,
          phone: order.phone,
          mat: order.mat,
          plate: order.plate,
          thick: order.thick,
          status: order.status,
          grp: order.grp,
          priority: order.priority,
        });
      } else {
        const payload: OrderInput = {
          cust: order.cust,
          phone: order.phone,
          mat: order.mat,
          plate: order.plate,
          thick: order.thick,
          grp: order.grp,
          priority: order.priority,
        };
        saved = await ordersService.create(payload);
      }

      // API'den dönen gerçek veriyle state'i güncelle
      get().upsertOrder(saved);
      return { ok: true };
    } catch (error) {
      // Rollback: optimistic update'i geri al, kullanıcı kayıpsız bırakılmaz
      set({ orders: previousOrders });
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Sipariş kaydedilemedi",
      };
    }
  },

  setOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status, upd: "az önce" } : order
      ),
    })),
}));
