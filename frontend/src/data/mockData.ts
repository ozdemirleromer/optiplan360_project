// Mock order data for development (temizlendi — gerçek veri API'den gelir)
export const ORDERS_DATA: Record<string, unknown>[] = [];

// Ölçü tablosu için mock veri
export const MEASURE_DATA = [
  {
    id: 1,
    boy: "700",
    en: "400",
    adet: "2",
    grain: "0",
    u1: false,
    u2: false,
    k1: true,
    k2: false,
    delik1: "",
    delik2: "",
    info: "Gövde ön panel",
  },
  {
    id: 2,
    boy: "700",
    en: "400",
    adet: "1",
    grain: "0",
    u1: false,
    u2: false,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    info: "Gövde arka panel",
  },
  {
    id: 3,
    boy: "1200",
    en: "600",
    adet: "1",
    grain: "1",
    u1: true,
    u2: true,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    info: "Kapak sağ",
  },
  {
    id: 4,
    boy: "1200",
    en: "600",
    adet: "1",
    grain: "1",
    u1: true,
    u2: true,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    info: "Kapak sol",
  },
  {
    id: 5,
    boy: "500",
    en: "300",
    adet: "4",
    grain: "0",
    u1: false,
    u2: false,
    k1: false,
    k2: false,
    delik1: "",
    delik2: "",
    info: "Çekmece ön",
  },
];

// Utility functions for order IDs
export function formatOrderId(year: number, seq: number): string {
  const padded = String(seq).padStart(4, "0");
  return `OP-${year}-${padded}`;
}

export function nextOrderId(): string {
  const year = new Date().getFullYear();
  const ids = ORDERS_DATA.map((o) => o.id).filter(Boolean);
  const maxSeqThisYear = ids.reduce((max, id) => {
    const parts = id.split("-");
    if (parts.length === 3 && parseInt(parts[1]) === year) {
      const seq = parseInt(parts[2]);
      return Math.max(max, seq);
    }
    return max;
  }, 0);
  return formatOrderId(year, maxSeqThisYear + 1);
}
