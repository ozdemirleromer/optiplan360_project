import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import type { OptiMode } from "../domain/job";

const plateSizeSchema = z.object({
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
});

export const pathsConfigSchema = z.object({
  optiplanningExePath: z.string(),
  optiplanningImportFolder: z.string(),
  optiplanningExportFolder: z.string(),
  optiplanningRulesFolder: z.string(),
  machineDropFolder: z.string(),
  tempFolder: z.string(),
  xlsxTemplatePath: z.string(),
});

export const rulesConfigSchema = z.object({
  cm_to_mm_multiplier: z.number().positive(),
  trimByThickness: z.record(z.number().positive()),
  backingThicknesses: z.array(z.number().positive()),
  edgeMapping: z.record(z.number().nullable()),
  grainMapping: z.record(z.number().int().min(0).max(3)),
  mergePolicy: z.object({
    defaultDisabled: z.boolean(),
    requiresOperatorApproval: z.boolean(),
  }),
  defaultPlateSize: plateSizeSchema.optional(),
  retry_count_max: z.number().int().min(0),
  retry_backoff_minutes: z.array(z.number().positive()),
  optiModeDefault: z.custom<OptiMode>((value) => value === "A" || value === "B" || value === "C"),
  timeouts: z.object({
    optiXmlMinutes: z.number().positive(),
    osiAckMinutes: z.number().positive(),
  }),
  ackMode: z.literal("file_move"),
});

export type PathsConfig = z.infer<typeof pathsConfigSchema>;
export type RulesConfig = z.infer<typeof rulesConfigSchema>;

function resolveConfigPath(fileName: string): string {
  const local = path.resolve(process.cwd(), "config", fileName);
  if (fs.existsSync(local)) {
    return local;
  }

  const fallback = path.resolve(process.cwd(), "..", "..", "config", fileName);
  if (fs.existsSync(fallback)) {
    return fallback;
  }

  throw new Error(`Config file not found: ${fileName}`);
}

export function loadPathsConfig(): PathsConfig {
  const file = resolveConfigPath("paths.json");
  const raw = fs.readFileSync(file, "utf-8");
  return pathsConfigSchema.parse(JSON.parse(raw));
}

export function loadRulesConfig(): RulesConfig {
  const file = resolveConfigPath("rules.json");
  const raw = fs.readFileSync(file, "utf-8");
  return rulesConfigSchema.parse(JSON.parse(raw));
}
