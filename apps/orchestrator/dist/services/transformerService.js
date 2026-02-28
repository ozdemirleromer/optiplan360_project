"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformerService = void 0;
const errors_1 = require("../domain/errors");
function toMillimeter(valueCm, multiplier) {
    return Number((valueCm * multiplier).toFixed(2));
}
function mapEdge(value, edgeMapping) {
    const key = value ?? "Bant Yok";
    if (!(key in edgeMapping)) {
        throw new Error(errors_1.ERROR_CODES.E_EDGE_MAPPING_UNKNOWN);
    }
    return edgeMapping[key] ?? null;
}
function resolveTrim(thickness, trimMap) {
    const key = String(thickness);
    if (!(key in trimMap)) {
        throw new Error(errors_1.ERROR_CODES.E_TRIM_RULE_MISSING);
    }
    return trimMap[key];
}
function normalizeGrain(input, grainMap) {
    const key = String(input);
    if (!(key in grainMap)) {
        throw new Error(errors_1.ERROR_CODES.E_INVALID_GRAIN);
    }
    return grainMap[key];
}
function hasEdgeInput(part) {
    return [part.edge_up, part.edge_lo, part.edge_sx, part.edge_dx].some((value) => value !== undefined && value !== null && value !== "" && value !== "Bant Yok");
}
class TransformerService {
    transform(parts, rules, plateSize) {
        const batches = new Map();
        let backingEdgeResetCount = 0;
        for (const part of parts) {
            if (part.part_type === "ARKALIK" && !rules.backingThicknesses.includes(part.thickness_mm)) {
                throw new Error(errors_1.ERROR_CODES.E_BACKING_THICKNESS_UNKNOWN);
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
            const row = {
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
            batches.get(key).rows.push(row);
        }
        return {
            plate_size: plateSize,
            batches: [...batches.values()],
            backing_edge_reset_count: backingEdgeResetCount,
        };
    }
}
exports.TransformerService = TransformerService;
