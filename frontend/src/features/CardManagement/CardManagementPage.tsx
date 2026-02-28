import { lazy, Suspense, useState } from "react";
import { TopBar } from "../../components/Layout/TopBar";
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../../components/Shared/constants";

const CRMDashboardTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.CRMDashboardTab })),
);
const AccountsTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.AccountsTab })),
);
const OpportunitiesTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.OpportunitiesTab })),
);
const QuotesTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.QuotesTab })),
);
const SyncHealthTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.SyncHealthTab })),
);
const ErrorsTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.ErrorsTab })),
);
const AuditTab = lazy(() =>
  import("../../components/CRM/CRMPage").then((m) => ({ default: m.AuditTab })),
);
const StockCardComponent = lazy(() =>
  import("../../components/Stock/StockCardComponent").then((m) => ({ default: m.StockCardComponent })),
);
const PaymentDashboard = lazy(() => import("../../components/Payment/PaymentDashboard"));

const tabs = [
  { id: "dashboard", label: "Ozet Panel" },
  { id: "accounts", label: "Cari Kartlar" },
  { id: "stock", label: "Stok Kartlar" },
  { id: "tahsilatlar", label: "Tahsilatlar" },
  { id: "opportunities", label: "Firsat Pipeline" },
  { id: "quotes", label: "Teklifler" },
  { id: "sync", label: "Senkron Saglik" },
  { id: "errors", label: "Hatalar" },
  { id: "audit", label: "Islem Gecmisi" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TabLoading = () => (
  <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
    <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
    Yukleniyor...
  </div>
);

export function CardManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <div className="electric-page">
      <TopBar
        title="Musteri Yonetimi"
        subtitle="Cari kartlar, stok yonetimi ve musteri iliskileri"
      />

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
          {tabs.map((tab) => (
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

      <div className="app-page-container" style={{ paddingTop: 16 }}>
        <Suspense fallback={<TabLoading />}>
          {activeTab === "dashboard" && <CRMDashboardTab />}
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "stock" && <StockCardComponent />}
          {activeTab === "tahsilatlar" && <PaymentDashboard embedded />}
          {activeTab === "opportunities" && <OpportunitiesTab />}
          {activeTab === "quotes" && <QuotesTab />}
          {activeTab === "sync" && <SyncHealthTab />}
          {activeTab === "errors" && <ErrorsTab />}
          {activeTab === "audit" && <AuditTab />}
        </Suspense>
      </div>
    </div>
  );
}

export default CardManagementPage;
