import { apiRequest } from "./apiClient";

const BASE = "/api/phase4";

export type Phase4RecordStatus =
  | "PHASE4_PENDING"
  | "PHASE4_PREVIEW_READY"
  | "PHASE4_EXPORT_RUNNING"
  | "PHASE4_EXPORT_FAILED"
  | "PHASE4_RETRY_PENDING"
  | "COMPLETED";

export type FolderHealthStatus = "HEALTHY" | "WARNING" | "OFFLINE" | "ERROR";

export interface Phase4QueueItem {
  recordId: string;
  status: Phase4RecordStatus;
  customerCode: string | null;
  documentName: string;
  exportType: "XLSX";
  manifestId: string | null;
  retryCount: number;
  lastErrorMessage: string | null;
  fireRequired: boolean;
  updatedAt: string;
}

export interface Phase4QueueListResponse {
  items: Phase4QueueItem[];
}

export interface Phase4RecordSummary {
  recordId: string;
  status: Phase4RecordStatus;
  customerCode: string | null;
  exportType: "XLSX";
  outputFileName: string | null;
  previewReady: boolean;
  manifestId: string | null;
  retryCount: number;
  lastErrorMessage: string | null;
  fireRequired: boolean;
  phase4Ready: boolean;
}

export interface Phase4MappingSummary {
  locked: boolean;
  profileName: string;
}

export interface Phase4FolderHealthSummary {
  outputFolderStatus: FolderHealthStatus;
  previewFolderStatus: FolderHealthStatus;
  manifestArchiveStatus: FolderHealthStatus;
  lastWriteAt: string | null;
}

export interface Phase4RecordDetail {
  record: Phase4RecordSummary;
  mappingSummary: Phase4MappingSummary;
  folderHealth: Phase4FolderHealthSummary;
}

export interface Phase4ManifestItem {
  manifestId: string;
  recordId: string;
  exportType: "XLSX";
  fileName: string;
  createdAt: string;
  status: "CREATED";
}

export interface Phase4ManifestListResponse {
  items: Phase4ManifestItem[];
}

export interface Phase4FolderHealthItem {
  folderType: string;
  healthStatus: FolderHealthStatus;
  lastWriteAt: string | null;
}

export interface Phase4FolderHealthListResponse {
  items: Phase4FolderHealthItem[];
}

export type Phase4PreviewLine = Record<string, string | number | boolean | null>;

export interface Phase4PreviewData {
  customerCode?: string | null;
  customerName?: string | null;
  lines: Phase4PreviewLine[];
  lineCount: number;
}

export interface Phase4PreviewResponse {
  ok: boolean;
  recordId: string;
  status: Phase4RecordStatus | null;
  previewData: Phase4PreviewData | null;
  errorCode: string | null;
  message: string | null;
}

export interface Phase4ExportResponse {
  ok: boolean;
  recordId: string;
  status: Phase4RecordStatus | null;
  exportPath: string | null;
  manifestPath: string | null;
  manifestId: string | null;
  outputFileName: string | null;
  errorCode: string | null;
  message: string | null;
}

export interface Phase4MappingRow {
  sourceField: string;
  targetField: string;
}

export const PHASE4_MAPPING_CONTRACT: readonly Phase4MappingRow[] = [
  { sourceField: "Malzeme", targetField: "[P_CODE_MAT]" },
  { sourceField: "BOY", targetField: "[P_LENGTH]" },
  { sourceField: "EN", targetField: "[P_WIDTH]" },
  { sourceField: "ADET", targetField: "[P_MINQ]" },
  { sourceField: "GRAIN", targetField: "[P_GRAIN]" },
  { sourceField: "BILGI", targetField: "[P_IDESC]" },
  { sourceField: "U1", targetField: "[P_EDGE_MAT_UP]" },
  { sourceField: "U2", targetField: "[P_EGDE_MAT_LO]" },
  { sourceField: "K1", targetField: "[P_EDGE_MAT_SX]" },
  { sourceField: "K2", targetField: "[P_EDGE_MAT_DX]" },
  { sourceField: "DELIK-1", targetField: "[P_IIDESC]" },
  { sourceField: "DELIK-2", targetField: "[P_DESC1]" },
] as const;

export function canCreatePhase4Preview(status: Phase4RecordStatus | null | undefined): boolean {
  return status === "PHASE4_PENDING";
}

export function canRunPhase4Export(status: Phase4RecordStatus | null | undefined): boolean {
  return status === "PHASE4_PREVIEW_READY" || status === "PHASE4_RETRY_PENDING";
}

export function canRunPhase4Retry(status: Phase4RecordStatus | null | undefined): boolean {
  return status === "PHASE4_EXPORT_FAILED";
}

export async function getPhase4Queue(): Promise<Phase4QueueListResponse> {
  return apiRequest<Phase4QueueListResponse>(`${BASE}/queue`);
}

export async function getPhase4RecordDetail(recordId: string): Promise<Phase4RecordDetail> {
  return apiRequest<Phase4RecordDetail>(`${BASE}/records/${recordId}`);
}

export async function getPhase4Manifests(): Promise<Phase4ManifestListResponse> {
  return apiRequest<Phase4ManifestListResponse>(`${BASE}/manifests`);
}

export async function getPhase4FolderHealth(): Promise<Phase4FolderHealthListResponse> {
  return apiRequest<Phase4FolderHealthListResponse>(`${BASE}/folder-health`);
}

export async function createPhase4Preview(recordId: string): Promise<Phase4PreviewResponse> {
  return apiRequest<Phase4PreviewResponse>(`${BASE}/preview`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId }),
  });
}

export async function exportPhase4Record(recordId: string): Promise<Phase4ExportResponse> {
  return apiRequest<Phase4ExportResponse>(`${BASE}/export`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId }),
  });
}

export async function retryPhase4Record(recordId: string): Promise<Phase4ExportResponse> {
  return apiRequest<Phase4ExportResponse>(`${BASE}/retry`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId, decision: "RETRY_NOW" }),
  });
}
