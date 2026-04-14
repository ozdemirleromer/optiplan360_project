import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateConfigShape } from "./ci_workflow_contract_engine/core.mjs";

const configPath = resolve(
  process.cwd(),
  "scripts/ci_workflow_contracts.config.json",
);
const config = JSON.parse(readFileSync(configPath, "utf8"));

const errors = [...validateConfigShape(config)];

if (!Array.isArray(config.workflowAllowList) || config.workflowAllowList.length === 0) {
  errors.push("workflowAllowList bos olmamali ve string dizisi olmalidir.");
}

if (!Array.isArray(config.contracts) || config.contracts.length === 0) {
  errors.push("contracts bos olmamali ve dizi olmalidir.");
}

const workflowContracts = (config.contracts ?? [])
  .map((contract) => contract.path)
  .filter((path) => typeof path === "string" && path.startsWith(".github/workflows/"));

const uniqueWorkflowContracts = [...new Set(workflowContracts)].sort();
const allowListSorted = [...(config.workflowAllowList ?? [])].sort();

for (const path of allowListSorted) {
  if (!uniqueWorkflowContracts.includes(path)) {
    errors.push(`AllowList kaydi icin contract eksik: ${path}`);
  }
}

for (const path of uniqueWorkflowContracts) {
  if (!allowListSorted.includes(path)) {
    errors.push(`Workflow contract kaydi allowList icinde yok: ${path}`);
  }
}

for (const contract of config.contracts ?? []) {
  const hasRule =
    (contract.allOf?.length ?? 0) > 0 ||
    (contract.forbiddenAllOf?.length ?? 0) > 0 ||
    (contract.anyOf?.length ?? 0) > 0 ||
    (contract.ordered?.length ?? 0) > 0;

  if (!hasRule) {
    errors.push(`Contract kurali bos: ${contract.path}`);
  }
}

if (errors.length > 0) {
  console.error("[ci-workflow-contract-config] Config dogrulamasi basarisiz:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[ci-workflow-contract-config] Config dogrulamasi basarili.");
