import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { TopBar } from "../../components/Layout";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { Button } from "../../components/Shared";
import { COLORS, RADIUS, primaryRgba } from "../../components/Shared/constants";
import { MasterSpecBanner } from "../../components/Shared/MasterSpecBanner";
import { optiplanWorkflowService } from "../../services/optiplanWorkflowService";
import type { WorkflowRecord, WorkflowSourceFolder } from "../../services/optiplanWorkflowService";
import { navigateToAppPage } from "../../utils/appNavigation";

// 🚀 QUICK PERFORMANCE BOOSTS
import { FixedSizeList as List } from 'react-window';
import { useDebouncedCallback } from 'use-debounce';

const STATUS_LABEL: Record<string, string> = {
  PHASE_1_OCR_HAVUZU: "OCR Havuzu",
  PHASE_2_OCR_KONTROL: "OCR Kontrol",
  PHASE_3_SIPARIS_DUZENLEME: "Sipariş Kontrol",
  PHASE_4_EXPORT: "OptiPlanning",
  HATA: "Yazım Hatası",
  TAMAMLANDI: "Tamamlandı",
};

const STATUS_COLOR: Record<string, string> = {
  PHASE_1_OCR_HAVUZU: "#2563eb",
  PHASE_2_OCR_KONTROL: "#d97706",
  PHASE_3_SIPARIS_DUZENLEME: "#7c3aed",
  PHASE_4_EXPORT: "#059669",
  HATA: "#dc2626",
  TAMAMLANDI: "#475569",
};

const SOURCE_OPTIONS: Array<{ value: WorkflowSourceFolder; label: string }> = [
  { value: "manuel_raw", label: "Manuel" },
  { value: "whatsapp_raw", label: "WhatsApp" },
  { value: "scanner_raw", label: "Tarayıcı" },
  { value: "email_raw", label: "E-posta" },
];

