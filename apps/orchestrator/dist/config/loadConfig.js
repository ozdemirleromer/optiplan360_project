"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rulesConfigSchema = exports.pathsConfigSchema = void 0;
exports.loadPathsConfig = loadPathsConfig;
exports.loadRulesConfig = loadRulesConfig;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const zod_1 = require("zod");
const plateSizeSchema = zod_1.z.object({
    width_mm: zod_1.z.number().positive(),
    height_mm: zod_1.z.number().positive(),
});
exports.pathsConfigSchema = zod_1.z.object({
    optiplanningExePath: zod_1.z.string(),
    optiplanningImportFolder: zod_1.z.string(),
    optiplanningExportFolder: zod_1.z.string(),
    optiplanningRulesFolder: zod_1.z.string(),
    machineDropFolder: zod_1.z.string(),
    tempFolder: zod_1.z.string(),
    xlsxTemplatePath: zod_1.z.string(),
});
exports.rulesConfigSchema = zod_1.z.object({
    cm_to_mm_multiplier: zod_1.z.number().positive(),
    trimByThickness: zod_1.z.record(zod_1.z.number().positive()),
    backingThicknesses: zod_1.z.array(zod_1.z.number().positive()),
    edgeMapping: zod_1.z.record(zod_1.z.number().nullable()),
    grainMapping: zod_1.z.record(zod_1.z.number().int().min(0).max(3)),
    mergePolicy: zod_1.z.object({
        defaultDisabled: zod_1.z.boolean(),
        requiresOperatorApproval: zod_1.z.boolean(),
    }),
    defaultPlateSize: plateSizeSchema.optional(),
    retry_count_max: zod_1.z.number().int().min(0),
    retry_backoff_minutes: zod_1.z.array(zod_1.z.number().positive()),
    optiModeDefault: zod_1.z.custom((value) => value === "A" || value === "B" || value === "C"),
    timeouts: zod_1.z.object({
        optiXmlMinutes: zod_1.z.number().positive(),
        osiAckMinutes: zod_1.z.number().positive(),
    }),
    ackMode: zod_1.z.literal("file_move"),
});
function resolveConfigPath(fileName) {
    const local = node_path_1.default.resolve(process.cwd(), "config", fileName);
    if (node_fs_1.default.existsSync(local)) {
        return local;
    }
    const fallback = node_path_1.default.resolve(process.cwd(), "..", "..", "config", fileName);
    if (node_fs_1.default.existsSync(fallback)) {
        return fallback;
    }
    throw new Error(`Config file not found: ${fileName}`);
}
function loadPathsConfig() {
    const file = resolveConfigPath("paths.json");
    const raw = node_fs_1.default.readFileSync(file, "utf-8");
    return exports.pathsConfigSchema.parse(JSON.parse(raw));
}
function loadRulesConfig() {
    const file = resolveConfigPath("rules.json");
    const raw = node_fs_1.default.readFileSync(file, "utf-8");
    return exports.rulesConfigSchema.parse(JSON.parse(raw));
}
