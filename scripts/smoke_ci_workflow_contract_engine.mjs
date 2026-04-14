import { loadConfig, runContractVerification } from "./ci_workflow_contract_engine/core.mjs";

const { config, configErrors } = loadConfig({
  rootDir: process.cwd(),
  configArg: "scripts/ci_workflow_contracts.config.json",
});

if (configErrors.length > 0) {
  console.error("[ci-workflow-contract-engine-smoke] Config hatasi bulundu.");
  process.exit(1);
}

const verification = runContractVerification({
  rootDir: process.cwd(),
  config,
  workflowsDirArg: ".github/workflows",
  strictUnknown: true,
});

if (!verification.passed) {
  console.error("[ci-workflow-contract-engine-smoke] Engine smoke FAIL.");
  process.exit(1);
}

console.log("[ci-workflow-contract-engine-smoke] Engine smoke PASS.");
