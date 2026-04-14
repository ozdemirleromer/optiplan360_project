export interface OCRField {
  id: string;
  name: string;
  value: string;
  confidence: number;
  bbox?: BoundingBox;
  isCritical: boolean;
  isApproved: boolean;
  isOverridden: boolean;
  rowNumber: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface OCRRow {
  id: string;
  rowNumber: number;
  fields: Record<string, OCRField>;
  status: 'normal' | 'warning' | 'error';
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  totalPages: number;
  currentPage: number;
  imageUrl?: string;
}

export interface BlockerInfo {
  hasBlockers: boolean;
  unapprovedLowConfidenceCount: number;
  totalCriticalFields: number;
  approvedCount: number;
  message: string;
}

export type CellState = 'normal' | 'selected' | 'low-confidence' | 'approved' | 'overridden' | 'read-only';

export type ViewState = 'loading' | 'empty' | 'ready' | 'image-error' | 'save-error' | 'blocker-active' | 'blocker-cleared' | 'faulty-modal-open';

export interface KeyboardNavigationState {
  selectedCell: { rowId: string; fieldId: string } | null;
  focusedCell: { rowId: string; fieldId: string } | null;
}

export interface ZoomState {
  level: number;
  centerX: number;
  centerY: number;
  targetBbox?: BoundingBox;
}

// Critical field names as per specification
export const CRITICAL_FIELDS = ['BOY', 'EN', 'ADET', 'U1', 'U2', 'K1', 'K2'] as const;
export type CriticalField = typeof CRITICAL_FIELDS[number];
