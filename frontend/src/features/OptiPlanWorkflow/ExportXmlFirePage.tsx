import { useCallback, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

import { TopBar } from "../../components/Layout";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { Button } from "../../components/Shared";
import { COLORS, RADIUS, SHADOWS, TYPOGRAPHY, primaryRgba } from "../../components/Shared/constants";
import { MasterSpecBanner } from "../../components/Shared/MasterSpecBanner";
import { useToast } from "../../contexts/ToastContext";
import {
  PHASE4_MAPPING_CONTRACT,
  canCreatePhase4Preview,
  canRunPhase4Export,
  canRunPhase4Retry,
  createPhase4Preview,
  exportPhase4Record,
  getPhase4FolderHealth,
  getPhase4Manifests,
  getPhase4Queue,
  getPhase4RecordDetail,
  retryPhase4Record,
  type Phase4ExportResponse,
  type Phase4FolderHealthItem,
  type Phase4ManifestItem,
  type Phase4PreviewLine,
  type Phase4PreviewResponse,
  type Phase4QueueItem,
  type Phase4RecordDetail,
  type Phase4RecordStatus,
} from "../../services/phase4Service";
import { optiplanWorkflowService, type FolderSettings } from "../../services/optiplanWorkflowService";
import { navigateToAppPage } from "../../utils/appNavigation";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatPhase4Date,
  sortPhase4Queue,
  healthColor,
  folderTypeLabel,
  normalizeText,
} from "./phase4Constants";

type DrawerMode = "export" | "manifest" | "mapping" | null;

function folderTypePath(folderType: string, settings: FolderSettings | null): string {
  switch (folderType) {
    case "phase4_output":
      return settings?.xlsxCiktiKlasoru?.trim() || "Backend PHASE4_OUTPUT_DIR";
    case "phase4_preview":
      return "Backend PHASE4_PREVIEW_DIR";
    case "phase4_manifest_archive":
      return "Backend PHASE4_MANIFEST_DIR";
    default:
      return "Tanımsız";
  }
}

function previewDisabledReason(detail: Phase4RecordDetail | null): string | undefined {
  if (!detail) return "Aktif kayıt yükleniyor.";
  if (!detail.record.phase4Ready) return "Kayıt henüz Phase 4 hazır değil.";
  if (canCreatePhase4Preview(detail.record.status)) return undefined;
  return `Önizleme yalnız Phase 4 hazır statüsünde üretilir (${STATUS_LABEL[detail.record.status]}).`;
}

function exportDisabledReason(detail: Phase4RecordDetail | null): string | undefined {
  if (!detail) return "Aktif kayıt yükleniyor.";
  if (!detail.record.phase4Ready) return "Kayıt henüz export-ready değil.";
  if (canRunPhase4Export(detail.record.status)) return undefined;
  return `Export için önce preview ya da retry kararı gerekir (${STATUS_LABEL[detail.record.status]}).`;
}

function retryDisabledReason(detail: Phase4RecordDetail | null): string | undefined {
  if (!detail) return "Aktif kayıt yükleniyor.";
  if (canRunPhase4Retry(detail.record.status)) return undefined;
  return `Retry yalnız export hatası sonrasında açılır (${STATUS_LABEL[detail.record.status]}).`;
}

function drawerTitle(mode: DrawerMode): string {
  switch (mode) {
    case "export":
      return "Export Detay Paneli";
    case "manifest":
      return "Manifest Detay Paneli";
    case "mapping":
      return "Eşleşme Özet Paneli";
    default:
      return "Faz 4 Paneli";
  }
}

function resultTone(result: Phase4ExportResponse): CSSProperties {
  return result.ok
    ? { border: `1px solid ${COLORS.success}`, background: `${COLORS.success}10` }
    : { border: `1px solid ${COLORS.warning}`, background: `${COLORS.warning}12` };
}

