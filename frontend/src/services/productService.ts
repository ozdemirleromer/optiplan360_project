/**
 * OptiPlan 360 — Product Catalog API Service
 * Backend /api/v1/products/* endpointleri icin istemci
 */
import { apiRequest } from "./apiClient";

export interface SpecSearchResult {
  id: number;
  productTypeName: string;
  colorName: string;
  thicknessMm: number;
  widthCm: number;
  heightCm: number;
  specHash: string;
  matchStatus: "MATCHED" | "AMBIGUOUS" | "NO_MATCH";
  supplierItems: Array<{
    id: number;
    brandName: string;
    displayName: string;
    isDefault: boolean;
  }>;
}

export interface SpecSearchResponse {
  results: SpecSearchResult[];
  total: number;
}

function mapSearchResult(raw: Record<string, unknown>): SpecSearchResult {
  const supplierItems = Array.isArray(raw.supplierItems)
    ? (raw.supplierItems as Record<string, unknown>[]).map((si) => ({
        id: Number(si.id),
        brandName: String(si.brandName ?? ""),
        displayName: String(si.displayName ?? ""),
        isDefault: Boolean(si.isDefault),
      }))
    : [];

  return {
    id: Number(raw.id ?? 0),
    productTypeName: String(raw.productTypeName ?? ""),
    colorName: String(raw.colorName ?? ""),
    thicknessMm: Number(raw.thicknessMm ?? 0),
    widthCm: Number(raw.widthCm ?? 0),
    heightCm: Number(raw.heightCm ?? 0),
    specHash: String(raw.specHash ?? ""),
    matchStatus: (raw.matchStatus as SpecSearchResult["matchStatus"]) ?? "NO_MATCH",
    supplierItems,
  };
}

export const productService = {
  async searchSpecs(params?: {
    query?: string;
    productTypeId?: number;
    colorId?: number;
    thicknessMm?: number;
    widthCm?: number;
    heightCm?: number;
    limit?: number;
  }): Promise<SpecSearchResponse> {
    const q = new URLSearchParams();
    if (params?.query) q.set("query", params.query);
    if (params?.productTypeId) q.set("product_type_id", String(params.productTypeId));
    if (params?.colorId) q.set("color_id", String(params.colorId));
    if (params?.thicknessMm) q.set("thickness_mm", String(params.thicknessMm));
    if (params?.widthCm) q.set("width_cm", String(params.widthCm));
    if (params?.heightCm) q.set("height_cm", String(params.heightCm));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    const raw = (await apiRequest(`/products/search${qs ? "?" + qs : ""}`, {
      method: "GET",
    })) as Record<string, unknown>;
    const results = Array.isArray(raw.results)
      ? (raw.results as Record<string, unknown>[]).map(mapSearchResult)
      : [];
    return { results, total: Number(raw.total ?? results.length) };
  },

  async resolveIncoming(incomingId: number, brandId: number, itemId?: number): Promise<unknown> {
    const q = new URLSearchParams();
    q.set("brand_id", String(brandId));
    if (itemId) q.set("item_id", String(itemId));
    return apiRequest(`/products/incoming/${incomingId}/resolve?${q.toString()}`, {
      method: "POST",
    });
  },
};
