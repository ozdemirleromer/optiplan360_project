import { orderOptimizationStyles } from "../UI/orderOptimizationStyles";

export type OrderOptimizationRibbonTab = "dosya" | "cari" | "siparis" | "raporlar";

interface OrderOptimizationRibbonProps {
  activeTab: OrderOptimizationRibbonTab;
  isFullscreen: boolean;
  isMinimized: boolean;
  onTabChange: (tab: OrderOptimizationRibbonTab) => void;
  onFullscreenToggle: () => void;
  onMinimizeToggle: () => void;
  onClose: () => void;
}

const TABS: Array<{ id: OrderOptimizationRibbonTab; label: string }> = [
  { id: "dosya", label: "Dosya" },
  { id: "cari", label: "Cari" },
  { id: "siparis", label: "Sipariş" },
  { id: "raporlar", label: "Raporlar" },
];

export function OrderOptimizationRibbon({
  activeTab,
  isFullscreen,
  isMinimized,
  onTabChange,
  onFullscreenToggle,
  onMinimizeToggle,
  onClose,
}: OrderOptimizationRibbonProps) {
  return (
    <div className={orderOptimizationStyles.ribbonShell}>
      <div className={orderOptimizationStyles.titleBar}>
        {/* Logo Solda - Stratejik Gruplandırma */}
        <div className={orderOptimizationStyles.titleGroup}>
          <div className={orderOptimizationStyles.logo}>KESİM PLANLAMA</div>
        </div>

        {/* Menüler Sağda - "Nefes Alma Alanı" ile */}
        <div className={orderOptimizationStyles.tabList} role="tablist" aria-label="Siparis paneli">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${orderOptimizationStyles.tab} ${active ? orderOptimizationStyles.activeTab : ""}`}
                onClick={() => onTabChange(tab.id)}
              >
                <span>{tab.label}</span>
                {/* Aktif Durum Vurgusu - Neon Mavi Alt Çizgi (Focus State) */}
                {active ? <span className={orderOptimizationStyles.activeTabUnderline} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
