/**
 * Phase 2 OCR Kontrol — TypeScript Type Definitions
 *
 * [DOKUMAN] Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.1, 5.4, 5.5
 *
 * Frontend - Backend type alignment:
 * - BlockerReasonCode
 * - ErrorReasonCategory
 * - CellApprovalStatus
 * - Phase2DecisionEventType
 * + 15 interface type'ı (validation, decision, gate, audit, batch, undo, metrics)
 */

/**
 * Blocker Neden Kodları
 * [DOKUMAN] Bölüm 5.1 — Validasyon kuralları
 */
export type BlockerReasonCode =
  | "CONFIDENCE_LOW"           // Güven < eşik
  | "TYPE_INVALID"             // Sayı değil
  | "RANGE_OUT_OF_BOUNDS"      // Min/Max sınırı dışı
  | "UNIT_MISMATCH"            // Birim hatası
  | "CONSISTENCY_MISMATCH"     // Tutarlılık sorunu
  | "OCR_COMMON_ERROR"         // Sık OCR hatası
  | "OPERATOR_APPROVED"        // Operatör onayladı
  | "OPERATOR_OVERRIDE"        // Operatör override yaptı
  | "OPERATOR_MARKED_ERROR"    // Operatör hatalı işaretledi
  | "UNDO";                    // Geri alındı

/**
 * Hata Kategorileri
 * [DOKUMAN] Bölüm 5.4 — "Hatalı İşaretle" modalı
 */
export type ErrorReasonCategory =
  | "OCR_MISREAD"              // OCR yanış okudu
  | "CONFIDENCE_FALSE"         // Güven hatalı
  | "SUPPLIER_DATA"            // Fornisseur hatası
  | "MEASUREMENT_ERROR"        // Ölçüm hatası
  | "SPEC_CHANGE"              // Spesifikasyon değişikliği
  | "SYSTEM_ERROR"             // Sistem hatası
  | "OTHER";                   // Diğer

/**
 * Hücre Onay Durumu
 */
export type CellApprovalStatus =
  | "PENDING"                  // Beklemede
  | "APPROVED"                 // Onaylı
  | "REJECTED"                 // Red
  | "OVERRIDE";                // Override

/**
 * Decision Event Tipi
 */
export type Phase2DecisionEventType =
  | "CELL_DECIDED"             // Hücre karar
  | "CELL_UNDONE"              // Karar geri alındı
  | "ROW_APPROVED"             // Satır onaylandı
  | "ERROR_MARKED"             // Hata işareti
  | "ERROR_UNMARKED";          // Hata işareti kaldırıldı

/**
 * Blocker Detayı
 * [DOKUMAN] Bölüm 5.1
 */
export interface CellBlocker {
  reasonCode: BlockerReasonCode;
  operatorMessage: string;            // Türkçe, anlaşılır
  isBlocker: boolean;                 // Gate'ye etki ediyor mu
  severity: "critical" | "warning";
  confidenceScore: number;
  suggestedValue?: number;
}

/**
 * Doğrulama Sonucu
 */
export interface ValidateCellResponse {
  isValid: boolean;
  blockers: CellBlocker[];
  message: string;
  proposedValue?: number;
}

/**
 * Hücre Karar İsteği
 * [DOKUMAN] Bölüm 5.5
 */
export interface CellDecideRequest {
  recordUuid: string;
  rowId: string;
  fieldType: "boy" | "en" | "adet";
  action: "APPROVE" | "APPLY_SUGGESTION" | "OVERRIDE_WITH_VALUE" | "MARK_ERROR";
  value?: number;
  reason?: BlockerReasonCode;
  errorCategory?: ErrorReasonCategory;
  operatorNote?: string;
  idempotencyKey?: string;
}

/**
 * Hücre Karar Sonucu
 */
export interface CellDecideResponse {
  success: boolean;
  message: string;
  idempotencyId?: string;
  cached: boolean;
  cellState: {
    rowId: string;
    fieldType: "boy" | "en" | "adet";
    approved: boolean;
  };
  nextBlockingCell?: { rowId: string; fieldType: string };
  gateStatus: "BLOCKED" | "READY";
}

/**
 * Phase 3 Gate Blocker Detayı
 */
export interface BlockerReasonDetail {
  rowId: string;
  fieldType: "boy" | "en" | "adet";
  reasonCode: BlockerReasonCode;
  operatorMessage: string;
  suggestedAction?: string;
  confidenceScore: number;
  severity: "critical" | "warning";
}

/**
 * Phase 3 Gate Durumu
 * [DOKUMAN] Bölüm 5.5
 */
export interface Phase3GateStatusResponse {
  canProceed: boolean;
  message: string;
  blockerReasons: BlockerReasonDetail[];
  summary: {
    totalBlockers: number;
    criticalCount: number;
    warningCount: number;
  };
  gateCheckTime: string; // ISO timestamp
}

/**
 * Karar Event (Audit Log)
 */
export interface DecisionEvent {
  id: string;
  createdAt: string;                   // ISO timestamp
  recordUuid: string;
  rowId: string;
  fieldType: "boy" | "en" | "adet";
  eventType: Phase2DecisionEventType;
  oldValue?: number;
  newValue?: number;
  actorUserId?: number;
  actorUserName?: string;
  decisionReason?: BlockerReasonCode;
  operatorNote?: string;
  confidenceBefore?: number;            // Güven skoru değişimi (Undo History)
  confidenceAfter?: number;           // Güven skoru değişimi (Undo History)
}

/**
 * Undo Record
 */
export interface UndoRecord {
  timestamp: string;                   // ISO timestamp
  action: Phase2DecisionEventType;
  oldState: Record<string, unknown>;
  newState: Record<string, unknown>;
  userName: string;
}

/**
 * Toplu Onay Query
 */
export interface BatchApproveQuery {
  fieldType?: "boy" | "en" | "adet";
  confidenceRange?: [number, number];  // [min, max] %
  reason?: BlockerReasonCode;
}

/**
 * Toplu Onay Dry-Run Sonucu
 */
export interface BatchApproveDryRunResponse {
  dryRunId: string;
  affectedCount: number;
  affectedCells: Array<{
    rowId: string;
    fieldType: "boy" | "en" | "adet";
    oldConfidence: number;
    newApprovalStatus: CellApprovalStatus;
  }>;
  estimatedImpact: {
    blockersRemaining: number;
    gateStatusAfter: "BLOCKED" | "READY";
  };
}

/**
 * Toplu Onay Commit Sonucu
 */
export interface BatchApproveCommitResponse {
  success: boolean;
  appliedCount: number;
  message: string;
  gateStatus: "BLOCKED" | "READY";
}

/**
 * Undo İsteği
 */
export interface UndoRequest {
  recordUuid: string;
  decisionEventId: string;
  idempotencyKey?: string;
}

/**
 * Undo Sonucu
 */
export interface UndoResponse {
  success: boolean;
  message: string;
  revertedEventId: string;
  gateStatus: "BLOCKED" | "READY";
}

/**
 * Audit Trail
 */
export interface AuditTrailResponse {
  recordUuid: string;
  totalEvents: number;
  events: DecisionEvent[];
}

/**
 * Phase 2 Metrikleri (Telemetri)
 * [DOKUMAN] Bölüm 5.10
 */
export interface Phase2Metrics {
  recordUuid: string;
  totalDecisions: number;
  totalUndos: number;
  errorMarkedCount: number;
  undoFrequency: number;    // % 
  reasonCodeDistribution: Record<BlockerReasonCode, number>;
}
