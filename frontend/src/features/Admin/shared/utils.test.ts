import { describe, expect, it } from "vitest";

import {
  applyTelemetryPresetRange,
  buildUrlWithTelemetryFilters,
  isValidTelemetryKayitUuid,
  localDateTimeToIsoWithTimezone,
  normalizeTelemetryPagingFilters,
  parseTelemetryIntegerInput,
  parseTelemetryFiltersFromUrl,
  validateTelemetryLocalRange,
} from "./utils";

describe("admin shared telemetry utils", () => {
  it("localDateTimeToIsoWithTimezone datetime-local değerini timezone içeren ISO'ya çevirir", () => {
    const converted = localDateTimeToIsoWithTimezone("2026-03-12T10:15");
    expect(converted).toMatch(/^2026-03-12T10:15:00[+-]\d{2}:\d{2}$/);
  });

  it("parseTelemetryFiltersFromUrl telemetry query alanlarını okur", () => {
    const parsed = parseTelemetryFiltersFromUrl(
      "https://localhost/admin?telemetry_kayit_uuid=wf-1&telemetry_from_local=2026-03-12T09%3A00&telemetry_to_local=2026-03-12T10%3A30&telemetry_limit=25&telemetry_offset=5",
    );

    expect(parsed.kayitUuid).toBe("wf-1");
    expect(parsed.fromLocal).toBe("2026-03-12T09:00");
    expect(parsed.toLocal).toBe("2026-03-12T10:30");
    expect(parsed.limit).toBe("25");
    expect(parsed.offset).toBe("5");
  });

  it("parseTelemetryFiltersFromUrl legacy limit/offset query alanlarını fallback olarak okur", () => {
    const parsed = parseTelemetryFiltersFromUrl("https://localhost/admin?limit=15&offset=3");

    expect(parsed.limit).toBe("15");
    expect(parsed.offset).toBe("3");
  });

  it("buildUrlWithTelemetryFilters query alanlarını set eder ve temizler", () => {
    const updated = buildUrlWithTelemetryFilters("https://localhost/admin?foo=bar&limit=5&offset=2", {
      kayitUuid: "wf-2",
      fromLocal: "2026-03-12T08:00",
      toLocal: "2026-03-12T09:00",
      limit: "20",
      offset: "0",
    });

    expect(updated).toContain("foo=bar");
    expect(updated).toContain("telemetry_kayit_uuid=wf-2");
    expect(updated).toContain("telemetry_from_local=2026-03-12T08%3A00");
    expect(updated).toContain("telemetry_to_local=2026-03-12T09%3A00");
    expect(updated).toContain("telemetry_limit=20");
    expect(updated).toContain("telemetry_offset=0");
    expect(updated).not.toContain("limit=5");
    expect(updated).not.toContain("offset=2");

    const cleaned = buildUrlWithTelemetryFilters(`https://localhost${updated}`, {
      kayitUuid: "",
      fromLocal: "",
      toLocal: "",
      limit: "",
      offset: "",
    });

    expect(cleaned).toContain("foo=bar");
    expect(cleaned).not.toContain("telemetry_kayit_uuid");
    expect(cleaned).not.toContain("telemetry_from_local");
    expect(cleaned).not.toContain("telemetry_to_local");
    expect(cleaned).not.toContain("telemetry_limit");
    expect(cleaned).not.toContain("telemetry_offset");
  });

  it("applyTelemetryPresetRange preset aralığını datetime-local formatında üretir", () => {
    const now = new Date("2026-03-12T12:00:00Z");
    const range = applyTelemetryPresetRange(now, "LAST_1_HOUR");

    expect(range.fromLocal).toMatch(/^2026-03-12T\d{2}:\d{2}$/);
    expect(range.toLocal).toMatch(/^2026-03-12T\d{2}:\d{2}$/);
  });

  it("validateTelemetryLocalRange from > to durumunda hata döner", () => {
    const error = validateTelemetryLocalRange("2026-03-12T11:00", "2026-03-12T10:00");
    expect(error).toBe("from değeri to değerinden büyük olamaz.");
  });

  it("parseTelemetryIntegerInput geçerli ve geçersiz değerleri ayrıştırır", () => {
    expect(parseTelemetryIntegerInput("20")).toBe(20);
    expect(parseTelemetryIntegerInput("0")).toBe(0);
    expect(parseTelemetryIntegerInput(" 15 ")).toBe(15);
    expect(parseTelemetryIntegerInput("-1")).toBeNull();
    expect(parseTelemetryIntegerInput("1.5")).toBeNull();
    expect(parseTelemetryIntegerInput("abc")).toBeNull();
    expect(parseTelemetryIntegerInput("")).toBeNull();
  });

  it("normalizeTelemetryPagingFilters varsayılan ve normalize değerleri döner", () => {
    const defaults = normalizeTelemetryPagingFilters("", "");
    expect(defaults.errorCode).toBeNull();
    expect(defaults.paging).toEqual({ limit: 20, offset: 0 });

    const normalized = normalizeTelemetryPagingFilters("025", "0009");
    expect(normalized.errorCode).toBeNull();
    expect(normalized.paging).toEqual({ limit: 25, offset: 9 });
    expect(normalized.normalizedLimitInput).toBe("25");
    expect(normalized.normalizedOffsetInput).toBe("9");
  });

  it("normalizeTelemetryPagingFilters geçersiz limit/offset için hata kodu döner", () => {
    expect(normalizeTelemetryPagingFilters("0", "0").errorCode).toBe("LIMIT_OUT_OF_RANGE");
    expect(normalizeTelemetryPagingFilters("201", "0").errorCode).toBe("LIMIT_OUT_OF_RANGE");
    expect(normalizeTelemetryPagingFilters("20", "-1").errorCode).toBe("OFFSET_OUT_OF_RANGE");
  });

  it("isValidTelemetryKayitUuid geçerli ve geçersiz formatları ayırt eder", () => {
    expect(isValidTelemetryKayitUuid("wf-1")).toBe(true);
    expect(isValidTelemetryKayitUuid("d3f4b620-8d1e-4ef8-a705-57f33df8fa0f")).toBe(true);
    expect(isValidTelemetryKayitUuid("wf:group_1.2")).toBe(true);

    expect(isValidTelemetryKayitUuid("a")).toBe(false);
    expect(isValidTelemetryKayitUuid("wf 1")).toBe(false);
    expect(isValidTelemetryKayitUuid("@@bad@@")).toBe(false);
  });
});
