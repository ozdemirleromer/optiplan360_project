import { useState, useEffect } from "react";
import { Button, Card, KPICard } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../Shared/constants";
import { TopBar } from "../Layout";
import { adminService, type SystemStats } from "../../services/adminService";
import { ordersService } from "../../services/ordersService";
import type { Order } from "../../types";
import { getPartCount } from "../../utils/orderParts";

export function Reports() {
  const [dateRange, setDateRange] = useState("7d");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, ordersData] = await Promise.all([
          adminService.getStats(),
          ordersService.list(),
        ]);
        setStats(statsData);
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching reports data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  // Hesaplamalar
  const totalOrders = stats?.totalOrders ?? 0;
  const totalParts = orders.reduce((sum, o) => sum + getPartCount(o.parts, 0), 0);
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
  const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : "0.0";

  // Operatör performansı - veri modelinde operator bilgisi yoksa "Sistem" olarak grupla
  const operatorStats: { name: string; orders: number; color: string }[] = (() => {
    const grouped: Record<string, number> = {};
    orders.forEach((_o) => {
      const opName = "Sistem";
      grouped[opName] = (grouped[opName] ?? 0) + 1;
    });

    return Object.entries(grouped)
      .map(([name, count]) => ({
        name,
        orders: count,
        color: [COLORS.info.DEFAULT, COLORS.accent[400], COLORS.success.DEFAULT, COLORS.primary[500]][Object.keys(grouped).indexOf(name) % 4],
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3);
  })();

  const maxOperatorOrders = Math.max(...operatorStats.map((o) => o.orders), 1);

  return (
    <div>
      <TopBar title="Raporlar" subtitle="Üretim ve performans raporları" breadcrumbs={["Ana İşlemler", "Raporlar"]}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.04)", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: 3 }}>
          {[{ k: "1d", l: "Bugün" }, { k: "7d", l: "7 Gün" }, { k: "30d", l: "30 Gün" }, { k: "90d", l: "90 Gün" }].map((d) => (
            <button
              key={d.k}
              onClick={() => setDateRange(d.k)}
              style={{
                padding: "6px 12px",
                borderRadius: RADIUS.md,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                background: dateRange === d.k ? primaryRgba(0.15) : "transparent",
                color: dateRange === d.k ? COLORS.primary[500] : COLORS.muted,
                fontWeight: dateRange === d.k ? TYPOGRAPHY.fontWeight.semibold : TYPOGRAPHY.fontWeight.normal,
              }}
            >
              {d.l}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon="DL" onClick={() => {
          const exportData = {
            generatedAt: new Date().toISOString(),
            dateRange,
            totalOrders,
            totalParts,
            cancellationRate,
            orders: orders.map((o) => ({ id: o.id, cust: o.cust, mat: o.mat, status: o.status, parts: getPartCount(o.parts, 0), date: o.date })),
          };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `rapor_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}>
          Dışa Aktar
        </Button>
      </TopBar>

      <div style={{ padding: 24, maxWidth: 1320, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <KPICard icon="SP" label="Toplam Sipariş" value={totalOrders} color={COLORS.primary[500]} sparkData={stats?.weeklyValues ?? []} />
          <KPICard icon="SR" label="Ortalama Süre" value={orders.length > 0 ? `${(orders.length / 7).toFixed(1)}/gün` : "—"} color={COLORS.accent[400]} />
          <KPICard icon="PR" label="Toplam Parça" value={totalParts} color={COLORS.info.DEFAULT} sparkData={stats?.weeklyValues ?? []} />
          <KPICard icon="IP" label="İptal Oranı" value={`%${cancellationRate}`} color={COLORS.error.DEFAULT} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 16 }}>
          <Card title="Operatör Performansı">
            <div>
              {operatorStats.length > 0 ? (
                operatorStats.map((op, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < operatorStats.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${op.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.bold, color: op.color }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: COLORS.text }}>{op.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{op.orders} sipariş</div>
                    </div>
                    <div style={{ width: 100, height: 5, borderRadius: 3, background: "rgba(255,255,255,.06)" }}>
                      <div style={{ width: `${(op.orders / maxOperatorOrders) * 100}%`, height: "100%", borderRadius: 3, background: op.color }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: COLORS.muted, fontSize: 12 }}>Veri yok</div>
              )}
            </div>
          </Card>

          <Card title="Malzeme Dağılımı">
            {stats && stats.materialLabels && stats.materialLabels.length > 0 ? (
              (() => {
                const total = (stats.materialValues ?? []).reduce((a, b) => a + b, 0);
                return stats.materialLabels.map((label, i) => {
                  const pct = total > 0 ? (((stats.materialValues?.[i] ?? 0) / total) * 100).toFixed(0) : "0";
                  const colors = [COLORS.accent[400], COLORS.primary[500], COLORS.info.DEFAULT, COLORS.success.DEFAULT, COLORS.gray[400]];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < stats.materialLabels.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: TYPOGRAPHY.fontWeight.bold, color: colors[i % colors.length] }}>{pct}%</span>
                    </div>
                  );
                });
              })()
            ) : (
              <div style={{ color: COLORS.muted, fontSize: 12 }}>Veri yok</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
