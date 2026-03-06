import { Suspense, useState } from "react";

import { COLORS } from "../../components/Shared/constants";
import { TabBar } from "../../components/Shared";
import { AuditRecordsTab, LogsTab } from "./systemLogsFeatureAdapters";

const tabs = [
  { id: "logs", label: "Genel Loglar" },
  { id: "audit", label: "Denetim Kayıtları" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TabLoading = () => (
  <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
    <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
    Yükleniyor...
  </div>
);

export function SystemLogsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("logs");

  return (
    <div className="electric-page">
      <div className="app-page-container" style={{ paddingTop: 16 }}>
        <TabBar
          tabs={tabs as unknown as { id: string; label: string }[]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      <Suspense fallback={<TabLoading />}>
        {activeTab === "logs" && <LogsTab />}
        {activeTab === "audit" && <AuditRecordsTab />}
      </Suspense>
    </div>
  );
}

export default SystemLogsPage;
