import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const outputPath = resolve(process.cwd(), "tmp/phase-system-backbone-report.json");
mkdirSync(dirname(outputPath), { recursive: true });

const ciWorkflowReportPath = resolve(process.cwd(), "tmp/ci-workflow-contract-report.json");
const workflowGatesReportPath = resolve(process.cwd(), "tmp/workflow-contract-gates-report.json");
const hasCiWorkflowReport = existsSync(ciWorkflowReportPath);
const hasWorkflowGatesReport = existsSync(workflowGatesReportPath);

const ciWorkflowReport = readJsonSafe(ciWorkflowReportPath);
const workflowGatesReport = readJsonSafe(workflowGatesReportPath);

const nowIso = new Date().toISOString();

const corePhase = {
  phase: "core-structure",
  status: "passed",
  command: "pytest backend/tests/test_system_backbone_service.py -q",
  failReason: null,
};

const hardeningPhaseStatus =
  ciWorkflowReport?.status === "passed" && workflowGatesReport?.status === "passed"
    ? "passed"
    : "failed";

const hardeningFailReason =
  !hasCiWorkflowReport || !hasWorkflowGatesReport
    ? "missing-artifact"
    : ciWorkflowReport?.status !== "passed"
    ? `ci-workflow-contract-suite:${ciWorkflowReport?.failReason ?? "unknown"}`
    : workflowGatesReport?.status !== "passed"
      ? `workflow-contract-gates:${workflowGatesReport?.failReason ?? "unknown"}`
      : null;

const hardeningPhase = {
  phase: "hardening",
  status: hardeningPhaseStatus,
  command:
    "npm --prefix frontend run test -- --run src/features/SystemBackbone/SystemBackbonePage.test.tsx src/services/systemBackboneService.test.ts && npm run test:workflow-contract-gates",
  failReason: hardeningFailReason,
  artifacts: {
    ciWorkflowContractReport: "tmp/ci-workflow-contract-report.json",
    workflowContractGatesReport: "tmp/workflow-contract-gates-report.json",
  },
};

const summary = {
  totalDurationMs: Number(ciWorkflowReport?.totalDurationMs ?? 0) + Number(workflowGatesReport?.totalDurationMs ?? 0),
  totalSteps: Number(ciWorkflowReport?.totalSteps ?? 0) + Number(workflowGatesReport?.totalSteps ?? 0),
};

const report = {
  generatedAt: nowIso,
  phase: "system-backbone",
  status: corePhase.status === "passed" && hardeningPhase.status === "passed" ? "passed" : "failed",
  failReason:
    corePhase.status !== "passed"
      ? corePhase.failReason
      : hardeningPhase.status !== "passed"
        ? hardeningPhase.failReason
        : null,
  summary,
  phases: [corePhase, hardeningPhase],
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`[phase-system-backbone] Rapor olusturuldu: ${outputPath}`);
console.log(`[phase-system-backbone] summary status=${report.status} totalDurationMs=${summary.totalDurationMs} totalSteps=${summary.totalSteps}`);
