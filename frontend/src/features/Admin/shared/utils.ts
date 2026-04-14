/**


 * Utility functions for Admin components


 */





/**


 * Convert array of objects to CSV format


 */


export function toCsv(arr: Record<string, unknown>[], headers?: string[]): string {


  if (arr.length === 0) return "";


  const keys = headers || Object.keys(arr[0]);


  const header = keys.join(",");


  const rows = arr.map((obj) => keys.map((k) => obj[k] ?? "").join(","));


  return [header, ...rows].join("\n");


}





/**


 * Download text content as file


 */


export function downloadText(filename: string, text: string): void {


  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });


  const url = URL.createObjectURL(blob);


  const a = document.createElement("a");


  a.href = url;


  a.download = filename;


  a.click();


  URL.revokeObjectURL(url);


}

// ── Telemetri Filtre Yardımcıları ─────────────────────────────

/** datetime-local değerini (ör. "2026-03-12T10:15") timezone içeren ISO stringine çevirir */
export function localDateTimeToIsoWithTimezone(dateLocal: string): string {
  const date = new Date(dateLocal);
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const MM = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}T${HH}:${MM}:00${sign}${hh}:${mm}`;
}

export interface TelemetryFilters {
  kayitUuid: string;
  fromLocal: string;
  toLocal: string;
  limit: string;
  offset: string;
}

/** URL'den telemetri filtre parametrelerini okur */
export function parseTelemetryFiltersFromUrl(url: string): TelemetryFilters {
  const { searchParams } = new URL(url);
  return {
    kayitUuid: searchParams.get("telemetry_kayit_uuid") ?? "",
    fromLocal: searchParams.get("telemetry_from_local") ?? "",
    toLocal: searchParams.get("telemetry_to_local") ?? "",
    limit: searchParams.get("telemetry_limit") ?? searchParams.get("limit") ?? "",
    offset: searchParams.get("telemetry_offset") ?? searchParams.get("offset") ?? "",
  };
}

/** URL'ye telemetri filtre parametrelerini yazar; boş değerler silinir; eski limit/offset kaldırılır */
export function buildUrlWithTelemetryFilters(url: string, filters: TelemetryFilters): string {
  const u = new URL(url);
  u.searchParams.delete("limit");
  u.searchParams.delete("offset");

  const set = (key: string, val: string) => {
    if (val) u.searchParams.set(key, val);
    else u.searchParams.delete(key);
  };

  set("telemetry_kayit_uuid", filters.kayitUuid);
  set("telemetry_from_local", filters.fromLocal);
  set("telemetry_to_local", filters.toLocal);
  set("telemetry_limit", filters.limit);
  set("telemetry_offset", filters.offset);

  return u.toString();
}

type TelemetryPreset = "LAST_1_HOUR" | "LAST_6_HOURS" | "LAST_24_HOURS" | "LAST_7_DAYS";

/** Preset aralığını datetime-local formatında üretir */
export function applyTelemetryPresetRange(
  now: Date,
  preset: TelemetryPreset | string,
): { fromLocal: string; toLocal: string } {
  const toMs: Record<string, number> = {
    LAST_1_HOUR: 60 * 60 * 1000,
    LAST_6_HOURS: 6 * 60 * 60 * 1000,
    LAST_24_HOURS: 24 * 60 * 60 * 1000,
    LAST_7_DAYS: 7 * 24 * 60 * 60 * 1000,
  };
  const ms = toMs[preset] ?? 60 * 60 * 1000;
  const toDatetimeLocal = (d: Date) => {
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mo}-${dd}T${HH}:${MM}`;
  };
  return {
    fromLocal: toDatetimeLocal(new Date(now.getTime() - ms)),
    toLocal: toDatetimeLocal(now),
  };
}

/** from > to ise hata metni döner, geçerliyse null */
export function validateTelemetryLocalRange(from: string, to: string): string | null {
  if (!from || !to) return null;
  return new Date(from) > new Date(to) ? "from değeri to değerinden büyük olamaz." : null;
}

/** Pozitif tam sayıya çevirir; geçersizse null döner */
export function parseTelemetryIntegerInput(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export interface TelemetryPagingResult {
  errorCode: "LIMIT_OUT_OF_RANGE" | "OFFSET_OUT_OF_RANGE" | null;
  paging: { limit: number; offset: number };
  normalizedLimitInput?: string;
  normalizedOffsetInput?: string;
}

/** Limit/offset string'lerini validate eder ve normalize eder */
export function normalizeTelemetryPagingFilters(
  limitStr: string,
  offsetStr: string,
): TelemetryPagingResult {
  const DEFAULT_LIMIT = 20;
  const DEFAULT_OFFSET = 0;

  if (!limitStr && !offsetStr) {
    return { errorCode: null, paging: { limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET } };
  }

  const limit = limitStr ? parseTelemetryIntegerInput(limitStr) : DEFAULT_LIMIT;
  const offset = offsetStr ? parseTelemetryIntegerInput(offsetStr) : DEFAULT_OFFSET;

  if (limit === null || limit < 1 || limit > 200) {
    return { errorCode: "LIMIT_OUT_OF_RANGE", paging: { limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET } };
  }
  if (offset === null || offset < 0) {
    return { errorCode: "OFFSET_OUT_OF_RANGE", paging: { limit, offset: DEFAULT_OFFSET } };
  }

  return {
    errorCode: null,
    paging: { limit, offset },
    normalizedLimitInput: String(limit),
    normalizedOffsetInput: String(offset),
  };
}

/** Gecerli bir telemetri kayit UUID formati mi? (min 2 karakter, bosluk ve ozel karakter yok) */
export function isValidTelemetryKayitUuid(val: string): boolean {
  return val.length >= 2 && /^[a-zA-Z0-9\-._:]+$/.test(val);
}

// ── Telemetri Sabitler ─────────────────────────────────────────

export type TelemetryPresetRangeId = "LAST_1_HOUR" | "LAST_6_HOURS" | "LAST_24_HOURS" | "LAST_7_DAYS";

export const TELEMETRY_PRESET_RANGES: { id: TelemetryPresetRangeId; label: string }[] = [
  { id: "LAST_1_HOUR", label: "Son 1 Saat" },
  { id: "LAST_6_HOURS", label: "Son 6 Saat" },
  { id: "LAST_24_HOURS", label: "Son 24 Saat" },
  { id: "LAST_7_DAYS", label: "Son 7 Gun" },
];

export const TELEMETRY_PAGING_DEFAULTS = { limit: 20, offset: 0 };
