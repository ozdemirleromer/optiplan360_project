import type { WorkflowFileStatus } from "./optiplanWorkflowTypes";
import type { WorkflowExportRunResult } from "../../services/optiplanWorkflowService";

export type ExportNoticeTone = "info" | "success" | "warning" | "danger";

export function getExportNoticeTone(
  result: WorkflowExportRunResult | null,
): ExportNoticeTone | null {
  if (!result) return null;
  if (result.durum === "HATALI") return "danger";
  if (result.durum === "KISMI_BASARILI") return "warning";
  if (result.durum === "BASARILI") return "success";
  return "warning";
}

export function mapExportResultToRecordStatus(
  result: WorkflowExportRunResult,
  mode: "workflow" | "excel",
  currentStatus: WorkflowFileStatus,
): WorkflowFileStatus {
  if (mode !== "workflow") return currentStatus;
  if (result.durum === "BASARILI") return "TAMAMLANDI";
  if (result.durum === "HATALI") return "HATALI";
  return "EXPORT_ONIZLEME";
}