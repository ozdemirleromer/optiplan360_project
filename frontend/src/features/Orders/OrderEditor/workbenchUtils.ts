import { createMeasureRow, type MeasureRow } from "./shared";

function normalizeNumericInput(value: string) {
  return value.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
}

export function sanitizeMaskedNumberInput(value: string) {
  return normalizeNumericInput(value);
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function parseMaskedNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeMaskedNumberOnBlur(value: string) {
  const parsed = parseMaskedNumber(value);
  if (!parsed) {
    return "";
  }

  return parsed.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function createMockRows(count: number): MeasureRow[] {
  return Array.from({ length: count }, (_, index) =>
    createMeasureRow(index + 1, {
      material: "18 2100x2800",
      boy: String(500 + index),
      en: String(300 + index),
      adet: String((index % 4) + 1),
      info: `Parça ${index + 1}`,
      status: index % 5 === 0 ? "Kontrol" : "Hazır",
    }),
  );
}
