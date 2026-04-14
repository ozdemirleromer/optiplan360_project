import { ORDER_ROUTE_META, type NavigationRouteMeta } from "../../components/Layout/orderNavigationContract";
import type { WorkflowFileStatus, WorkflowPhase } from "./optiplanWorkflowTypes";

export type LegacyOrderWorkflowStatus = "pending_ocr" | "ocr_validated" | "ready";

export const WORKFLOW_PHASE_ROUTE_META: Record<WorkflowPhase, NavigationRouteMeta> = {
  1: ORDER_ROUTE_META.workflowInbox,
  2: ORDER_ROUTE_META.workflowReview,
  3: ORDER_ROUTE_META.workflowEditing,
  4: ORDER_ROUTE_META.workflowExport,
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowFileStatus, string> = {
  OCR_HAVUZU: WORKFLOW_PHASE_ROUTE_META[1].title,
  OCR_KONTROL: WORKFLOW_PHASE_ROUTE_META[2].title,
  SIPARIS_DUZENLEME: WORKFLOW_PHASE_ROUTE_META[3].title,
  EXPORT_ONIZLEME: WORKFLOW_PHASE_ROUTE_META[4].title,
  TAMAMLANDI: "Tamamlandı",
  HATALI: "Hatalı",
};

export const LEGACY_ORDER_WORKFLOW_STATUS_LABELS: Record<LegacyOrderWorkflowStatus, string> = {
  pending_ocr: "OCR Bekleniyor",
  ocr_validated: "OCR Onaylandı",
  ready: "Hazır",
};

export const WORKFLOW_ACTION_LABELS = {
  backToInbox: WORKFLOW_PHASE_ROUTE_META[1].navLabel,
  advanceToReview: WORKFLOW_PHASE_ROUTE_META[2].navLabel,
  advanceToEditing: WORKFLOW_PHASE_ROUTE_META[3].navLabel,
  advanceToExport: WORKFLOW_PHASE_ROUTE_META[4].navLabel,
  backToEditing: WORKFLOW_PHASE_ROUTE_META[3].navLabel,
  exportExcel: "Excel",
  print: "Yazdır",
  sendToOptimization: "Optimizasyona Gönder",
} as const;
