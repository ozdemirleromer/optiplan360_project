import { Suspense, useState } from "react";

import { TopBar } from "../../components/Layout/TopBar";
import { COLORS, TYPOGRAPHY } from "../../components/Shared/constants";
import {
  AccountsTab,
  AuditTab,
  CariCardsIntroScreen,
  CRMDashboardTab,
  ErrorsTab,
  OpportunitiesTab,
  PaymentDashboard,
  QuotesTab,
  StockCardComponent,
  StockCardsIntroScreen,
  SyncHealthTab,
} from "./cardManagementFeatureAdapters";

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
  const [showAccountsIntro, setShowAccountsIntro] = useState(true);
  const [showStockIntro, setShowStockIntro] = useState(true);
  const [openAccountCreateOnMount, setOpenAccountCreateOnMount] = useState(false);
  const [openStockCreateOnMount, setOpenStockCreateOnMount] = useState(false);

  const handleAccountStart = () => {
    setShowAccountsIntro(false);
    setOpenAccountCreateOnMount(true);
  };

  const handleStockStart = () => {
    setShowStockIntro(false);
    setOpenStockCreateOnMount(true);
  };

  return (
    <div className="electric-page">
      <TopBar title="Musteri Yonetimi" subtitle="Cari kartlar, stok yonetimi ve musteri iliskileri" />

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
                color: activeTab === tab.id ? COLORS.primary : COLORS.muted,
                background: activeTab === tab.id ? `${COLORS.primary}08` : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? `3px solid ${COLORS.primary}` : "3px solid transparent",
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
          {activeTab === "accounts" &&
            (showAccountsIntro ? (
              <CariCardsIntroScreen onStart={handleAccountStart} />
            ) : (
              <AccountsTab
                openCreateOnMount={openAccountCreateOnMount}
                onCreateOpenHandled={() => setOpenAccountCreateOnMount(false)}
              />
            ))}
          {activeTab === "stock" &&
            (showStockIntro ? (
              <StockCardsIntroScreen onStart={handleStockStart} />
            ) : (
              <StockCardComponent
                openCreateOnMount={openStockCreateOnMount}
                onCreateOpenHandled={() => setOpenStockCreateOnMount(false)}
              />
            ))}
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
