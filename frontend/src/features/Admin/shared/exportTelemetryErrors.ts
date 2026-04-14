export type ExportTelemetryErrorCode =
  | "INVALID_FROM_FORMAT"
  | "INVALID_TO_FORMAT"
  | "INVALID_RANGE"
  | "INVALID_KAYIT_UUID"
  | "MISSING_TIMEZONE"
  | "LIMIT_OUT_OF_RANGE"
  | "OFFSET_OUT_OF_RANGE"
  | "LOAD_FAILED";

export interface ExportTelemetryErrorResult {
  code: ExportTelemetryErrorCode;
  message: string;
  rawMessage: string;
}

export const EXPORT_TELEMETRY_ERROR_MESSAGES: Record<ExportTelemetryErrorCode, string> = {
  INVALID_FROM_FORMAT: "from alanı geçerli datetime formatında olmalıdır.",
  INVALID_TO_FORMAT: "to alanı geçerli datetime formatında olmalıdır.",
  INVALID_RANGE: "from değeri to değerinden büyük olamaz.",
  INVALID_KAYIT_UUID: "kayit_uuid yalnızca harf/rakam ve . _ : - karakterleri içermelidir (2-128 karakter).",
  MISSING_TIMEZONE: "from/to alanları timezone içermelidir (ör: 2026-03-12T00:00:00+00:00).",
  LIMIT_OUT_OF_RANGE: "limit değeri 1 ile 200 arasında olmalıdır.",
  OFFSET_OUT_OF_RANGE: "offset değeri 0 veya daha büyük olmalıdır.",
  LOAD_FAILED: "Export telemetry yüklenemedi.",
};

function extractRawMessage(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof Error) {
    return input.message;
  }

  if (input && typeof input === "object") {
    const objectInput = input as { message?: unknown; error?: unknown };
    if (typeof objectInput.message === "string") {
      return objectInput.message;
    }
    if (typeof objectInput.error === "string") {
      return objectInput.error;
    }
  }

  return "";
}

function detectTelemetryErrorCode(rawMessage: string): ExportTelemetryErrorCode {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("from alanı geçerli datetime")) {
    return "INVALID_FROM_FORMAT";
  }

  if (normalized.includes("to alanı geçerli datetime")) {
    return "INVALID_TO_FORMAT";
  }

  if (normalized.includes("from değeri to değerinden büyük olamaz")) {
    return "INVALID_RANGE";
  }

  if (/kayit_uuid|kayıt_uuid|uuid/.test(normalized) && /(format|geçersiz|invalid|yalnızca|only)/.test(normalized)) {
    return "INVALID_KAYIT_UUID";
  }

  if (normalized.includes("timezone içermelidir")) {
    return "MISSING_TIMEZONE";
  }

  if (/limit/.test(normalized) && /(1\s*ile\s*200|1\.\.200|between\s*1\s*and\s*200)/.test(normalized)) {
    return "LIMIT_OUT_OF_RANGE";
  }

  if (/offset/.test(normalized) && /(>=\s*0|0\s*veya\s*daha\s*büyük|non-?negative)/.test(normalized)) {
    return "OFFSET_OUT_OF_RANGE";
  }

  return "LOAD_FAILED";
}

export function normalizeExportTelemetryError(input: unknown): ExportTelemetryErrorResult {
  const rawMessage = extractRawMessage(input).trim();
  const code = detectTelemetryErrorCode(rawMessage);

  if (code === "LOAD_FAILED" && rawMessage) {
    return {
      code,
      message: rawMessage,
      rawMessage,
    };
  }

  return {
    code,
    message: EXPORT_TELEMETRY_ERROR_MESSAGES[code],
    rawMessage,
  };
}

export function resolveExportTelemetryErrorMessage(input: unknown): string {
  return normalizeExportTelemetryError(input).message;
}
