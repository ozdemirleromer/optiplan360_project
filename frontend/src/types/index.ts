// ============================================================================
// OPTIPLAN360 - MERKEZI TYPE TANIMLARI
// ============================================================================

// Order Status Enum — Backend OrderStatusEnum ile senkron
export type OrderStatus =
  | "DRAFT"
  | "NEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "HOLD"
  | "IN_PRODUCTION"
  | "READY"
  | "COMPLETED"
  | "DELIVERED"
  | "DONE"
  | "CANCELLED";

// Orchestrator teknik durumları (canonical state machine)
export type OptiJobState =
  | "NEW"
  | "PREPARED"
  | "OPTI_IMPORTED"
  | "OPTI_RUNNING"
  | "OPTI_DONE"
  | "XML_READY"
  | "DELIVERED"
  | "DONE"
  | "HOLD"
  | "FAILED";

// Teknik state → UI status eşleme tablosu (K-03 kararı)
export const OPTI_STATE_TO_UI_STATUS: Record<OptiJobState, OrderStatus> = {
  NEW: "NEW",
  PREPARED: "NEW",
  OPTI_IMPORTED: "IN_PRODUCTION",
  OPTI_RUNNING: "IN_PRODUCTION",
  OPTI_DONE: "IN_PRODUCTION",
  XML_READY: "READY",
  DELIVERED: "DELIVERED",
  DONE: "DONE",
  HOLD: "HOLD",
  FAILED: "HOLD",
};

// Tüm OrderStatus → Türkçe etiket
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Taslak",
  NEW: "Yeni",
  PENDING_APPROVAL: "Onay Bekliyor",
  APPROVED: "Onaylandı",
  HOLD: "Beklemede",
  IN_PRODUCTION: "Üretimde",
  READY: "Hazır",
  COMPLETED: "Tamamlandı",
  DELIVERED: "Teslim Edildi",
  DONE: "Bitti",
  CANCELLED: "İptal",
};

// Priority Levels
export type PriorityLevel = "low" | "normal" | "high" | "urgent";

// Part Group Types
export type PartGroup = "GOVDE" | "ARKALIK";

// Grain Direction
export type GrainDirection = "0" | "1" | "2" | "3";

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface Order {
  id: string;
  orderNo?: string;      // Formatlanmış sipariş numarası (SIP-0001)
  cust: string;          // Müşteri adı
  phone: string;         // Telefon
  mat: string;           // Malzeme adı
  plate?: string;        // Plaka boyutu (örn: "2100×2800")
  thick: number;         // Kalınlık (mm)
  parts: number;         // Parça sayısı
  status: OrderStatus;
  date: string;          // Oluşturulma tarihi
  upd: string;           // Son güncelleme
  grp?: PartGroup;       // Gövde/Arkalık
  priority: PriorityLevel;
  measures?: Record<string, unknown>;  // Ölçü bilgileri
}

export interface OrderPart {
  id: number;
  boy: string;           // Boy (mm)
  en: string;            // En (mm)
  adet: string;          // Adet
  grain: GrainDirection; // Grain yönü
  u1: boolean;           // Üst kenar 1
  u2: boolean;           // Üst kenar 2
  k1: boolean;           // Kenar 1
  k2: boolean;           // Kenar 2
  delik1: string;        // Delik kodu 1
  delik2: string;        // Delik kodu 2
  info: string;          // Açıklama
}

export interface OrderInput {
  cust: string;
  phone: string;
  mat: string;
  plate?: string;
  thick: number;
  grp?: PartGroup;
  priority?: PriorityLevel;
  parts?: OrderPart[];
}

export interface OrderUpdate {
  cust?: string;
  phone?: string;
  mat?: string;
  plate?: string;
  thick?: number;
  status?: OrderStatus;
  grp?: PartGroup;
  priority?: PriorityLevel;
  parts?: OrderPart[];
}

// ============================================================================
// MATERIAL TYPES
// ============================================================================

export interface Material {
  id: string;
  code: string;          // Malzeme kodu
  name: string;          // Malzeme adı
  type: string;          // MDFLAM, SUNTALAM, vb.
  thickness: number;     // Kalınlık
  color: string;         // Renk
  supplier?: string;     // Tedarikçi
  stock?: number;        // Stok miktarı
}

export interface MaterialSuggestion {
  malKod: string;
  malAdi: string;
  stokMiktar?: number;
}

// ============================================================================
// CUSTOMER TYPES
// ============================================================================

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLookup {
  phone: string;
  name?: string;
}

// ============================================================================
// STATION & KIOSK TYPES
// ============================================================================

export interface Station {
  id: string;
  name: string;
  type: "CUTTING" | "EDGE_BANDING" | "CNC" | "PACKAGING" | "OTHER";
  status: "ACTIVE" | "IDLE" | "MAINTENANCE" | "OFFLINE";
  currentOrder?: string;  // Current order ID
  operator?: string;
  lastActivity?: string;
}

