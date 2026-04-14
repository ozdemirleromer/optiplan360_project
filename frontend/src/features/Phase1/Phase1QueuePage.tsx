/**
 * Phase 1 — OCR Havuzu (master spec v3)
 * Spec: OptiPlan360_Eksiksiz_phase4_Master_Spesifikasyon_v3.md §6, §7, §8
 *
 * Yapı:
 *   - SummaryCards  — KPI özeti (§6.5)
 *   - FiltersBar    — Tüm query param filtreleri (§6.1)
 *   - Sekmeler      — Kuyruk | Hatalar | Klasör Sağlığı
 *   - QueueTable    — Paginated kayıt listesi
 *   - DetailDrawer  — Sağ kaydırma paneli (kayıt detayı + lifecycle)
 *   - ErrorsView    — Hata/retry kayıtlar (§6.4)
 *   - FolderHealth  — Klasör sağlık durumu (§6.3)
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Folder,
  FolderOpen,
  HardDrive,
  Inbox,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import {
  getPhase1Errors,
  getPhase1FolderHealth,
  getPhase1Queue,
  getPhase1RecordDetail,
  getPhase1StatusSummary,
  postBatchRetry,
  postManualRescan,
  postManualRetry,
  type ErrorSeverity,
  type FolderHealthStatus,
  type Phase1ErrorRecord,
  type Phase1FolderHealth,
  type Phase1LifecycleEvent,
  type Phase1QueueParams,
  type Phase1QueueRecord,
  type Phase1RecordStatus,
  type Phase1StatusSummary,
} from "../../services/phase1Service";
import { optiplanWorkflowService, type WorkflowSourceFolder } from "../../services/optiplanWorkflowService";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<Phase1RecordStatus, string> = {
  RECEIVED: "Alındı",
  DUPLICATE: "Tekrar",
  PROCESSING: "İşleniyor",
  OCR_PROCESSING: "OCR",
  PHASE2_PENDING: "Phase 2 Bekliyor",
  OCR_RETRY_PENDING: "Retry Bekliyor",
  FAULTY: "Hatalı",
  MANUAL_REVIEW_REQUIRED: "Manuel İnceleme",
  PHASE2_IN_PROGRESS: "Phase 2 Devam",
  PHASE3_PENDING: "Phase 3 Bekliyor",
  PHASE3_IN_PROGRESS: "Phase 3 Devam",
  PHASE4_PENDING: "Phase 4 Bekliyor",
  PHASE4_PREVIEW_READY: "Önizleme Hazır",
  PHASE4_EXPORT_RUNNING: "Export Çalışıyor",
  PHASE4_EXPORT_FAILED: "Export Hatası",
  PHASE4_RETRY_PENDING: "Phase 4 Retry",
  COMPLETED: "Tamamlandı",
};

const STATUS_COLOR: Record<Phase1RecordStatus, string> = {
  RECEIVED: "#3b82f6",
  DUPLICATE: "#94a3b8",
  PROCESSING: "#f59e0b",
  OCR_PROCESSING: "#f59e0b",
  PHASE2_PENDING: "#2563eb",
  OCR_RETRY_PENDING: "#dc2626",
  FAULTY: "#b91c1c",
  MANUAL_REVIEW_REQUIRED: "#d97706",
  PHASE2_IN_PROGRESS: "#7c3aed",
  PHASE3_PENDING: "#0891b2",
  PHASE3_IN_PROGRESS: "#0e7490",
  PHASE4_PENDING: "#059669",
  PHASE4_PREVIEW_READY: "#0d9488",
  PHASE4_EXPORT_RUNNING: "#0284c7",
  PHASE4_EXPORT_FAILED: "#dc2626",
  PHASE4_RETRY_PENDING: "#f97316",
  COMPLETED: "#475569",
};

const FOLDER_HEALTH_COLOR: Record<FolderHealthStatus, string> = {
  HEALTHY: "#10b981",
  WARNING: "#f59e0b",
  OFFLINE: "#94a3b8",
  ERROR: "#ef4444",
};

const FOLDER_HEALTH_LABEL: Record<FolderHealthStatus, string> = {
  HEALTHY: "Sağlıklı",
  WARNING: "Uyarı",
  OFFLINE: "Çevrimdışı",
  ERROR: "Hata",
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp_raw: "WhatsApp",
  scanner_raw: "Tarayıcı",
  manuel_raw: "Manuel",
  email_raw: "E-posta",
};

const MANUAL_SOURCE_OPTIONS: Array<{ value: WorkflowSourceFolder; label: string }> = [
  { value: "manuel_raw", label: "Manuel" },
  { value: "whatsapp_raw", label: "WhatsApp" },
  { value: "scanner_raw", label: "Tarayıcı" },
  { value: "email_raw", label: "E-posta" },
];

const ERROR_SEVERITY_COLOR: Record<ErrorSeverity, string> = {
  INFO: "#3b82f6",
  WARNING: "#f59e0b",
  RETRYABLE: "#f97316",
  FATAL: "#dc2626",
};

const PAGE_SIZE = 25;
const FILTER_PRESETS_STORAGE_KEY = "phase1_queue_filter_presets";

type QueueFilterPreset = {
  name: string;
  params: Partial<Phase1QueueParams>;
};

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function normalizeRetryReason(rawMessage: string | null): string {
  if (!rawMessage) return "Bilinmeyen hata";
  const message = rawMessage.trim();
  if (!message) return "Bilinmeyen hata";
  const normalized = message.toLocaleLowerCase("tr-TR");
  if (normalized.includes("timeout")) return "Zaman aşımı";
  if (normalized.includes("connection") || normalized.includes("bağlantı")) return "Bağlantı sorunu";
  if (normalized.includes("auth") || normalized.includes("unauthorized") || normalized.includes("yetki")) return "Yetki/kimlik sorunu";
  if (normalized.includes("json") || normalized.includes("parse")) return "Veri parse sorunu";
  return message.length > 42 ? `${message.slice(0, 42)}...` : message;
}

function resolveOcrProvider(record: Phase1QueueRecord | Record<string, unknown>): string | null {
  const raw = record as Record<string, unknown>;
  const candidate =
    raw.ocrProvider ??
    raw.ocr_provider ??
    raw.ocrEngine ??
    raw.ocr_engine ??
    raw.provider;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePresetParams(params: Phase1QueueParams): Partial<Phase1QueueParams> {
  return {
    search: params.search,
    status: params.status,
    sourceType: params.sourceType,
    folderType: params.folderType,
    duplicate: params.duplicate,
    retryOnly: params.retryOnly,
    phase2Ready: params.phase2Ready,
    manualReviewOnly: params.manualReviewOnly,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  };
}

// ---------------------------------------------------------------------------
// Stil sabitleri (tasarım tokenları v2 spec §14)
// ---------------------------------------------------------------------------

const S = {
  page: {
    background: "#0f172a",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "inherit",
  } as CSSProperties,
  panel: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 6,
  } as CSSProperties,
  row: (odd: boolean): CSSProperties => ({
    background: odd ? "#1e293b" : "#172032",
    borderBottom: "1px solid #1e293b",
    height: 32,
  }),
  th: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    padding: "0 12px",
    textAlign: "left",
    whiteSpace: "nowrap",
    userSelect: "none",
  } as CSSProperties,
  td: {
    fontSize: 13,
    color: "#cbd5e1",
    padding: "0 12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220,
  } as CSSProperties,
  input: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 4,
    color: "#e2e8f0",
    fontSize: 13,
    padding: "4px 10px",
    height: 30,
    outline: "none",
  } as CSSProperties,
  select: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 4,
    color: "#e2e8f0",
    fontSize: 13,
    padding: "4px 8px",
    height: 30,
    outline: "none",
    cursor: "pointer",
  } as CSSProperties,
  btnPrimary: {
    background: "#2563eb",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    padding: "0 12px",
    height: 30,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as CSSProperties,
  btnSecondary: {
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: 4,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 500,
    padding: "0 12px",
    height: 30,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as CSSProperties,
  btnDanger: {
    background: "#7f1d1d",
    border: "none",
    borderRadius: 4,
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: 600,
    padding: "0 12px",
    height: 30,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as CSSProperties,
  badge: (color: string): CSSProperties => ({
    background: `${color}22`,
    border: `1px solid ${color}66`,
    color,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    padding: "1px 7px",
    display: "inline-block",
    whiteSpace: "nowrap",
  }),
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  } as CSSProperties,
};

// ---------------------------------------------------------------------------
// KPI Summary Cards
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
  summary: Phase1StatusSummary | null;
  loading: boolean;
}

function SummaryCards({ summary, loading }: SummaryCardsProps) {
  const cards = [
    {
      label: "Toplam Kayıt",
      value: summary?.totalCount ?? 0,
      icon: <Layers size={16} color="#3b82f6" />,
      color: "#3b82f6",
    },
    {
      label: "Phase 2 Hazır",
      value: summary?.phase2ReadyCount ?? 0,
      icon: <CheckCircle size={16} color="#10b981" />,
      color: "#10b981",
    },
    {
      label: "Retry Bekliyor",
      value: summary?.retryCount ?? 0,
      icon: <RotateCcw size={16} color="#f97316" />,
      color: "#f97316",
    },
    {
      label: "Hata",
      value: summary?.errorCount ?? 0,
      icon: <AlertCircle size={16} color="#ef4444" />,
      color: "#ef4444",
    },
    {
      label: "Tekrar (Dup.)",
      value: summary?.duplicateCount ?? 0,
      icon: <Copy size={16} color="#94a3b8" />,
      color: "#94a3b8",
    },
    {
      label: "Manuel İnceleme",
      value: summary?.manualReviewCount ?? 0,
      icon: <AlertTriangle size={16} color="#d97706" />,
      color: "#d97706",
    },
    {
      label: "Aktif Klasör",
      value: summary?.activeFolderCount ?? 0,
      icon: <FolderOpen size={16} color="#7c3aed" />,
      color: "#7c3aed",
    },
  ];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            ...S.panel,
            flex: "1 1 120px",
            minWidth: 110,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {c.icon}
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{c.label}</span>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: loading ? "#334155" : c.color,
              letterSpacing: "-0.02em",
            }}
          >
            {loading ? "—" : c.value.toLocaleString("tr-TR")}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters Bar
// ---------------------------------------------------------------------------

interface FiltersBarProps {
  params: Phase1QueueParams;
  onChange: (p: Partial<Phase1QueueParams>) => void;
  onRefresh: () => void;
  loading: boolean;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tüm Durumlar" },
  { value: "RECEIVED", label: "Alındı" },
  { value: "PROCESSING", label: "İşleniyor" },
  { value: "PHASE2_PENDING", label: "Phase 2 Bekliyor" },
  { value: "OCR_RETRY_PENDING", label: "Retry" },
  { value: "FAULTY", label: "Hatalı" },
  { value: "DUPLICATE", label: "Tekrar" },
  { value: "MANUAL_REVIEW_REQUIRED", label: "Manuel İnceleme" },
  { value: "PHASE3_PENDING", label: "Phase 3 Bekliyor" },
  { value: "PHASE4_PENDING", label: "Phase 4 Bekliyor" },
  { value: "PHASE4_PREVIEW_READY", label: "Önizleme Hazır" },
  { value: "PHASE4_EXPORT_RUNNING", label: "Export Çalışıyor" },
  { value: "PHASE4_EXPORT_FAILED", label: "Export Hatası" },
  { value: "PHASE4_RETRY_PENDING", label: "Phase 4 Retry" },
  { value: "COMPLETED", label: "Tamamlandı" },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tüm Kaynaklar" },
  { value: "whatsapp_raw", label: "WhatsApp" },
  { value: "scanner_raw", label: "Tarayıcı" },
  { value: "manuel_raw", label: "Manuel" },
  { value: "email_raw", label: "E-posta" },
];

function FiltersBar({ params, onChange, onRefresh, loading }: FiltersBarProps) {
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      onChange({ search: value || undefined, page: 1 });
    }, 350);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
        padding: "8px 0",
      }}
    >
      {/* Arama */}
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
        <Search
          size={14}
          color="#64748b"
          style={{ position: "absolute", left: 8, top: 8, pointerEvents: "none" }}
        />
        <input
          style={{ ...S.input, paddingLeft: 28, width: "100%", boxSizing: "border-box" }}
          placeholder="Dosya adı ara..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Durum filtresi */}
      <select
        style={S.select}
        value={params.status ?? ""}
        onChange={(e) => onChange({ status: e.target.value || undefined, page: 1 })}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Kaynak filtresi */}
      <select
        style={S.select}
        value={params.sourceType ?? ""}
        onChange={(e) => onChange({ sourceType: e.target.value || undefined, page: 1 })}
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Phase 2 hazır */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          color: "#94a3b8",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={params.phase2Ready === true}
          onChange={(e) => onChange({ phase2Ready: e.target.checked ? true : undefined, page: 1 })}
        />
        Phase 2 Hazır
      </label>

      {/* Retry only */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          color: "#94a3b8",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={params.retryOnly === true}
          onChange={(e) => onChange({ retryOnly: e.target.checked ? true : undefined, page: 1 })}
        />
        Sadece Retry
      </label>

      {/* Duplicate */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          color: "#94a3b8",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={params.duplicate === true}
          onChange={(e) => onChange({ duplicate: e.target.checked ? true : undefined, page: 1 })}
        />
        Tekrarlar
      </label>

      {/* Yenile */}
      <button
        style={S.btnSecondary}
        onClick={onRefresh}
        disabled={loading}
        title="Listeyi yenile"
      >
        <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : undefined }} />
        Yenile
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue Table
// ---------------------------------------------------------------------------

