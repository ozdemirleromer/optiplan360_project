/**
 * TabBar — Sistem genelinde tekdüzen altı çizgili (underline) sekme çubuğu.
 * Tüm sayfa sekmeleri bu bileşeni kullanmalıdır.
 */
import type { ReactNode, CSSProperties } from "react";
import { COLORS, TYPOGRAPHY } from "./constants";

export interface TabItem {
     id: string;
     label: string;
     icon?: ReactNode;
}

interface TabBarProps {
     tabs: TabItem[];
     activeTab: string;
     onTabChange: (id: string) => void;
     /** İsteğe bağlı: dış kapsayıcı div için ekstra stil */
     style?: CSSProperties;
}

export function TabBar({ tabs, activeTab, onTabChange, style }: TabBarProps) {
     return (
          <div
               style={{
                    display: "flex",
                    gap: "2px",
                    borderBottom: `1px solid ${COLORS.border}`,
                    flexWrap: "wrap",
                    marginBottom: "24px",
                    ...style,
               }}
          >
               {tabs.map((tab) => (
                    <button
                         key={tab.id}
                         type="button"
                         onClick={() => onTabChange(tab.id)}
                         style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "12px 24px",
                              fontSize: 14,
                              fontWeight: activeTab === tab.id ? 700 : 400,
                              color: activeTab === tab.id ? COLORS.primary.DEFAULT : COLORS.muted,
                              background: activeTab === tab.id
                                   ? `${COLORS.primary.DEFAULT}08`
                                   : "transparent",
                              border: "none",
                              borderBottom: activeTab === tab.id
                                   ? `3px solid ${COLORS.primary.DEFAULT}`
                                   : "3px solid transparent",
                              cursor: "pointer",
                              fontFamily: TYPOGRAPHY.fontFamily.base,
                              marginBottom: "-1px",
                              transition: "all 0.2s",
                              whiteSpace: "nowrap",
                         }}
                    >
                         {tab.icon}
                         {tab.label}
                    </button>
               ))}
          </div>
     );
}

export default TabBar;
