import type {
  WorkflowBandThickness,
  WorkflowFileStatus,
  WorkflowGrain,
  WorkflowPreviewRow,
  WorkflowRecord,
} from "./optiplanWorkflowTypes";
import { WORKFLOW_STATUS_LABELS } from "./workflowUiContract";

export const OPTIPLAN_SOURCE_LABELS: Record<WorkflowRecord["kaynakKlasor"], string> = {
  whatsapp_raw: "whatsapp_raw",
  scanner_raw: "scanner_raw",
  manuel_raw: "manuel_raw",
  email_raw: "email_raw",
};

export const OPTIPLAN_STATUS_LABELS: Record<WorkflowFileStatus, string> = WORKFLOW_STATUS_LABELS;

export const OPTIPLAN_GRAIN_OPTIONS: ReadonlyArray<WorkflowGrain> = [0, 1, 2, 3] as const;
export const OPTIPLAN_BAND_OPTIONS: ReadonlyArray<WorkflowBandThickness> = ["0.40 MM", "1 MM", "2 MM"] as const;
export const OPTIPLAN_PHASE2_CONFIDENCE_FIELDS = ["boy", "en", "adet"] as const;

export const OPTIPLAN_EXPORT_HEADERS: ReadonlyArray<{ key: keyof WorkflowPreviewRow; label: string }> = [
  { key: "pCodeMat", label: "[P_CODE_MAT]" },
  { key: "pLength", label: "[P_LENGTH]" },
  { key: "pWidth", label: "[P_WIDTH]" },
  { key: "pMinq", label: "[P_MINQ]" },
  { key: "pGrain", label: "[P_GRAIN]" },
  { key: "pIdesc", label: "[P_IDESC]" },
  { key: "pEdgeMatUp", label: "[P_EDGE_MAT_UP]" },
  { key: "pEgdeMatLo", label: "[P_EGDE_MAT_LO]" },
  { key: "pEdgeMatSx", label: "[P_EDGE_MAT_SX]" },
  { key: "pEdgeMatDx", label: "[P_EDGE_MAT_DX]" },
  { key: "pIidesc", label: "[P_IIDESC]" },
  { key: "pDesc1", label: "[P_DESC1]" },
] as const;
