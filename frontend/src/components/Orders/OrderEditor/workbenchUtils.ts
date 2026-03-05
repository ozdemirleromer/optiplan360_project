import type { MeasureRow } from "./shared";

export interface PlateDimensionInputs {
  boy: string;
  en: string;
}

export interface ParsedCustomerField {
  name: string;
  phone: string;
}

const DEFAULT_PLATE_DIMENSIONS: PlateDimensionInputs = {
  boy: "2800.00",
  en: "2070.00",
};

function toPlainDecimalString(value: string): string {
  const cleaned = value.replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
  if (!cleaned) {
    return "";
  }

  const decimalIndex = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  if (decimalIndex === -1) {
    return cleaned.replace(/[.,]/g, "");
  }

  const whole = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
  const fraction = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
  const hasTrailingSeparator = decimalIndex === cleaned.length - 1;

  if (hasTrailingSeparator) {
    return `${whole || "0"}.`;
  }

  if (!fraction) {
    return whole || "0";
  }

  return `${whole || "0"}.${fraction}`;
}

export function sanitizeMaskedNumberInput(value: string): string {
  const normalized = toPlainDecimalString(value);
  if (!normalized) {
    return "";
  }

  const [wholePart = "", ...fractionParts] = normalized.split(".");
  const sanitizedWhole = wholePart.replace(/^0+(?=\d)/, "") || (wholePart.includes("0") ? "0" : wholePart);
  const fraction = fractionParts.join("").slice(0, 2);

  if (normalized.endsWith(".") && fraction.length === 0) {
    return `${sanitizedWhole || "0"}.`;
  }

  return fraction.length > 0 ? `${sanitizedWhole || "0"}.${fraction}` : sanitizedWhole;
}

export function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseMaskedNumber(value: string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalized = toPlainDecimalString(String(value ?? ""));

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatMaskedNumber(value: string | number): string {
  const parsed = parseMaskedNumber(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function normalizeMaskedNumberOnBlur(value: string): string {
  const normalized = toPlainDecimalString(value);
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return formatMaskedNumber(parsed.toFixed(2));
}

export function parsePlateSizeInputs(value: string): PlateDimensionInputs {
  const match = value
    .replace(/\s+/g, "")
    .match(/(\d+(?:[.,]\d+)?)\s*[xX*\u00D7]\s*(\d+(?:[.,]\d+)?)/);

  if (!match) {
    return DEFAULT_PLATE_DIMENSIONS;
  }

  return {
    boy: normalizeMaskedNumberOnBlur(match[1]) || DEFAULT_PLATE_DIMENSIONS.boy,
    en: normalizeMaskedNumberOnBlur(match[2]) || DEFAULT_PLATE_DIMENSIONS.en,
  };
}

export function buildPlateSizeValue(dimensions: PlateDimensionInputs): string {
  const boy = normalizeMaskedNumberOnBlur(dimensions.boy) || DEFAULT_PLATE_DIMENSIONS.boy;
  const en = normalizeMaskedNumberOnBlur(dimensions.en) || DEFAULT_PLATE_DIMENSIONS.en;
  return `${boy}x${en}`;
}

export function buildCustomerField(name: string, phone: string): string {
  const parts = [name.trim(), phone.trim()].filter(Boolean);
  return parts.join(" | ");
}

export function parseCustomerField(value: string): ParsedCustomerField {
  const trimmed = value.trim();
  if (!trimmed) {
    return { name: "", phone: "" };
  }

  const segments = trimmed
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    return {
      name: segments[0],
      phone: segments.slice(1).join(" "),
    };
  }

  const phoneMatch = trimmed.match(/(?:\+?\d[\d\s()-]{8,}\d)/);
  if (!phoneMatch) {
    return { name: trimmed, phone: "" };
  }

  const phone = phoneMatch[0].trim();
  const name = trimmed.replace(phoneMatch[0], "").replace(/[|/,-]+$/g, "").trim();
  return {
    name: name || trimmed,
    phone,
  };
}

export function buildSystemOrderNo(orderNo?: string | null, rawId?: string | null): string {
  if (orderNo?.trim()) {
    return orderNo.trim();
  }

  const digits = String(rawId ?? "").replace(/\D/g, "").slice(-6);
  return `SIP-${digits.padStart(6, "0")}`;
}

export function isRotated(grain: string): boolean {
  return grain === "1" || grain === "3";
}

export function toggleRotation(grain: string): "0" | "1" {
  return isRotated(grain) ? "0" : "1";
}

export function countInvalidBoyItems(items: MeasureRow[], plateBoy: number): number {
  return items.reduce((total, item) => {
    const boy = parseMaskedNumber(item.boy);
    return total + (Number.isFinite(boy) && Number.isFinite(plateBoy) && boy > plateBoy ? 1 : 0);
  }, 0);
}

export function createMockRows(count: number): MeasureRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    boy: formatMaskedNumber(450 + index * 11),
    en: formatMaskedNumber(280 + index * 7),
    adet: String((index % 5) + 1),
    grain: index % 2 === 0 ? "0" : "1",
    u1: index % 2 === 0,
    u2: index % 3 === 0,
    k1: index % 4 === 0,
    k2: index % 5 === 0,
    delik1: "",
    delik2: "",
    info: `Parca ${String(index + 1).padStart(3, "0")}`,
  }));
}
