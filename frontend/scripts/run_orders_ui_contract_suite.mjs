import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const reportPath = path.resolve(projectRoot, "tmp/orders-ui-contracts-report.json");
mkdirSync(path.dirname(reportPath), { recursive: true });

const DEFAULT_TIMEOUT_MS = Number(process.env.ORDERS_UI_CONTRACT_STEP_TIMEOUT_MS ?? 0);
const mode = process.argv[2] ?? "default";
const isSilent = mode === "silent";

const vitestBaseArgs = ["--run"];
if (isSilent) {
  vitestBaseArgs.push("--silent=true");
}

const commands = [
  {
    label: "Orders workflow helper contracts",
    command: "npm",
    args: [
      "run",
      "test",
      "--",
      ...vitestBaseArgs,
      "src/features/Orders/workflowWorkspaceUtils.test.ts",
    ],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    label: "Orders workflow UI contracts",
    command: "npm",
    args: [
      "run",
      "test",
      "--",
      ...vitestBaseArgs,
      "src/features/Orders/workflowWorkspaceUI.test.tsx",
    ],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    label: "Orders order-entry contracts",
    command: "npm",
    args: [
      "run",
      "test",
      "--",
      ...vitestBaseArgs,
      "src/features/Orders/OrderEntry/__tests__/OrderMetaBar.test.tsx",
      "src/features/Orders/OrderEntry/__tests__/OrderEntryScreen.test.tsx",
    ],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
];

const report = {
  generatedAt: new Date().toISOString(),
  mode,
  status: "passed",
  failReason: null,
  totalDurationMs: 0,
  totalSteps: commands.length,
  steps: [],
};

for (const step of commands) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  console.log(`\n[orders-ui-contracts] ${step.label} baslatiliyor...`);

  const result = spawnSync(step.command, step.args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: step.timeoutMs > 0 ? step.timeoutMs : undefined,
    env: process.env,
  });

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAtMs;
  report.totalDurationMs += durationMs;

  const stepResult = {
    label: step.label,
    command: step.command,
    args: step.args,
    timeoutMs: step.timeoutMs,
    startedAt,
    finishedAt,
    exitCode: result.status ?? 1,
    durationMs,
    failReason: (result.status ?? 1) === 0 ? null : "command-exit-nonzero",
  };
  report.steps.push(stepResult);

  if (result.status !== 0) {
    report.status = "failed";
    report.failReason = `${step.label}:${stepResult.failReason}`;
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.exit(result.status ?? 1);
  }
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`[orders-ui-contracts] Rapor olusturuldu: ${reportPath}`);
console.log("[orders-ui-contracts] Tum adimlar basariyla tamamlandi.");
