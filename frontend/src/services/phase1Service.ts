/**
 * Phase 1 (OCR Havuzu) API servisi — master spec v3.
 * Tüm /api/phase1/* endpoint çağrıları burada.
 */
import { apiRequest } from "./apiClient";

/** Kısa alias — tüm çağrılarda kullanılır. */
const fetchWithAuth = apiRequest;

const BASE = "/api/phase1";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export type Phase1RecordStatus =
  | "RECEIVED"
  | "DUPLICATE"
  | "PROCESSING"
  | "OCR_PROCESSING"
  | "PHASE2_PENDING"
  | "OCR_RETRY_PENDING"
  | "FAULTY"
  | "MANUAL_REVIEW_REQUIRED"
  | "PHASE2_IN_PROGRESS"
  | "PHASE3_PENDING"
  | "PHASE3_IN_PROGRESS"
  | "PHASE4_PENDING"
  | "PHASE4_PREVIEW_READY"
  | "PHASE4_EXPORT_RUNNING"
  | "PHASE4_EXPORT_FAILED"
  | "PHASE4_RETRY_PENDING"
  | "COMPLETED";

export type ApprovalStatus =
  | "UNREVIEWED"
  | "LOW_CONFIDENCE"
  | "APPROVED_AS_IS"
  | "OVERRIDDEN"
  | "READ_ONLY";

export type MatchStatus = "UNMATCHED" | "MATCHED" | "MANUAL_MATCHED" | "BLOCKED";

export type FolderHealthStatus = "HEALTHY" | "WARNING" | "OFFLINE" | "ERROR";

export type ErrorSeverity = "INFO" | "WARNING" | "RETRYABLE" | "FATAL";

export interface Phase1QueueRecord {
  recordId: string;
  uuid: string;
  fileName: string;
  sourceType: string;
  ocrProvider?: string | null;
  ocrEngine?: string | null;
  folderType: string;
  status: Phase1RecordStatus;
  duplicateFlag: boolean;
  duplicateReason: string | null;
  retryCount: number;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  nextRetryAt: string | null;
  phase2Ready: boolean;
  imageUrl?: string | null;
}

export interface Phase1LifecycleEvent {
  fromStatus: string | null;
  toStatus: string;
  triggeredAt: string;
  triggeredBy: string;
  note: string | null;
}

export interface Phase1FolderHealth {
  folderType: string;
  isActive: boolean;
  healthStatus: FolderHealthStatus;
  lastScanAt: string | null;
  lastFileAt: string | null;
  recordCount: number;
  physicalPath: string | null;
}

export interface Phase1QueueDetailDto {
  record: Phase1QueueRecord;
  folderHealth: Phase1FolderHealth | null;
  lifecycle: Phase1LifecycleEvent[];
}

