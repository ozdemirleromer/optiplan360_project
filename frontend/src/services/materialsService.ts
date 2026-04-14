import { apiRequest } from "./apiClient";

interface RawMaterialDetail {
  id?: string | number;
  code?: string;
  name?: string;
  unit?: string;
  category?: string | null;
  lastPrice?: number | string | null;
  last_price?: number | string | null;
}

export interface MaterialLookupItem {
  kod: string;
  ad: string;
  birim: string;
  fiyat: number;
  kategori: string;
}

function mapMaterial(raw: RawMaterialDetail): MaterialLookupItem {
  return {
    kod: String(raw.code ?? raw.id ?? "").trim(),
    ad: String(raw.name ?? raw.code ?? raw.id ?? "").trim(),
    birim: String(raw.unit ?? "ADET").trim() || "ADET",
    fiyat: Number(raw.lastPrice ?? raw.last_price ?? 0) || 0,
    kategori: String(raw.category ?? "Diğer").trim() || "Diğer",
  };
}

export const materialsService = {
  async listMaterials(params?: { search?: string; pageSize?: number }): Promise<MaterialLookupItem[]> {
    const query = new URLSearchParams();
    const search = params?.search?.trim();
    if (search) {
      query.set("search", search);
    }
    query.set("page_size", String(params?.pageSize ?? 100));

    const raw = await apiRequest<RawMaterialDetail[]>(`/materials${query.toString() ? `?${query.toString()}` : ""}`, {
      method: "GET",
    });

    return Array.isArray(raw) ? raw.map(mapMaterial) : [];
  },
};


