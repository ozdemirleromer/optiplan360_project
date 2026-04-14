import React, { useState } from "react";
import { TopBar } from "../../components/Layout/TopBar";
import { Card, KPICard, COLORS, TYPOGRAPHY } from "../../components/Shared";
import { Activity, AlertTriangle, Zap } from "lucide-react";

interface MachineStats {
  id: string;
  name: string;
  status: "running" | "idle" | "error" | "offline";
  uptimeHours: number;
  downtimeHours: number;
  efficiency: number;
  lastMaintenance: string;
  currentTask?: string;
}

const mockMachines: MachineStats[] = [
  { id: "M01", name: "Lazer Kesim #1", status: "running", uptimeHours: 112, downtimeHours: 4, efficiency: 96.5, lastMaintenance: "12.10.2023", currentTask: "SIP-2023-001 Panel Kesimi" },
  { id: "M02", name: "Lazer Kesim #2", status: "idle", uptimeHours: 86, downtimeHours: 12, efficiency: 87.7, lastMaintenance: "05.11.2023" },
  { id: "M03", name: "CNC Freze", status: "error", uptimeHours: 42, downtimeHours: 24, efficiency: 63.6, lastMaintenance: "01.12.2023", currentTask: "Kalibrasyon Hatası" },
  { id: "M04", name: "Büküm Presi", status: "running", uptimeHours: 145, downtimeHours: 2, efficiency: 98.6, lastMaintenance: "15.11.2023", currentTask: "Büküm İşlemi (Profil)" },
];

export function MachinePerformanceReport() {
  const [machines] = useState<MachineStats[]>(mockMachines);

  const activeCount = machines.filter(m => m.status === "running").length;
  const errorCount = machines.filter(m => m.status === "error").length;
  const avgEfficiency = (machines.reduce((acc, m) => acc + m.efficiency, 0) / machines.length).toFixed(1);

  return (
    <div className="electric-page" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="İstasyon ve Cihaz Çalışma/Rapor Ekranları" breadcrumbs={["Ana İşlemler", "İstasyon Analitiği"]} />
      <div className="app-page-container" style={{ flex: 1, overflowY: "auto", display: "grid", gap: 24, padding: 24 }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <KPICard label="Ortalama Verimlilik" value={`%${avgEfficiency}`} color={COLORS.success} icon={<Zap size={16} />} />
          <KPICard label="Aktif İstasyon" value={`${activeCount} / ${machines.length}`} color={COLORS.primary} icon={<Activity size={16} />} />
          <KPICard label="Arıza Durumu" value={errorCount.toString()} color={errorCount > 0 ? COLORS.danger : COLORS.success} icon={<AlertTriangle size={16} />} />
        </div>

        <Card title="Makine Detayları" icon={<Activity size={16} />}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: "12px", color: COLORS.muted }}>Makine ID</th>
                  <th style={{ padding: "12px", color: COLORS.muted }}>İstasyon Adı</th>
                  <th style={{ padding: "12px", color: COLORS.muted }}>Durum</th>
                  <th style={{ padding: "12px", color: COLORS.muted }}>Çalışma (Saat)</th>
                  <th style={{ padding: "12px", color: COLORS.muted }}>OEE (%)</th>
                  <th style={{ padding: "12px", color: COLORS.muted }}>Mevcut İşlem</th>
                </tr>
              </thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px", fontFamily: TYPOGRAPHY.fontFamily.mono }}>{m.id}</td>
                    <td style={{ padding: "12px", fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ 
                        padding: "4px 8px", borderRadius: "50%", fontSize: 11, fontWeight: 600,
                        background: m.status === 'running' ? 'rgba(16, 185, 129, 0.1)' : m.status === 'idle' ? 'rgba(245, 158, 11, 0.1)' : m.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                        color: m.status === 'running' ? COLORS.success : m.status === 'idle' ? COLORS.warning : m.status === 'error' ? COLORS.danger : COLORS.muted
                      }}>
                        {m.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                        <span style={{ color: COLORS.success }}>{m.uptimeHours}s</span> / <span style={{ color: COLORS.danger }}>{m.downtimeHours}s</span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>% {m.efficiency}</span>
                        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: "50%", overflow: "hidden" }}>
                          <div style={{ width: `${m.efficiency}%`, height: "100%", background: m.efficiency > 90 ? COLORS.success : m.efficiency > 75 ? COLORS.warning : COLORS.danger }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px", color: m.status === 'error' ? COLORS.danger : COLORS.text }}>{m.currentTask || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