function ActionResultPanel({ result }: { result: Phase4ExportResponse }) {
  return (
    <article style={{ ...cardStyle, ...resultTone(result) }}>
      <strong>{result.ok ? "Phase 4 İşlemi Başarılı" : "Phase 4 İşlemi Engellendi"}</strong>
      <div style={mutedStyle}>{result.message || "Durum mesajı sağlanmadı."}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <InfoCard label="Record ID" value={result.recordId} mono />
        <InfoCard label="Status" value={result.status ? STATUS_LABEL[result.status] : "-"} />
        <InfoCard label="Manifest ID" value={result.manifestId || "-"} mono />
        <InfoCard label="Output File" value={result.outputFileName || "-"} mono />
      </div>
    </article>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <article style={cardStyle}>
      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: COLORS.text, fontFamily: mono ? TYPOGRAPHY.fontFamily.mono : TYPOGRAPHY.fontFamily.base, wordBreak: "break-word" }}>
        {value}
      </span>
    </article>
  );
}

interface ExportXmlFirePageProps {
  preferredRecordId?: string | null;
}

export function ExportXmlFirePage({ preferredRecordId = null }: ExportXmlFirePageProps) {
  const [settings, setSettings] = useState<FolderSettings | null>(null);
  const [queueItems, setQueueItems] = useState<Phase4QueueItem[]>([]);
  const [manifests, setManifests] = useState<Phase4ManifestItem[]>([]);
  const [folderHealth, setFolderHealth] = useState<Phase4FolderHealthItem[]>([]);
  const [activeRecordId, setActiveRecordId] = useState("");
  const [activeDetail, setActiveDetail] = useState<Phase4RecordDetail | null>(null);
  const [preview, setPreview] = useState<Phase4PreviewResponse | null>(null);
  const [actionResult, setActionResult] = useState<Phase4ExportResponse | null>(null);
  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("export");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const { addToast } = useToast();

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "refresh", focusRecordId: string | null = null) => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);

      try {
        setPageError(null);
        const [folderSettings, queueResponse, manifestsResponse, folderHealthResponse] = await Promise.all([
          optiplanWorkflowService.getFolderSettings(),
          getPhase4Queue(),
          getPhase4Manifests(),
          getPhase4FolderHealth(),
        ]);

        const sortedQueue = sortPhase4Queue(queueResponse.items ?? []);
        setSettings(folderSettings);
        setQueueItems(sortedQueue);
        setManifests(manifestsResponse.items ?? []);
        setFolderHealth(folderHealthResponse.items ?? []);
        setActiveRecordId((current) => {
          if (focusRecordId && sortedQueue.some((item) => item.recordId === focusRecordId)) return focusRecordId;
          if (preferredRecordId && sortedQueue.some((item) => item.recordId === preferredRecordId)) return preferredRecordId;
          if (current && sortedQueue.some((item) => item.recordId === current)) return current;
          return sortedQueue[0]?.recordId ?? "";
        });
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Phase 4 yüzeyi yüklenemedi.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [preferredRecordId],
  );

  const loadActiveRecord = useCallback(async (recordId: string) => {
    if (!recordId) {
      setActiveDetail(null);
      return;
    }

    setRecordLoading(true);
    try {
      setPageError(null);
      setActiveDetail(await getPhase4RecordDetail(recordId));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Aktif Phase 4 kaydı yüklenemedi.");
      setActiveDetail(null);
    } finally {
      setRecordLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard("initial", preferredRecordId);
  }, [loadDashboard, preferredRecordId]);

  useEffect(() => {
    setPreview(null);
    setActionResult(null);
    if (!activeRecordId) {
      setActiveDetail(null);
      return;
    }
    void loadActiveRecord(activeRecordId);
  }, [activeRecordId, loadActiveRecord]);

  const activeQueueItem = useMemo(
    () => queueItems.find((item) => item.recordId === activeRecordId) ?? null,
    [activeRecordId, queueItems],
  );

  const activeManifests = useMemo(
    () => manifests.filter((item) => item.recordId === activeRecordId),
    [activeRecordId, manifests],
  );

  const previewLines = useMemo<Phase4PreviewLine[]>(() => preview?.previewData?.lines ?? [], [preview]);
  const previewHeaders = useMemo(() => Object.keys(previewLines[0] ?? {}), [previewLines]);

  const { statusCounts, fireRequiredCount, manualDecisionCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let fireRequired = 0;
    let manualDecision = 0;
    for (const item of queueItems) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      if (item.fireRequired) fireRequired++;
      if (item.status === "PHASE4_EXPORT_FAILED") manualDecision++;
    }
    return { statusCounts: counts, fireRequiredCount: fireRequired, manualDecisionCount: manualDecision };
  }, [queueItems]);

  const statusEntries = useMemo(() => Object.entries(statusCounts), [statusCounts]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearchText.trim());
    return queueItems.filter((item) => {
      if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
      if (!normalizedSearch) return true;
      return [item.recordId, item.documentName, item.customerCode, item.manifestId, item.lastErrorMessage]
        .map((value) => normalizeText(value))
        .join(" ")
        .includes(normalizedSearch);
    });
  }, [deferredSearchText, filterStatus, queueItems]);

  const metrics = useMemo(
    () => [
      { label: "Phase-4 Hazır", value: String(statusCounts.PHASE4_PENDING ?? 0), hint: "Önizleme bekleyen kayıtlar" },
      { label: "Preview Hazır", value: String(statusCounts.PHASE4_PREVIEW_READY ?? 0), hint: "Export tetiklenebilir kayıtlar" },
      { label: "Export Başarılı", value: String(statusCounts.COMPLETED ?? 0), hint: "Kapanmış Phase 4 kayıtları" },
      { label: "Export Hatalı", value: String(statusCounts.PHASE4_EXPORT_FAILED ?? 0), hint: "Manuel karar isteyen hatalar" },
      { label: "Retry Bekleyen", value: String(statusCounts.PHASE4_RETRY_PENDING ?? 0), hint: "Retry kararı verilmiş kayıtlar" },
      { label: "Manifest Oluşturulan", value: String(manifests.length), hint: "Manifest izi oluşan kayıtlar" },
      { label: "Fire Takip Gereken", value: String(fireRequiredCount), hint: "Fire paneli ile izlenen kayitlar" },
      { label: "Manuel Karar Bekleyen", value: String(manualDecisionCount), hint: "Retry karari bekleyenler" },
    ],
    [fireRequiredCount, manifests.length, manualDecisionCount, statusCounts],
  );

  const previewReason = previewDisabledReason(activeDetail);
  const exportReason = exportDisabledReason(activeDetail);
  const retryReason = retryDisabledReason(activeDetail);
  const dryRunChecks = [
    {
      label: "Phase 4 hazır",
      ok: Boolean(activeDetail?.record.phase4Ready),
      hint: "Phase 3 blocker kapanmadan export açılamaz.",
    },
    {
      label: "Preview (dry-run)",
      ok: Boolean(activeDetail?.record.previewReady || (preview?.ok && previewLines.length > 0)),
      hint: "Export öncesi en az bir önizleme doğrulaması önerilir.",
    },
    {
      label: "Mapping kilidi",
      ok: Boolean(activeDetail?.mappingSummary.locked),
      hint: "Hedef alan eşleşmesi readonly/kilitli olmalı.",
    },
  ];

  const handlePreview = async () => {
    if (!activeDetail) {
      addToast("Aktif kayıt henüz yüklenmedi.", "warning");
      return;
    }
    if (previewReason) {
      addToast(previewReason, "warning");
      return;
    }

    setPreviewing(true);
    try {
      const response = await createPhase4Preview(activeDetail.record.recordId);
      setPreview(response);
      setActionResult(null);
      await loadDashboard("refresh", activeDetail.record.recordId);
      await loadActiveRecord(activeDetail.record.recordId);
      addToast(response.message ?? "Phase 4 önizlemesi oluşturuldu.", response.ok ? "success" : "warning");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Phase 4 önizlemesi alınamadı.", "error");
    } finally {
      setPreviewing(false);
    }
  };

  const handleExport = async () => {
    if (!activeDetail) {
      addToast("Aktif kayıt henüz yüklenmedi.", "warning");
      return;
    }
    if (exportReason) {
      addToast(exportReason, "warning");
      return;
    }

    setExporting(true);
    try {
      const response = await exportPhase4Record(activeDetail.record.recordId);
      setActionResult(response);
      await loadDashboard("refresh", activeDetail.record.recordId);
      await loadActiveRecord(activeDetail.record.recordId);
      if (response.ok) setDrawerMode("manifest");
      addToast(response.message ?? "Phase 4 export tamamlandı.", response.ok ? "success" : "warning");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Phase 4 export başarısız.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleRetry = async () => {
    if (!activeDetail) {
      addToast("Aktif kayıt henüz yüklenmedi.", "warning");
      return;
    }
    if (retryReason) {
      addToast(retryReason, "warning");
      return;
    }

    setRetrying(true);
    try {
      const response = await retryPhase4Record(activeDetail.record.recordId);
      setActionResult(response);
      await loadDashboard("refresh", activeDetail.record.recordId);
      await loadActiveRecord(activeDetail.record.recordId);
      if (response.ok) setDrawerMode("manifest");
      addToast(response.message ?? "Retry kararı işlendi.", response.ok ? "success" : "warning");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Phase 4 retry başarısız.", "error");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="electric-page">
        <TopBar
          title={ORDER_ROUTE_META.workflowExport.title}
          subtitle="Phase 4 kuyruğu hazırlanıyor."
          breadcrumbs={[ORDER_ROUTE_META.orderList.title, ORDER_ROUTE_META.workflowExport.title]}
        />
        <div className="app-page-container" style={{ color: COLORS.muted }}>
          Phase 4 yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="electric-page">
      <TopBar
        title={ORDER_ROUTE_META.workflowExport.title}
        subtitle="Preview, manifest, retry ve klasör sağlığı kanonik Phase 4 sözleşmesiyle kapanır."
        breadcrumbs={[ORDER_ROUTE_META.orderList.title, ORDER_ROUTE_META.workflowExport.title]}
      />

      <div className="app-page-container" style={{ display: "grid", gap: 18 }}>
        <MasterSpecBanner
          tone="subtle"
          title="Phase 4"
          subtitle="OptiPlanning kapanisi, manifest izi ve retry karari ayni operasyon yuzeyinde tutulur."
          metrics={metrics}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={() => navigateToAppPage("config", "phase4")}>
                Sistem Ayarları (Klasör Ayarları)
              </Button>
              <Button type="button" variant="secondary" onClick={() => void loadDashboard("refresh", activeRecordId)} disabled={refreshing}>
                {refreshing ? "Yenileniyor..." : "Yenile"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handlePreview()} disabled={previewing || Boolean(previewReason) || recordLoading} title={previewReason}>
                {previewing ? "Önizleniyor..." : "Önizleme Oluştur"}
              </Button>
              <Button type="button" onClick={() => void handleExport()} disabled={exporting || Boolean(exportReason) || recordLoading} title={exportReason}>
                {exporting ? "Çalışıyor..." : "Export'u Çalıştır"}
              </Button>
            </>
          }
        />

        {pageError ? (
          <div role="alert" style={warningStyle}>
            <AlertTriangle size={16} />
            <span>{pageError}</span>
          </div>
        ) : null}

        <section style={panelStyle}>
          <div style={headerStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong>Phase 4 Kuyruğu</strong>
              <span style={mutedStyle}>Kanonik /api/phase4/queue yüzeyi ile export-ready kayıtlar listelenir.</span>
            </div>
            <span style={pillStyle}>{filteredRecords.length} kayit</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(200px, 0.8fr)", gap: 12 }}>
            <input
              aria-label="Phase 4 kuyrugu arama"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Kayit, belge, cari veya manifest ile ara"
              style={fieldStyle}
            />
            <select aria-label="Phase 4 durum filtresi" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} style={fieldStyle}>
              <option value="ALL">Tum durumlar</option>
              {statusEntries.map(([status, count]) => (
                <option key={status} value={status}>
                  {(STATUS_LABEL[status as Phase4RecordStatus] ?? status) + ` (${count})`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1420 }}>
              <thead>
                <tr style={{ background: COLORS.bg.elevated ?? COLORS.bg.main }}>
                  <th style={thStyle}>Belge / Kayit ID</th>
                  <th style={thStyle}>Cari / Siparis</th>
                  <th style={thStyle}>Faz</th>
                  <th style={thStyle}>Export Tipi</th>
                  <th style={thStyle}>Manifest ID</th>
                  <th style={thStyle}>Dosya Adi</th>
                  <th style={thStyle}>Durum</th>
                  <th style={thStyle}>Retry</th>
                  <th style={thStyle}>Son Hata</th>
                  <th style={thStyle}>Fire</th>
                  <th style={thStyle}>Operator</th>
                  <th style={thStyle}>Son Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item) => (
                  <tr
                    key={item.recordId}
                    onClick={() => {
                      setActiveRecordId(item.recordId);
                      setDrawerMode("export");
                    }}
                    style={{ cursor: "pointer", background: item.recordId === activeRecordId ? primaryRgba(0.08) : "transparent" }}
                  >
                    <td style={tdStyle}>
                      <strong>{item.recordId}</strong>
                      <div style={mutedStyle}>{item.documentName}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{item.customerCode || "Cari eşleşmedi"}</div>
                      <div style={mutedStyle}>Siparis: -</div>
                    </td>
                    <td style={tdStyle}>4</td>
                    <td style={tdStyle}>{item.exportType}</td>
                    <td style={tdStyle}>
                      {item.manifestId ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveRecordId(item.recordId);
                            setDrawerMode("manifest");
                          }}
                          style={linkButtonStyle}
                        >
                          {item.manifestId}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={tdStyle}>{item.documentName}</td>
                    <td style={tdStyle}>
                      <span style={{ ...statusPillStyle, color: STATUS_COLOR[item.status], background: `${STATUS_COLOR[item.status]}18` }}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td style={tdStyle}>{item.retryCount}</td>
                    <td style={tdStyle}>{item.lastErrorMessage || "-"}</td>
                    <td style={tdStyle}>{item.fireRequired ? "Gerekli" : "Yok"}</td>
                    <td style={tdStyle}>Sistem</td>
                    <td style={tdStyle}>{formatPhase4Date(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {activeQueueItem && activeDetail ? (
          <div style={contentGridStyle}>
            <div style={{ display: "grid", gap: 18 }}>
              <section style={panelStyle}>
                <div style={headerStyle}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>Phase 4 Kayıt Özeti</strong>
                    <span style={mutedStyle}>Aktif kayıt Phase 4 detail contract üzerinden okunur. Export, mapping ve manifest drawer'ları buradan açılır.</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button type="button" variant={drawerMode === "export" ? "primary" : "secondary"} onClick={() => setDrawerMode("export")}>
                      Export Detayi
                    </Button>
                    <Button type="button" variant={drawerMode === "manifest" ? "primary" : "secondary"} onClick={() => setDrawerMode("manifest")}>
                      Manifest Drawer
                    </Button>
                    <Button type="button" variant={drawerMode === "mapping" ? "primary" : "secondary"} onClick={() => setDrawerMode("mapping")}>
                      Mapping Drawer
                    </Button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <InfoCard label="Kayit ID" value={activeQueueItem.recordId} mono />
                  <InfoCard label="Cari Kodu" value={activeDetail.record.customerCode || "-"} />
                  <InfoCard label="Durum" value={STATUS_LABEL[activeDetail.record.status]} />
                  <InfoCard label="Manifest" value={activeDetail.record.manifestId || "-"} mono />
                  <InfoCard label="Çıktı Dosyası" value={activeDetail.record.outputFileName || "-"} mono />
                  <InfoCard label="Son Güncelleme" value={formatPhase4Date(activeQueueItem.updatedAt)} />
                </div>

                {activeDetail.record.phase4Ready ? (
                  <div style={successStyle}>
                    <CheckCircle2 size={16} />
                    <span>Kayıt Phase 4 operasyon ekranında izlenebilir durumda. Preview, export ve retry kararları statüye göre açılır.</span>
                  </div>
                ) : (
                  <div style={warningStyle}>
                    <AlertTriangle size={16} />
                    <span>Bu kayıt henüz Phase 4 hazır değil. Phase 3 blocker temizliği tamamlanmadan export aksiyonu açılmaz.</span>
                  </div>
                )}
              </section>

              <section style={panelStyle}>
                <div style={headerStyle}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>Önizleme ve Sonuç</strong>
                    <span style={mutedStyle}>Önizleme satırları doğrudan /api/phase4/preview cevabından gelir. Export sonucu ayrı kapanış kartında tutulur.</span>
                  </div>
                  <span style={pillStyle}>{previewLines.length} satir</span>
                </div>

                <div style={{ ...cardStyle, display: "grid", gap: 8 }}>
                  <strong>Dry-run Doğrulama</strong>
                  <div style={{ display: "grid", gap: 6 }}>
                    {dryRunChecks.map((item) => (
                      <div key={item.label} style={{ display: "grid", gridTemplateColumns: "170px 70px 1fr", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: COLORS.text }}>{item.label}</span>
                        <span style={{ ...statusPillStyle, color: item.ok ? COLORS.success : COLORS.warning, background: item.ok ? `${COLORS.success}18` : `${COLORS.warning}18` }}>
                          {item.ok ? "OK" : "Eksik"}
                        </span>
                        <span style={mutedStyle}>{item.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {preview && preview.ok && previewLines.length > 0 ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      <InfoCard label="Cari" value={preview.previewData?.customerCode || "-"} />
                      <InfoCard label="Musteri" value={preview.previewData?.customerName || "-"} />
                      <InfoCard label="Satir Sayisi" value={String(preview.previewData?.lineCount ?? 0)} />
                      <InfoCard label="Statu" value={preview.status ? STATUS_LABEL[preview.status] : "-"} />
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                        <thead>
                          <tr style={{ background: COLORS.bg.elevated ?? COLORS.bg.main }}>
                            {previewHeaders.map((header) => (
                              <th key={header} style={thStyle}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewLines.map((row, rowIndex) => (
                            <tr key={`${activeRecordId}-preview-${rowIndex}`}>
                              {previewHeaders.map((header) => (
                                <td key={header} style={tdStyle}>{String(row[header] ?? "-")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={cardStyle}>
                    <strong>Önizleme Hazır Değil</strong>
                    <span style={mutedStyle}>
                      {activeDetail.record.previewReady
                        ? "Bu kayıt daha önce önizleme aldı. Gerekirse önizlemeyi tekrar üretin."
                        : "Henüz önizleme üretilmedi."}
                    </span>
                  </div>
                )}

                {actionResult ? <ActionResultPanel result={actionResult} /> : null}
              </section>

              <div style={doublePanelGridStyle}>
                <section style={panelStyle}>
                  <div style={headerStyle}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>Retry Karar Paneli</strong>
                      <span style={mutedStyle}>Retry kararı sadece export hatası sonrasında açılır.</span>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => void handleRetry()} disabled={retrying || Boolean(retryReason)} title={retryReason}>
                      <RotateCcw size={14} />
                      {retrying ? "Retry..." : "Retry Başlat"}
                    </Button>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <InfoCard label="Durum" value={STATUS_LABEL[activeDetail.record.status]} />
                    <InfoCard label="Retry Sayısı" value={String(activeDetail.record.retryCount)} />
                    <InfoCard label="Son Hata" value={activeDetail.record.lastErrorMessage || "-"} />
                    <div style={activeDetail.record.status === "PHASE4_EXPORT_FAILED" ? warningStyle : successStyle}>
                      {activeDetail.record.status === "PHASE4_EXPORT_FAILED" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      <span>
                        {activeDetail.record.status === "PHASE4_EXPORT_FAILED"
                          ? "Bu kayıt manuel retry kararı bekliyor."
                          : retryReason ?? "Retry paneli şu an kapalı."}
                      </span>
                    </div>
                  </div>
                </section>

                <section style={panelStyle}>
                  <div style={headerStyle}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>Fire Takip Paneli</strong>
                      <span style={mutedStyle}>Fire gereksinimi export kapanışında görünür kalır. Gerekiyorsa kayıt Phase 3'e geri yönlendirilir.</span>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => navigateToAppPage(ORDER_ROUTE_META.workflowEditing.page, "phase4", activeRecordId)}>
                      Siparis Kontrol'e Git
                    </Button>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <InfoCard label="Fire Gerekli" value={activeDetail.record.fireRequired ? "Evet" : "Hayir"} />
                    <InfoCard label="Phase 4 Ready" value={activeDetail.record.phase4Ready ? "Evet" : "Hayir"} />
                    {activeDetail.record.fireRequired ? (
                      <div style={warningStyle}>
                        <AlertTriangle size={16} />
                        <span>Fire izi bu kayıt için zorunlu. Export öncesi not kapanışı Phase 3 tarafında doğrulanmış olmalı.</span>
                      </div>
                    ) : (
                      <div style={successStyle}>
                        <CheckCircle2 size={16} />
                        <span>Fire takibi gerektiren aktif blocker görünmüyor.</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section style={panelStyle} aria-label="Klasör Sağlık / Çıktı Hedefleri">
                <div style={headerStyle}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>Klasör Sağlık / Çıktı Hedefleri</strong>
                    <span style={mutedStyle}>Klasör sağlığı ve hedef path bağlamı birlikte gösterilir.</span>
                  </div>
                  <span style={pillStyle}>{folderHealth.length} hedef</span>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {folderHealth.map((item) => (
                    <article key={item.folderType} style={cardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <strong>{folderTypeLabel(item.folderType)}</strong>
                        <span style={{ ...statusPillStyle, color: healthColor(item.healthStatus), background: `${healthColor(item.healthStatus)}18` }}>
                          {item.healthStatus}
                        </span>
                      </div>
                      <div style={{ ...mutedStyle, fontFamily: TYPOGRAPHY.fontFamily.mono }}>{folderTypePath(item.folderType, settings)}</div>
                      <div style={mutedStyle}>Son yazım: {formatPhase4Date(item.lastWriteAt)}</div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {drawerMode ? (
              <aside role="complementary" aria-label={drawerTitle(drawerMode)} style={drawerStyle}>
                <div style={headerStyle}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>{drawerTitle(drawerMode)}</strong>
                    <span style={mutedStyle}>Aktif kayit: {activeRecordId}</span>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setDrawerMode(null)}>
                    Kapat
                  </Button>
                </div>

                {drawerMode === "export" ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <InfoCard label="Belge" value={activeQueueItem.documentName} />
                    <InfoCard label="Kayit ID" value={activeQueueItem.recordId} mono />
                    <InfoCard label="Durum" value={STATUS_LABEL[activeDetail.record.status]} />
                    <InfoCard label="Manifest ID" value={activeDetail.record.manifestId || "-"} mono />
                    <InfoCard label="Output File" value={activeDetail.record.outputFileName || "-"} mono />
                    <InfoCard label="Preview Ready" value={activeDetail.record.previewReady ? "Evet" : "Hayir"} />
                    <InfoCard label="Son Hata" value={activeDetail.record.lastErrorMessage || "-"} />
                  </div>
                ) : null}

                {drawerMode === "manifest" ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {activeManifests.length > 0 ? (
                      activeManifests.map((item) => (
                        <article key={item.manifestId} style={cardStyle}>
                          <InfoCard label="Manifest ID" value={item.manifestId} mono />
                          <InfoCard label="Dosya" value={item.fileName} mono />
                          <InfoCard label="Durum" value={item.status} />
                          <InfoCard label="Oluşturulma" value={formatPhase4Date(item.createdAt)} />
                        </article>
                      ))
                    ) : (
                      <article style={cardStyle}>
                        <strong>Manifest kaydı bulunamadı.</strong>
                        <span style={mutedStyle}>Export tamamlandığında bu drawer manifest izini gösterecek.</span>
                      </article>
                    )}
                  </div>
                ) : null}

                {drawerMode === "mapping" ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <article style={cardStyle}>
                      <InfoCard label="Profil" value={activeDetail.mappingSummary.profileName} />
                      <InfoCard label="Locked" value={activeDetail.mappingSummary.locked ? "Evet" : "Hayir"} />
                    </article>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
                        <thead>
                          <tr style={{ background: COLORS.bg.elevated ?? COLORS.bg.main }}>
                            <th style={thStyle}>Kaynak</th>
                            <th style={thStyle}>Hedef</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PHASE4_MAPPING_CONTRACT.map((row) => (
                            <tr key={row.targetField}>
                              <td style={tdStyle}>{row.sourceField}</td>
                              <td style={{ ...tdStyle, fontFamily: TYPOGRAPHY.fontFamily.mono }}>{row.targetField}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={successStyle}>
                      <CheckCircle2 size={16} />
                      <span>Mapping readonly ve kilitli. Phase 4 ekranı hedef alanları yalnız görünür olarak taşır.</span>
                    </div>
                  </div>
                ) : null}
              </aside>
            ) : null}
          </div>
        ) : (
          <section style={panelStyle}>
            <strong>Phase 4 kaydı bulunamadı.</strong>
            <span style={mutedStyle}>Queue boşsa bu yüzey yalnız özet ve klasör sağlığı ile görünür kalır.</span>
          </section>
        )}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  padding: "20px 22px",
  borderRadius: RADIUS.xl,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bg.surface,
  boxShadow: SHADOWS.sm,
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "16px 18px",
  borderRadius: RADIUS.lg,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bg.elevated ?? COLORS.bg.surface,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bg.main,
  color: COLORS.text,
  fontSize: 13,
  fontFamily: TYPOGRAPHY.fontFamily.mono,
  boxSizing: "border-box",
};

const mutedStyle: CSSProperties = {
  fontSize: 12,
  color: COLORS.muted,
  lineHeight: 1.6,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: primaryRgba(0.1),
  color: COLORS.primary,
  fontSize: 12,
  fontWeight: 700,
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
};

const thStyle: CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: 12,
  fontWeight: 700,
  color: COLORS.text,
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: 13,
  color: COLORS.text,
  verticalAlign: "top",
};

const warningStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "12px 14px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.warning}`,
  background: `${COLORS.warning}12`,
  color: COLORS.text,
  fontSize: 13,
};

const successStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.success}`,
  background: `${COLORS.success}10`,
  color: COLORS.text,
  fontSize: 13,
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "minmax(0, 1.65fr) minmax(300px, 0.95fr)",
  alignItems: "start",
};

const doublePanelGridStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
};

const drawerStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  padding: "20px 22px",
  borderRadius: RADIUS.xl,
  border: `1px solid ${COLORS.border}`,
  background: `linear-gradient(180deg, ${COLORS.bg.surface}, ${COLORS.bg.elevated ?? COLORS.bg.surface})`,
  boxShadow: SHADOWS.md,
  position: "sticky",
  top: 16,
};

const linkButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: COLORS.primary,
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
  fontFamily: TYPOGRAPHY.fontFamily.mono,
};

export default ExportXmlFirePage;
