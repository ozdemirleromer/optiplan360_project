const MIN_PARTS_COUNT = 0;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getPartCount(parts: unknown, fallback = MIN_PARTS_COUNT): number {
  if (Array.isArray(parts)) {
    return parts.length;
  }

  const parsed = toFiniteNumber(parts);
  if (parsed !== null) {
    return Math.max(MIN_PARTS_COUNT, Math.trunc(parsed));
  }

  return fallback;
}
