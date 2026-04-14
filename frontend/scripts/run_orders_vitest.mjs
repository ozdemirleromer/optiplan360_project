import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const ordersRoot = path.resolve(projectRoot, "src", "features", "Orders");
const vitestCli = path.resolve(projectRoot, "node_modules", "vitest", "vitest.mjs");
const mode = process.argv[2] ?? "full";

function collectTestFiles(dirPath) {
  const entries = readdirSync(dirPath).sort((left, right) => left.localeCompare(right, "tr"));
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) {
      files.push(path.relative(projectRoot, fullPath).replace(/\\/g, "/"));
    }
  }

  return files;
}

const files = collectTestFiles(ordersRoot);
if (files.length === 0) {
  console.error("Orders test dosyasi bulunamadi.");
  process.exit(1);
}

const args = [vitestCli, "--run"];
if (mode === "coverage") {
  args.push("--coverage", "--coverage.include=src/features/Orders/**");
}
args.push(...files);

const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
