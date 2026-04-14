import React from "react";
import { Card, COLORS, RADIUS } from "../../components/Shared";
import { TrendingUp, Users, Target, ShieldCheck } from "lucide-react";

interface AgentPerformance {
  id: string;
  name: string;
  avatar?: string;
  collectedAmount: number;
  targetAmount: number;
  successRate: number;
  invoicesProcessed: number;
  trend: "up" | "down" | "neutral";
}

const mockAgents: AgentPerformance[] = [
  { id: "A1", name: "Ali Yılmaz", collectedAmount: 1250000, targetAmount: 1500000, successRate: 83.3, invoicesProcessed: 142, trend: "up" },
  { id: "A2", name: "Ayşe Demir", collectedAmount: 2100000, targetAmount: 2000000, successRate: 105.0, invoicesProcessed: 215, trend: "up" },
  { id: "A3", name: "Mehmet Kaya", collectedAmount: 850000, targetAmount: 1000000, successRate: 85.0, invoicesProcessed: 98, trend: "neutral" },
  { id: "A4", name: "Zeynep Çelik", collectedAmount: 420000, targetAmount: 800000, successRate: 52.5, invoicesProcessed: 45, trend: "down" },
];

export default function CollectionPerformancePanel() {
  const { totalCollected, totalTarget } = mockAgents.reduce(
    (acc, a) => ({ totalCollected: acc.totalCollected + a.collectedAmount, totalTarget: acc.totalTarget + a.targetAmount }),
    { totalCollected: 0, totalTarget: 0 },
  );
  const overallRate = ((totalCollected / totalTarget) * 100).toFixed(1);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Üst Bento Box */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
        {/* Toplam Performans Kartı */}
        <div style={{ background: `${COLORS.primary}0d`, border: `1px solid ${COLORS.primary}33`, borderRadius: RADIUS.lg, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: `${COLORS.primary}1a`, borderRadius: RADIUS.md }}>
              <Target size={20} color={COLORS.primary} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: COLORS.text }}>Departman Hedefi (Aylık)</h3>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
            ₺{totalCollected.toLocaleString("tr-TR")} <span style={{ fontSize: 16, color: COLORS.muted }}>/ ₺{totalTarget.toLocaleString("tr-TR")}</span>
          </div>
          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: "50%", overflow: "hidden", marginTop: 16 }}>
            <div style={{ width: `${Math.min(100, (totalCollected / totalTarget) * 100)}%`, height: "100%", background: COLORS.primary }} />
          </div>
        </div>

        {/* Başarı Oranı Kartı */}
        <div style={{ background: `${COLORS.success}0d`, border: `1px solid ${COLORS.success}33`, borderRadius: RADIUS.lg, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: `${COLORS.success}1a`, borderRadius: RADIUS.md }}>
              <ShieldCheck size={20} color={COLORS.success} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: COLORS.text }}>Genel Başarı Oranı</h3>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.success, marginBottom: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
            %{overallRate} 
            <span style={{ fontSize: 14, color: COLORS.muted, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <TrendingUp size={14} color={COLORS.success} /> %4 artış
            </span>
          </div>
        </div>
      </div>

      {/* Personel Tablosu */}
      {mockAgents.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
          Henüz veri bulunmuyor
        </div>
      )}
      <Card title="Personel (Temsilci) Performansı" icon={<Users size={16} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ padding: "12px", color: COLORS.muted }}>Temsilci</th>
                <th style={{ padding: "12px", color: COLORS.muted }}>Tahsil Edilen (₺)</th>
                <th style={{ padding: "12px", color: COLORS.muted }}>Hedef (₺)</th>
                <th style={{ padding: "12px", color: COLORS.muted }}>Başarı Oranı</th>
                <th style={{ padding: "12px", color: COLORS.muted }}>İşlem Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {mockAgents.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${COLORS.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.primary, color: COLORS.bg.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>
                      {a.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    {a.name}
                  </td>
                  <td style={{ padding: "12px", color: COLORS.success, fontWeight: 600 }}>{a.collectedAmount.toLocaleString("tr-TR")}</td>
                  <td style={{ padding: "12px", color: COLORS.muted }}>{a.targetAmount.toLocaleString("tr-TR")}</td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: a.successRate >= 100 ? COLORS.success : a.successRate >= 80 ? COLORS.warning : COLORS.danger, fontWeight: 600 }}>
                        %{a.successRate.toFixed(1)}
                      </span>
                      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: "50%", overflow: "hidden", maxWidth: 100 }}>
                        <div style={{ width: `${Math.min(100, a.successRate)}%`, height: "100%", background: a.successRate >= 100 ? COLORS.success : a.successRate >= 80 ? COLORS.warning : COLORS.danger }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px", color: COLORS.text }}>{a.invoicesProcessed} işlem</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
