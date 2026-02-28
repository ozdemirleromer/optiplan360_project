import { useState, lazy, Suspense } from "react";
import { COLORS, TYPOGRAPHY } from "../../components/Shared/constants";

const AIOpsDashboard = lazy(() =>
  import("./AIOpsDashboard").then((m) => ({ default: m.AIOpsDashboard }))
);
const AIOrchestratorDashboard = lazy(() =>
  import("./AIOrchestratorDashboard").then((m) => ({ default: m.AIOrchestratorDashboard }))
);

const tabs = [
  { id: "ops", label: "Orkestrasyon Paneli" },
  { id: "orchestrator", label: "AI Komuta Merkezi" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TabLoading = () => (
  <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
    <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
    Yükleniyor...
  </div>
);

export function AICenterPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ops");

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
      <div style={{ padding: "16px 20px 0" }}>
        <div
          style={{
            display: "flex",
            gap: "2px",
            borderBottom: `1px solid ${COLORS.border}`,
            flexWrap: "wrap",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 24px",
                background: activeTab === tab.id ? `${COLORS.primary.DEFAULT}08` : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? `3px solid ${COLORS.primary.DEFAULT}` : "3px solid transparent",
                color: activeTab === tab.id ? COLORS.primary.DEFAULT : COLORS.muted,
                fontWeight: activeTab === tab.id ? 700 : 400,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Suspense fallback={<TabLoading />}>
        {activeTab === "ops" && <AIOpsDashboard />}
        {activeTab === "orchestrator" && <AIOrchestratorDashboard />}
      </Suspense>
    </div>
  );
}

export default AICenterPage;
