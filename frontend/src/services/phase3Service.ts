/**
 * Phase 3 (Siparis Kontrol) API servisi — master spec v3.
 * Tüm /api/phase3/* endpoint çağrıları burada.
 */
import { apiRequest } from "./apiClient";
import {
  optiplanWorkflowService,
  type WorkflowBandThickness,
  type WorkflowGrain,
  type WorkflowLookupCustomer,
  type WorkflowLookupStock,
  type WorkflowPlate,
  type WorkflowRecord,
  type WorkflowRow,
} from "./optiplanWorkflowService";
import type { Phase1QueueListResponse } from "./phase1Service";

const fetchWithAuth = apiRequest;

const BASE = "/api/phase3";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export interface Phase3OrderHeader {
  recordId: string;
  customerMatchStatus: string;
  customerCode: string | null;
  customerName: string | null;
  customerPhone?: string | null;
  fireAciklamasi?: string | null;
  sourceType: string;
  operatorName: string | null;
  updatedAt: string;
}

export interface Phase3OrderLine {
  rowIndex: number;
  plateId: string | null;
  materialText: string | null;
  stockMatchStatus: string;
  stockCode: string | null;
  boy: string | null;
  en: string | null;
  adet: number | null;
  yon: string | null;
  aciklama: string | null;
  bantUst: string | null;
  bantAlt: string | null;
  bantSol: string | null;
  bantSag: string | null;
  ilaveAciklama: string | null;
  aciklama1: string | null;
  mergeCandidate: boolean;
  scrapNoteRequired: boolean;
  scrapNote: string | null;
  status: string;
}

export interface Phase3PlateGroup {
  plateId: string;
  label: string;
  lineCount: number;
  blockerCount: number;
  active: boolean;
}

export interface Phase3Summary {
  customerBlocker: boolean;
  stockBlockerCount: number;
  mergePendingCount: number;
  scrapNoteMissingCount: number;
  phase4Ready: boolean;
}

export interface Phase3RecordDetail {
  header: Phase3OrderHeader;
  plateGroups: Phase3PlateGroup[];
  lines: Phase3OrderLine[];
  summary: Phase3Summary;
}

export interface Phase3CustomerMatchResult {
  ok: boolean;
  recordId: string;
  customerCode: string;
  customerName: string | null;
  customerMatchStatus: string;
}

export interface Phase3StockMatchResult {
  ok: boolean;
  recordId: string;
  rowIndex: number;
  stockCode: string;
  stockMatchStatus: string;
  unmatchedCount: number;
}

export interface Phase3MergeRowsResult {
  ok: boolean;
  recordId: string;
  targetRowIndex: number;
  mergedRowIndexes: number[];
  totalAdet: number;
}

export interface Phase3ScrapNoteResult {
  ok: boolean;
  recordId: string;
  note: string;
  affectedRowCount: number;
  scrapNoteRequired: boolean;
}

export interface Phase3MovePhase4Result {
  ok: boolean;
  recordId: string;
  status?: string | null;
  errorCode?: string | null;
  message?: string | null;
}

export type Phase3DraftPayload = {
  cariUnvan: string;
  cariKodu: string;
  siparisNo: string;
  termin: string;
  teslimTarihi: string;
  teslimatAdresi: string;
  odemeSekli: string;
  malzeme: string;
  stokKodu: string;
  bantKalinligi: WorkflowBandThickness;
  grainVarsayilan: WorkflowGrain;
  plakaBoyMm: number | null;
  plakaEnMm: number | null;
  fireAciklamasi: string;
  rows: WorkflowRow[];
  plates: WorkflowPlate[];
};

export type {
  WorkflowLookupCustomer,
  WorkflowLookupStock,
  WorkflowPlate,
  WorkflowRecord,
  WorkflowRow,
};

// ---------------------------------------------------------------------------
// API fonksiyonları
// ---------------------------------------------------------------------------

export async function getPhase3Queue(
  params: { page?: number; pageSize?: number } = {},
): Promise<Phase1QueueListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return fetchWithAuth<Phase1QueueListResponse>(`${BASE}/queue${qs}`);
}

export async function getPhase3RecordDetail(recordId: string): Promise<Phase3RecordDetail> {
  return fetchWithAuth<Phase3RecordDetail>(`${BASE}/records/${recordId}`);
}

export async function matchCustomer(
  recordId: string,
  customerCode: string,
): Promise<Phase3CustomerMatchResult> {
  return fetchWithAuth<Phase3CustomerMatchResult>(`${BASE}/customer-match`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId, customer_code: customerCode }),
  });
}

export async function matchStock(
  recordId: string,
  rowIndex: number,
  stockCode: string,
): Promise<Phase3StockMatchResult> {
  return fetchWithAuth<Phase3StockMatchResult>(`${BASE}/stock-match`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId, row_index: rowIndex, stock_code: stockCode }),
  });
}

export async function mergeRows(
  recordId: string,
  rowIndexes: number[],
): Promise<Phase3MergeRowsResult> {
  return fetchWithAuth<Phase3MergeRowsResult>(`${BASE}/merge-rows`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId, row_indexes: rowIndexes }),
  });
}

export async function addScrapNote(
  recordId: string,
  note: string,
): Promise<Phase3ScrapNoteResult> {
  return fetchWithAuth<Phase3ScrapNoteResult>(`${BASE}/scrap-note`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId, note }),
  });
}

export async function moveToPhase4(recordId: string): Promise<Phase3MovePhase4Result> {
  return fetchWithAuth<Phase3MovePhase4Result>(`${BASE}/move-phase4`, {
    method: "POST",
    body: JSON.stringify({ record_id: recordId }),
  });
}

export async function lookupCustomers(query: string): Promise<WorkflowLookupCustomer[]> {
  return optiplanWorkflowService.lookupCustomers(query);
}

export async function lookupStocks(query: string): Promise<WorkflowLookupStock[]> {
  return optiplanWorkflowService.lookupStocks(query);
}

export async function updatePhase3Draft(
  kayitUuid: string,
  payload: Phase3DraftPayload,
): Promise<WorkflowRecord> {
  return optiplanWorkflowService.updatePhase3(kayitUuid, payload);
}

