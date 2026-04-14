import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function getArgValue(args, flagName) {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} icin deger girilmelidir.`);
  }

  return value;
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateConfigShape(config) {
  const errors = [];

  if (!Array.isArray(config.contracts)) {
    errors.push("contracts alani dizi olmalidir.");
  }

  if (
    config.workflowAllowList !== undefined &&
    !isStringArray(config.workflowAllowList)
  ) {
    errors.push("workflowAllowList alani string dizisi olmalidir.");
  }

  if (!Array.isArray(config.contracts)) {
    return errors;
  }

  const seenPaths = new Set();

  for (const contract of config.contracts) {
    if (typeof contract.path !== "string" || contract.path.length === 0) {
      errors.push("Her contract kaydinda path zorunlu ve string olmalidir.");
      continue;
    }

    if (seenPaths.has(contract.path)) {
      errors.push(`Ayni contract path birden fazla kez tanimli: ${contract.path}`);
    }
    seenPaths.add(contract.path);

    if (contract.allOf !== undefined && !isStringArray(contract.allOf)) {
      errors.push(`${contract.path} icin allOf string dizisi olmalidir.`);
    }

    if (contract.forbiddenAllOf !== undefined && !isStringArray(contract.forbiddenAllOf)) {
      errors.push(`${contract.path} icin forbiddenAllOf string dizisi olmalidir.`);
    }

    if (contract.anyOf !== undefined) {
      const validAnyOf =
        Array.isArray(contract.anyOf) &&
        contract.anyOf.every((group) => isStringArray(group));
      if (!validAnyOf) {
        errors.push(`${contract.path} icin anyOf string dizilerinden olusmalidir.`);
      }
    }

    if (contract.ordered !== undefined) {
      const validOrdered =
        Array.isArray(contract.ordered) &&
        contract.ordered.every((sequence) => isStringArray(sequence));
      if (!validOrdered) {
        errors.push(`${contract.path} icin ordered string dizilerinden olusmalidir.`);
      }
    }
  }

  return errors;
}

export function loadConfig({ rootDir, configArg }) {
  const configPath = resolve(rootDir, configArg);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const configErrors = validateConfigShape(config);
  return {
    config,
    configErrors,
  };
}

function evaluateContract({ contract, content }) {
  const missingAllOf = (contract.allOf ?? []).filter(
    (snippet) => !content.includes(snippet),
  );

  const forbiddenAllOf = (contract.forbiddenAllOf ?? []).filter((snippet) =>
    content.includes(snippet),
  );

  const missingAnyOf = [];
  for (const alternatives of contract.anyOf ?? []) {
    const matched = alternatives.some((snippet) => content.includes(snippet));
    if (!matched) {
      missingAnyOf.push(alternatives);
    }
  }

  const orderedViolations = [];
  for (const sequence of contract.ordered ?? []) {
    let previousIndex = -1;
    let violated = false;

    for (const snippet of sequence) {
      const index = content.indexOf(snippet);
      if (index === -1 || index < previousIndex) {
        violated = true;
        break;
      }
      previousIndex = index;
    }

    if (violated) {
      orderedViolations.push(sequence);
    }
  }

  return {
    missingAllOf,
    forbiddenAllOf,
    missingAnyOf,
    orderedViolations,
  };
}

export function runContractVerification({
  rootDir,
  config,
  workflowsDirArg,
  strictUnknown,
}) {
  const strictUnknownIssues = {
    unknownWorkflows: [],
    missingAllowListEntries: [],
  };

  if (strictUnknown) {
    const workflowsDir = resolve(rootDir, workflowsDirArg);
    const discoveredWorkflows = readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith(".yml"))
      .map((fileName) => `${workflowsDirArg}/${fileName}`)
      .sort();

    const allowList = [...(config.workflowAllowList ?? [])].sort();
    strictUnknownIssues.unknownWorkflows = discoveredWorkflows.filter(
      (path) => !allowList.includes(path),
    );
    strictUnknownIssues.missingAllowListEntries = allowList.filter(
      (path) => !discoveredWorkflows.includes(path),
    );
  }

  const failures = [];

  for (const contract of config.contracts) {
    const absolutePath = resolve(rootDir, contract.path);
    const content = readFileSync(absolutePath, "utf8");
    const result = evaluateContract({ contract, content });

    if (
      result.missingAllOf.length > 0 ||
      result.forbiddenAllOf.length > 0 ||
      result.missingAnyOf.length > 0 ||
      result.orderedViolations.length > 0
    ) {
      failures.push({
        path: contract.path,
        ...result,
      });
    }
  }

  const strictUnknownFailed =
    strictUnknownIssues.unknownWorkflows.length > 0 ||
    strictUnknownIssues.missingAllowListEntries.length > 0;

  return {
    failures,
    strictUnknownIssues,
    strictUnknownFailed,
    passed: !strictUnknownFailed && failures.length === 0,
  };
}