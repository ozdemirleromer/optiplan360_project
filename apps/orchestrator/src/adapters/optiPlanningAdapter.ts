import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ERROR_CODES } from "../domain/errors";
import type { OptiMode } from "../domain/job";

export interface TriggerInput {
  mode: OptiMode;
  optiplanningExePath: string;
  importFiles: string[];
}

export class OptiPlanningAdapter {
  trigger(input: TriggerInput): { operatorActionRequired: boolean } {
    if (input.mode === "C") {
      return { operatorActionRequired: true };
    }

    if (input.mode === "B") {
      const macroPath = path.join(path.dirname(input.optiplanningExePath), "RunOptiPlanning.xls");
      if (!fs.existsSync(macroPath)) {
        throw new Error(ERROR_CODES.E_OPTI_MODE_B_MACRO_MISSING);
      }
      return { operatorActionRequired: false };
    }

    if (!fs.existsSync(input.optiplanningExePath)) {
      throw new Error(ERROR_CODES.E_OPTI_MODE_A_RUNNER_MISSING);
    }

    const result = spawnSync(input.optiplanningExePath, input.importFiles, {
      shell: true,
      windowsHide: true,
      timeout: 60_000,
      stdio: "ignore",
    });

    if (result.status !== 0) {
      throw new Error(ERROR_CODES.E_OPTI_RUNNER_FAILED);
    }

    return { operatorActionRequired: false };
  }
}
