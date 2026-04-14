/**
 * Phase 2 OCR Kontrol — Frontend Constants & Lookups
 *
 * Enum to display label mappings, field thresholds, action descriptions
 */

import type {
  BlockerReasonCode,
  ErrorReasonCategory,
  CellApprovalStatus,
} from "./phase2_types";

// ============================================================================
// Blocker Reason Code → Türkçe Küme + Aksiyon Açıklaması
// ============================================================================

export const BLOCKER_REASON_CODES: Record<BlockerReasonCode, string> = {
  CONFIDENCE_LOW: "Düşük Güven Skoru",
  TYPE_INVALID: "Geçersiz Tür",
  RANGE_OUT_OF_BOUNDS: "Aralık Dışı",
  UNIT_MISMATCH: "Birim Hatası",
  CONSISTENCY_MISMATCH: "Tutarlılık Sorunu",
  OCR_COMMON_ERROR: "Sık OCR Hatası",
  OPERATOR_APPROVED: "Operatör Onayladı",
  OPERATOR_OVERRIDE: "Operatör Override",
  OPERATOR_MARKED_ERROR: "Hata İşareti",
  UNDO: "Geri Alındı",
};

// ============================================================================
// Error Reason Category → Türkçe Açıklama
// ============================================================================

export const ERROR_REASON_CATEGORIES: Record<ErrorReasonCategory, string> = {
  OCR_MISREAD: "OCR Yanlış Okudu",
  CONFIDENCE_FALSE: "Güven Hatalı",
  SUPPLIER_DATA: "Tedarikçi Hatası",
  MEASUREMENT_ERROR: "Ölçüm Hatası",
  SPEC_CHANGE: "Spesifikasyon Değişimi",
  SYSTEM_ERROR: "Sistem Hatası",
  OTHER: "Diğer",
};

// ============================================================================
// Cell Approval Status → Türkçe Etiket
// ============================================================================

export const CELL_APPROVAL_STATUS_LABELS: Record<CellApprovalStatus, string> =
  {
    PENDING: "Beklemede",
    APPROVED: "Onaylı",
    REJECTED: "Red",
    OVERRIDE: "Override",
  };

// ============================================================================
// Field Type → Türkçe İsim (Boy, En, Adet)
// ============================================================================

export const FIELD_TYPE_LABELS: Record<"boy" | "en" | "adet", string> = {
  boy: "Boy (mm)",
  en: "En (mm)",
  adet: "Adet",
};

// ============================================================================
// Field Type → Confidence Threshold (%)
// [DOKUMAN] Bölüm 5.2 Table: Boys 75%, En 80%, Adet 85%
// ============================================================================

export const CONFIDENCE_THRESHOLDS: Record<"boy" | "en" | "adet", number> = {
  boy: 75,
  en: 80,
  adet: 85,
};

// ============================================================================
// Cell Decision Actions
// ============================================================================

export const CELL_DECISION_ACTIONS = {
  APPROVE: { label: "Onayla", color: "green" },
  APPLY_SUGGESTION: { label: "Önerimi Uygula", color: "blue" },
  OVERRIDE_WITH_VALUE: { label: "Değer Gir", color: "orange" },
  MARK_ERROR: { label: "Hata İşaretle", color: "red" },
};