function formatDate(value: string | null): string {
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

function normalizeText(value?: string | null) {
  return (value ?? "").toLocaleLowerCase("tr-TR");
}

export function OCRPoolPage() {
  const [records, setRecords] = useState<WorkflowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchText, setSearchText] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [retryingUuids, setRetryingUuids] = useState<Set<string>>(new Set());
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSource, setManualSource] = useState<WorkflowSourceFolder>("manuel_raw");
  const [forceDuplicate, setForceDuplicate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const deferredSearchText = useDeferredValue(searchText);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await optiplanWorkflowService.listRecords();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıtlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleManualScan = async () => {
    setScanning(true);
    try {
      await optiplanWorkflowService.scanWatchFolders();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarama başarısız");
    } finally {
      setScanning(false);
    }
  };

  const handleRetry = async (kayitUuid: string) => {
    setRetryingUuids((prev) => new Set([...prev, kayitUuid]));
    try {
      await optiplanWorkflowService.retryRecord(kayitUuid);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry başarısız");
    } finally {
      setRetryingUuids((prev) => {
        const next = new Set(prev);
        next.delete(kayitUuid);
        return next;
      });
    }
  };

  const handleManualUpload = async () => {
    if (!manualFile) {
      setError("Lütfen önce bir dosya seçin");
      setSuccess(null);
      fileInputRef.current?.click();
      return;
    }

    setUploading(true);
    const fileName = manualFile.name;
    try {
      setError(null);
      await optiplanWorkflowService.manualImport(manualFile, manualSource, forceDuplicate);
      setManualFile(null);
      setForceDuplicate(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await load();
      setSuccess(`Dosya OCR havuzuna yüklendi: ${fileName}`);
    } catch (err) {
      setSuccess(null);
      setError(err instanceof Error ? err.message : "Manuel yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const statusCounts = useMemo(
    () =>
      records.reduce<Record<string, number>>((acc, record) => {
        acc[record.dosyaDurumu] = (acc[record.dosyaDurumu] ?? 0) + 1;
        return acc;
      }, {}),
    [records],
  );

  const retryRecordCount = useMemo(
    () => records.filter((record) => record.retryNo > 0).length,
    [records],
  );

  const statusEntries = useMemo(
    () => Object.entries(statusCounts),
    [statusCounts],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearchText.trim());
    const startMs = dateStart ? new Date(dateStart).getTime() : null;
    const endMs = dateEnd ? new Date(dateEnd + "T23:59:59").getTime() : null;

    return records.filter((record) => {
      if (filterStatus !== "ALL" && record.dosyaDurumu !== filterStatus) {
        return false;
      }

      if (startMs !== null || endMs !== null) {
        const recMs = record.gelisTarihi ? new Date(record.gelisTarihi).getTime() : null;
        if (recMs === null || Number.isNaN(recMs)) return false;
        if (startMs !== null && recMs < startMs) return false;
        if (endMs !== null && recMs > endMs) return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        record.hamDosyaAdi,
        record.kaynakKlasor,
        record.cariUnvan,
        record.okunanCariUnvan,
        record.siparisNo,
        record.kayitUuid,
      ]
        .map((item) => normalizeText(item))
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [dateEnd, dateStart, deferredSearchText, filterStatus, records]);

  const metrics = useMemo(
    () => [
      {
        label: "Toplam Kayıt",
        value: String(records.length),
        hint: "OCR kuyruğundaki belge sayısı",
      },
      {
        label: "Filtreli Liste",
        value: String(filteredRecords.length),
        hint: "Aktif arama ve durum filtresi sonrası",
      },
      {
        label: "Kaynak Klasör",
        value: String(new Set(records.map((item) => item.kaynakKlasor).filter(Boolean)).size),
        hint: "Canlı izlenen klasör adedi",
      },
      {
        label: "Retry Kayıt",
        value: String(retryRecordCount),
        hint: "Yeniden işleme almış kayıtlar",
      },
      {
        label: "Yineleme",
        value: String(records.filter((item) => item.duplicateFlag === true).length),
        hint: "Daha önce işlenmiş hash ile gelen kayıtlar",
      },
    ],
    [filteredRecords.length, records, retryRecordCount],
  );

  if (loading) {
    return (
      <div className="electric-page">
        <TopBar
          title={ORDER_ROUTE_META.workflowInbox.title}
          subtitle="Gelen belge kayıtları ve operasyon kuyruğu hazırlanıyor."
          breadcrumbs={[ORDER_ROUTE_META.orderList.title, ORDER_ROUTE_META.workflowInbox.title]}
        />
        <div className="app-page-container" style={{ color: COLORS.muted }}>
          OCR havuzu yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="electric-page">
      <TopBar
        title={ORDER_ROUTE_META.workflowInbox.title}
        subtitle="Kaynak klasör, durum, işlenme sonucu ve retry takibi tek OCR kuyruğunda toplanır."
        breadcrumbs={[ORDER_ROUTE_META.orderList.title, ORDER_ROUTE_META.workflowInbox.title]}
      />

      <div className="app-page-container" style={{ display: "grid", gap: 18 }}>
        <MasterSpecBanner
          tone="subtle"
          title="OCR Havuzu"
          subtitle="Gelen OCR kayıtları bu ekranda toplanır. Kayıtlar kaynak klasör, durum ve retry bilgisiyle birlikte takip edilir."
          metrics={metrics}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFilterStatus("HATA")}
              >
                Hata Kayıtları
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void load()}
              >
                Yenile
              </Button>
              <Button type="button" onClick={() => void handleManualScan()} disabled={scanning}>
                {scanning ? "Taranıyor..." : "Klasörleri Tara"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                title="Aktif filtre görünümünü kaydet"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (filterStatus !== "ALL") params.set("durum", filterStatus);
                  if (searchText) params.set("ara", searchText);
                  if (dateStart) params.set("baslangic", dateStart);
                  if (dateEnd) params.set("bitis", dateEnd);
                  window.history.replaceState(null, "", `?${params.toString()}`);
                }}
              >
                Görünüm Kaydet
              </Button>
            </>
          }
        />

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Manuel Yükleme</span>
              <span style={{ fontSize: 12, color: COLORS.muted }}>
                PDF/JPG/PNG dosyasını seçip OCR kuyruğuna manuel ekleyin.
              </span>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px) minmax(200px, 1fr) auto",
              gap: 12,
              padding: "16px 18px 18px",
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Dosya</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                aria-label="OCR Dosyası"
                onChange={(event) => setManualFile(event.target.files?.[0] ?? null)}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Kaynak</span>
              <select
                value={manualSource}
                onChange={(event) => setManualSource(event.target.value as WorkflowSourceFolder)}
                aria-label="Kaynak"
                style={fieldStyle}
              >
                {SOURCE_OPTIONS.map((option) => (
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
                gap: 8,
                minHeight: 42,
                color: COLORS.text,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={forceDuplicate}
                onChange={(event) => setForceDuplicate(event.target.checked)}
                aria-label="Yinelemeyi zorla"
              />
              Aynı dosya ise zorla yükle
            </label>

            <Button
              type="button"
              onClick={() => void handleManualUpload()}
              disabled={uploading}
              title="Seçilen dosyayı OCR havuzuna yükle"
            >
              {uploading ? "Yükleniyor..." : "Dosyayı Yükle"}
            </Button>
          </div>
          <div
            style={{
              padding: "0 18px 16px",
              color: COLORS.muted,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            İpucu: Aynı belgeyi tekrar yüklemeniz gerekiyorsa <strong>"Aynı dosya ise zorla yükle"</strong>
            seçeneğini işaretleyin.
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            style={{
              padding: "12px 14px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.danger}`,
              background: `${COLORS.danger}10`,
              color: COLORS.text,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            style={{
              padding: "12px 14px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.success}`,
              background: `${COLORS.success}10`,
              color: COLORS.text,
              fontSize: 13,
            }}
          >
            {success}
          </div>
        ) : null}

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Operasyon Kuyruğu</span>
              <span style={{ fontSize: 12, color: COLORS.muted }}>
                Belge adı, cari, sipariş no ve klasör bağlamına göre daraltılabilir.
              </span>
            </div>
            <span
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: primaryRgba(0.1),
                color: COLORS.primary,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {filteredRecords.length} kayıt gösteriliyor
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px, 1.2fr) repeat(2, minmax(180px, 0.6fr)) auto",
              gap: 12,
              padding: "16px 18px 12px",
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Ara</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Belge adı, klasör, cari veya sipariş no ile ara"
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Durum</span>
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                aria-label="Durum"
                style={fieldStyle}
              >
                <option value="ALL">Tüm durumlar</option>
                {statusEntries.map(([status, count]) => (
                  <option key={status} value={status}>
                    {(STATUS_LABEL[status] ?? status) + ` (${count})`}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Kuyruk Özeti</span>
              <div style={{ ...fieldStyle, display: "flex", alignItems: "center", color: COLORS.muted }}>
                {retryRecordCount} retry, {statusEntries.length} durum
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "end" }}>
              {filterStatus !== "ALL" || searchText || dateStart || dateEnd ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setFilterStatus("ALL");
                    setSearchText("");
                    setDateStart("");
                    setDateEnd("");
                  }}
                >
                  Filtreyi Temizle
                </Button>
              ) : null}
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Başlangıç Tarihi</span>
              <input
                type="date"
                value={dateStart}
                onChange={(event) => setDateStart(event.target.value)}
                aria-label="Başlangıç Tarihi"
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={toolbarLabelStyle}>Bitiş Tarihi</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(event) => setDateEnd(event.target.value)}
                aria-label="Bitiş Tarihi"
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}` }}>
            {statusEntries.map(([status, count]) => {
              const active = filterStatus === status;
              const color = STATUS_COLOR[status] ?? COLORS.muted;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus((prev) => (prev === status ? "ALL" : status))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? color : `${color}55`}`,
                    background: active ? color : `${color}12`,
                    color: active ? "#ffffff" : color,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {(STATUS_LABEL[status] ?? status) + ` · ${count}`}
                </button>
              );
            })}
          </div>

          {filteredRecords.length === 0 ? (
            <div style={{ padding: "28px 18px", color: COLORS.muted, fontSize: 13 }}>
              {records.length === 0
                ? "Henüz OCR kaydı yok. Kaynak klasörleri tarayarak kuyruğu başlatın."
                : "Seçili arama ve filtreye uygun kayıt bulunamadı."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                <thead>
                  <tr style={{ background: COLORS.bg.elevated ?? COLORS.bg.main }}>
                    <th style={thStyle}>Belge</th>
                    <th style={thStyle}>Kaynak Klasör</th>
                    <th style={thStyle}>Durum</th>
                    <th style={thStyle}>Cari / Sipariş</th>
                    <th style={thStyle}>Satır</th>
                    <th style={thStyle}>Retry</th>
                    <th style={thStyle}>Yineleme</th>
                    <th style={thStyle}>Geliş Tarihi</th>
                    <th style={thStyle}>Son Güncelleme</th>
                    <th style={thStyle}>Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const statusColor = STATUS_COLOR[record.dosyaDurumu] ?? COLORS.muted;
                    return (
                      <tr key={record.kayitUuid} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={tdStyle}>
                          <div style={{ display: "grid", gap: 3 }}>
                            <span style={{ fontWeight: 700, color: COLORS.text }}>{record.hamDosyaAdi}</span>
                            <span style={{ fontSize: 11, color: COLORS.muted }}>
                              {record.kayitUuid.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td style={tdStyle}>{record.kaynakKlasor || "—"}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "5px 10px",
                              borderRadius: 999,
                              background: `${statusColor}14`,
                              color: statusColor,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {STATUS_LABEL[record.dosyaDurumu] ?? record.dosyaDurumu}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "grid", gap: 3 }}>
                            <span>{record.cariUnvan || record.okunanCariUnvan || "Cari eşleşmesi bekleniyor"}</span>
                            <span style={{ fontSize: 12, color: COLORS.muted }}>
                              {record.siparisNo ? `Sipariş: ${record.siparisNo}` : "Sipariş no yok"}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>{record.satirlar.length}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {record.retryNo > 0 ? (
                            <span style={{ fontWeight: 700, color: COLORS.warning }}>{record.retryNo}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {record.duplicateFlag === true ? (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: `${COLORS.warning}18`,
                                color: COLORS.warning,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                              title="Aynı içerikli belge daha önce işlendi"
                            >
                              Yineleme
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={tdStyle}>{formatDate(record.gelisTarihi)}</td>
                        <td style={tdStyle}>{formatDate(record.sonGuncelleme ?? null)}</td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {/* Faz navigasyonu */}
                            {record.dosyaDurumu === "PHASE_2_OCR_KONTROL" && (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => navigateToAppPage("ocr-kontrol")}
                                title="OCR Kontrol sayfasına git"
                              >
                                OCR Kontrol →
                              </Button>
                            )}
                            {record.dosyaDurumu === "PHASE_3_SIPARIS_DUZENLEME" && (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => navigateToAppPage("siparis-duzenleme")}
                                title="Sipariş Kontrol sayfasına git"
                              >
                                Sipariş Kontrol →
                              </Button>
                            )}
                            {record.dosyaDurumu === "PHASE_4_EXPORT" && (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => navigateToAppPage("optiplan-job")}
                                title="Export sayfasına git"
                              >
                                Export →
                              </Button>
                            )}
                            {/* Manuel Retry */}
                            {(record.dosyaDurumu === "HATA" || record.retryNo > 0) && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => void handleRetry(record.kayitUuid)}
                                disabled={retryingUuids.has(record.kayitUuid)}
                                title="Bu kaydı tekrar işlemeye al"
                              >
                                {retryingUuids.has(record.kayitUuid) ? "Retrying..." : "Retry"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  borderRadius: RADIUS.xl,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bg.surface,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "18px",
  borderBottom: `1px solid ${COLORS.border}`,
  flexWrap: "wrap",
};

const toolbarLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.muted,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const fieldStyle: CSSProperties = {
  minHeight: 42,
  padding: "10px 12px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bg.surface,
  color: COLORS.text,
  fontSize: 13,
};

const thStyle: CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: COLORS.muted,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  fontSize: 13,
  color: COLORS.text,
  verticalAlign: "top",
};
