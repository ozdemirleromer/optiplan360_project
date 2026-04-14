import { describe, expect, it } from "vitest";

import {
  EXPORT_TELEMETRY_ERROR_MESSAGES,
  normalizeExportTelemetryError,
  resolveExportTelemetryErrorMessage,
} from "./exportTelemetryErrors";

describe("exportTelemetryErrors", () => {
  it("hata sozlugu tum kodlar icin dolu ve tutarli mesajlar icerir", () => {
    const entries = Object.entries(EXPORT_TELEMETRY_ERROR_MESSAGES);
    expect(entries.length).toBe(8);

    for (const [code, message] of entries) {
      expect(code.length).toBeGreaterThan(0);
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it("from format hatasını kod ve mesajla normalize eder", () => {
    const result = normalizeExportTelemetryError("from alanı geçerli datetime formatında olmalıdır.");
    expect(result.code).toBe("INVALID_FROM_FORMAT");
    expect(result.message).toBe(EXPORT_TELEMETRY_ERROR_MESSAGES.INVALID_FROM_FORMAT);
  });

  it("timezone hatasını normalize eder", () => {
    const result = normalizeExportTelemetryError(
      new Error("from alanı timezone içermelidir (ör: 2026-03-12T00:00:00+00:00)."),
    );
    expect(result.code).toBe("MISSING_TIMEZONE");
    expect(result.message).toBe(EXPORT_TELEMETRY_ERROR_MESSAGES.MISSING_TIMEZONE);
  });

  it("limit/offset hatalarını normalize eder", () => {
    expect(normalizeExportTelemetryError("limit değeri 1 ile 200 arasında olmalıdır.").code).toBe("LIMIT_OUT_OF_RANGE");
    expect(normalizeExportTelemetryError("offset değeri >=0 olmalıdır").code).toBe("OFFSET_OUT_OF_RANGE");
    expect(normalizeExportTelemetryError("offset must be non-negative").code).toBe("OFFSET_OUT_OF_RANGE");
    expect(normalizeExportTelemetryError("kayit_uuid formatı geçersizdir").code).toBe("INVALID_KAYIT_UUID");
  });

  it("tablo bazli hata mesajlarini dogru kodlara normalize eder", () => {
    const cases = [
      {
        input: "to alanı geçerli datetime formatında olmalıdır.",
        code: "INVALID_TO_FORMAT",
      },
      {
        input: "from değeri to değerinden büyük olamaz",
        code: "INVALID_RANGE",
      },
      {
        input: "UUID format invalid",
        code: "INVALID_KAYIT_UUID",
      },
      {
        input: "LIMIT must be between 1 and 200",
        code: "LIMIT_OUT_OF_RANGE",
      },
      {
        input: "OFFSET should be non-negative",
        code: "OFFSET_OUT_OF_RANGE",
      },
    ] as const;

    for (const { input, code } of cases) {
      const result = normalizeExportTelemetryError(input);
      expect(result.code).toBe(code);
      expect(result.message).toBe(EXPORT_TELEMETRY_ERROR_MESSAGES[code]);
    }
  });

  it("object.error alanindaki mesaji normalize eder", () => {
    const result = normalizeExportTelemetryError({ error: "to alanı geçerli datetime formatında olmalıdır." });
    expect(result.code).toBe("INVALID_TO_FORMAT");
    expect(result.message).toBe(EXPORT_TELEMETRY_ERROR_MESSAGES.INVALID_TO_FORMAT);
  });

  it("bilinmeyen string hatasını olduğu gibi döndürür", () => {
    const message = resolveExportTelemetryErrorMessage("Telemetry erişim hatası");
    expect(message).toBe("Telemetry erişim hatası");
  });

  it("mesajsız hatada fallback mesaj döndürür", () => {
    const message = resolveExportTelemetryErrorMessage({});
    expect(message).toBe(EXPORT_TELEMETRY_ERROR_MESSAGES.LOAD_FAILED);
  });
});
