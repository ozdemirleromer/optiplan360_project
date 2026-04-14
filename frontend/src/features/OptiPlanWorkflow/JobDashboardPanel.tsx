import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FolderCheck,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  canCreatePhase4Preview,
  canRunPhase4Export,
  canRunPhase4Retry,
  createPhase4Preview,
  exportPhase4Record,
  getPhase4FolderHealth,
  getPhase4Queue,
  getPhase4RecordDetail,
  retryPhase4Record,
  type FolderHealthStatus,
  type Phase4FolderHealthItem,
  type Phase4QueueItem,
  type Phase4RecordDetail,
} from "../../services/phase4Service";
import { COLORS, RADIUS } from "../../components/Shared/constants";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  PIPELINE_ORDER,
  formatPhase4Date,
  sortPhase4Queue,
  healthColor,
} from "./phase4Constants";

/* ---------- Local healthIcon (uses shared healthColor + COLORS) ---------- */
function healthIcon(s: FolderHealthStatus) {
  if (s === "HEALTHY") return <CheckCircle2 size={14} color={COLORS.success} />;
  if (s === "ERROR" || s === "OFFLINE") return <AlertTriangle size={14} color={COLORS.danger} />;
  return <Clock size={14} color={COLORS.warning} />;
}

/* ---------- Props ---------- */
export interface JobDashboardPanelProps {
  preferredRecordId?: string | null;
  compact?: boolean;
}

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const headerLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const badgesRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const rowActionButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
};

const detailActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginTop: 10,
};

const folderNameStyle: React.CSSProperties = {
  color: COLORS.text,
};

function getDetailHeaderStyle(): React.CSSProperties {
  return {
    ...headerRowStyle,
    marginBottom: 8,
  };
}

function getHeaderTitleStyle(compact: boolean): React.CSSProperties {
  return {
    color: COLORS.text,
    fontSize: compact ? 13 : 15,
  };
}

function getHeaderSubtitleStyle(compact: boolean): React.CSSProperties {
  return {
    color: COLORS.muted,
    fontSize: compact ? 11 : 12,
  };
}

function getLoadingPanelStyle(panel: React.CSSProperties): React.CSSProperties {
  return {
    ...panel,
    color: COLORS.muted,
  };
}

function getRefreshButtonStyle(
  btn: (enabled: boolean, color: string) => React.CSSProperties
): React.CSSProperties {
  return {
    ...btn(true, COLORS.border),
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
  };
}

function getFolderStatusStyle(status: FolderHealthStatus): React.CSSProperties {
  return {
    color: healthColor(status),
    fontWeight: 600,
  };
}

function getErrorRowStyle(compact: boolean): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    alignItems: "center",
    color: COLORS.danger,
    fontSize: compact ? 11 : 12,
  };
}

function getFolderRowStyle(compact: boolean): React.CSSProperties {
  return {
    display: "flex",
    gap: compact ? 8 : 12,
    flexWrap: "wrap",
  };
}

function getFolderItemStyle(compact: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: compact ? 11 : 12,
  };
}

function getQueueEmptyCellStyle(td: React.CSSProperties): React.CSSProperties {
  return {
    ...td,
    textAlign: "center",
    color: COLORS.muted,
  };
}

function getQueueRowStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? `${COLORS.primary}18` : "transparent",
    cursor: "pointer",
  };
}

function getRecordIdCellStyle(td: React.CSSProperties, compact: boolean): React.CSSProperties {
  return {
    ...td,
    fontFamily: "monospace",
    fontSize: compact ? 11 : 12,
  };
}

function getRetryCellStyle(td: React.CSSProperties): React.CSSProperties {
  return {
    ...td,
    textAlign: "center",
  };
}

function getDetailRegionStyle(pad: number): React.CSSProperties {
  return {
    background: COLORS.bg.main,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.sm,
    padding: pad,
  };
}

function getDetailTitleStyle(compact: boolean): React.CSSProperties {
  return {
    color: COLORS.text,
    fontSize: compact ? 12 : 13,
  };
}

function getDetailErrorStyle(compact: boolean): React.CSSProperties {
  return {
    marginTop: 8,
    padding: 6,
    background: `${COLORS.danger}15`,
    borderRadius: RADIUS.sm,
    color: COLORS.danger,
    fontSize: compact ? 11 : 12,
  };
}

