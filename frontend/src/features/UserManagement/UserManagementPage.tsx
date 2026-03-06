import { Suspense, useState } from "react";

import { COLORS } from "../../components/Shared/constants";
import { TabBar } from "../../components/Shared";
import { RolesPermissionsTab, UsersTab } from "./userManagementFeatureAdapters";

const tabs = [
  { id: "users", label: "Kullanıcılar" },
  { id: "roles", label: "Roller ve Yetkiler" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TabLoading = () => (
  <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
    <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
    Yükleniyor...
  </div>
);

export function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>("users");

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
        {activeTab === "users" && <UsersTab />}
        {activeTab === "roles" && <RolesPermissionsTab />}
      </Suspense>
    </div>
  );
}

export default UserManagementPage;
