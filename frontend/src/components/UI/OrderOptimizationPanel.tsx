import { useCallback, useEffect, useRef, useState } from "react";
import { OrderOptimizationGrid } from "../Grid/OrderOptimizationGrid";
import { OrderOptimizationRibbon, type OrderOptimizationRibbonTab } from "../Ribbon/OrderOptimizationRibbon";
import type { MeasureRow } from "../Orders/OrderEditor/shared";
import { ORDER_OPTIMIZATION_THEME, orderOptimizationStyles, type OrderOptimizationThemeMode } from "./orderOptimizationStyles";
import { OrderOptimizationMetaStrip } from "./OrderOptimizationMetaStrip";

interface OrderOptimizationPanelProps {
  themeMode: OrderOptimizationThemeMode;
  activeTab: OrderOptimizationRibbonTab;
  customerValue: string;
  orderNo: string;
  dueDate: string;
  plateBoy: string;
  plateEn: string;
  customerSuggestions: string[];
  items: MeasureRow[];
  notice?: { text: string; tone: "default" | "danger" | "accent" } | null;
  onTabChange: (tab: OrderOptimizationRibbonTab) => void;
  onClose: () => void;
  onCustomerChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPlateBoyChange: (value: string) => void;
  onPlateEnChange: (value: string) => void;
  onPlateBoyBlur: () => void;
  onPlateEnBlur: () => void;
  onItemChange: (id: number, field: keyof MeasureRow, value: string | number | boolean) => void;
  onAddItem: () => void;
}

export function OrderOptimizationPanel({
  themeMode,
  activeTab,
  customerValue,
  orderNo,
  dueDate,
  plateBoy,
  plateEn,
  customerSuggestions,
  items,
  notice,
  onTabChange,
  onClose,
  onCustomerChange,
  onDueDateChange,
  onPlateBoyChange,
  onPlateEnChange,
  onPlateBoyBlur,
  onPlateEnBlur,
  onItemChange,
  onAddItem,
}: OrderOptimizationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const firstGridCellRef = useRef<HTMLInputElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (activeTab === "cari") {
      customerInputRef.current?.focus();
    }

    if (activeTab === "siparis") {
      firstGridCellRef.current?.focus();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleMinimizeToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const handleFullscreenToggle = useCallback(async () => {
    if (!panelRef.current) {
      return;
    }

    if (document.fullscreenElement === panelRef.current) {
      await document.exitFullscreen();
      return;
    }

    await panelRef.current.requestFullscreen();
  }, []);

  return (
    <div
      ref={panelRef}
      className={orderOptimizationStyles.panel}
      style={{
        ...ORDER_OPTIMIZATION_THEME[themeMode],
        fontFamily: '"Inter", sans-serif',
      }}
    >
      <OrderOptimizationRibbon
        activeTab={activeTab}
        isFullscreen={isFullscreen}
        isMinimized={isMinimized}
        onTabChange={onTabChange}
        onFullscreenToggle={() => void handleFullscreenToggle()}
        onMinimizeToggle={handleMinimizeToggle}
        onClose={onClose}
      />
      {isMinimized ? (
        <div className={orderOptimizationStyles.minimizedBanner}>Panel simge durumuna alindi</div>
      ) : (
        <>
          <OrderOptimizationMetaStrip
            customerValue={customerValue}
            orderNo={orderNo}
            dueDate={dueDate}
            plateBoy={plateBoy}
            plateEn={plateEn}
            customerSuggestions={customerSuggestions}
            customerInputRef={customerInputRef}
            onCustomerChange={onCustomerChange}
            onDueDateChange={onDueDateChange}
            onPlateBoyChange={onPlateBoyChange}
            onPlateEnChange={onPlateEnChange}
            onPlateBoyBlur={onPlateBoyBlur}
            onPlateEnBlur={onPlateEnBlur}
          />
          <OrderOptimizationGrid
            items={items}
            plateBoy={plateBoy}
            notice={notice}
            firstCellRef={firstGridCellRef}
            onItemChange={onItemChange}
            onAddItem={onAddItem}
          />
        </>
      )}
    </div>
  );
}
