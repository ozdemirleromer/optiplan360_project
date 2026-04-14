import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const vitestBin = resolve(__dirname, "../node_modules/vitest/vitest.mjs");
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [vitestBin, "--run", ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_CJS_IGNORE_WARNING: "1",
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
