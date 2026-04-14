import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function runFixtureTest({ fixture, shouldPass, args = [] }) {
  const fixturePath = resolve(process.cwd(), "scripts/fixtures/ci-workflow-contracts", fixture);
  const verifierScript = resolve(process.cwd(), "scripts/verify_ci_workflow_contracts.mjs");

  const commandArgs = [
    verifierScript,
    "--config",
    "config.json",
    "--workflows-dir",
    ".github/workflows",
    ...args,
  ];

  const result = spawnSync("node", commandArgs, {
    cwd: fixturePath,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (shouldPass && result.status !== 0) {
    console.error(`[ci-workflow-contract-selftest] Beklenen PASS ama FAIL: ${fixture}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }

  if (!shouldPass && result.status === 0) {
    console.error(`[ci-workflow-contract-selftest] Beklenen FAIL ama PASS: ${fixture}`);
    process.exit(1);
  }
}

runFixtureTest({
  fixture: "ok",
  shouldPass: true,
  args: ["--strict-unknown"],
});

runFixtureTest({
  fixture: "missing-snippet",
  shouldPass: false,
  args: ["--strict-unknown"],
});

runFixtureTest({
  fixture: "unknown-workflow",
  shouldPass: false,
  args: ["--strict-unknown"],
});

runFixtureTest({
  fixture: "forbidden-direct-run",
  shouldPass: false,
  args: ["--strict-unknown"],
});

console.log("[ci-workflow-contract-selftest] Tum fixture testleri basarili.");