function getDetailCellLabelStyle(compact: boolean): React.CSSProperties {
  return {
    fontSize: compact ? 10 : 11,
    color: COLORS.muted,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
}

function getDetailCellValueStyle(compact: boolean): React.CSSProperties {
  return {
    fontSize: compact ? 12 : 13,
    color: COLORS.text,
    wordBreak: "break-word",
  };
}

/* ---------- Component ---------- */
export function JobDashboardPanel({ preferredRecordId = null, compact = false }: JobDashboardPanelProps) {
  const [queue, setQueue] = useState<Phase4QueueItem[]>([]);
  const [folders, setFolders] = useState<Phase4FolderHealthItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Phase4RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pad = compact ? 8 : 14;
  const fontSize = compact ? 12 : 13;

  /* --- data loading --- */
  const refresh = useCallback(
    async (focusId?: string | null) => {
      try {
        setError(null);
        const [qRes, fRes] = await Promise.all([getPhase4Queue(), getPhase4FolderHealth()]);
        const sorted = sortPhase4Queue(qRes.items ?? []);
        setQueue(sorted);
        setFolders(fRes.items ?? []);
        setSelectedId((cur) => {
          const target = focusId ?? preferredRecordId ?? cur;
          if (target && sorted.some((i) => i.recordId === target)) return target;
          return sorted[0]?.recordId ?? "";
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kuyruk yüklenemedi.");
      } finally {
        setLoading(false);
      }
    },
    [preferredRecordId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const d = await getPhase4RecordDetail(selectedId);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  /* --- actions --- */
  const runAction = useCallback(
    async (action: "preview" | "export" | "retry") => {
      if (!selectedId) return;
      setBusy(true);
      try {
        if (action === "preview") await createPhase4Preview(selectedId);
        else if (action === "export") await exportPhase4Record(selectedId);
        else await retryPhase4Record(selectedId);
        await refresh(selectedId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "İşlem başarısız.");
      } finally {
        setBusy(false);
      }
    },
    [selectedId, refresh],
  );

  /* --- derived --- */
  const statusCounts = useMemo(
    () => queue.reduce<Record<string, number>>((acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; }, {}),
    [queue],
  );

  const canPreview = detail ? canCreatePhase4Preview(detail.record.status) : false;
  const canExport = detail ? canRunPhase4Export(detail.record.status) : false;
  const canRetry = detail ? canRunPhase4Retry(detail.record.status) : false;

  /* --- styles --- */
  const panel: React.CSSProperties = {
    background: COLORS.bg.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg,
    padding: pad, display: "grid", gap: pad, fontSize,
  };
  const th: React.CSSProperties = {
    textAlign: "left", padding: `${compact ? 4 : 6}px 8px`, fontSize: compact ? 11 : 12,
    color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: `${compact ? 3 : 5}px 8px`, borderBottom: `1px solid ${COLORS.border}`,
    color: COLORS.text, fontSize, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180,
  };
  const badge = (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 999,
    fontSize: compact ? 10 : 11, fontWeight: 600, color: "#fff",
    background: color,
  });
  const btn = (enabled: boolean, color: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: compact ? "3px 8px" : "5px 12px", borderRadius: RADIUS.sm,
    fontSize: compact ? 11 : 12, fontWeight: 600, border: "none", cursor: enabled ? "pointer" : "not-allowed",
    color: "#fff", background: enabled ? color : COLORS.border, opacity: enabled ? 1 : 0.5,
  });

  if (loading) {
    return <div style={getLoadingPanelStyle(panel)}>Phase 4 kuyruk yükleniyor...</div>;
  }

  return (
    <div style={panel} aria-label="Phase 4 Job Dashboard">
      {/* --- Header --- */}
      <div style={headerRowStyle}>
        <div style={headerLeftStyle}>
          <Activity size={compact ? 14 : 16} color={COLORS.primary} />
          <strong style={getHeaderTitleStyle(compact)}>Job Dashboard</strong>
          <span style={getHeaderSubtitleStyle(compact)}>{queue.length} kayıt</span>
        </div>
        <button
          type="button"
          style={getRefreshButtonStyle(btn)}
          onClick={() => void refresh()}
        >
          <RefreshCw size={12} /> Yenile
        </button>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          style={getErrorRowStyle(compact)}
        >
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* --- Pipeline status badges --- */}
      <div style={badgesRowStyle}>
        {PIPELINE_ORDER.map((s) => (
          <span key={s} style={badge(STATUS_COLOR[s])}>
            {STATUS_LABEL[s]} {statusCounts[s] ?? 0}
          </span>
        ))}
        {(statusCounts.PHASE4_EXPORT_FAILED ?? 0) > 0 && (
          <span style={badge(COLORS.danger)}>Hatalı {statusCounts.PHASE4_EXPORT_FAILED}</span>
        )}
      </div>

      {/* --- Folder health --- */}
      {folders.length > 0 && (
        <div style={getFolderRowStyle(compact)}>
          {folders.map((f) => (
            <div key={f.folderType} style={getFolderItemStyle(compact)}>
              <FolderCheck size={13} color={healthColor(f.healthStatus)} />
              {healthIcon(f.healthStatus)}
              <span style={folderNameStyle}>{f.folderType.replace("phase4_", "")}</span>
              <span style={getFolderStatusStyle(f.healthStatus)}>{f.healthStatus}</span>
            </div>
          ))}
        </div>
      )}

      {/* --- Queue table --- */}
      <div style={tableWrapStyle}>
        <table style={tableStyle} aria-label="Phase 4 iş kuyruğu">
          <thead>
            <tr>
              <th style={th}>Kayıt ID</th>
              <th style={th}>Belge</th>
              <th style={th}>Durum</th>
              <th style={th}>Retry</th>
              <th style={th}>Güncelleme</th>
              <th style={th}>Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 && (
              <tr><td colSpan={6} style={getQueueEmptyCellStyle(td)}>Kuyrukta kayıt yok.</td></tr>
            )}
            {queue.map((item) => {
              const active = item.recordId === selectedId;
              const previewEnabled = canCreatePhase4Preview(item.status) && !busy;
              const exportEnabled = canRunPhase4Export(item.status) && !busy;
              const retryEnabled = canRunPhase4Retry(item.status) && !busy;
              return (
                <tr
                  key={item.recordId}
                  style={getQueueRowStyle(active)}
                  onClick={() => setSelectedId(item.recordId)}
                >
                  <td style={getRecordIdCellStyle(td, compact)}>{item.recordId}</td>
                  <td style={td}>{item.documentName || "-"}</td>
                  <td style={td}><span style={badge(STATUS_COLOR[item.status])}>{STATUS_LABEL[item.status]}</span></td>
                  <td style={getRetryCellStyle(td)}>{item.retryCount}</td>
                  <td style={td}>{formatPhase4Date(item.updatedAt)}</td>
                  <td style={td}>
                    <div style={rowActionButtonsStyle}>
                      <button
                        type="button"
                        style={btn(previewEnabled, COLORS.primary)}
                        disabled={!previewEnabled}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(item.recordId); void runAction("preview"); }}
                        aria-label="Önizleme oluştur"
                        title={previewEnabled ? "Önizleme oluştur" : "Önizleme yalnız PHASE4_PENDING durumunda üretilir"}
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        type="button"
                        style={btn(exportEnabled, COLORS.success)}
                        disabled={!exportEnabled}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(item.recordId); void runAction("export"); }}
                        aria-label="Export çalıştır"
                        title={exportEnabled ? "Export çalıştır" : "Export için önce preview gerekir"}
                      >
                        <Play size={12} />
                      </button>
                      <button
                        type="button"
                        style={btn(retryEnabled, COLORS.warning)}
                        disabled={!retryEnabled}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(item.recordId); void runAction("retry"); }}
                        aria-label="Tekrar dene"
                        title={retryEnabled ? "Tekrar dene" : "Retry yalnız export hatası sonrasında açılır"}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- Selected record detail / audit --- */}
      {detail && (
        <div
          role="region"
          aria-label="Seçili kayıt detayı"
          style={getDetailRegionStyle(pad)}
        >
          <div style={getDetailHeaderStyle()}>
            <strong style={getDetailTitleStyle(compact)}>
              Seçili Kayıt: {detail.record.recordId}
            </strong>
            <span style={badge(STATUS_COLOR[detail.record.status])}>{STATUS_LABEL[detail.record.status]}</span>
          </div>
          <div style={detailGridStyle}>
            <DetailCell label="Cari Kodu" value={detail.record.customerCode ?? "-"} compact={compact} />
            <DetailCell label="Dosya" value={detail.record.outputFileName ?? "-"} compact={compact} />
            <DetailCell label="Retry" value={String(detail.record.retryCount)} compact={compact} />
            <DetailCell label="Phase4 Ready" value={detail.record.phase4Ready ? "Evet" : "Hayır"} compact={compact} />
            <DetailCell label="Mapping Profili" value={detail.mappingSummary.profileName} compact={compact} />
            <DetailCell label="Mapping Kilitli" value={detail.mappingSummary.locked ? "Evet" : "Hayır"} compact={compact} />
          </div>
          {detail.record.lastErrorMessage && (
            <div
              aria-live="polite"
              style={getDetailErrorStyle(compact)}
            >
              {detail.record.lastErrorMessage}
            </div>
          )}
          {/* Action bar for selected record */}
          <div style={detailActionsStyle}>
            <button
              type="button"
              style={btn(canPreview && !busy, COLORS.primary)}
              disabled={!canPreview || busy}
              onClick={() => void runAction("preview")}
              aria-label="Önizleme oluştur"
              title={canPreview ? "Önizleme oluştur" : "Önizleme yalnız PHASE4_PENDING durumunda üretilir"}
            >
              <Eye size={12} /> Önizleme
            </button>
            <button
              type="button"
              style={btn(canExport && !busy, COLORS.success)}
              disabled={!canExport || busy}
              onClick={() => void runAction("export")}
              aria-label="Export çalıştır"
              title={canExport ? "Export çalıştır" : "Export için önce preview gerekir"}
            >
              <Play size={12} /> Export
            </button>
            <button
              type="button"
              style={btn(canRetry && !busy, COLORS.warning)}
              disabled={!canRetry || busy}
              onClick={() => void runAction("retry")}
              aria-label="Tekrar dene"
              title={canRetry ? "Tekrar dene" : "Retry yalnız export hatası sonrasında açılır"}
            >
              <RotateCcw size={12} /> Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */
function DetailCell({ label, value, compact }: { label: string; value: string; compact: boolean }) {
  return (
    <div>
      <div style={getDetailCellLabelStyle(compact)}>
        {label}
      </div>
      <div style={getDetailCellValueStyle(compact)}>{value}</div>
    </div>
  );
}
