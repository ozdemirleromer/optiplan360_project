import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, ClipboardList, RefreshCw, Settings } from 'lucide-react';
import { COLORS, RADIUS, SHADOWS, TYPOGRAPHY } from './Shared/constants';
import { adminService } from '../services/adminService';
import type { StationDto } from '../services/adminService';

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

const KioskScreen: React.FC = () => {
  const [currentStation, setCurrentStation] = useState<StationDto | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // API'den aktif istasyonları çek, sonra URL parametresine göre seç
    const urlParams = new URLSearchParams(window.location.search);
    const stationIdParam = urlParams.get('station');

    adminService.listStations().then((list) => {
      const active = list.filter((s) => s.active !== false);
      if (stationIdParam) {
        const found = active.find((s) => s.id === parseInt(stationIdParam));
        setCurrentStation(found ?? active[0] ?? null);
      } else {
        setCurrentStation(active[0] ?? null);
      }
    }).catch(() => {
      // Bağlantı yoksa boş bırak; kullanıcı hata mesajını görür
      setCurrentStation(null);
    }).finally(() => {
      setStationsLoading(false);
    });

    // Otomatik input focus
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleScan = async (scannedData: string) => {
    if (!currentStation) {
      setScanResult({
        success: false,
        message: 'İstasyon bilgisi bulunamadı',
        error: 'Station not configured'
      });
      return;
    }

    setIsScanning(true);

    try {
      // Barkod verisini parse et (format: ORDERID_PARTID veya sadece ORDERID)
      const parts = scannedData.includes('_') ? scannedData.split('_') : [scannedData];
      const orderId = parts[0];
      const partId = parts[1] ?? undefined;

      const result = await adminService.scanStation({
        order_id: orderId,
        part_id: partId,
        station_id: currentStation.id,
        scan_type: partId ? 'PART' : 'ORDER',
        timestamp: new Date().toISOString(),
      });

      const newResult: ScanResult = {
        success: true,
        message: result.message || 'İşlem gerçekleştirildi',
        orderInfo: result.order_info as ScanResult['orderInfo'],
      };

      setScanResult(newResult);
      setScanHistory(prev => [newResult, ...prev.slice(0, 9)]);

      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      const failResult: ScanResult = {
        success: false,
        message: msg,
        error: msg,
      };
      setScanResult(failResult);
      setScanHistory(prev => [failResult, ...prev.slice(0, 9)]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualScan = () => {
    const inputValue = inputRef.current?.value?.trim();
    if (inputValue) {
      handleScan(inputValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualScan();
    }
  };

  const clearResults = () => {
    setScanResult(null);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  if (stationsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: COLORS.bg.main, color: COLORS.muted }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginRight: 12 }} />
        İstasyon bilgisi yükleniyor...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg.main, color: COLORS.text }}>
      {/* Header */}
      <header style={{ background: COLORS.bg.surface, borderBottom: `1px solid ${COLORS.border}`, boxShadow: SHADOWS.sm }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: COLORS.text, fontFamily: TYPOGRAPHY.fontFamily.heading }}>OPTIPLAN360</h1>
              <p className="text-sm" style={{ color: COLORS.muted }}>İstasyon Yönetim Sistemi</p>
            </div>
            {currentStation && (
              <div className="text-right">
                <div
                  className="px-4 py-2 rounded-lg"
                  style={{ background: COLORS.bg.elevated, border: `1px solid ${COLORS.border}` }}
                >
                  <p className="font-semibold" style={{ color: COLORS.text }}>{currentStation.name}</p>
                  <p className="text-xs" style={{ color: COLORS.muted }}>{currentStation.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Scan Area */}
        <div className="rounded-xl p-8 mb-6" style={{ background: COLORS.bg.surface, border: `1px solid ${COLORS.border}`, boxShadow: SHADOWS.md }}>
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: COLORS.bg.elevated, border: `1px solid ${COLORS.border}` }}>
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>Barkod Tara</h2>
            <p style={{ color: COLORS.muted }}>Sipariş veya parça barkodunu okutun</p>
          </div>

          {/* Input Area */}
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
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Scan Button */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button
              onClick={handleManualScan}
              disabled={isScanning}
              style={{
                background: isScanning ? COLORS.border2 : COLORS.primary[600],
                color: "#fff",
                fontWeight: TYPOGRAPHY.fontWeight.bold,
                padding: "12px 28px",
                borderRadius: RADIUS.lg,
                fontSize: 16,
                border: `1px solid ${isScanning ? COLORS.border : COLORS.primary[700]}`,
                cursor: isScanning ? "not-allowed" : "pointer",
                transition: "all .2s ease",
              }}
            >
              {isScanning ? "İşleniyor..." : "Manuel Tara"}
            </button>
          </div>

          {/* Scan Result */}
          {scanResult && (
            <div
              style={{
                borderRadius: RADIUS.lg,
                padding: 20,
                marginBottom: 24,
                border: `1px solid ${scanResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT}`,
                background: scanResult.success ? COLORS.success.light : COLORS.error.light,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: 16,
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                      color: scanResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                    }}
                  >
                    {scanResult.success ? <><CheckCircle2 size={18} aria-hidden /> Başarılı</> : <><XCircle size={18} aria-hidden /> Hata</>}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: scanResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
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
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
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
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Sipariş No:</span> {scanResult.orderInfo.orderNumber}
                        </div>
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Müşteri:</span> {scanResult.orderInfo.customerName}
                        </div>
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Parça Sayısı:</span> {scanResult.orderInfo.partCount}
                        </div>
                        <div>
                          <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Mevcut İstasyon:</span> {scanResult.orderInfo.currentStation}
                        </div>
                        {scanResult.orderInfo.nextStation && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>Sonraki İstasyon:</span> {scanResult.orderInfo.nextStation}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
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

          {/* Quick Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
            {[
              { icon: <ClipboardList size={24} aria-hidden />, label: "Sipariş Ara" },
              { icon: <RefreshCw size={24} aria-hidden />, label: "İstasyon Değiştir" },
              { icon: <Settings size={24} aria-hidden />, label: "Ayarlar" },
            ].map((item) => (
              <button
                key={item.label}
                disabled
                title="Yakında"
                style={{
                  background: COLORS.bg.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.lg,
                  padding: 16,
                  textAlign: "center",
                  color: COLORS.text,
                  cursor: "not-allowed",
                  opacity: 0.7,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ marginBottom: 0 }}>{item.icon}</div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: TYPOGRAPHY.fontWeight.semibold }}>{item.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Scan History */}
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
                    background: result.success ? COLORS.success.light : COLORS.error.light,
                    border: `1px solid ${result.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>{result.success ? <CheckCircle2 size={18} color={COLORS.success.DEFAULT} aria-hidden /> : <XCircle size={18} color={COLORS.error.DEFAULT} aria-hidden />}</span>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: result.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
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
                  <span style={{ fontSize: 11, color: COLORS.muted }}>
                    {new Date().toLocaleTimeString("tr-TR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ background: COLORS.bg.surface, borderTop: `1px solid ${COLORS.border}`, marginTop: 32 }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center text-sm" style={{ color: COLORS.muted }}>
            <span>OPTIPLAN360 v1.0</span>
            <span>{currentStation?.name || 'İstasyon Seçilmedi'}</span>
            <span>{new Date().toLocaleString('tr-TR')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default KioskScreen;
