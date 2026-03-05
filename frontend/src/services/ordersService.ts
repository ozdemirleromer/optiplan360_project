import type { Order, OrderInput, OrderUpdate, OrderNote, BulkStatusUpdate, BulkDeleteRequest, BulkOperationResult, OrderStatus } from "../types";

import { apiRequest, getApiBaseUrl } from "./apiClient";



type RawOrder = Order | (Record<string, unknown> & { parts?: unknown });

type ListOrdersResponse = RawOrder[] | { data?: RawOrder[]; items?: RawOrder[] };

type OrderResponse = RawOrder | { data?: RawOrder };



const COUNT_FIELD_KEYS = ["partsCount", "partCount", "parts_count", "part_count"] as const;



function toFiniteNumber(value: unknown): number | null {

  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {

    const parsed = Number(value.trim());

    if (Number.isFinite(parsed)) return parsed;

  }

  return null;

}



function resolvePartsCount(order: Record<string, unknown>): number {

  if (Array.isArray(order.parts)) {

    return order.parts.length;

  }



  const direct = toFiniteNumber(order.parts);

  if (direct !== null) {

    return Math.max(0, Math.trunc(direct));

  }



  for (const key of COUNT_FIELD_KEYS) {

    const value = toFiniteNumber(order[key]);

    if (value !== null) {

      return Math.max(0, Math.trunc(value));

    }

  }



  return 0;

}



function formatDate(value: unknown): string {

  if (!value) return "";

  const str = String(value);

  try {

    const d = new Date(str);

    if (Number.isNaN(d.getTime())) return str;

    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

  } catch {

    return str;

  }

}



function normalizeOrder(order: RawOrder): Order {

  const s = order as Record<string, unknown>;



  // Backend OrderOut (camelCase after transformKeys):

  //   crmNameSnapshot, phoneNorm, materialName, thicknessMm,

  //   plateWMm, plateHMm, grainDefault, createdAt, updatedAt, ...

  // Frontend Order expects:

  //   cust, phone, mat, thick, plate, date, upd, grp, priority, ...



  const id = String(s.id ?? "");

  // order_no varsa formatla (SIP-0001)

  const rawOrderNo = s.orderNo ?? s.order_no;

  const orderNo = rawOrderNo ? `SIP-${String(rawOrderNo).padStart(4, "0")}` : undefined;

  const cust = String(s.cust || s.crmNameSnapshot || s.customerName || "");

  const phone = String(s.phone || s.phoneNorm || "");

  const mat = String(s.mat || s.materialName || "");

  const thick = Number(s.thick ?? s.thicknessMm ?? 0);



  // plate: "WxH" formatı

  let plate = String(s.plate || "");

  if (!plate && (s.plateWMm || s.plateHMm)) {

    const w = Number(s.plateWMm || 0);

    const h = Number(s.plateHMm || 0);

    if (w > 0 && h > 0) plate = `${w}×${h}`;

  }



  const status = String(s.status || "DRAFT") as import("../types").OrderStatus;

  const date = String(s.date || "") || formatDate(s.createdAt);

  const upd = String(s.upd || "") || formatDate(s.updatedAt) || "—";



  // grp: PartGroup (GOVDE | ARKALIK) — backend'de doğrudan yok,

  // parçalardan gelebilir; şimdilik mevcut değeri koru

  const grp = (s.grp || undefined) as import("../types").PartGroup | undefined;



  const priority = (s.priority || "normal") as import("../types").PriorityLevel;



  return {

    id,

    orderNo,

    cust,

    phone,

    mat,

    plate: plate || undefined,

    thick,

    parts: resolvePartsCount(s),

    status,

    date,

    upd,

    grp,

    priority,

  };

}



function normalizeListResponse(payload: ListOrdersResponse): Order[] {

  if (Array.isArray(payload)) return payload.map(normalizeOrder);

  if (Array.isArray(payload?.data)) return payload.data.map(normalizeOrder);

  if (Array.isArray(payload?.items)) return payload.items.map(normalizeOrder);

  return [];

}



function isRawOrder(value: unknown): value is RawOrder {

  return Boolean(value) && typeof value === "object" && !Array.isArray(value);

}



function normalizeOrderResponse(payload: OrderResponse): Order {

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {

    const data = (payload as { data?: unknown }).data;

    if (isRawOrder(data)) {

      return normalizeOrder(data);

    }

  }

  return normalizeOrder(payload as RawOrder);

}



// Frontend → Backend alan adı dönüşümü

