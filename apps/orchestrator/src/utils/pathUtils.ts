import path from "node:path";

export function withExtension(fileName: string, nextExt: string): string {
  const parsed = path.parse(fileName);
  return `${parsed.name}${nextExt.startsWith(".") ? nextExt : `.${nextExt}`}`;
}

export function toSafeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
