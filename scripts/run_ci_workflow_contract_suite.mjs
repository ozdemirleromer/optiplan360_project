import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const reportPath = resolve(process.cwd(), "tmp/ci-workflow-contract-report.json");
mkdirSync(dirname(reportPath), { recursive: true });
const failReasonsPath = resolve(process.cwd(), "scripts/contracts/fail_reasons.json");
const failReasons = JSON.parse(readFileSync(failReasonsPath, "utf8"));

const DEFAULT_TIMEOUT_MS = Number(process.env.CI_WORKFLOW_STEP_TIMEOUT_MS ?? 0);

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

const steps = [
  {
    name: "tooling-contracts",
    command: "npm",
    args: ["run", "test:ci-tooling-contracts"],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: "engine-smoke",
    command: "npm",
    args: ["run", "test:ci-workflow-contracts:engine-smoke"],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: "config",
    command: "npm",
    args: ["run", "test:ci-workflow-contracts:config"],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: "selftest",
    command: "npm",
    args: ["run", "test:ci-workflow-contracts:selftest"],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: "strict-unknown",
    command: "npm",
    args: ["run", "test:ci-workflow-contracts:strict-unknown"],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
];

const report = {
  generatedAt: new Date().toISOString(),
  status: "passed",
  failReason: null,
  totalDurationMs: 0,
  totalSteps: steps.length,
  steps: [],
};

for (const step of steps) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

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
    name: step.name,
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

  if ((result.status ?? 1) !== 0) {
    report.status = "failed";
    report.failReason = `${step.name}:${stepResult.failReason}`;
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.exit(result.status ?? 1);
  }
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`[ci-workflow-contract-suite] Rapor olusturuldu: ${reportPath}`);
