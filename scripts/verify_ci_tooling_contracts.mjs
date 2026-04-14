import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = resolve(process.cwd(), "scripts/ci_tooling_contracts.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

const failures = [];

for (const contract of config.contracts ?? []) {
  const absolutePath = resolve(process.cwd(), contract.path);
  const content = readFileSync(absolutePath, "utf8");

  const missingAllOf = (contract.allOf ?? []).filter((snippet) => !content.includes(snippet));
  const forbiddenAllOf = (contract.forbiddenAllOf ?? []).filter((snippet) => content.includes(snippet));

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

  if (missingAllOf.length > 0 || forbiddenAllOf.length > 0 || orderedViolations.length > 0) {
    failures.push({
      path: contract.path,
      missingAllOf,
      forbiddenAllOf,
      orderedViolations,
    });
  }
}

if (failures.length > 0) {
  if (jsonOutput) {
    console.error(JSON.stringify({ status: "failed", failures }, null, 2));
    process.exit(1);
  }

  console.error("[ci-tooling-contract] Tooling sozlesmesi ihlalleri bulundu:");
  for (const failure of failures) {
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

    if (failure.orderedViolations.length > 0) {
      console.error("  * Siralama ihlalleri:");
      for (const sequence of failure.orderedViolations) {
        console.error(`    - ${sequence.join(" -> ")}`);
      }
    }
  }
  process.exit(1);
}

if (jsonOutput) {
  console.log(JSON.stringify({ status: "passed", failures: [] }, null, 2));
  process.exit(0);
}

console.log("[ci-tooling-contract] Tooling sozlesmeleri dogrulandi.");
