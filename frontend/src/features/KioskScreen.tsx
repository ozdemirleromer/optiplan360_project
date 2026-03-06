import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, RefreshCw, Settings, XCircle } from "lucide-react";

import { useToast } from "../contexts/ToastContext";
import { adminService } from "../services/adminService";
import type { StationDto } from "../services/adminService";
import { COLORS, RADIUS, SHADOWS, TYPOGRAPHY } from "../components/Shared/constants";

interface ScanResult {
  success: boolean;
  message: string;
  orderInfo?: {
    orderNumber: string;
    customerName: string;
    partCount: number;
    currentStation: string;
    nextStation?: string;
  };
  error?: string;
}

interface StationDetailResult {
  stationId: string;
  configuration: Record<string, unknown>;
  stats: { totalScans: number; todayScans: number };
  recentErrors: unknown[];
}

interface StationConnectionResult {
  stationId: string;
  status: string;
  lastContact: string;
  responseTimeMs: number;
}

const KioskScreen: React.FC = () => {
  const [currentStation, setCurrentStation] = useState<StationDto | null>(null);
  const [stations, setStations] = useState<StationDto[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [showStationSettings, setShowStationSettings] = useState(false);
  const [stationDetail, setStationDetail] = useState<StationDetailResult | null>(null);
  const [stationSettingsLoading, setStationSettingsLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<StationConnectionResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stationIdParam = urlParams.get("station");

    adminService
      .listStations()
      .then((list) => {
        const active = list.filter((station) => station.active !== false);
        setStations(active);

        if (stationIdParam) {
          const found = active.find((station) => station.id === parseInt(stationIdParam, 10));
          setCurrentStation(found ?? active[0] ?? null);
        } else {
          setCurrentStation(active[0] ?? null);
        }
      })
      .catch(() => {
        setCurrentStation(null);
      })
      .finally(() => {
        setStationsLoading(false);
      });

    inputRef.current?.focus();
  }, []);

  const syncStationQuery = (stationId: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("station", String(stationId));
    window.history.replaceState({}, "", url.toString());
  };

  const handleScan = async (scannedData: string) => {
    if (isScanning) {
      return;
    }

    if (!currentStation) {
      setScanResult({
        success: false,
        message: "İstasyon bilgisi bulunamadı",
        error: "Station not configured",
      });
      return;
    }

    setIsScanning(true);

    try {
      const parts = scannedData.includes("_") ? scannedData.split("_") : [scannedData];
      const orderId = parts[0];
      const partId = parts[1] ?? undefined;

      const result = await adminService.scanStation({
        order_id: orderId,
        part_id: partId,
        station_id: currentStation.id,
        scan_type: partId ? "PART" : "ORDER",
        timestamp: new Date().toISOString(),
      });

      const newResult: ScanResult = {
        success: true,
        message: result.message || "İşlem gerçekleştirildi",
        orderInfo: result.order_info as ScanResult["orderInfo"],
      };

      setScanResult(newResult);
      setScanHistory((prev) => [newResult, ...prev.slice(0, 9)]);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      const failResult: ScanResult = {
        success: false,
        message,
        error: message,
      };
      setScanResult(failResult);
      setScanHistory((prev) => [failResult, ...prev.slice(0, 9)]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualScan = () => {
    if (isScanning) {
      return;
    }

    const inputValue = inputRef.current?.value?.trim();
    if (inputValue) {
      void handleScan(inputValue);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleManualScan();
    }
  };

  const clearResults = () => {
    setScanResult(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  const handleSearchOrder = () => {
    if (isScanning) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    if (input.value.trim()) {
      void handleScan(input.value.trim());
      return;
    }

    input.focus();
    input.select();
    addToast("Sipariş araması için barkod alanı odaklandı", "info");
  };

  const handleSwitchStation = () => {
    if (stations.length === 0) {
      addToast("Aktif istasyon bulunamadı", "warning");
      return;
    }

    const currentIndex = currentStation
      ? stations.findIndex((station) => station.id === currentStation.id)
      : -1;
    const nextStation = stations[(currentIndex + 1 + stations.length) % stations.length];

    setCurrentStation(nextStation);
    setStationDetail(null);
    setConnectionResult(null);
    setShowStationSettings(false);
    clearResults();
    syncStationQuery(nextStation.id);
    addToast(`Aktif istasyon değiştirildi: ${nextStation.name}`, "success");
  };

  const loadStationSettings = async () => {
    if (!currentStation) {
      addToast("İstasyon seçili değil", "warning");
      return;
    }

    setShowStationSettings(true);
    setStationSettingsLoading(true);
    setConnectionResult(null);

    try {
      const detail = await adminService.getStationDetail(String(currentStation.id));
      setStationDetail(detail as StationDetailResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "İstasyon ayarları yüklenemedi";
      addToast(message, "error");
    } finally {
      setStationSettingsLoading(false);
    }
  };

  const handleConnectionTest = async () => {
    if (!currentStation || testingConnection) {
      return;
    }

    setTestingConnection(true);
    try {
      const result = await adminService.testStationConnection(String(currentStation.id));
      setConnectionResult(result as StationConnectionResult);
      addToast(`Bağlantı testi tamamlandı: ${result.status}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bağlantı testi başarısız";
      addToast(message, "error");
    } finally {
      setTestingConnection(false);
    }
  };

  if (stationsLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: COLORS.bg.main,
          color: COLORS.muted,
        }}
      >
        <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", marginRight: 12 }} />
        İstasyon bilgisi yükleniyor...
      </div>
    );
  }

  const quickActions = [
    {
      icon: <ClipboardList size={24} aria-hidden />,
      label: "Sipariş Ara",
      onClick: handleSearchOrder,
    },
    {
      icon: <RefreshCw size={24} aria-hidden />,
      label: "İstasyon Değiştir",
      onClick: handleSwitchStation,
    },
    {
      icon: <Settings size={24} aria-hidden />,
      label: "Ayarlar",
      onClick: () => void loadStationSettings(),
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg.main, color: COLORS.text }}>
      <header style={{ background: COLORS.bg.surface, borderBottom: `1px solid ${COLORS.border}`, boxShadow: SHADOWS.sm }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: COLORS.text, fontFamily: TYPOGRAPHY.fontFamily.heading }}>
                OPTIPLAN360
              </h1>
              <p className="text-sm" style={{ color: COLORS.muted }}>
                İstasyon Yönetim Sistemi
              </p>
            </div>
            {currentStation && (
              <div className="text-right">
                <div
                  className="px-4 py-2 rounded-lg"
                  style={{ background: COLORS.bg.elevated, border: `1px solid ${COLORS.border}` }}
                >
                  <p className="font-semibold" style={{ color: COLORS.text }}>
                    {currentStation.name}
                  </p>
                  <p className="text-xs" style={{ color: COLORS.muted }}>
                    {currentStation.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div
          className="rounded-xl p-8 mb-6"
          style={{ background: COLORS.bg.surface, border: `1px solid ${COLORS.border}`, boxShadow: SHADOWS.md }}
        >
          <div className="text-center mb-8">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: COLORS.bg.elevated, border: `1px solid ${COLORS.border}` }}
            >
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>
              Barkod Tara
            </h2>
            <p style={{ color: COLORS.muted }}>Sipariş veya parça barkodunu okutun</p>
          </div>

          <div className="mb-6">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                onKeyPress={handleKeyPress}
                placeholder="Barkod girin veya barkod okutucu kullanın..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                disabled={isScanning}
              />
              {isScanning && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button type="button"
              onClick={handleManualScan}
              disabled={isScanning}
              style={{
                background: isScanning ? COLORS.border : COLORS.accent,
                color: "#fff",
                fontWeight: TYPOGRAPHY.fontWeight.bold,
                padding: "12px 28px",
                borderRadius: RADIUS.lg,
                fontSize: 16,
                border: `1px solid ${isScanning ? COLORS.border : COLORS.accent}`,
                cursor: isScanning ? "not-allowed" : "pointer",
                transition: "all .2s ease",
              }}
            >
              {isScanning ? "İşleniyor..." : "Manuel Tara"}
            </button>
          </div>

          {scanResult && (
            <div
              style={{
                borderRadius: RADIUS.lg,
                padding: 20,
                marginBottom: 24,
                border: `1px solid ${scanResult.success ? COLORS.success : COLORS.danger}`,
                background: scanResult.success ? COLORS.success : COLORS.danger,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: 16,
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                      color: scanResult.success ? COLORS.success : COLORS.danger,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {scanResult.success ? <CheckCircle2 size={18} aria-hidden /> : <XCircle size={18} aria-hidden />}
                    {scanResult.success ? "Başarılı" : "Hata"}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: scanResult.success ? COLORS.success : COLORS.danger,
                    }}
                  >
                    {scanResult.message}
                  </p>

                  {scanResult.orderInfo && (
                    <div
                      style={{
                        marginTop: 16,
                        borderRadius: RADIUS.lg,
                        padding: 12,
                        background: COLORS.bg.elevated,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 8px 0",
                          fontSize: 13,
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: COLORS.text,
                        }}
                      >
                        Sipariş Bilgileri:
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                          gap: 8,
                          fontSize: 12,
                          color: COLORS.text,
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Sipariş No:</span>{" "}
                          {scanResult.orderInfo.orderNumber}
                        </div>
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Müşteri:</span>{" "}
                          {scanResult.orderInfo.customerName}
                        </div>
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Parça Sayısı:</span>{" "}
                          {scanResult.orderInfo.partCount}
                        </div>
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Mevcut İstasyon:</span>{" "}
                          {scanResult.orderInfo.currentStation}
                        </div>
                        {scanResult.orderInfo.nextStation && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Sonraki İstasyon:</span>{" "}
                            {scanResult.orderInfo.nextStation}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button type="button"
                  onClick={clearResults}
                  style={{
                    background: COLORS.bg.elevated,
                    color: COLORS.text,
                    padding: "8px 14px",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${COLORS.border}`,
                    cursor: "pointer",
                    fontWeight: TYPOGRAPHY.fontWeight.semibold,
                  }}
                >
                  Temizle
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
            {quickActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                style={{
                  background: COLORS.bg.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.lg,
                  padding: 16,
                  textAlign: "center",
                  color: COLORS.text,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ marginBottom: 0 }}>{item.icon}</div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                  {item.label}
                </p>
              </button>
            ))}
          </div>

          {showStationSettings && (
            <div
              style={{
                marginTop: 20,
                borderRadius: RADIUS.xl,
                padding: 20,
                background: COLORS.bg.elevated,
                border: `1px solid ${COLORS.border}`,
                display: "grid",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
                    İstasyon Ayarları
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.muted }}>
                    {currentStation?.name || "İstasyon seçili değil"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void handleConnectionTest()}
                    style={{
                      background: COLORS.accent,
                      color: "#fff",
                      border: `1px solid ${COLORS.accent}`,
                      borderRadius: RADIUS.md,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                    }}
                  >
                    {testingConnection ? "Test ediliyor..." : "Bağlantı Testi"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStationSettings(false)}
                    style={{
                      background: COLORS.bg.surface,
                      color: COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.md,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                    }}
                  >
                    Kapat
                  </button>
                </div>
              </div>

              {stationSettingsLoading ? (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>İstasyon ayrıntıları yükleniyor...</div>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                      gap: 12,
                    }}
                  >
                    <div style={{ padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Toplam Tarama</div>
                      <div style={{ fontSize: 18, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text }}>
                        {stationDetail?.stats.totalScans ?? currentStation?.scanCountToday ?? 0}
                      </div>
                    </div>
                    <div style={{ padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Bugünkü Tarama</div>
                      <div style={{ fontSize: 18, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text }}>
                        {stationDetail?.stats.todayScans ?? currentStation?.todayScans ?? 0}
                      </div>
                    </div>
                    <div style={{ padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Cihaz</div>
                      <div style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
                        {currentStation?.deviceModel || currentStation?.deviceType || "Tanımsız"}
                      </div>
                    </div>
                    <div style={{ padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Bağlantı</div>
                      <div style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
                        {currentStation?.connectionType || currentStation?.ipAddress || "Tanımsız"}
                      </div>
                    </div>
                  </div>

                  {stationDetail?.configuration && Object.keys(stationDetail.configuration).length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                        gap: 10,
                      }}
                    >
                      {Object.entries(stationDetail.configuration).slice(0, 8).map(([key, value]) => (
                        <div
                          key={key}
                          style={{
                            padding: 10,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: RADIUS.md,
                            background: COLORS.bg.surface,
                          }}
                        >
                          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{key}</div>
                          <div style={{ fontSize: 12, color: COLORS.text }}>{String(value ?? "—")}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {connectionResult && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: RADIUS.md,
                        border: `1px solid ${COLORS.success}`,
                        background: COLORS.success,
                        color: COLORS.success,
                        fontSize: 12,
                      }}
                    >
                      Durum: {connectionResult.status} • Yanıt: {connectionResult.responseTimeMs} ms • Son temas:{" "}
                      {new Date(connectionResult.lastContact).toLocaleString("tr-TR")}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {scanHistory.length > 0 && (
          <div
            style={{
              borderRadius: RADIUS.xl,
              padding: 20,
              background: COLORS.bg.surface,
              border: `1px solid ${COLORS.border}`,
              boxShadow: SHADOWS.md,
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
              Son Taramalar
            </h3>
            <div style={{ display: "grid", gap: 8 }}>
              {scanHistory.map((result, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 10,
                    borderRadius: RADIUS.lg,
                    background: result.success ? COLORS.success : COLORS.danger,
                    border: `1px solid ${result.success ? COLORS.success : COLORS.danger}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>
                      {result.success ? (
                        <CheckCircle2 size={18} color={COLORS.success} aria-hidden />
                      ) : (
                        <XCircle size={18} color={COLORS.danger} aria-hidden />
                      )}
                    </span>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: result.success ? COLORS.success : COLORS.danger,
                        }}
                      >
                        {result.message}
                      </p>
                      {result.orderInfo && (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.muted }}>
                          {result.orderInfo.orderNumber} - {result.orderInfo.customerName}
                        </p>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>{new Date().toLocaleTimeString("tr-TR")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer style={{ background: COLORS.bg.surface, borderTop: `1px solid ${COLORS.border}`, marginTop: 32 }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center text-sm" style={{ color: COLORS.muted }}>
            <span>OPTIPLAN360 v1.0</span>
            <span>{currentStation?.name || "İstasyon Seçilmedi"}</span>
            <span>{new Date().toLocaleString("tr-TR")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default KioskScreen;



