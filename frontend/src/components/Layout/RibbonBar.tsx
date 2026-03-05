import React, { useState } from "react";
import { FileText, Users, ShoppingCart, Zap, Settings, Plus, Trash2, Download, Upload } from "lucide-react";
import "./ribbon.css";

export type RibbonTab = "DOSYA" | "CARİ" | "SİPARİŞ" | "OPTİMİZASYON" | "AYARLAR";

interface RibbonBarProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  onAction?: (action: string) => void;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({ activeTab, onTabChange, onAction }) => {
  const tabs: RibbonTab[] = ["DOSYA", "CARİ", "SİPARİŞ", "OPTİMİZASYON", "AYARLAR"];

  const tabIcons = {
    DOSYA: FileText,
    CARİ: Users,
    SİPARİŞ: ShoppingCart,
    OPTİMİZASYON: Zap,
    AYARLAR: Settings,
  };

  // Icon groups per tab
  const getIconsForTab = (tab: RibbonTab) => {
    switch (tab) {
      case "DOSYA":
        return [
          { icon: Plus, label: "YENİ" },
          { icon: Upload, label: "AÇIKIŞ" },
          { icon: Download, label: "KAYDET" },
        ];
      case "CARİ":
        return [
          { icon: Plus, label: "EKLE" },
          { icon: Trash2, label: "SİL" },
        ];
      case "SİPARİŞ":
        return [
          { icon: Plus, label: "EKLE" },
          { icon: Trash2, label: "SİL" },
        ];
      case "OPTİMİZASYON":
        return [
          { icon: Zap, label: "ÇALIŞTIR" },
          { icon: Download, label: "SONUÇ" },
        ];
      case "AYARLAR":
        return [
          { icon: Settings, label: "AYARLA" },
        ];
      default:
        return [];
    }
  };

  const iconsForTab = getIconsForTab(activeTab);

  return (
    <div className="ribbon-container">
      {/* Tab Bar (Top stripe, 28px) */}
      <div className="ribbon-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Icon Strip (Bottom stripe, 60px) */}
      <div className="ribbon-icons">
        {iconsForTab.map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div key={idx} className="ribbon-icon-group">
              <button
                className="ribbon-icon-btn"
                onClick={() => onAction?.(item.label)}
                title={item.label}
              >
                <IconComponent size={24} />
              </button>
              <div className="ribbon-icon-label">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
