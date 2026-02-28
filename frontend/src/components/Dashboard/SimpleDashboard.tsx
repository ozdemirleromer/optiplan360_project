import { BarChart3, ClipboardList, RefreshCw, Settings } from "lucide-react";
import { TopBar } from "../Layout/TopBar";
import { Card, Button } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";

type DashboardProps = {
  currentUser: { name: string };
  stations: Array<{
    id: number;
    name: string;
    active: boolean;
    lastScan: string;
    istasyonDurumu: string;
    todayScans: number;
  }>;
  onNav?: (page: string) => void;
  onNewOrder?: () => void;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function SimpleDashboard({ currentUser, stations, onNav, onNewOrder }: DashboardProps) {
  const totalScans = stations.reduce((sum, s) => sum + s.todayScans, 0);

  return (
    <div>
      <TopBar
        title={`${greeting()}, ${currentUser.name.split(" ")[0]}`}
        subtitle="Üretim durumu"
        breadcrumbs={["Ana İşlemler", "Genel Bakış"]}
      >
        <Button variant="primary" size="sm" icon="+" onClick={onNewOrder}>
          Yeni Sipariş
        </Button>
      </TopBar>

      <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", display: "grid", gap: 24 }}>
        {/* Özet Kartları */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          <Card title="Bugün Gelen">
            <div style={{ fontSize: 24, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary[500] }}>
              12
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              Yeni sipariş
            </div>
          </Card>
          
          <Card title="Üretimde">
            <div style={{ fontSize: 24, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.accent[400] }}>
              8
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              Aktif iş
            </div>
          </Card>
          
          <Card title="Tamamlanan">
            <div style={{ fontSize: 24, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.success.DEFAULT }}>
              {totalScans}
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              Bugün toplam
            </div>
          </Card>
        </div>

        {/* İstasyon Durumları */}
        <Card title="İstasyon Durumları">
          <div style={{ display: "grid", gap: 12 }}>
            {stations.map((station) => (
              <div
                key={station.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.md,
                  background: station.active ? "rgba(43,212,167,0.05)" : "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: station.active ? COLORS.success.DEFAULT : COLORS.gray[400],
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.medium }}>
                      {station.name}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {station.istasyonDurumu}
                    </div>
                  </div>
                </div>
                
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: TYPOGRAPHY.fontWeight.bold }}>
                    {station.todayScans}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    işlem
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Hızlı Eylemler */}
        <Card title="Hızlı Eylemler">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <Button variant="secondary" size="sm" icon={<BarChart3 size={14} aria-hidden />} onClick={() => onNav?.("reports-analytics")}>
              Raporlar
            </Button>
            <Button variant="secondary" size="sm" icon={<ClipboardList size={14} aria-hidden />} onClick={() => onNav?.("orders")}>
              Siparişler
            </Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} aria-hidden />} onClick={() => onNav?.("kanban")}>
              Üretim Akışı
            </Button>
            <Button variant="secondary" size="sm" icon={<Settings size={14} aria-hidden />} onClick={() => onNav?.("config")}>
              Ayarlar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