interface QueueTableProps {
  records: Phase1QueueRecord[];
  folders: Phase1FolderHealth[];
  loading: boolean;
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (record: Phase1QueueRecord) => void;
  onToggleSelect: (recordId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onRetry: (recordId: string) => void;
  onBatchRetry: () => void;
  onViewImage?: (imageUrl: string | null, fileName: string) => void;
}

const QUEUE_COLS = [
  { key: "select", label: "", width: 40 },
  { key: "thumbnail", label: "Görsel", width: 60 },
  { key: "recordId", label: "Kayıt ID", width: 90 },
  { key: "fileName", label: "Dosya Adı", width: 160 },
  { key: "sourceType", label: "Kaynak", width: 90 },
  { key: "ocrProvider", label: "OCR", width: 90 },
  { key: "folderHealth", label: "Klasör", width: 80 },
  { key: "status", label: "Durum", width: 130 },
  { key: "phase2Ready", label: "P2 Hazır", width: 70 },
  { key: "retryCount", label: "Retry", width: 55 },
  { key: "createdAt", label: "Geliş Tarihi", width: 110 },
  { key: "nextRetryAt", label: "Sonraki Retry", width: 110 },
  { key: "actions", label: "", width: 70 },
] as const;

function QueueTable({ records, folders, loading, selectedId, selectedIds, onSelect, onToggleSelect, onSelectAll, onSelectNone, onRetry, onBatchRetry: _onBatchRetry, onViewImage }: QueueTableProps) {
  const allSelected = selectedIds.length > 0 && selectedIds.length === records.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < records.length;

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
        <div>Yükleniyor...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "#475569" }}>
        <Inbox size={32} color="#334155" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14 }}>Kayıt bulunamadı</div>
        <div style={{ fontSize: 12, marginTop: 4, color: "#334155" }}>
          Filtre kriterlerini değiştirmeyi deneyin
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          {QUEUE_COLS.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", height: 32 }}>
            <th key="select" style={{ ...S.th, width: 40, textAlign: "center" }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={() => allSelected ? onSelectNone() : onSelectAll()}
                title="Tümünü seç/temizle"
              />
            </th>
            {QUEUE_COLS.slice(1).map((c) => (
              <th key={c.key} style={S.th}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, idx) => {
            const isSelected = r.recordId === selectedId;
            return (
              <tr
                key={r.recordId}
                style={{
                  ...S.row(idx % 2 === 0),
                  cursor: "pointer",
                  background: isSelected
                    ? "#1e3a5f"
                    : idx % 2 === 0
                      ? "#1e293b"
                      : "#172032",
                  outline: isSelected ? "1px solid #3b82f6" : undefined,
                }}
                onClick={() => onSelect(r)}
                tabIndex={0}
                onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(r);
                }}
                aria-selected={isSelected}
              >
                <td style={{ ...S.td, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.recordId)}
                    onChange={() => onToggleSelect(r.recordId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  {r.imageUrl ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewImage?.(r.imageUrl, r.fileName);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        padding: 0,
                        border: "1px solid #334155",
                        borderRadius: 4,
                        overflow: "hidden",
                        cursor: "pointer",
                        background: "#0f172a",
                      }}
                      title="Görseli görüntüle"
                    >
                      <img
                        src={r.imageUrl}
                        alt={r.fileName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <span style={{ color: "#475569", fontSize: 11 }}>—</span>
                  )}
                </td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>
                  {r.recordId}
                </td>
                <td style={S.td} title={r.fileName}>
                  {r.fileName}
                </td>
                <td style={S.td}>
                  <span style={S.badge("#7c3aed")}>
                    {SOURCE_LABEL[r.sourceType] ?? r.sourceType}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={S.badge("#0ea5e9")}>
                    {resolveOcrProvider(r) ?? "—"}
                  </span>
                </td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  {(() => {
                    const folder = folders.find(f => f.folderType === r.folderType);
                    if (!folder) return <span style={{ color: "#475569" }}>—</span>;
                    return (
                      <span
                        style={{
                          ...S.badge(FOLDER_HEALTH_COLOR[folder.healthStatus]),
                          fontSize: 10,
                          padding: "2px 6px",
                        }}
                        title={folder.physicalPath || FOLDER_HEALTH_LABEL[folder.healthStatus]}
                      >
                        {FOLDER_HEALTH_LABEL[folder.healthStatus]}
                      </span>
                    );
                  })()}
                </td>
                <td style={S.td}>
                  <span style={S.badge(STATUS_COLOR[r.status] ?? "#475569")}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  {r.phase2Ready ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <XCircle size={14} color="#475569" />
                  )}
                </td>
                <td style={{ ...S.td, textAlign: "center", color: r.retryCount > 0 ? "#f97316" : "#475569" }}>
                  {r.retryCount}
                </td>
                <td style={{ ...S.td, fontSize: 12 }}>{formatDateShort(r.createdAt)}</td>
                <td style={{ ...S.td, fontSize: 12, color: r.nextRetryAt ? "#f97316" : "#475569" }}>
                  {r.nextRetryAt ? formatDateShort(r.nextRetryAt) : "—"}
                </td>
                <td style={{ ...S.td, padding: "0 8px" }}>
                  {(r.status === "OCR_RETRY_PENDING" ||
                    r.status === "FAULTY" ||
                    r.status === "MANUAL_REVIEW_REQUIRED") && (
                    <button
                      style={{ ...S.btnSecondary, height: 24, padding: "0 8px", fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry(r.recordId);
                      }}
                      title="Yeniden dene"
                    >
                      <RotateCcw size={11} />
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Lightbox
// ---------------------------------------------------------------------------

interface ImageLightboxProps {
  imageUrl: string | null;
  fileName: string;
  onClose: () => void;
}

function ImageLightbox({ imageUrl, fileName, onClose }: ImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "90vw",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: 0,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ color: "#cbd5e1", fontSize: 13 }}>{fileName}</span>
          <button
            onClick={onClose}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 4,
              color: "#e2e8f0",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <X size={14} />
          </button>
        </div>
        <img
          src={imageUrl}
          alt={fileName}
          style={{
            maxWidth: "90vw",
            maxHeight: "85vh",
            borderRadius: 4,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        fontSize: 12,
        color: "#64748b",
      }}
    >
      <button
        style={S.btnSecondary}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Önceki sayfa"
      >
        <ChevronLeft size={13} />
      </button>
      <span>
        {page} / {totalPages} sayfa ({total.toLocaleString("tr-TR")} kayıt)
      </span>
      <button
        style={S.btnSecondary}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Sonraki sayfa"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer
// ---------------------------------------------------------------------------

interface DetailDrawerProps {
  recordId: string | null;
  onClose: () => void;
  onRetry: (recordId: string) => void;
  onRescan: (folderType: string) => void;
}

function DetailDrawer({ recordId, onClose, onRetry, onRescan }: DetailDrawerProps) {
  const [detail, setDetail] = useState<{
    record: Phase1QueueRecord;
    folderHealth: Phase1FolderHealth | null;
    lifecycle: Phase1LifecycleEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recordId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getPhase1RecordDetail(recordId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [recordId]);

  // ESC ile kapat
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const drawerWidth = 420;

  const drawerStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    width: drawerWidth,
    height: "100vh",
    background: "#1e293b",
    borderLeft: "1px solid #334155",
    zIndex: 200,
    display: "flex",
    flexDirection: "column",
    transform: recordId ? "translateX(0)" : `translateX(${drawerWidth}px)`,
    transition: "transform 0.2s ease",
    overflow: "hidden",
  };

  if (!recordId) return null;

  const r = detail?.record;
  const fh = detail?.folderHealth;
  const lifecycle = detail?.lifecycle ?? [];

  return (
    <div
      style={drawerStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Kayıt Detayı"
    >
      {/* Drawer header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 48,
          borderBottom: "1px solid #334155",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
          Kayıt Detayı
        </span>
        <button
          style={{ ...S.btnSecondary, padding: "0 8px" }}
          onClick={onClose}
          aria-label="Kapat"
        >
          <X size={14} />
        </button>
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
            <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {!loading && r && (
          <>
            {/* Durum badge */}
            <div style={{ marginBottom: 16 }}>
              <span style={S.badge(STATUS_COLOR[r.status] ?? "#475569")}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
              {r.duplicateFlag && (
                <span style={{ ...S.badge("#94a3b8"), marginLeft: 6 }}>TEKRAR</span>
              )}
            </div>

            {/* Temel bilgiler */}
            <section style={{ marginBottom: 16 }}>
              <div style={{ ...S.sectionTitle, marginBottom: 8 }}>Dosya Bilgileri</div>
              <DetailRow label="Kayıt ID" value={r.recordId} mono />
              <DetailRow label="UUID" value={r.uuid.slice(0, 18) + "..."} mono />
              <DetailRow label="Dosya Adı" value={r.fileName} />
              <DetailRow
                label="Kaynak"
                value={SOURCE_LABEL[r.sourceType] ?? r.sourceType}
              />
              <DetailRow label="OCR Sağlayıcı" value={resolveOcrProvider(r) ?? "—"} />
              <DetailRow label="Klasör Tipi" value={r.folderType} />
              <DetailRow label="Phase 2 Hazır" value={r.phase2Ready ? "Evet" : "Hayır"} />
            </section>

            {/* Retry bilgileri */}
            {r.retryCount > 0 && (
              <section style={{ marginBottom: 16 }}>
                <div style={{ ...S.sectionTitle, marginBottom: 8 }}>Retry Bilgileri</div>
                <DetailRow label="Retry Sayısı" value={String(r.retryCount)} />
                <DetailRow label="Son Hata" value={r.lastErrorMessage ?? "—"} />
                <DetailRow label="Sonraki Retry" value={formatDateTime(r.nextRetryAt)} />
                <DetailRow label="Son Deneme" value={formatDateTime(r.createdAt)} />
              </section>
            )}

            {/* Klasör sağlığı */}
            {fh && (
              <section style={{ marginBottom: 16 }}>
                <div style={{ ...S.sectionTitle, marginBottom: 8 }}>Klasör Durumu</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "#0f172a",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: FOLDER_HEALTH_COLOR[fh.healthStatus],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                    {FOLDER_HEALTH_LABEL[fh.healthStatus]}
                  </span>
                  {fh.physicalPath && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#475569",
                        fontFamily: "monospace",
                        marginLeft: "auto",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={fh.physicalPath}
                    >
                      {fh.physicalPath.split(/[\\/]/).pop()}
                    </span>
                  )}
                </div>
                <DetailRow label="Son Tarama" value={formatDateTime(fh.lastScanAt)} />
                <DetailRow label="Son Dosya" value={formatDateTime(fh.lastFileAt)} />
                <DetailRow
                  label="Kayıt Sayısı"
                  value={fh.recordCount.toLocaleString("tr-TR")}
                />
                <button
                  style={{ ...S.btnSecondary, marginTop: 8, fontSize: 11 }}
                  onClick={() => onRescan(fh.folderType)}
                >
                  <RefreshCw size={11} />
                  Klasörü Yeniden Tara
                </button>
              </section>
            )}

            {/* Yaşam döngüsü */}
            {lifecycle.length > 0 && (
              <section>
                <div style={{ ...S.sectionTitle, marginBottom: 8 }}>Yaşam Döngüsü</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {lifecycle.map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        fontSize: 12,
                        color: "#94a3b8",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#3b82f6",
                          marginTop: 5,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ color: "#cbd5e1" }}>
                          {ev.fromStatus ? `${ev.fromStatus} → ` : ""}
                          <strong>{ev.toStatus}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#475569" }}>
                          {formatDateTime(ev.triggeredAt)} · {ev.triggeredBy}
                        </div>
                        {ev.note && (
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                            {ev.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Aksiyonlar */}
      {!loading && r && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #334155",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {(r.status === "OCR_RETRY_PENDING" ||
            r.status === "FAULTY" ||
            r.status === "MANUAL_REVIEW_REQUIRED") && (
            <button
              style={S.btnPrimary}
              onClick={() => onRetry(r.recordId)}
            >
              <RotateCcw size={13} />
              Yeniden İşle
            </button>
          )}
          <button style={S.btnSecondary} onClick={onClose}>
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: "#cbd5e1",
          fontFamily: mono ? "monospace" : undefined,
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Errors View
// ---------------------------------------------------------------------------

interface ErrorsViewProps {
  errors: Phase1ErrorRecord[];
  loading: boolean;
  onRetry: (recordId: string) => void;
}

function ErrorsView({ errors, loading, onRetry }: ErrorsViewProps) {
  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
        Yükleniyor...
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "#475569" }}>
        <CheckCircle size={32} color="#10b981" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14 }}>Hata kaydı yok</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", height: 32 }}>
            {["Kayıt ID", "Dosya", "Durum", "Hata Tipi", "Mesaj", "Retry", "Son Deneme", "Sonraki Retry", ""].map(
              (h) => (
                <th key={h} style={S.th}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {errors.map((e, idx) => (
            <tr key={e.recordId} style={S.row(idx % 2 === 0)}>
              <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{e.recordId}</td>
              <td style={S.td} title={e.fileName}>
                {e.fileName}
              </td>
              <td style={S.td}>
                <span style={S.badge(STATUS_COLOR[e.status] ?? "#475569")}>
                  {STATUS_LABEL[e.status] ?? e.status}
                </span>
              </td>
              <td style={S.td}>
                {e.errorSeverity && (
                  <span style={S.badge(ERROR_SEVERITY_COLOR[e.errorSeverity])}>
                    {e.errorSeverity}
                  </span>
                )}
              </td>
              <td
                style={{ ...S.td, color: "#f97316", maxWidth: 240 }}
                title={e.lastErrorMessage ?? ""}
              >
                {e.lastErrorMessage ?? "—"}
              </td>
              <td style={{ ...S.td, textAlign: "center", color: "#f97316" }}>{e.retryCount}</td>
              <td style={{ ...S.td, fontSize: 12 }}>{formatDateShort(e.lastAttemptAt)}</td>
              <td style={{ ...S.td, fontSize: 12, color: "#f97316" }}>
                {e.nextRetryAt ? formatDateShort(e.nextRetryAt) : "—"}
              </td>
              <td style={{ ...S.td, padding: "0 8px" }}>
                <button
                  style={{ ...S.btnSecondary, height: 24, padding: "0 8px", fontSize: 11 }}
                  onClick={() => onRetry(e.recordId)}
                >
                  <RotateCcw size={11} />
                  Retry
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder Health View
// ---------------------------------------------------------------------------

interface FolderHealthViewProps {
  folders: Phase1FolderHealth[];
  folderDocuments: Record<string, Phase1QueueRecord[]>;
  loading: boolean;
  onRescan: (folderType: string) => void;
}

function FolderHealthView({ folders, folderDocuments, loading, onRescan }: FolderHealthViewProps) {
  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#475569" }}>
        Yükleniyor...
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "#475569" }}>
        <Folder size={32} color="#334155" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14 }}>Klasör tanımlı değil</div>
        <div style={{ fontSize: 12, marginTop: 4, color: "#334155" }}>
          Klasör Yönetimi sayfasından klasörleri tanımlayın
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
      {folders.map((f) => {
        const color = FOLDER_HEALTH_COLOR[f.healthStatus];
        const docs = folderDocuments[f.folderType] ?? [];
        const visibleDocs = docs.slice(0, 20);
        return (
          <div
            key={f.folderType}
            style={{
              ...S.panel,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {/* Sağlık indikatörü */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${color}88`,
              }}
            />

            {/* İkon */}
            <HardDrive size={16} color="#64748b" />

            {/* Klasör bilgileri */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                  {SOURCE_LABEL[f.folderType] ?? f.folderType}
                </span>
                <span style={S.badge(color)}>{FOLDER_HEALTH_LABEL[f.healthStatus]}</span>
                {!f.isActive && (
                  <span style={S.badge("#475569")}>Pasif</span>
                )}
              </div>
              {f.physicalPath && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#475569",
                    fontFamily: "monospace",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={f.physicalPath}
                >
                  {f.physicalPath}
                </div>
              )}
            </div>

            {/* Metrikler */}
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748b" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>
                  {f.recordCount}
                </div>
                <div>Kayıt</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#475569" }}>Son Tarama</div>
                <div>{formatDateShort(f.lastScanAt)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#475569" }}>Son Dosya</div>
                <div>{formatDateShort(f.lastFileAt)}</div>
              </div>
            </div>

            {/* Aksiyon */}
            <button
              style={S.btnSecondary}
              onClick={() => onRescan(f.folderType)}
              disabled={!f.isActive || f.healthStatus === "OFFLINE"}
              title="Klasörü manuel tara"
            >
              <RefreshCw size={13} />
              Tara
            </button>

            <div
              style={{
                width: "100%",
                marginTop: 10,
                borderTop: "1px solid #334155",
                paddingTop: 10,
              }}
            >
              <div style={{ ...S.sectionTitle, marginBottom: 6 }}>Dosya Dökümü</div>
              {docs.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Bu klasörde görüntülenecek belge bulunamadı.
                </div>
              ) : (
                <>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      display: "grid",
                      gap: 4,
                      fontSize: 12,
                      color: "#cbd5e1",
                    }}
                  >
                    {visibleDocs.map((doc) => (
                      <li key={`${f.folderType}-${doc.recordId}`} title={doc.fileName}>
                        <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>{doc.recordId}</span>
                        <span style={{ color: "#64748b" }}> · </span>
                        <span>{doc.fileName}</span>
                      </li>
                    ))}
                  </ol>
                  {docs.length > visibleDocs.length && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                      +{docs.length - visibleDocs.length} belge daha var
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast (inline — bağımlılık eklememek için minimal)
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const show = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return { toasts, show };
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  const COLOR: Record<Toast["type"], string> = {
    success: "#10b981",
    error: "#ef4444",
    info: "#3b82f6",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "#1e293b",
            border: `1px solid ${COLOR[t.type]}66`,
            borderRadius: 6,
            padding: "10px 16px",
            fontSize: 13,
            color: "#e2e8f0",
            maxWidth: 340,
            boxShadow: "0 4px 12px #0006",
          }}
        >
          <span style={{ color: COLOR[t.type], marginRight: 8 }}>
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ana Bileşen: Phase1QueuePage
// ---------------------------------------------------------------------------

type TabId = "queue" | "errors" | "folder-health";

export function Phase1QueuePage() {
  // ----- Veri -----
  const [summary, setSummary] = useState<Phase1StatusSummary | null>(null);
  const [records, setRecords] = useState<Phase1QueueRecord[]>([]);
  const [errors, setErrors] = useState<Phase1ErrorRecord[]>([]);
  const [folders, setFolders] = useState<Phase1FolderHealth[]>([]);
  const [folderDocuments, setFolderDocuments] = useState<Record<string, Phase1QueueRecord[]>>({});
  const [total, setTotal] = useState(0);

  // ----- Yükleme -----
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);

  // ----- Filtreler & Sayfalama -----
  const [params, setParams] = useState<Phase1QueueParams>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "created_at",
    sortDir: "desc",
  });

  // ----- UI -----
  const [activeTab, setActiveTab] = useState<TabId>("queue");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterPresets, setFilterPresets] = useState<QueueFilterPreset[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSource, setManualSource] = useState<WorkflowSourceFolder>("manuel_raw");
  const [forceDuplicate, setForceDuplicate] = useState(false);
  const [manualUploading, setManualUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ imageUrl: string | null; fileName: string } | null>(null);
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const { toasts, show: showToast } = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as QueueFilterPreset[];
      if (Array.isArray(parsed)) {
        setFilterPresets(parsed.filter((item) => item && typeof item.name === "string" && item.params));
      }
    } catch {
      setFilterPresets([]);
    }
  }, []);

  const persistPresets = useCallback((next: QueueFilterPreset[]) => {
    setFilterPresets(next);
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const retryInsights = useMemo(() => {
    const reasonCounts = new Map<string, number>();
    const sourceErrors = errors.length > 0
      ? errors.map((item) => item.errorType ?? item.lastErrorMessage)
      : records
          .filter((item) => item.retryCount > 0 || item.status === "OCR_RETRY_PENDING")
          .map((item) => item.lastErrorMessage);

    sourceErrors.forEach((raw) => {
      const reason = normalizeRetryReason(raw);
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    });

    const topReasons = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const retryPendingCount = summary?.retryCount ?? records.filter((item) => item.status === "OCR_RETRY_PENDING").length;

    return {
      retryPendingCount,
      topReasons,
    };
  }, [errors, records, summary]);

  // ----- Otomatik Yenileme -----
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----- Veri yükleme -----
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await getPhase1StatusSummary();
      setSummary(data);
    } catch {
      // Özet yüklenememesi kritik değil
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const data = await getPhase1Queue(params);
      setRecords(data.items);
      setTotal(data.total);
      setSelectedIds([]); // Yeni veri yüklendiğinde seçimleri temizle
    } catch {
      showToast("Kuyruk listesi yüklenemedi", "error");
    } finally {
      setQueueLoading(false);
    }
  }, [params, showToast]);

  const loadErrors = useCallback(async () => {
    setErrorsLoading(true);
    try {
      const data = await getPhase1Errors();
      setErrors(data.items);
    } catch {
      showToast("Hata listesi yüklenemedi", "error");
    } finally {
      setErrorsLoading(false);
    }
  }, [showToast]);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const data = await getPhase1FolderHealth();
      setFolders(data.items);
    } catch {
      showToast("Klasör sağlığı yüklenemedi", "error");
    } finally {
      setFoldersLoading(false);
    }
  }, [showToast]);

  const loadFolderDocuments = useCallback(async () => {
    try {
      const pageSize = 100;
      const maxPages = 10;
      let page = 1;
      let totalCount = 0;
      const allItems: Phase1QueueRecord[] = [];

      do {
        const response = await getPhase1Queue({
          page,
          pageSize,
          sortBy: "created_at",
          sortDir: "desc",
        });
        allItems.push(...response.items);
        totalCount = response.total;
        page += 1;
      } while (allItems.length < totalCount && page <= maxPages);

      const grouped = allItems.reduce<Record<string, Phase1QueueRecord[]>>((acc, item) => {
        if (!acc[item.folderType]) {
          acc[item.folderType] = [];
        }
        acc[item.folderType].push(item);
        return acc;
      }, {});

      setFolderDocuments(grouped);
    } catch {
      setFolderDocuments({});
      showToast("Dosya dökümü yüklenemedi", "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (autoRefreshEnabled) {
      autoRefreshRef.current = setInterval(() => {
        void loadSummary();
        if (activeTab === "queue") void loadQueue();
        if (activeTab === "errors") void loadErrors();
        if (activeTab === "folder-health") {
          void loadFolders();
          void loadFolderDocuments();
        }
      }, 30000); // 30 saniye
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefreshEnabled, activeTab, loadSummary, loadQueue, loadErrors, loadFolders, loadFolderDocuments]);

  // İlk yükleme
  useEffect(() => {
    void loadSummary();
    void loadQueue();
  }, [loadSummary, loadQueue]);

  // Sekme değişince ilgili veriyi yükle
  useEffect(() => {
    if (activeTab === "errors") void loadErrors();
    if (activeTab === "folder-health") {
      void loadFolders();
      void loadFolderDocuments();
    }
  }, [activeTab, loadErrors, loadFolders, loadFolderDocuments]);

  // ----- Aksiyonlar -----
  const handleRetry = useCallback(
    async (recordId: string) => {
      try {
        const res = await postManualRetry(recordId);
        showToast(res.message ?? "Retry planlandı", "success");
        void loadSummary();
        void loadQueue();
      } catch {
        showToast("Retry başlatılamadı", "error");
      }
    },
    [loadSummary, loadQueue, showToast],
  );

  const handleRescan = useCallback(
    async (folderType: string) => {
      try {
        const res = await postManualRescan(folderType);
        showToast(res.message ?? "Tarama başlatıldı", res.ok ? "success" : "error");
        void loadSummary();
        void loadQueue();
        if (activeTab === "folder-health") {
          void loadFolders();
          void loadFolderDocuments();
        }
      } catch {
        showToast("Tarama başlatılamadı", "error");
      }
    },
    [loadSummary, loadQueue, loadFolders, loadFolderDocuments, activeTab, showToast],
  );

  const handleManualUpload = useCallback(async () => {
    if (!manualFile) {
      manualFileInputRef.current?.click();
      return;
    }

    setManualUploading(true);
    try {
      await optiplanWorkflowService.manualImport(manualFile, manualSource, forceDuplicate);
      showToast("Dosya OCR havuzuna eklendi", "success");
      setManualFile(null);
      setForceDuplicate(false);
      if (manualFileInputRef.current) {
        manualFileInputRef.current.value = "";
      }
      void loadSummary();
      void loadQueue();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Manuel yükleme başarısız";
      showToast(message, "error");
    } finally {
      setManualUploading(false);
    }
  }, [forceDuplicate, loadQueue, loadSummary, manualFile, manualSource, showToast]);

  const handleParamsChange = useCallback((patch: Partial<Phase1QueueParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
    setSelectedIds([]); // Filtre değişince seçimleri temizle
  }, []);

  const handleRefresh = useCallback(() => {
    void loadSummary();
    void loadQueue();
    if (activeTab === "errors") {
      void loadErrors();
    }
    if (activeTab === "folder-health") {
      void loadFolders();
      void loadFolderDocuments();
    }
    setSelectedIds([]); // Yenilemede seçimleri temizle
  }, [loadSummary, loadQueue, loadErrors, loadFolders, loadFolderDocuments, activeTab]);

  const handleSaveCurrentFilters = useCallback(() => {
    const input = window.prompt("Preset adı girin:", selectedPresetName || "Yeni Preset");
    const name = input?.trim();
    if (!name) return;
    const preset: QueueFilterPreset = {
      name,
      params: normalizePresetParams(params),
    };
    const withoutSame = filterPresets.filter((item) => item.name !== name);
    persistPresets([...withoutSame, preset]);
    setSelectedPresetName(name);
    showToast(`Filtre preset kaydedildi: ${name}`, "success");
  }, [filterPresets, params, persistPresets, selectedPresetName, showToast]);

  const handleApplyPreset = useCallback(() => {
    if (!selectedPresetName) return;
    const preset = filterPresets.find((item) => item.name === selectedPresetName);
    if (!preset) return;
    setParams((prev) => ({
      ...prev,
      ...preset.params,
      page: 1,
    }));
    setSelectedIds([]);
    showToast(`Preset yüklendi: ${selectedPresetName}`, "success");
  }, [filterPresets, selectedPresetName, showToast]);

  const handleDeletePreset = useCallback(() => {
    if (!selectedPresetName) return;
    if (!window.confirm(`Preset silinsin mi? (${selectedPresetName})`)) return;
    const next = filterPresets.filter((item) => item.name !== selectedPresetName);
    persistPresets(next);
    setSelectedPresetName("");
    showToast("Preset silindi", "success");
  }, [filterPresets, persistPresets, selectedPresetName, showToast]);

  // ----- Batch Retry Aksiyonları -----
  const handleToggleSelect = useCallback((recordId: string) => {
    setSelectedIds((prev) =>
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(records.map((r) => r.recordId));
  }, [records]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleBatchRetry = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await postBatchRetry(selectedIds);
      showToast(`${res.processedCount} kayıt için retry planlandı`, "success");
      setSelectedIds([]);
      void loadSummary();
      void loadQueue();
    } catch {
      showToast("Batch retry başlatılamadı", "error");
    }
  }, [selectedIds, loadSummary, loadQueue, showToast]);

  // ----- Render -----
  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "queue", label: "Kuyruk", icon: <Inbox size={14} />, badge: total || undefined },
    {
      id: "errors",
      label: "Hatalar",
      icon: <AlertCircle size={14} />,
      badge: summary?.errorCount || undefined,
    },
    {
      id: "folder-health",
      label: "Klasör Durumu",
      icon: <Folder size={14} />,
      badge: folders.filter((f) => f.healthStatus !== "HEALTHY").length || undefined,
    },
  ];

  return (
    <div style={S.page}>
      {/* Sayfa başlığı */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: 56,
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Layers size={18} color="#3b82f6" />
          <span style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
            Phase 1 — OCR Havuzu
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#475569",
              padding: "2px 8px",
              background: "#1e293b",
              borderRadius: 4,
              border: "1px solid #334155",
            }}
          >
            v2
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              ...S.btnSecondary,
              background: autoRefreshEnabled ? "#1e3a5f" : "transparent",
              borderColor: autoRefreshEnabled ? "#3b82f6" : "#334155",
              color: autoRefreshEnabled ? "#93c5fd" : "#94a3b8",
            }}
            onClick={() => setAutoRefreshEnabled((v) => !v)}
            title={autoRefreshEnabled ? "Otomatik yenileme açık (30s)" : "Otomatik yenileme kapalı"}
          >
            <RefreshCw size={13} style={{ animation: autoRefreshEnabled ? "spin 2s linear infinite" : undefined }} />
            {autoRefreshEnabled ? "Oto: Açık" : "Oto: Kapalı"}
          </button>
          <button style={S.btnSecondary} onClick={handleRefresh} title="Tümünü yenile">
            <RefreshCw size={13} />
            Yenile
          </button>
        </div>
      </div>

      {/* İçerik */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "auto",
        }}
      >
        {/* KPI Kartları */}
        <SummaryCards summary={summary} loading={summaryLoading} />

        {/* Sekmeler */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #334155",
            gap: 0,
          }}
        >
          {tabs.map((t) => {
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#e2e8f0" : "#64748b",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {t.icon}
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span
                    style={{
                      background: t.id === "errors" ? "#7f1d1d" : "#1e3a5f",
                      color: t.id === "errors" ? "#fca5a5" : "#93c5fd",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 6px",
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sekme içeriği */}
        {activeTab === "queue" && (
          <>
            <div
              style={{
                ...S.panel,
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1fr) minmax(140px, 180px) auto auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <label style={{ display: "grid", gap: 4, color: "#94a3b8", fontSize: 11 }}>
                OCR Dosyası
                <div
                  style={{
                    ...S.input,
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  aria-label="OCR Dosyası"
                >
                  {manualFile?.name ?? "Dosya seçilmedi"}
                </div>
                <input
                  ref={manualFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setManualFile(event.target.files?.[0] ?? null)}
                  style={{ display: "none" }}
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </label>

              <label style={{ display: "grid", gap: 4, color: "#94a3b8", fontSize: 11 }}>
                Kaynak
                <select
                  value={manualSource}
                  onChange={(event) => setManualSource(event.target.value as WorkflowSourceFolder)}
                  style={S.select}
                  aria-label="Kaynak"
                >
                  {MANUAL_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#cbd5e1",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="checkbox"
                  checked={forceDuplicate}
                  onChange={(event) => setForceDuplicate(event.target.checked)}
                  aria-label="Yinelemeyi zorla"
                />
                Yinelemeyi zorla
              </label>

              <button
                style={S.btnPrimary}
                onClick={() => void handleManualUpload()}
                disabled={manualUploading}
                title="Seçilen dosyayı OCR havuzuna yükle"
              >
                {manualUploading ? "Yükleniyor..." : "Dosyayı Yükle"}
              </button>
            </div>

            {/* Filtreler */}
            <FiltersBar
              params={params}
              onChange={handleParamsChange}
              onRefresh={handleRefresh}
              loading={queueLoading}
            />

            <div style={{ ...S.panel, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ color: "#cbd5e1", fontSize: 12 }}>Filtre Preset</strong>
              <select
                style={S.select}
                value={selectedPresetName}
                onChange={(e) => setSelectedPresetName(e.target.value)}
              >
                <option value="">Preset seçin</option>
                {filterPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
              </select>
              <button style={S.btnSecondary} onClick={handleApplyPreset} title="Seçili filtre presetini uygula">Preset Uygula</button>
              <button style={S.btnSecondary} onClick={handleSaveCurrentFilters}>Kaydet</button>
              <button style={S.btnSecondary} onClick={handleDeletePreset} disabled={!selectedPresetName}>Sil</button>
            </div>

            <div style={{ ...S.panel, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <strong style={{ color: "#cbd5e1", fontSize: 13 }}>Retry İçgörü</strong>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Bekleyen: <span style={{ color: retryInsights.retryPendingCount > 0 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>{retryInsights.retryPendingCount}</span>
                </span>
              </div>
              {retryInsights.topReasons.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {retryInsights.topReasons.map(([reason, count], index) => (
                    <div
                      key={reason}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr auto",
                        gap: 8,
                        alignItems: "center",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        padding: "6px 8px",
                        background: "#0f172a",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{index + 1}</span>
                      <span style={{ fontSize: 12, color: "#cbd5e1" }}>{reason}</span>
                      <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: "#64748b" }}>Retry kaynağı oluşturacak hata verisi henüz yok.</span>
              )}
            </div>

            {/* Tablo */}
            <div style={S.panel}>
              {/* Batch Retry Toolbar */}
              {selectedIds.length > 0 && (
                <div style={{ padding: "8px 12px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", gap: 12, background: "#1e3a5f" }}>
                  <span style={{ fontSize: 13, color: "#93c5fd" }}>
                    {selectedIds.length} kayıt seçildi
                  </span>
                  <button style={S.btnPrimary} onClick={handleBatchRetry}>
                    <RotateCcw size={13} />
                    Toplu Retry
                  </button>
                  <button style={S.btnSecondary} onClick={handleSelectNone}>
                    Seçimi Temizle
                  </button>
                </div>
              )}
              <QueueTable
                records={records}
                folders={folders}
                loading={queueLoading}
                selectedId={selectedRecordId}
                selectedIds={selectedIds}
                onSelect={(r) =>
                  setSelectedRecordId((prev) => (prev === r.recordId ? null : r.recordId))
                }
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
                onRetry={handleRetry}
                onBatchRetry={handleBatchRetry}
                onViewImage={(imageUrl, fileName) => setLightbox({ imageUrl, fileName })}
              />
            </div>

            {/* Sayfalama */}
            <Pagination
              page={params.page ?? 1}
              pageSize={params.pageSize ?? PAGE_SIZE}
              total={total}
              onChange={(p) => handleParamsChange({ page: p })}
            />
          </>
        )}

        {activeTab === "errors" && (
          <div style={S.panel}>
            <ErrorsView errors={errors} loading={errorsLoading} onRetry={handleRetry} />
          </div>
        )}

        {activeTab === "folder-health" && (
          <FolderHealthView
            folders={folders}
            folderDocuments={folderDocuments}
            loading={foldersLoading}
            onRescan={handleRescan}
          />
        )}
      </div>

      {/* Detay Drawer */}
      <DetailDrawer
        recordId={selectedRecordId}
        onClose={() => setSelectedRecordId(null)}
        onRetry={handleRetry}
        onRescan={handleRescan}
      />

      {/* Overlay — drawer açıkken */}
      {selectedRecordId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#00000040",
            zIndex: 199,
          }}
          onClick={() => setSelectedRecordId(null)}
          aria-hidden="true"
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          imageUrl={lightbox.imageUrl}
          fileName={lightbox.fileName}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Toast bildirimleri */}
      <ToastList toasts={toasts} />

      {/* Spinner animasyonu */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
