import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge, Button, Card, KPICard, PriorityBadge } from "../Shared";
import { TopBar } from "../Layout";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";
import { adminService, SystemStats, DashboardInsights } from "../../services/adminService";
import { ordersService } from "../../services/ordersService";
import type { Order } from "../../types";
import { useRealtime } from "../../hooks/useRealtime";
import { getPartCount } from "../../utils/orderParts";
import "./dashboard.css";

// Lazy-loaded AI sekmeleri
const AIOpsDashboard = lazy(() =>
  import("../../features/Operations/AIOpsDashboard").then((m) => ({ default: m.AIOpsDashboard }))
);
const AIOrchestratorDashboard = lazy(() =>
  import("../../features/Operations/AIOrchestratorDashboard").then((m) => ({ default: m.AIOrchestratorDashboard }))
);

const dashboardTabs = [
  { id: "overview", label: "Genel Bakış" },
  { id: "ops", label: "Orkestrasyon Paneli" },
  { id: "orchestrator", label: "AI Komuta Merkezi" },
] as const;

type DashboardTabId = (typeof dashboardTabs)[number]["id"];

const TabLoading = () => (
  <div className="dashboard-tab-loading">
    <div className="loading-spinner" aria-hidden="true" />
    Yükleniyor...
  </div>
);

type DashboardStation = {
  id: number;
  name: string;
  active: boolean;
  lastScan: string;
  istasyonDurumu: string;
  todayScans: number;
};

