import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const tmpDir = resolve(process.cwd(), "tmp");
const MAX_AGE_HOURS = Number(process.env.TMP_REPORT_MAX_AGE_HOURS ?? 48);
const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;

if (!existsSync(tmpDir)) {
  console.log("[clean-tmp-reports] tmp dizini bulunamadi, islem atlandi.");
  process.exit(0);
}

const now = Date.now();
let removed = 0;
const prefixes = [
  "ci-workflow-contract-report",
  "workflow-contract-gates-report",
  "phase-system-backbone-report"
];

for (const entry of readdirSync(tmpDir)) {
  const path = resolve(tmpDir, entry);
  const matchesPrefix = prefixes.some((prefix) => entry.startsWith(prefix));
  if (!matchesPrefix) {
    continue;
  }

  const ageMs = now - statSync(path).mtimeMs;
  if (ageMs > maxAgeMs) {
    rmSync(path, { force: true });
    removed += 1;
  }
}

console.log(`[clean-tmp-reports] temizlenen_dosya=${removed} max_age_hours=${MAX_AGE_HOURS}`);
