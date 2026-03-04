import { describe, expect, it } from "vitest";
import {
  buildCustomerField,
  buildPlateSizeValue,
  countInvalidBoyItems,
  createMockRows,
  formatMaskedNumber,
  normalizeMaskedNumberOnBlur,
  parseCustomerField,
  parsePlateSizeInputs,
  sanitizeIntegerInput,
  sanitizeMaskedNumberInput,
  toggleRotation,
} from "./workbenchUtils";

describe("workbenchUtils", () => {
  it("formats masked numbers with thousands separator and two decimals", () => {
    expect(formatMaskedNumber("1200.5")).toBe("1,200.50");
    expect(normalizeMaskedNumberOnBlur("450")).toBe("450.00");
  });

  it("sanitizes decimal and integer inputs", () => {
    expect(sanitizeMaskedNumberInput("12ab,345")).toBe("12.34");
    expect(sanitizeIntegerInput("2a4b")).toBe("24");
  });

  it("round-trips combined customer field values", () => {
    const combined = buildCustomerField("Kaya Tasarim", "+90 555 123 45 67");
    expect(combined).toBe("Kaya Tasarim | +90 555 123 45 67");
    expect(parseCustomerField(combined)).toEqual({
      name: "Kaya Tasarim",
      phone: "+90 555 123 45 67",
    });
  });

  it("parses and rebuilds plate dimensions", () => {
    const parsed = parsePlateSizeInputs("2800x2070");
    expect(parsed).toEqual({ boy: "2,800.00", en: "2,070.00" });
    expect(buildPlateSizeValue(parsed)).toBe("2,800.00x2,070.00");
  });

  it("counts invalid boy items, toggles rotation, and creates mock rows", () => {
    const items = [
      { id: 1, boy: "2,900.00", en: "500.00", adet: "1", grain: "0", u1: false, u2: false, k1: false, k2: false, delik1: "", delik2: "", info: "" },
      { id: 2, boy: "800.00", en: "600.00", adet: "2", grain: "1", u1: false, u2: false, k1: false, k2: false, delik1: "", delik2: "", info: "" },
    ];

    expect(countInvalidBoyItems(items, 2800)).toBe(1);
    expect(toggleRotation("0")).toBe("1");
    expect(toggleRotation("1")).toBe("0");
    expect(createMockRows(100)).toHaveLength(100);
  });
});
