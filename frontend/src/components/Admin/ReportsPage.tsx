/**
 * Reports Management Page
 * Generates and exports production, efficiency, and financial reports
 * Gerçek API verisi ile çalışır
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { TopBar } from "../Layout";
import { Button, Card } from "../Shared";
import { COLORS, RADIUS } from "../Shared/constants";
import { downloadText } from "./shared/utils";
import { adminService, type SystemStats } from "../../services/adminService";
import { ordersService } from "../../services/ordersService";
import type { Order } from "../../types";
import { getPartCount } from "../../utils/orderParts";

interface StationPerf {
  name: string;
  processed: number;
  total: number;
  rate: number;
}

export function ReportsPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [reportType, setReportType] = useState("production");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stations, setStations] = useState<StationPerf[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, ordersData, stationsData] = await Promise.all([
          adminService.getStats(),
          ordersService.list(),
          adminService.getStations().catch(() => []),
        ]);
        setStats(statsData);
        setOrders(ordersData);

        const total = ordersData.length;
        const delivered = ordersData.filter((o) => o.status === "DELIVERED" || o.status === "READY").length;
        setStations(
          (stationsData as Array<Record<string, unknown>>).map((s) => ({
            name: String(s.name || "İstasyon"),
            processed: delivered,
            total,
            rate: total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0,
          }))
        );
      } catch (err) {
        console.error("ReportsPage veri yükleme hatası:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Hesaplamalar
  const totalOrders = stats?.totalOrders ?? orders.length;
  const completed = orders.filter((o) => o.status === "DELIVERED").length;
  const pending = orders.filter((o) => o.status === "IN_PRODUCTION" || o.status === "NEW").length;
  const delayed = orders.filter((o) => o.status === "HOLD").length;
  const completionRate = totalOrders > 0 ? Math.round((completed / totalOrders) * 1000) / 10 : 0;
  const delayRate = totalOrders > 0 ? Math.round((delayed / totalOrders) * 1000) / 10 : 0;
  const avgDaily = totalOrders > 0 ? Math.round((totalOrders / 30) * 10) / 10 : 0;

  const productionDetails = useMemo<Record<string, string | number>>(() => ({
    "Günlük Ortalama": avgDaily,
    "Toplam Sipariş": totalOrders,
    "Tamamlanan": completed,
    "Üretimde": orders.filter((o) => o.status === "IN_PRODUCTION").length,
    "Bekleyen": pending,
    "Verimlilik (%)": completionRate,
  }), [avgDaily, totalOrders, completed, orders, pending, completionRate]);

  const materialsDetails = useMemo<Record<string, string | number>>(() => {
    const materialCounts = orders.reduce((acc, o) => {
      const mat = o.mat || "Bilinmiyor";
      acc[mat] = (acc[mat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topMaterial = Object.entries(materialCounts).sort((a, b) => b[1] - a[1])[0];
    const totalParts = orders.reduce((sum, o) => sum + getPartCount(o.parts, 0), 0);
    return {
      "Toplam Parça": totalParts,
      "En Çok Kullanılan": topMaterial ? `${topMaterial[0]} (${topMaterial[1]})` : "—",
      "Farklı Malzeme": Object.keys(materialCounts).length,
      "Sipariş/Malzeme Oranı": Object.keys(materialCounts).length > 0
        ? Math.round(totalOrders / Object.keys(materialCounts).length * 10) / 10
        : 0,
    };
  }, [orders, totalOrders]);

  const generateReport = useCallback(async () => {
    setGenerating(true);
    try {
      const [freshStats, freshOrders] = await Promise.all([
        adminService.getStats(),
        ordersService.list(),
      ]);
      setStats(freshStats);
      setOrders(freshOrders);
    } catch (error) {
      console.error("Rapor oluşturma hatası:", error);
    } finally {
      setGenerating(false);
    }
  }, []);

  const exportReport = useCallback((format: "excel" | "pdf" | "csv") => {
    const reportData = {
      reportType,
      dateRange,
      generatedAt: new Date().toISOString(),
      summary: { totalOrders, completed, pending, delayed, completionRate, delayRate },
      production: productionDetails,
      stations: stations,
      materials: materialsDetails,
      orders: orders.map((o) => ({
        id: o.id,
        customer: o.cust,
        material: o.mat,
        status: o.status,
        parts: getPartCount(o.parts, 0),
        date: o.date,
      })),
    };
    const content = format === "csv"
      ? `Sipariş No,Müşteri,Malzeme,Durum,Parça,Tarih\n${orders.map((o) =>
          `${o.id},${o.cust || ""},${o.mat || ""},${o.status},${getPartCount(o.parts, 0)},${o.date || ""}`
        ).join("\n")}`
      : JSON.stringify(reportData, null, 2);

    const ext = format === "excel" ? "json" : format;
    downloadText(`rapor_${reportType}_${dateRange.start}_${dateRange.end}.${ext}`, content);
  }, [dateRange, reportType, totalOrders, completed, pending, delayed, completionRate, delayRate, productionDetails, stations, materialsDetails, orders]);

  if (loading) {
    return (
      <div>
        <TopBar title="Raporlar" subtitle="Detaylı üretim raporları" breadcrumbs={["Yönetim", "Raporlar"]} />
        <div style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>Veriler yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Raporlar" subtitle="Detaylı üretim raporları" breadcrumbs={["Yönetim", "Raporlar"]} />
      <div style={{ padding: 24, maxWidth: 1320, margin: "0 auto", display: "grid", gap: 16 }}>
        <Card title="Rapor Yapılandırması">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Başlangıç Tarihi</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(s => ({ ...s, start: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Bitiş Tarihi</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(s => ({ ...s, end: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Rapor Türü</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="production">Üretim Raporu</option>
                <option value="efficiency">Verimlilik Raporu</option>
                <option value="quality">Kalite Raporu</option>
                <option value="inventory">Envanter Raporu</option>
                <option value="orders">Sipariş Raporu</option>
                <option value="stations">İstasyon Raporu</option>
                <option value="users">Kullanıcı Raporu</option>
                <option value="financial">Finansal Rapor</option>
              </select>
            </div>
            <div>
              <Button onClick={generateReport} disabled={generating} style={{ width: "100%", marginTop: 20 }}>
                {generating ? "Oluşturuluyor..." : "Rapor Oluştur"}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Yönetici Özeti">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
            {[
              { label: "Toplam Sipariş", value: totalOrders, color: COLORS.primary[600], suffix: "" },
              { label: "Tamamlanan", value: completed, color: COLORS.success.DEFAULT, suffix: `%${completionRate}` },
              { label: "Bekleyen", value: pending, color: COLORS.warning.DEFAULT, suffix: "İşlemde" },
              { label: "Geciken", value: delayed, color: COLORS.error.DEFAULT, suffix: `%${delayRate}` }
            ].map((stat) => (
              <div key={stat.label} style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: stat.color }}>{stat.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{stat.suffix}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16 }}>
          <Card title="Üretim Detayları">
            {Object.entries(productionDetails).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ color: COLORS.muted }}>{key}</span>
                <span style={{ fontWeight: 600 }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
              </div>
            ))}
          </Card>

          <Card title="İstasyon Performansı">
            {stations.length > 0 ? stations.map((station) => (
              <div key={station.name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>{station.name}</span>
                  <span style={{ fontWeight: 600, color: station.rate >= 95 ? COLORS.success.DEFAULT : station.rate >= 80 ? COLORS.warning.DEFAULT : COLORS.error.DEFAULT }}>%{station.rate}</span>
                </div>
                <div style={{ height: 4, background: COLORS.border, borderRadius: 2 }}>
                  <div style={{ width: `${station.rate}%`, height: "100%", background: station.rate >= 95 ? COLORS.success.DEFAULT : station.rate >= 80 ? COLORS.warning.DEFAULT : COLORS.error.DEFAULT, borderRadius: 2 }} />
                </div>
              </div>
            )) : (
              <div style={{ color: COLORS.muted, fontSize: 13, padding: "12px 0" }}>İstasyon verisi bulunamadı</div>
            )}
          </Card>

          <Card title="Malzeme Kullanımı">
            {Object.entries(materialsDetails).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ color: COLORS.muted }}>{key}</span>
                <span style={{ fontWeight: 600 }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
              </div>
            ))}
          </Card>

          <Card title="İndirme Seçenekleri">
            <div style={{ display: "grid", gap: 8 }}>
              {(["excel", "pdf", "csv"] as const).map((format) => (
                <Button key={format} variant="secondary" onClick={() => exportReport(format)}>{format.toUpperCase()} İndir</Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
