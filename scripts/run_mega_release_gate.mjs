import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const reportPath = resolve(process.cwd(), "tmp/mega-release-gate-report.json");
mkdirSync(dirname(reportPath), { recursive: true });
const failReasonsPath = resolve(process.cwd(), "scripts/contracts/fail_reasons.json");
const failReasons = JSON.parse(readFileSync(failReasonsPath, "utf8"));
const DEFAULT_TIMEOUT_MS = Number(process.env.MEGA_GATE_STEP_TIMEOUT_MS ?? 0);

function normalizeFailReason(code) {
  if (failReasons.allowed.includes(code)) {
    return code;
  }
  return "spawn-error";
}

function classifyFailure(error) {
  if (error && String(error.code ?? "").toUpperCase() === "ETIMEDOUT") {
    return normalizeFailReason("timeout");
  }
  if (error && typeof error.message === "string" && error.message.toLowerCase().includes("timed out")) {
    return normalizeFailReason("timeout");
  }
  return normalizeFailReason("spawn-error");
}

const commands = [
  {
    command: "npm",
    args: ["run", "test:workflow-contract-gates"],
    label: "Workflow contract gates",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    command: "npm",
    args: ["run", "validate:report:ci-workflow-contract"],
    label: "CI workflow contract report validation",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    command: "npm",
    args: ["run", "validate:report:workflow-contract-gates"],
    label: "Workflow gates report validation",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
];

const report = {
  generatedAt: new Date().toISOString(),
  status: "passed",
  failReason: null,
  totalDurationMs: 0,
  totalSteps: commands.length,
  steps: [],
};

for (const step of commands) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  console.log(`\n[mega-release-gate] ${step.label} baslatiliyor...`);

  let result;
  let failReason = null;
  try {
    result = spawnSync(step.command, step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      timeout: step.timeoutMs > 0 ? step.timeoutMs : undefined,
    });
    if (result.error) {
      failReason = classifyFailure(result.error);
    }
  } catch (error) {
    result = { status: 1 };
    failReason = classifyFailure(error);
  }

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
    failReason: (result.status ?? 1) === 0 ? null : failReason ?? "command-exit-nonzero",
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
console.log(`[mega-release-gate] Rapor olusturuldu: ${reportPath}`);
console.log("\n[mega-release-gate] Tum adimlar basariyla tamamlandi.");
