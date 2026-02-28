import { ERROR_CODES } from "../domain/errors";
import type { JobPartInput, PlateSize } from "../domain/job";
import type { RulesConfig } from "../config/loadConfig";

export interface TransformResultRow {
  P_CODE_MAT: string;
  P_LENGTH: number;
  P_WIDTH: number;
  P_MINQ: number;
  P_GRAIN: number;
  P_IDESC: string;
  P_EDGE_MAT_UP: number | null;
  P_EGDE_MAT_LO: number | null;
  P_EDGE_MAT_SX: number | null;
  P_EDGE_MAT_DX: number | null;
  P_IIDESC: string;
  P_DESC1: string;
}

export interface TransformBatch {
  key: string;
  part_type: "GOVDE" | "ARKALIK";
  color: string;
  thickness_mm: number;
  rows: TransformResultRow[];
}

export interface TransformOutput {
  plate_size: PlateSize;
  batches: TransformBatch[];
  backing_edge_reset_count: number;
}

function toMillimeter(valueCm: number, multiplier: number): number {
  return Number((valueCm * multiplier).toFixed(2));
}

function mapEdge(value: string | null | undefined, edgeMapping: Record<string, number | null>): number | null {
  const key = value ?? "Bant Yok";
  if (!(key in edgeMapping)) {
    throw new Error(ERROR_CODES.E_EDGE_MAPPING_UNKNOWN);
  }
  return edgeMapping[key] ?? null;
}

function resolveTrim(thickness: number, trimMap: Record<string, number>): number {
  const key = String(thickness);
  if (!(key in trimMap)) {
    throw new Error(ERROR_CODES.E_TRIM_RULE_MISSING);
  }
  return trimMap[key];
}

function normalizeGrain(input: number, grainMap: Record<string, number>): number {
  const key = String(input);
  if (!(key in grainMap)) {
    throw new Error(ERROR_CODES.E_INVALID_GRAIN);
  }
  return grainMap[key];
}

function hasEdgeInput(part: JobPartInput): boolean {
  return [part.edge_up, part.edge_lo, part.edge_sx, part.edge_dx].some(
    (value) => value !== undefined && value !== null && value !== "" && value !== "Bant Yok",
  );
}

export class TransformerService {
  transform(parts: JobPartInput[], rules: RulesConfig, plateSize: PlateSize): TransformOutput {
    const batches = new Map<string, TransformBatch>();
    let backingEdgeResetCount = 0;

    for (const part of parts) {
      if (part.part_type === "ARKALIK" && !rules.backingThicknesses.includes(part.thickness_mm)) {
        throw new Error(ERROR_CODES.E_BACKING_THICKNESS_UNKNOWN);
      }

      const trim = resolveTrim(part.thickness_mm, rules.trimByThickness);
      const pLength = toMillimeter(part.length_cm, rules.cm_to_mm_multiplier);
      const pWidth = toMillimeter(part.width_cm, rules.cm_to_mm_multiplier);
      const grain = normalizeGrain(part.grain, rules.grainMapping);

      const isBacking = part.part_type === "ARKALIK";
      if (isBacking && hasEdgeInput(part)) {
        backingEdgeResetCount += 1;
      }

      const edgeUp = isBacking ? null : mapEdge(part.edge_up, rules.edgeMapping);
      const edgeLo = isBacking ? null : mapEdge(part.edge_lo, rules.edgeMapping);
      const edgeSx = isBacking ? null : mapEdge(part.edge_sx, rules.edgeMapping);
      const edgeDx = isBacking ? null : mapEdge(part.edge_dx, rules.edgeMapping);

      const row: TransformResultRow = {
        P_CODE_MAT: part.material_code,
        P_LENGTH: pLength,
        P_WIDTH: pWidth,
        P_MINQ: part.quantity,
        P_GRAIN: grain,
        P_IDESC: `${part.part_type}_${part.id}_TRIM_${trim.toFixed(2)}`,
        P_EDGE_MAT_UP: edgeUp,
        P_EGDE_MAT_LO: edgeLo,
        P_EDGE_MAT_SX: edgeSx,
        P_EDGE_MAT_DX: edgeDx,
        P_IIDESC: part.iidesc ?? "",
        P_DESC1: part.desc1 ?? "",
      };

      const key = `${part.part_type}__${part.color}__${part.thickness_mm}`;
      if (!batches.has(key)) {
        batches.set(key, {
          key,
          part_type: part.part_type,
          color: part.color,
          thickness_mm: part.thickness_mm,
          rows: [],
        });
      }

      batches.get(key)!.rows.push(row);
    }

    return {
      plate_size: plateSize,
      batches: [...batches.values()],
      backing_edge_reset_count: backingEdgeResetCount,
    };
  }
}
