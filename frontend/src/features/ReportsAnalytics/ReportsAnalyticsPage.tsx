import { useState, lazy, Suspense } from "react";
import { COLORS, TYPOGRAPHY } from "../../components/Shared/constants";

const Reports = lazy(() =>
  import("../../components/Reports").then((m) => ({ default: m.Reports }))
);
const AnalyticsPage = lazy(() =>
  import("../../components/Admin").then((m) => ({ default: m.AnalyticsPage }))
);

const tabs = [
  { id: "reports", label: "Performans Raporları" },
  { id: "analytics", label: "Analitik & Metrikler" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TabLoading = () => (
  <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
    <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
    Yükleniyor...
  </div>
);

export function ReportsAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("reports");

  return (
    <div className="electric-page">
      <div className="app-page-container" style={{ paddingTop: 16, paddingBottom: 0 }}>
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
        {activeTab === "reports" && <Reports />}
        {activeTab === "analytics" && <AnalyticsPage />}
      </Suspense>
    </div>
  );
}

export default ReportsAnalyticsPage;
