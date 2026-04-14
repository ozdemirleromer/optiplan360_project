export interface MeasureRow {
  id: number;
  material: string;
  thickness: string;
  boy: string;
  en: string;
  adet: string;
  grain: "0" | "1" | "2" | "3";
  u1: boolean;
  u2: boolean;
  k1: boolean;
  k2: boolean;
  delik1: string;
  delik2: string;
  info: string;
  status: string;
}

export function createMeasureRow(id: number, overrides: Partial<MeasureRow> = {}): MeasureRow {
  return {
    id,
    material: "18 2100x2800",
    thickness: "18",
    boy: "",
    en: "",
    adet: "1",
    grain: "0",
    u1: false,
    u2: false,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    info: "",
    status: "Taslak",
    ...overrides,
  };
}