export interface Phase1QueueListResponse {
  items: Phase1QueueRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Phase1ErrorRecord {
  recordId: string;
  fileName: string;
  status: Phase1RecordStatus;
  errorSeverity: ErrorSeverity | null;
  errorType: string | null;
  lastErrorMessage: string | null;
  retryCount: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
}

export interface Phase1StatusSummary {
  totalCount: number;
  duplicateCount: number;
  retryCount: number;
  errorCount: number;
  phase2ReadyCount: number;
  manualReviewCount: number;
  activeFolderCount: number;
}

export interface Phase2Field {
  fieldName: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidenceScore: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  approvalStatus: ApprovalStatus;
  overrideValue: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface Phase2Row {
  rowIndex: number;
  fields: Phase2Field[];
}

export interface Phase2RecordDetail {
  recordId: string;
  status: Phase1RecordStatus;
  sourceType: string;
  imageUrl: string | null;
  createdAt: string;
  blockerCount: number;
  rows: Phase2Row[];
}

// ---------------------------------------------------------------------------
// Filtre parametreleri
// ---------------------------------------------------------------------------

export interface Phase1QueueParams {
  search?: string;
  status?: string;
  sourceType?: string;
  folderType?: string;
  duplicate?: boolean;
  retryOnly?: boolean;
  phase2Ready?: boolean;
  manualReviewOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// API fonksiyonları
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    // camelCase → snake_case dönüşümü
    const snakeKey = key.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
    q.set(snakeKey, String(value));
  }
  return q.toString() ? `?${q.toString()}` : "";
}

export async function getPhase1Queue(params: Phase1QueueParams = {}): Promise<Phase1QueueListResponse> {
  const qs = buildQuery(params as Record<string, unknown>);
  return fetchWithAuth<Phase1QueueListResponse>(`${BASE}/queue${qs}`);
}

export async function getPhase1RecordDetail(recordId: string): Promise<Phase1QueueDetailDto> {
  return fetchWithAuth<Phase1QueueDetailDto>(`${BASE}/queue/${recordId}`);
}

export async function getPhase1StatusSummary(): Promise<Phase1StatusSummary> {
  return fetchWithAuth<Phase1StatusSummary>(`${BASE}/status-summary`);
}

export async function getPhase1Errors(): Promise<{ items: Phase1ErrorRecord[] }> {
  return fetchWithAuth<{ items: Phase1ErrorRecord[] }>(`${BASE}/errors`);
}

export async function getPhase1FolderHealth(): Promise<{ items: Phase1FolderHealth[] }> {
  return fetchWithAuth<{ items: Phase1FolderHealth[] }>(`${BASE}/folder-health`);
}

export async function postManualRetry(recordId: string): Promise<{ ok: boolean; message: string }> {
  return fetchWithAuth<{ ok: boolean; message: string }>(`${BASE}/manual-retry`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId }),
  });
}

export async function postBatchRetry(recordIds: string[]): Promise<{ ok: boolean; message: string; processedCount: number }> {
  return fetchWithAuth<{ ok: boolean; message: string; processedCount: number }>(`${BASE}/batch-retry`, {
    method: "POST",
    body: JSON.stringify({ record_ids: recordIds }),
  });
}

export async function postManualRescan(folderType: string): Promise<{ ok: boolean; message: string }> {
  return fetchWithAuth<{ ok: boolean; message: string }>(`${BASE}/manual-rescan`, {
    method: "POST",
    body: JSON.stringify({ folder_type: folderType }),
  });
}

export async function getPhase2Queue(
  params: { page?: number; pageSize?: number } = {},
): Promise<Phase1QueueListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return fetchWithAuth<Phase1QueueListResponse>(`${BASE}/phase2/queue${qs}`);
}

export async function getPhase2RecordDetail(recordId: string): Promise<Phase2RecordDetail> {
  return fetchWithAuth<Phase2RecordDetail>(`${BASE}/phase2/records/${recordId}`);
}

export async function approveCell(
  recordId: string,
  rowIndex: number,
  fieldName: string,
): Promise<{ ok: boolean; blockerCount: number }> {
  return fetchWithAuth<{ ok: boolean; blockerCount: number }>(
    `${BASE}/phase2/records/${recordId}/cells/approve`,
    {
      method: "PATCH",
      body: JSON.stringify({ row_index: rowIndex, field_name: fieldName, mode: "APPROVE_AS_IS" }),
    },
  );
}

export async function overrideCell(
  recordId: string,
  rowIndex: number,
  fieldName: string,
  overrideValue: string,
): Promise<{ ok: boolean; blockerCount: number; normalizedValue: string }> {
  return fetchWithAuth<{ ok: boolean; blockerCount: number; normalizedValue: string }>(
    `${BASE}/phase2/records/${recordId}/cells/override`,
    {
      method: "PATCH",
      body: JSON.stringify({ row_index: rowIndex, field_name: fieldName, override_value: overrideValue }),
    },
  );
}

export async function markFaulty(recordId: string, note?: string): Promise<{ ok: boolean }> {
  return fetchWithAuth<{ ok: boolean }>(`${BASE}/phase2/records/${recordId}/mark-faulty`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function moveToPhase3(recordId: string): Promise<{ ok: boolean; errorCode?: string; message?: string }> {
  return fetchWithAuth<{ ok: boolean; errorCode?: string; message?: string }>(
    `${BASE}/phase2/records/${recordId}/move-phase3`,
    { method: "POST" },
  );
}
