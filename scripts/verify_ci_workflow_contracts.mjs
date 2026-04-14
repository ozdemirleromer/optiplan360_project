import {
  getArgValue,
  loadConfig,
  runContractVerification,
} from "./ci_workflow_contract_engine/core.mjs";

const args = process.argv.slice(2);
const strictUnknown = args.includes("--strict-unknown");
const configArg = getArgValue(args, "--config") ?? "scripts/ci_workflow_contracts.config.json";
const workflowsDirArg = getArgValue(args, "--workflows-dir") ?? ".github/workflows";

const { config, configErrors } = loadConfig({
  rootDir: process.cwd(),
  configArg,
});

if (configErrors.length > 0) {
  console.error("[ci-workflow-contract] Config yapisi gecersiz:");
  for (const error of configErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const verification = runContractVerification({
  rootDir: process.cwd(),
  config,
  workflowsDirArg,
  strictUnknown,
});

if (verification.strictUnknownFailed) {
  console.error("[ci-workflow-contract] Strict unknown workflow kontrolu basarisiz:");

  if (verification.strictUnknownIssues.unknownWorkflows.length > 0) {
    console.error("  * Allowlist disinda workflow bulundu:");
    for (const workflowPath of verification.strictUnknownIssues.unknownWorkflows) {
      console.error(`    - ${workflowPath}`);
    }
  }

  if (verification.strictUnknownIssues.missingAllowListEntries.length > 0) {
    console.error("  * Allowlistte olup repoda bulunamayan workflow kaydi var:");
    for (const workflowPath of verification.strictUnknownIssues.missingAllowListEntries) {
      console.error(`    - ${workflowPath}`);
    }
  }

  process.exit(1);
}

if (verification.failures.length > 0) {
  console.error("[ci-workflow-contract] Eksik workflow/action sozlesmeleri bulundu:");
  for (const failure of verification.failures) {
    console.error(`\n- ${failure.path}`);
    if (failure.missingAllOf.length > 0) {
      console.error("  * Eksik allOf snippetleri:");
      for (const snippet of failure.missingAllOf) {
        console.error(`    - ${snippet}`);
      }
    }
    if (failure.forbiddenAllOf.length > 0) {
      console.error("  * Ihlal edilen forbiddenAllOf snippetleri:");
      for (const snippet of failure.forbiddenAllOf) {
        console.error(`    - ${snippet}`);
      }
    }
    if (failure.missingAnyOf.length > 0) {
      console.error("  * Saglanmayan anyOf gruplari:");
      for (const alternatives of failure.missingAnyOf) {
        console.error(`    - ${alternatives.join(" || ")}`);
      }
    }
    if (failure.orderedViolations.length > 0) {
      console.error("  * Siralama ihlalleri:");
      for (const sequence of failure.orderedViolations) {
        console.error(`    - ${sequence.join(" -> ")}`);
      }
    }
  }
  process.exit(1);
}

console.log(
  "[ci-workflow-contract] Tum workflow/action sozlesmeleri dogrulandi.",
);
