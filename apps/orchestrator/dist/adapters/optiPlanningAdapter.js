"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptiPlanningAdapter = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const errors_1 = require("../domain/errors");
class OptiPlanningAdapter {
    trigger(input) {
        if (input.mode === "C") {
            return { operatorActionRequired: true };
        }
        if (input.mode === "B") {
            const macroPath = node_path_1.default.join(node_path_1.default.dirname(input.optiplanningExePath), "RunOptiPlanning.xls");
            if (!node_fs_1.default.existsSync(macroPath)) {
                throw new Error(errors_1.ERROR_CODES.E_OPTI_MODE_B_MACRO_MISSING);
            }
            return { operatorActionRequired: false };
        }
        if (!node_fs_1.default.existsSync(input.optiplanningExePath)) {
            throw new Error(errors_1.ERROR_CODES.E_OPTI_MODE_A_RUNNER_MISSING);
        }
        const result = (0, node_child_process_1.spawnSync)(input.optiplanningExePath, input.importFiles, {
            shell: true,
            windowsHide: true,
            timeout: 60_000,
            stdio: "ignore",
        });
        if (result.status !== 0) {
            throw new Error(errors_1.ERROR_CODES.E_OPTI_RUNNER_FAILED);
        }
        return { operatorActionRequired: false };
    }
}
exports.OptiPlanningAdapter = OptiPlanningAdapter;
