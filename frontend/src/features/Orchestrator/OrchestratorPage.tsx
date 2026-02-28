/**
 * OptiPlan 360 — OptiPlanning Job Yonetim Sayfasi
 * Sade, verimli ve gercekten calisan tasarim
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  XCircle,
  Download,
  Search,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Receipt,
  Activity,
  Zap,
  Plus,
} from "lucide-react";
import { Button, COLORS, RADIUS, useConfirmation, Modal } from "../../components/Shared";
import { TopBar } from "../../components/Layout";
import { orchestratorService } from "../../services/orchestratorService";
import { ordersService } from "../../services/ordersService";
import type { OptiJob, OptiJobState, Order, ProductionReceipt, WorkerStatus } from "../../types";
import { OPTI_STATE_LABELS, OPTI_STATE_COLORS } from "../../types";

const REFRESH_MS = 45_000;
const MAX_RETRY_MS = 120_000;
const PAGE_SIZE = 25;

// ── Yardimci Bilesenler ─────────────────────────────────────────────────────

function StateBadge({ state }: { state: OptiJobState }) {
  const label = OPTI_STATE_LABELS[state] ?? state;
  const color = OPTI_STATE_COLORS[state] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: RADIUS.full,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: color + "22",
        color,
        border: `1px solid ${color}44`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az once";
  if (mins < 60) return `${mins} dk once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat once`;
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

// ── Job Karti ─────────────────────────────────────────────────────────────

function JobCard({
  job,
  onApprove,
  onRetry,
  onCancel,
  loading,
}: {
  job: OptiJob;
  onApprove: (id: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  loading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [receipt, setReceipt] = useState<ProductionReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  const isLoading = loading === job.id;

  useEffect(() => {
    if (!expanded) return;
    const canLoad = ["XML_READY", "DELIVERED", "DONE", "OPTI_DONE"].includes(job.state);
    if (!canLoad) return;
    setReceiptLoading(true);
    orchestratorService.getReceipt(job.id)
      .then(setReceipt)
      .catch(() => setReceipt(null))
      .finally(() => setReceiptLoading(false));
  }, [expanded, job.id, job.state]);

  async function handleCreateReceipt() {
    setCreatingReceipt(true);
    try {
      await orchestratorService.createReceipt(job.id);
      const updated = await orchestratorService.getReceipt(job.id);
      setReceipt(updated);
    } catch {
      // sessiz
    } finally {
      setCreatingReceipt(false);
    }
  }

  const canCancel = !["DONE", "FAILED"].includes(job.state);
  const isXmlReady = job.state === "XML_READY";

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        borderLeft: `4px solid ${OPTI_STATE_COLORS[job.state] ?? COLORS.muted}`,
        backgroundColor: expanded ? COLORS.bg.elevated : COLORS.surface,
        transition: "background 0.15s",
        marginBottom: 8,
      }}
    >
      {/* Ozet satiri */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          gap: 12,
          cursor: "pointer",
          flexWrap: "wrap",
        }}
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? <ChevronDown size={14} color={COLORS.muted} /> : <ChevronRight size={14} color={COLORS.muted} />}

        {/* Siparis No */}
        <div style={{ minWidth: 80 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.primary.DEFAULT }}>
            #{job.orderId}
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
            {job.id.substring(0, 8)}
          </div>
        </div>

        {/* Durum */}
        <StateBadge state={job.state} />

        {/* Hata (varsa) */}
        {job.errorMessage && (
          <div
            style={{
              fontSize: 11,
              color: "#ef4444",
              maxWidth: 250,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={job.errorMessage}
          >
            {job.errorMessage.substring(0, 80)}
          </div>
        )}

        {/* Zaman */}
        <div style={{ fontSize: 11, color: COLORS.muted, marginLeft: "auto", whiteSpace: "nowrap" }}>
          {timeAgo(job.updatedAt ?? job.createdAt)}
        </div>

        {/* Aksiyonlar */}
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {isXmlReady && (
            <a
              href={orchestratorService.getXmlDownloadUrl(job.id)}
              target="_blank"
              rel="noreferrer"
              title="XML Indir"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: RADIUS.md,
                fontSize: 11,
                fontWeight: 600,
                background: COLORS.primary.DEFAULT,
                color: "#fff",
                textDecoration: "none",
              }}
            >
              <Download size={12} /> XML
            </a>
          )}
          {job.state === "HOLD" && (
            <Button size="sm" variant="primary" onClick={() => onApprove(job.id)} disabled={isLoading}>
              Onayla
            </Button>
          )}
          {(job.state === "FAILED" || job.state === "HOLD") && (
            <Button size="sm" variant="secondary" onClick={() => onRetry(job.id)} disabled={isLoading}>
              <RotateCcw size={12} style={{ marginRight: 3 }} /> Tekrar
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="danger" onClick={() => onCancel(job.id)} disabled={isLoading}>
              <XCircle size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Detay paneli */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${COLORS.border}` }}>
          {/* Temel bilgiler */}
          <div style={{ display: "flex", gap: 24, padding: "12px 0", flexWrap: "wrap", fontSize: 12 }}>
            <div>
              <span style={{ color: COLORS.muted }}>Olusturulma: </span>
              <span style={{ color: COLORS.text }}>
                {job.createdAt ? new Date(job.createdAt).toLocaleString("tr-TR") : "-"}
              </span>
            </div>
            <div>
              <span style={{ color: COLORS.muted }}>Son Guncelleme: </span>
              <span style={{ color: COLORS.text }}>
                {job.updatedAt ? new Date(job.updatedAt).toLocaleString("tr-TR") : "-"}
              </span>
            </div>
            {job.retryCount > 0 && (
              <div>
                <span style={{ color: COLORS.muted }}>Tekrar Deneme: </span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{job.retryCount}x</span>
              </div>
            )}
          </div>

          {/* Hata detayi */}
          {job.errorMessage && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                backgroundColor: "#ef444418",
                borderRadius: RADIUS.md,
                border: "1px solid #ef444433",
                color: "#ef4444",
                fontSize: 12,
              }}
            >
              <strong>{job.errorCode}: </strong>
              {job.errorMessage}
            </div>
          )}

          {/* Siparis Fisi / XML Parse */}
          {receiptLoading && (
            <div style={{ fontSize: 12, color: COLORS.muted, padding: "8px 0" }}>
              Siparis fisi yukleniyor...
            </div>
          )}

          {receipt && (
            <div style={{ marginBottom: 12 }}>
              {/* XML Parse Sonucu */}
              {receipt.xmlParse && !receipt.xmlParse.error && receipt.xmlParse.mqBoards !== undefined && (
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8,
                  padding: 12, backgroundColor: COLORS.bg.elevated, borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`, marginBottom: 10,
                }}>
                  {[
                    { label: "Plaka m\u00b2", value: receipt.xmlParse.mqBoards?.toFixed(2) },
                    { label: "Plaka Adedi", value: String(receipt.plakaAdedi) },
                    { label: "Bant (m)", value: receipt.bantMetre.toFixed(2) },
                    { label: "Desen", value: receipt.xmlParse.patterns != null ? String(receipt.xmlParse.patterns) : "-" },
                    { label: "Maliyet", value: receipt.xmlParse.jobCost != null ? `${receipt.xmlParse.jobCost.toFixed(2)} TL` : "-" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fatura */}
              {receipt.invoice ? (
                <div style={{
                  padding: 12, backgroundColor: "#22c55e11", borderRadius: RADIUS.md,
                  border: "1px solid #22c55e33",
                  display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.muted }}>Fatura</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{receipt.invoice.number}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.muted }}>Toplam</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>
                      {receipt.invoice.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: 10, backgroundColor: COLORS.bg.elevated, borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>Siparis fisi henuz olusturulmamis.</span>
                  <Button size="sm" variant="primary" onClick={handleCreateReceipt} disabled={creatingReceipt}>
                    <Receipt size={12} style={{ marginRight: 4 }} />
                    {creatingReceipt ? "..." : "Fis Olustur"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Audit trail (sadece son 5 olay) */}
          {job.events.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                Son Olaylar
              </div>
              {[...job.events]
                .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
                .slice(0, 5)
                .map((ev) => (
                  <div key={ev.id} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 11 }}>
                    <span style={{ color: COLORS.muted, minWidth: 100 }}>
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString("tr-TR") : "-"}
                    </span>
                    <span style={{ color: COLORS.text }}>{ev.message ?? ev.eventType}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function OrchestratorPage() {
  const [jobs, setJobs] = useState<OptiJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [orderIdSearch, setOrderIdSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);

  // Yeni job olusturma
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string | number>>(new Set());
  const [orderSearchTerm, setOrderSearchTerm] = useState("");

  const isMountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(REFRESH_MS);
  const { confirm } = useConfirmation();

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Veri Yukleme ──────────────────────────────────────────────────────────

  const loadJobs = useCallback(async (page = 0) => {
    if (!isMountedRef.current) return;
    setLoading(true);
    let anyFailed = false;
    try {
      const orderId = orderIdSearch.trim() ? parseInt(orderIdSearch.trim(), 10) : undefined;
      const res = await orchestratorService.listJobs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        state: stateFilter || undefined,
        orderId: orderId && !isNaN(orderId) ? orderId : undefined,
      });
      if (isMountedRef.current) {
        setJobs(res.jobs);
        setTotal(res.total);
      }
    } catch {
      anyFailed = true;
    } finally {
      if (isMountedRef.current) setLoading(false);
      if (anyFailed) {
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS);
      } else {
        retryDelayRef.current = REFRESH_MS;
      }
      if (isMountedRef.current) {
        timerRef.current = setTimeout(() => void loadJobs(page), retryDelayRef.current);
      }
    }
  }, [stateFilter, orderIdSearch]);

  const loadWorkerStatus = useCallback(async () => {
    try {
      const status = await orchestratorService.getWorkerStatus();
      if (isMountedRef.current) setWorkerStatus(status);
    } catch {
      // sessiz
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    setCurrentPage(0);
    void loadJobs(0);
    void loadWorkerStatus();
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadJobs, loadWorkerStatus]);

  // ── Modal: Siparis Listesi Yukle ──────────────────────────────────────────

  useEffect(() => {
    if (!createModalOpen) return;
    setOrdersLoading(true);
    ordersService.list()
      .then((orders) => {
        // Sadece NEW ve IN_PRODUCTION siparisleri goster
        const filtered = orders.filter((o) => ["NEW", "IN_PRODUCTION", "APPROVED"].includes(o.status));
        setAvailableOrders(filtered);
      })
      .catch(() => setAvailableOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [createModalOpen]);

  const filteredAvailableOrders = orderSearchTerm.trim()
    ? availableOrders.filter(
        (o) =>
          o.cust.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
          o.phone.includes(orderSearchTerm) ||
          String(o.id).includes(orderSearchTerm) ||
          (o.orderNo ?? "").toString().includes(orderSearchTerm)
      )
    : availableOrders;

  // ── Aksiyonlar ────────────────────────────────────────────────────────────

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handlePageChange = (newPage: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentPage(newPage);
    void loadJobs(newPage);
  };

  const handleApprove = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const updated = await orchestratorService.approveJob(jobId);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      showFeedback("success", "Job onaylandi.");
    } catch (e: unknown) {
      showFeedback("error", e instanceof Error ? e.message : "Onaylama basarisiz.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const updated = await orchestratorService.retryJob(jobId);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      showFeedback("success", "Job yeniden baslatildi.");
    } catch (e: unknown) {
      showFeedback("error", e instanceof Error ? e.message : "Retry basarisiz.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    const ok = await confirm({
      title: "Job Iptal Et",
      message: "Bu job'i iptal etmek istediginizden emin misiniz?",
      type: "danger",
      confirmText: "Iptal Et",
      cancelText: "Vazgec",
    });
    if (!ok) return;
    setActionLoading(jobId);
    try {
      const updated = await orchestratorService.cancelJob(jobId);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      showFeedback("success", "Job iptal edildi.");
    } catch (e: unknown) {
      showFeedback("error", e instanceof Error ? e.message : "Iptal basarisiz.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateJobs = async () => {
    if (selectedOrderIds.size === 0) return;
    try {
      setActionLoading("new");
      const orderIds = Array.from(selectedOrderIds).map((id) => Number(id));
      await orchestratorService.runOptimization(orderIds);
      showFeedback("success", `${orderIds.length} siparis optimizasyona gonderildi.`);
      setCreateModalOpen(false);
      setSelectedOrderIds(new Set());
      setOrderSearchTerm("");
      if (timerRef.current) clearTimeout(timerRef.current);
      void loadJobs(0);
    } catch (err: unknown) {
      showFeedback("error", err instanceof Error ? err.message : "Optimizasyon tetiklenemedi");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleOrderSelection = (orderId: string | number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // ── KPI Sayilari ──────────────────────────────────────────────────────────

  const stateKPIs: Array<{ key: string; icon: React.ReactNode; label: string }> = [
    { key: "OPTI_RUNNING", icon: <Cpu size={14} />, label: "Calisiyor" },
    { key: "OPTI_DONE", icon: <Clock size={14} />, label: "Opt. Bekliyor" },
    { key: "XML_READY", icon: <FileText size={14} />, label: "XML Hazir" },
    { key: "DONE", icon: <CheckCircle size={14} />, label: "Tamamlandi" },
    { key: "HOLD", icon: <AlertTriangle size={14} />, label: "Beklemede" },
    { key: "FAILED", icon: <XCircle size={14} />, label: "Basarisiz" },
  ];

  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.state] = (acc[j.state] ?? 0) + 1;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="electric-page">
      <TopBar
        title="OptiPlanning Isler"
        subtitle={`${total} is toplam`}
        breadcrumbs={["Orkestrasyon", "OptiPlanning"]}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={14} style={{ marginRight: 6 }} />
            Yeni Optimizasyon
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              void loadJobs(currentPage);
              void loadWorkerStatus();
            }}
            disabled={loading}
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </TopBar>

      <div className="app-page-container">
        {/* Feedback */}
        {feedback && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 16px",
              borderRadius: RADIUS.md,
              backgroundColor: feedback.type === "success" ? "#22c55e22" : "#ef444422",
              color: feedback.type === "success" ? "#22c55e" : "#ef4444",
              border: `1px solid ${feedback.type === "success" ? "#22c55e44" : "#ef444444"}`,
              fontSize: 13,
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Worker Status */}
        {workerStatus && (
          <div style={{
            marginBottom: 16, padding: "8px 16px", borderRadius: RADIUS.md,
            backgroundColor: workerStatus.circuitOpen ? "#ef444415" : COLORS.bg.elevated,
            border: `1px solid ${workerStatus.circuitOpen ? "#ef444444" : COLORS.border}`,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} color={workerStatus.circuitOpen ? "#ef4444" : "#22c55e"} />
              <span style={{ fontWeight: 600, color: workerStatus.circuitOpen ? "#ef4444" : "#22c55e" }}>
                Worker: {workerStatus.circuitOpen ? "DEVRE DISI" : "AKTIF"}
              </span>
            </div>
            <span style={{ color: COLORS.muted }}>
              Kuyruk: <strong style={{ color: COLORS.text }}>{workerStatus.queueCount}</strong>
            </span>
            <span style={{ color: COLORS.muted }}>
              Calisiyor: <strong style={{ color: COLORS.text }}>{workerStatus.runningCount}</strong>
            </span>
            {workerStatus.circuitOpen && (
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  try {
                    await orchestratorService.resetWorkerCircuitBreaker();
                    await loadWorkerStatus();
                    showFeedback("success", "Circuit breaker sifirlandi.");
                  } catch {
                    showFeedback("error", "Sifirlama basarisiz.");
                  }
                }}
              >
                <Zap size={12} style={{ marginRight: 4 }} /> Sifirla
              </Button>
            )}
          </div>
        )}

        {/* KPI Durum Filtreleri */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => setStateFilter("")}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: RADIUS.md, fontSize: 12,
              fontWeight: stateFilter === "" ? 700 : 400,
              border: `1px solid ${stateFilter === "" ? COLORS.primary.DEFAULT + "66" : COLORS.border}`,
              backgroundColor: stateFilter === "" ? COLORS.primary.DEFAULT + "15" : "transparent",
              color: stateFilter === "" ? COLORS.primary.DEFAULT : COLORS.muted,
              cursor: "pointer",
            }}
          >
            Tumunu ({total})
          </button>
          {stateKPIs.map(({ key, icon, label }) => {
            const count = counts[key] ?? 0;
            const active = stateFilter === key;
            const color = OPTI_STATE_COLORS[key as OptiJobState];
            return (
              <button
                key={key}
                onClick={() => setStateFilter(active ? "" : key)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: RADIUS.md, fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  border: `1px solid ${active ? color + "66" : COLORS.border}`,
                  backgroundColor: active ? color + "15" : "transparent",
                  color: active ? color : COLORS.muted,
                  cursor: "pointer",
                }}
              >
                {icon}
                <strong style={{ color }}>{count}</strong>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Arama */}
        <div style={{ position: "relative", maxWidth: 250, marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted, pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Siparis No ile ara..."
            value={orderIdSearch}
            onChange={(e) => setOrderIdSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (timerRef.current) clearTimeout(timerRef.current);
                setCurrentPage(0);
                void loadJobs(0);
              }
            }}
            style={{
              width: "100%", padding: "8px 10px 8px 30px", borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`, background: COLORS.bg.elevated,
              color: COLORS.text, fontSize: 12, outline: "none",
            }}
          />
        </div>

        {/* Job Listesi */}
        {loading && jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>
            <RefreshCw size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>Yukleniyor...</div>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>
            <FileText size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Henuz is yok</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              "Yeni Optimizasyon" butonuyla siparis secerek baslatabilirsiniz.
            </div>
          </div>
        ) : (
          <div>
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onApprove={handleApprove}
                onRetry={handleRetry}
                onCancel={handleCancel}
                loading={actionLoading}
              />
            ))}
          </div>
        )}

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 16, padding: "10px 16px",
            backgroundColor: COLORS.bg.elevated, borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              Sayfa {currentPage + 1} / {totalPages}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0 || loading}>
                <ChevronLeft size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1 || loading}>
                <ChevronRightIcon size={14} />
              </Button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted, textAlign: "right" }}>
          {REFRESH_MS / 1000}s'de otomatik guncellenir
          {loading && " — Guncelleniyor..."}
        </div>
      </div>

      {/* Yeni Optimizasyon Modal — Siparis Secimli */}
      <Modal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setSelectedOrderIds(new Set()); setOrderSearchTerm(""); }}
        title="Yeni Optimizasyon Baslat"
        subtitle="Optimizasyona gondermek istediginiz siparisleri secin"
        id="create-job-modal"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Arama */}
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted, pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Musteri, telefon veya siparis no ile ara..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px 8px 32px", borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`, background: COLORS.bg.elevated,
                color: COLORS.text, fontSize: 13, outline: "none",
              }}
            />
          </div>

          {/* Secim bilgisi */}
          {selectedOrderIds.size > 0 && (
            <div style={{
              padding: "8px 12px", borderRadius: RADIUS.md,
              backgroundColor: COLORS.primary.DEFAULT + "15",
              border: `1px solid ${COLORS.primary.DEFAULT}44`,
              fontSize: 12, color: COLORS.primary.DEFAULT, fontWeight: 600,
            }}>
              {selectedOrderIds.size} siparis secildi
            </div>
          )}

          {/* Siparis Listesi */}
          <div style={{
            maxHeight: 350, overflowY: "auto",
            border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md,
          }}>
            {ordersLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                Siparisler yukleniyor...
              </div>
            ) : filteredAvailableOrders.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                {availableOrders.length === 0
                  ? "Optimizasyona uygun siparis bulunamadi (NEW / IN_PRODUCTION durumunda siparis gerekli)"
                  : "Aramayla eslesen siparis bulunamadi"}
              </div>
            ) : (
              filteredAvailableOrders.map((order) => {
                const isSelected = selectedOrderIds.has(order.id);
                return (
                  <div
                    key={order.id}
                    onClick={() => toggleOrderSelection(order.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      borderBottom: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                      backgroundColor: isSelected ? COLORS.primary.DEFAULT + "12" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSelected ? COLORS.primary.DEFAULT : COLORS.border}`,
                      backgroundColor: isSelected ? COLORS.primary.DEFAULT : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected && <CheckCircle size={12} color="#fff" />}
                    </div>

                    {/* Siparis bilgisi */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                          {order.orderNo || `#${order.id}`}
                        </span>
                        <span style={{ fontSize: 12, color: COLORS.muted }}>
                          {order.cust}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>
                        {order.mat || "-"} | {order.thick}mm | {order.plate || "-"} | {typeof order.parts === "number" ? order.parts : 0} parca
                      </div>
                    </div>

                    {/* Durum */}
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: RADIUS.full,
                      backgroundColor: order.status === "NEW" ? "#0ea5e922" : "#f59e0b22",
                      color: order.status === "NEW" ? "#0ea5e9" : "#f59e0b",
                      fontWeight: 600,
                    }}>
                      {order.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Gonder butonu */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button
              variant="ghost"
              onClick={() => { setCreateModalOpen(false); setSelectedOrderIds(new Set()); }}
            >
              Vazgec
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateJobs}
              disabled={selectedOrderIds.size === 0 || actionLoading === "new"}
            >
              {actionLoading === "new"
                ? "Gonderiliyor..."
                : `${selectedOrderIds.size > 0 ? selectedOrderIds.size + " Siparis " : ""}Optimizasyona Gonder`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