function toBackendPayload(data: Partial<Order> | OrderInput | OrderUpdate): Record<string, unknown> {

  const s = data as Record<string, unknown>;

  const out: Record<string, unknown> = {};



  // cust → crm_name_snapshot (backend OrderUpdate alanı değil ama OrderCreate'te var)

  if (s.cust !== undefined) out.crm_name_snapshot = s.cust;

  if (s.phone !== undefined) out.phone_norm = s.phone;

  if (s.mat !== undefined) out.material_name = s.mat;

  if (s.thick !== undefined) out.thickness_mm = s.thick;

  if (s.status !== undefined) out.status = s.status;



  // plate: "2100×2800" → plate_w_mm + plate_h_mm

  if (s.plate && typeof s.plate === "string") {

    const match = String(s.plate).match(/(\d+)\s*[×xX*]\s*(\d+)/);

    if (match) {

      out.plate_w_mm = Number(match[1]);

      out.plate_h_mm = Number(match[2]);

    }

  }



  // Backend'in doğrudan kabul ettiği alanlar

  if (s.color !== undefined) out.color = s.color;

  if (s.grain_default !== undefined) out.grain_default = s.grain_default;

  if (s.band_mm !== undefined) out.band_mm = s.band_mm;

  if (s.customer_id !== undefined) out.customer_id = s.customer_id;



  if (s.parts !== undefined) out.parts = s.parts;

  return out;

}



export const ordersService = {

  async list(): Promise<Order[]> {

    const result = await apiRequest<ListOrdersResponse>("/orders", { method: "GET" });

    return normalizeListResponse(result);

  },



  async create(payload: OrderInput): Promise<Order> {

    const result = await apiRequest<OrderResponse>("/orders", {

      method: "POST",

      body: JSON.stringify(toBackendPayload(payload)),

    });

    return normalizeOrderResponse(result);

  },



  async update(orderId: string, payload: OrderUpdate): Promise<Order> {

    const result = await apiRequest<OrderResponse>(`/orders/${orderId}`, {

      method: "PUT",

      body: JSON.stringify(toBackendPayload(payload)),

    });

    return normalizeOrderResponse(result);

  },



  async remove(orderId: string): Promise<{ ok: boolean }> {

    return apiRequest<{ ok: boolean }>(`/orders/${orderId}`, {

      method: "DELETE",

    });

  },



  async exportOpti(orderId: string): Promise<{ files: Array<{ filename: string; partGroup: string; downloadUrl: string }> }> {

    const raw = await apiRequest<Record<string, unknown>>(`/orders/${orderId}/export/opti`, {

      method: "POST",

    });

    const files = Array.isArray(raw.files)

      ? (raw.files as Record<string, unknown>[]).map((f) => ({

          filename: String(f.filename ?? ""),

          partGroup: String(f.part_group ?? f.partGroup ?? ""),

          downloadUrl: String(f.download_url ?? f.downloadUrl ?? ""),

        }))

      : [];

    return { files };

  },



  getExportDownloadUrl(filename: string): string {

    return `${getApiBaseUrl()}/orders/export/download/${encodeURIComponent(filename)}`;

  },


  // --- Order Notes ---

  async getNotes(orderId: string): Promise<OrderNote[]> {
    const data = await apiRequest<unknown[]>(`/orders/${orderId}/notes`);
    return (Array.isArray(data) ? data : []).map((n) => {
      const r = n as Record<string, unknown>;
      return {
        id: Number(r.id),
        orderId: Number(r.orderId ?? r.id),
        userId: Number(r.userId ?? 0),
        noteText: String(r.noteText ?? ""),
        createdByUsername: r.createdByUsername != null ? String(r.createdByUsername) : undefined,
        createdAt: r.createdAt != null ? String(r.createdAt) : undefined,
        updatedAt: r.updatedAt != null ? String(r.updatedAt) : undefined,
      } satisfies OrderNote;
    });
  },

  async addNote(orderId: string, noteText: string): Promise<OrderNote> {
    const r = await apiRequest<Record<string, unknown>>(`/orders/${orderId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note_text: noteText }),
    });
    return {
      id: Number(r.id),
      orderId: Number(r.orderId ?? r.id),
      userId: Number(r.userId ?? 0),
      noteText: String(r.noteText ?? ""),
      createdByUsername: r.createdByUsername != null ? String(r.createdByUsername) : undefined,
      createdAt: r.createdAt != null ? String(r.createdAt) : undefined,
      updatedAt: r.updatedAt != null ? String(r.updatedAt) : undefined,
    };
  },

  async deleteNote(orderId: string, noteId: number): Promise<void> {
    await apiRequest(`/orders/${orderId}/notes/${noteId}`, { method: "DELETE" });
  },

  // --- Clone Order ---

  async cloneOrder(orderId: string): Promise<Order> {
    const data = await apiRequest<OrderResponse>(`/orders/${orderId}/clone`, { method: "POST" });
    return normalizeOrderResponse(data);
  },

  // --- Bulk Operations ---

  async bulkUpdateStatus(payload: BulkStatusUpdate): Promise<BulkOperationResult> {
    const body = { order_ids: payload.orderIds, new_status: payload.newStatus };
    return apiRequest<BulkOperationResult>("/orders/bulk/status", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async bulkDelete(payload: BulkDeleteRequest): Promise<BulkOperationResult> {
    const body = { order_ids: payload.orderIds };
    return apiRequest<BulkOperationResult>("/orders/bulk/delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};