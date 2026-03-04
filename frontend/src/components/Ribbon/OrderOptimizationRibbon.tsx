import { Minus, Square, X } from "lucide-react";
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
        <div className={orderOptimizationStyles.titleGroup}>
          <div className={orderOptimizationStyles.logo}>OP</div>
          <div className={orderOptimizationStyles.titleTextWrap}>
            <span className={orderOptimizationStyles.title}>OptiPlan 360</span>
            <span className={orderOptimizationStyles.titleMeta}>Sipariş ve Optimizasyon Yönetim Paneli</span>
          </div>
        </div>

        <div className={orderOptimizationStyles.windowControls}>
          <button
            type="button"
            className={orderOptimizationStyles.windowButton}
            aria-label={isMinimized ? "Paneli geri yukle" : "Simge durumuna al"}
            onClick={onMinimizeToggle}
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            className={orderOptimizationStyles.windowButton}
            aria-label={isFullscreen ? "Tam ekrandan cik" : "Tam ekran yap"}
            onClick={onFullscreenToggle}
          >
            <Square className="h-3 w-3" />
          </button>
          <button type="button" className={orderOptimizationStyles.windowButton} aria-label="Paneli kapat" onClick={onClose}>
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className={orderOptimizationStyles.tabBar}>
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
                {active ? <span className={orderOptimizationStyles.activeTabUnderline} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
