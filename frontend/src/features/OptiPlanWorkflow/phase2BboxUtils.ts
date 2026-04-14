import type { WorkflowRow } from "../../services/optiplanWorkflowService";
import type { ConfidenceField } from "./phase2GridTypes";

export type Phase2BboxRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Phase2BboxItem = {
  field: string;
  bbox: Phase2BboxRect;
};

export function supportsPhase2CanvasOverlay(): boolean {
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }

  return typeof HTMLCanvasElement !== "undefined"
    && typeof HTMLCanvasElement.prototype.getContext === "function";
}

export function getPhase2BboxItems(row: WorkflowRow | null | undefined): Phase2BboxItem[] {
  if (!row || !Array.isArray(row.bboxJson)) {
    return [];
  }

  return row.bboxJson.filter((item): item is Phase2BboxItem => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<Phase2BboxItem>;
    return typeof candidate.field === "string"
      && typeof candidate.bbox?.x === "number"
      && typeof candidate.bbox?.y === "number"
      && typeof candidate.bbox?.w === "number"
      && typeof candidate.bbox?.h === "number";
  });
}

export function phase2BboxFieldMatches(field: string | undefined, selectedField: ConfidenceField | null): boolean {
  if (!field || !selectedField) return false;
  return field.toLocaleLowerCase("tr-TR").includes(selectedField);
}

export function findPhase2SelectedBbox(
  row: WorkflowRow | null | undefined,
  selectedField: ConfidenceField | null,
): Phase2BboxItem | null {
  return getPhase2BboxItems(row).find((item) => phase2BboxFieldMatches(item.field, selectedField)) ?? null;
}

type Phase2BboxFocusPanParams = {
  bbox: Phase2BboxRect;
  naturalWidth: number;
  naturalHeight: number;
  clientWidth: number;
  clientHeight: number;
  currentZoom: number;
  minZoom?: number;
};

export function getPhase2BboxFocusPan({
  bbox,
  naturalWidth,
  naturalHeight,
  clientWidth,
  clientHeight,
  currentZoom,
  minZoom = 1.45,
}: Phase2BboxFocusPanParams): { targetZoom: number; panX: number; panY: number } | null {
  if (naturalWidth <= 0 || naturalHeight <= 0 || clientWidth <= 0 || clientHeight <= 0) {
    return null;
  }

  const targetZoom = Math.max(currentZoom, minZoom);
  const centerX = bbox.x + bbox.w / 2;
  const centerY = bbox.y + bbox.h / 2;
  const xRatio = centerX / naturalWidth;
  const yRatio = centerY / naturalHeight;

  return {
    targetZoom,
    panX: (clientWidth / 2 - xRatio * clientWidth) * targetZoom,
    panY: (clientHeight / 2 - yRatio * clientHeight) * targetZoom,
  };
}