export interface ScanEvent {
  stationId: string;
  orderId: string;
  partId?: string;
  timestamp: string;
  operator?: string;
  status: "SUCCESS" | "WARNING" | "ERROR";
  message?: string;
}

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER" | "STATION" | "SALES" | "KIOSK";

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ============================================================================
// NOTIFICATION & LOG TYPES
// ============================================================================

export interface Notification {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface LogEntry {
  id: number;
  time: string;
  user: string;
  action: string;
  target: string;
  level: "info" | "warning" | "error" | "success";
  module: string;
  details?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export interface BadgeProps extends BaseComponentProps {
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

// ============================================================================
// PRICE TRACKING TYPES
// ============================================================================

export type PriceJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export const PRICE_JOB_STATUS_LABELS: Record<PriceJobStatus, string> = {
  PENDING: "Bekliyor",
  PROCESSING: "İşleniyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
};

export interface PriceUploadJob {
  id: string;
  status: PriceJobStatus;
  originalFilename: string | null;
  supplier: string;
  rowsExtracted: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface PriceItem {
  id: string;
  urunKodu: string | null;
  urunAdi: string;
  birim: string;
  boyut: string | null;
  renk: string | null;
  listeFiyati: number | null;
  iskontoOrani: number;
  netFiyat: number | null;
  kdvOrani: number;
  kdvDahilFiyat: number | null;
  paraBirimi: string;
  kategori: string | null;
  marka: string | null;
  tedarikci: string;
}

export interface PriceJobDetail extends PriceUploadJob {
  items: PriceItem[];
}

// ============================================================================
// ORCHESTRATOR / OPTIJOB TYPES
// ============================================================================

export interface OptiAuditEvent {
  id: number;
  jobId: string;
  eventType: string;
  message: string | null;
  detailsJson: string | null;
  createdAt: string | null;
}

export interface OptiJob {
  id: string;
  orderId: number;
  state: OptiJobState;
  optiMode: "A" | "B" | "C";
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy?: number;
  events: OptiAuditEvent[];
}

export interface OptiJobListResponse {
  jobs: OptiJob[];
  total: number;
}

export const OPTI_STATE_LABELS: Record<OptiJobState, string> = {
  NEW: "Yeni",
  PREPARED: "Hazırlandı",
  OPTI_IMPORTED: "OptiPlanning'e Aktarıldı",
  OPTI_RUNNING: "Optimizasyon Çalışıyor",
  OPTI_DONE: "Optimizasyon Bitti",
  XML_READY: "XML Hazır",
  DELIVERED: "Makineye İletildi",
  DONE: "Tamamlandı",
  HOLD: "Beklemede",
  FAILED: "Başarısız",
};

export const OPTI_STATE_COLORS: Record<OptiJobState, string> = {
  NEW: "#6366f1",
  PREPARED: "#8b5cf6",
  OPTI_IMPORTED: "#0ea5e9",
  OPTI_RUNNING: "#f59e0b",
  OPTI_DONE: "#10b981",
  XML_READY: "#06b6d4",
  DELIVERED: "#3b82f6",
  DONE: "#22c55e",
  HOLD: "#f97316",
  FAILED: "#ef4444",
};

export interface OptiJobCreateRequest {
  orderId: number;
  customerPhone: string;
  customerSnapshotName?: string;
  optiMode?: "A" | "B" | "C";
  plateWidthMm?: number;
  plateHeightMm?: number;
  parts: OptiJobPart[];
}

export interface OptiJobPart {
  id: string;
  partType: "GOVDE" | "ARKALIK";
  materialCode: string;
  lengthCm: number;
  widthCm: number;
  quantity: number;
  grain: number;
  color: string;
  thicknessMm: number;
}

// ============================================================================
// PRODUCTION RECEIPT TYPES
// ============================================================================

export interface ProductionReceipt {
  jobId: string;
  orderId: number;
  orderTsCode: string | null;
  customerName: string | null;
  xmlParse: XmlParseResult;
  plakaAdedi: number;
  bantMetre: number;
  invoice: ReceiptInvoice | null;
}

export interface XmlParseResult {
  bestSolution?: string;
  algorithm?: string;
  mqBoards?: number;
  patterns?: number;
  cycles?: number;
  zcuts?: number;
  jobTime?: number;
  jobCost?: number;
  mqDrops?: number;
  diffDrops?: number;
  totalSolutions?: number;
  error?: string;
}

export interface ReceiptInvoice {
  id: number;
  number: string;
  subtotal: number;
  totalAmount: number;
  status: string | null;
  notes: string | null;
}

export interface WorkerStatus {
  circuitOpen: boolean;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  lastRunAt: string | null;
  lastError: string | null;
  engine: string;
  supportedEngines: string[];
  queueCount: number;
  runningCount: number;
  scriptPath: string;
  scriptExists: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};


// ============================================================================
// EXPORT ALL
// ============================================================================

export type {
  // Re-export all types for convenience
};
