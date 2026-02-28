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