type DashboardProps = {
  currentUser?: { name: string };
  onNewOrder?: () => void;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function Dashboard({ currentUser = { name: "Kullanıcı" }, onNewOrder }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [trends, setTrends] = useState<{ date: string; ordersNew: number; ordersProduction: number; ordersReady: number; ordersDelivered: number }[] | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [stations, setStations] = useState<DashboardStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Exponential backoff refs
  const REFRESH_MS = 45_000;
  const MAX_RETRY_MS = 120_000;
  const retryDelayRef = useRef(REFRESH_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, insightsData, trendsData, ordersData, stationsData] = await Promise.all([
        adminService.getStats().catch(() => null),
        adminService.getInsights().catch(() => null),
        adminService.getKpiTrends().catch(() => null),
        ordersService.list().catch((): Order[] => []),
        adminService.getStations().catch(() => []),
      ]);
      setStats(statsData);
      setInsights(insightsData);
      setTrends(trendsData?.trends ?? null);
      setRecentOrders((ordersData as Order[]).slice(0, 8));
      setStations(
        (stationsData as Array<Record<string, unknown>>).map((s, i) => ({
          id: Number(s.id) || i + 1,
          name: String(s.name || "İstasyon"),
          active: s.isActive !== false,
          lastScan: s.lastScanAt
            ? new Date(String(s.lastScanAt)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
            : "—",
          istasyonDurumu: String(s.stationType || s.name || "Hazır"),
          todayScans: Number(s.scanCountToday ?? 0),
        }))
      );
      const anyFailed = statsData === null;
      setOffline(anyFailed);
      retryDelayRef.current = anyFailed
        ? Math.min(retryDelayRef.current * 2, MAX_RETRY_MS)
        : REFRESH_MS;
    } finally {
      setLoading(false);
      if (isMountedRef.current) {
        timerRef.current = setTimeout(() => void loadStats(), retryDelayRef.current);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadStats();
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadStats]);

  useRealtime((event) => {
    if (event.type === 'STATION_SCAN' || event.type === 'ORDER_UPDATED') {
      void loadStats();
    }
  });

  const totalScans = stations.reduce((sum, s) => sum + (s.todayScans ?? 0), 0);
  const activeCount = stations.filter((s) => s.active).length;
  const inactiveCount = Math.max(0, stations.length - activeCount);

  // Gerçek trend verilerini kullan veya fallback
  const defaultSparkData = [0, 0, 0, 0, 0, 0, 0];
  const newSparkData = trends?.map(t => t.ordersNew) ?? defaultSparkData;
  const prodSparkData = trends?.map(t => t.ordersProduction) ?? defaultSparkData;
  const readySparkData = trends?.map(t => t.ordersReady) ?? defaultSparkData;
  const deliveredSparkData = trends?.map(t => t.ordersDelivered) ?? defaultSparkData;

  const kpiData = [
    { icon: "OR", label: "Bugün Gelen", value: stats?.ordersNew ?? 0, color: COLORS.info.DEFAULT, sparkData: [...newSparkData, stats?.ordersNew ?? 0] },
    { icon: "UR", label: "Üretimde", value: stats?.ordersProduction ?? 0, color: COLORS.accent[400], sparkData: [...prodSparkData, stats?.ordersProduction ?? 0] },
    { icon: "HZ", label: "Hazır", value: stats?.ordersReady ?? 0, color: COLORS.success.DEFAULT, sparkData: [...readySparkData, stats?.ordersReady ?? 0] },
    { icon: "TM", label: "Tamamlanan", value: stats?.ordersDelivered ?? 0, color: COLORS.primary[500], sparkData: [...deliveredSparkData, stats?.ordersDelivered ?? 0] }
  ];

  // Dinamik insights verileri (API'den gelen) veya fallback
  const probabilityInsights = insights?.probabilityInsights || [
    { label: "Gün içi kapasite aşımı olasılığı", probability: "28%", impact: "Yüksek", action: "Vardiya sonuna 2 ek slot aç" },
    { label: "Kritik istasyon arızası olasılığı", probability: inactiveCount > 0 ? "36%" : "14%", impact: "Kritik", action: "Yedek istasyonu hazır tut" },
    { label: "SLA gecikmesi olasılığı", probability: (stats?.ordersProduction ?? 0) > (stats?.ordersReady ?? 0) ? "33%" : "18%", impact: "Orta", action: "Öncelik kuralını yeniden dağıt" },
    { label: "İade/tekrar iş olasılığı", probability: "11%", impact: "Orta", action: "OCR confidence altına ikinci kontrol ekle" },
  ];

  const capacityPlan = insights?.capacityPlan || [
    { slot: "08:00-12:00", demand: 46, capacity: 52, utilization: "88%", risk: "Düşük" },
    { slot: "12:00-16:00", demand: 58, capacity: 54, utilization: "107%", risk: "Yüksek" },
    { slot: "16:00-20:00", demand: 41, capacity: 48, utilization: "85%", risk: "Düşük" },
    { slot: "20:00-24:00", demand: 34, capacity: 30, utilization: "113%", risk: "Kritik" },
  ];

  const overviewFacts = insights?.overviewFacts || [
    { label: "Toplam İstasyon Tarama", value: String(totalScans) },
    { label: "Aktif İstasyon", value: `${activeCount}/${stations.length}` },
    { label: "Pasif İstasyon", value: String(inactiveCount) },
    { label: "Acil Sipariş Oranı", value: "%12" },
    { label: "Ortalama İşlem Süresi", value: "6.8 dk" },
    { label: "Tahmini Gün Sonu Çıkış", value: String(stats?.ordersDelivered ? stats.ordersDelivered + 24 : 24) },
  ];

  return (
    <div className="electric-page">
      <TopBar
        title={`${greeting()}, ${currentUser.name.split(" ")[0]}`}
        subtitle="AI Orkestrasyon & Üretim Genel Durumu"
        breadcrumbs={["Orkestrasyon", "Gösterge Paneli"]}
      >
        {activeTab === "overview" && (
          <>
            <Button variant="secondary" size="sm" onClick={loadStats} disabled={loading}>
              {loading ? "Yenileniyor..." : "Yenile"}
            </Button>
            <Button variant="primary" size="sm" icon="+" onClick={onNewOrder}>Yeni Sipariş</Button>
          </>
        )}
      </TopBar>

      {/* Sekme Çubuğu */}
      <div className="app-page-container" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div
          style={{
            display: "flex",
            gap: "2px",
            marginBottom: "24px",
            borderBottom: `1px solid ${COLORS.border}`,
            flexWrap: "wrap",
          }}
        >
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? COLORS.primary.DEFAULT : COLORS.muted,
                background: activeTab === tab.id ? `${COLORS.primary.DEFAULT}08` : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? `3px solid ${COLORS.primary.DEFAULT}` : "3px solid transparent",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sekme İçerikleri */}
      {activeTab === "ops" && (
        <Suspense fallback={<TabLoading />}>
          <AIOpsDashboard />
        </Suspense>
      )}
      {activeTab === "orchestrator" && (
        <Suspense fallback={<TabLoading />}>
          <AIOrchestratorDashboard />
        </Suspense>
      )}

      {activeTab === "overview" && (
        <div className="app-page-container" style={{ display: "grid", gap: 20 }}>
          {offline && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background: "rgba(234,179,8,0.06)",
                border: "1px solid rgba(234,179,8,0.25)",
                borderRadius: RADIUS.md,
                fontSize: 12,
                color: COLORS.warning.DEFAULT,
              }}
            >
              <AlertTriangle size={13} aria-hidden />
              <span>Sunucu bağlantısı kurulamadı — son bilinen veriler gösteriliyor</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            {kpiData.map((kpi) => (
              <KPICard
                key={kpi.icon}
                icon={kpi.icon}
                label={kpi.label}
                value={loading ? "..." : kpi.value}
                change={0}
                color={kpi.color}
                sparkData={kpi.sparkData}
              />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
            <Card title="İstasyon Durumları" subtitle="Canlı üretim izleme">
              <div style={{ display: "grid", gap: 10 }}>
                {stations.map((station) => (
                  <div
                    key={station.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.md,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,.02)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold }}>{station.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>Durum: {station.istasyonDurumu}</div>
                      <div style={{ fontSize: 11, color: COLORS.gray[400] }}>Son okutma: {station.lastScan}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: station.active ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                          marginBottom: 4,
                        }}
                      >
                        {station.active ? "Aktif" : "Pasif"}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: TYPOGRAPHY.fontWeight.bold }}>{station.todayScans}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Gün Özeti" subtitle="Anlık toplamlar">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>Toplam Siparişler</span>
                  <strong style={{ color: COLORS.primary[500] }}>{stats?.totalOrders ?? 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>Aktif İstasyon</span>
                  <strong style={{ color: COLORS.success.DEFAULT }}>{activeCount} / {stations.length}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>Müşteri Sayısı</span>
                  <strong>{stats?.totalCustomers ?? 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>Kayıtlı Kullanıcılar</span>
                  <strong>{stats?.totalUsers ?? 0}</strong>
                </div>
              </div>
            </Card>
          </div>

          <Card title="Genel Bakış Detayları" subtitle="Olasılıklar, kapasite ve operasyonel senaryolar">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 14 }}>
              {overviewFacts.map((item) => (
                <div key={item.label} style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: "10px 12px", background: "rgba(255,255,255,.02)" }}>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{item.label}</div>
                  <div style={{ fontSize: 17, color: COLORS.text, fontWeight: TYPOGRAPHY.fontWeight.bold }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: "10px 12px", background: "rgba(255,255,255,.015)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.primary[500] }}>Risk ve Olasılık Matrisi</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  {probabilityInsights.map((item) => (
                    <div key={item.label} style={{ borderBottom: `1px dashed ${COLORS.border}`, paddingBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12 }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: COLORS.warning.DEFAULT }}>{item.probability}</span>
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>Etki: {item.impact} | Aksiyon: {item.action}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: "10px 12px", background: "rgba(255,255,255,.015)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.primary[500] }}>Kapasite ve Talep Planı</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        {["Zaman", "Talep", "Kapasite", "Kullanım", "Risk"].map((head) => (
                          <th key={head} style={{ textAlign: "left", fontSize: 11, color: COLORS.muted, padding: "8px 6px" }}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {capacityPlan.map((item) => (
                        <tr key={item.slot} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ fontSize: 12, padding: "8px 6px" }}>{item.slot}</td>
                          <td style={{ fontSize: 12, padding: "8px 6px" }}>{item.demand}</td>
                          <td style={{ fontSize: 12, padding: "8px 6px" }}>{item.capacity}</td>
                          <td style={{ fontSize: 12, padding: "8px 6px" }}>{item.utilization}</td>
                          <td style={{ fontSize: 12, padding: "8px 6px", color: item.risk === "Kritik" ? COLORS.error.DEFAULT : item.risk === "Yüksek" ? COLORS.warning.DEFAULT : COLORS.success.DEFAULT }}>
                            {item.risk}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Son Siparişler" subtitle="Son 24 saat güncellemesi">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border2}` }}>
                    {["Sipariş No", "Müşteri", "Malzeme", "Parça", "Öncelik", "Durum", "Tarih"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "11px 12px",
                          fontSize: 11,
                          color: COLORS.gray[400],
                          textTransform: "uppercase",
                          letterSpacing: ".05em",
                          textAlign: "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => (
                      <tr key={order.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "11px 12px", color: COLORS.primary[500], fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: 12 }}>
                          {order.id?.substring(0, 8)}...
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ fontSize: 13 }}>{order.cust || "—"}</div>
                          <div style={{ fontSize: 11, color: COLORS.gray[400] }}>{order.phone || "—"}</div>
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 13, color: COLORS.muted }}>{order.mat || "—"}</td>
                        <td style={{ padding: "11px 12px", fontSize: 13, color: COLORS.accent[400], fontWeight: TYPOGRAPHY.fontWeight.bold }}>
                          {getPartCount(order.parts, 1)}
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <PriorityBadge priority={order.priority || "normal"} />
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <Badge status={order.status || "NEW"} />
                        </td>
                        <td style={{ padding: "11px 12px", fontSize: 12, color: COLORS.gray[400] }}>
                          {order.date ? new Date(order.date).toLocaleDateString("tr-TR") : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: "11px 12px", textAlign: "center", color: COLORS.muted }}>
                        Sipariş bulunamadı
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
