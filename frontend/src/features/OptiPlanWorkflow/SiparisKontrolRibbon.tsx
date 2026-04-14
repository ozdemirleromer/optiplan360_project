import React, { useMemo } from "react";
import {
  Save,
  RefreshCw,
  FileText,
  Clock,
  Users,
  Link,
  UserPlus,
  Package,
  GitMerge,
  RotateCcw,
  PanelRightOpen,
  Plus,
  CheckCircle2,
  Flame,
  ChevronRight,
  Eye,
  Download,
  Activity,
  Loader2,
  type LucideIcon,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RibbonTab = "KAYIT" | "CARI" | "SATIR" | "KONTROL" | "IS_EMRI";

export const RIBBON_TAB_LABELS: Record<RibbonTab, string> = {
  KAYIT: "KAYIT",
  CARI: "CARİ",
  SATIR: "SATIR",
  KONTROL: "KONTROL",
  IS_EMRI: "İŞ EMRİ",
};

interface RibbonAction {
  key: string;
  icon: LucideIcon;
  label: string;
  title: string;
  danger?: boolean;
  primary?: boolean;
  /** When true, shows a Loader2 spinner instead of icon */
  loading?: boolean;
}

export interface SiparisKontrolRibbonProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  onAction: (actionKey: string) => void;
  disabledActions?: Set<string>;
  saving?: boolean;
  selectedCount?: number;
}

// ─── Tab → Action definitions ───────────────────────────────────────────────

function getActionsForTab(tab: RibbonTab, saving: boolean, selectedCount: number): RibbonAction[] {
  switch (tab) {
    case "KAYIT":
      return [
        { key: "save", icon: Save, label: saving ? "Kaydediliyor..." : "Kaydet", title: "Değişiklikleri taslak olarak kaydet", primary: true, loading: saving },
        { key: "refresh", icon: RefreshCw, label: "Yenile", title: "Backend'den en güncel veriyi çek" },
        { key: "revision", icon: FileText, label: "Revizyon", title: "Revizyon geçmişi aç" },
        { key: "history", icon: Clock, label: "Tarihçe", title: "Kayıt tarihçesini görüntüle" },
      ];
    case "CARI":
      return [
        { key: "cariSearch", icon: Users, label: "Cari Ara", title: "Mikro ERP'den cari eşleştir" },
        { key: "cariMatch", icon: Link, label: "Eşleştir", title: "Seçili cariyi bağla" },
        { key: "cariNew", icon: UserPlus, label: "Yeni Cari", title: "Yeni cari kartı oluştur" },
      ];
    case "SATIR":
      return [
        { key: "stokSearch", icon: Package, label: "Stok Ara", title: selectedCount > 1 ? `${selectedCount} seçiliye stok ata` : "Seçili satır için stok eşleştir" },
        { key: "merge", icon: GitMerge, label: "Birleştir", title: selectedCount < 2 ? "En az 2 satır seçin" : "Seçili satırları birleştir" },
        { key: "reset", icon: RotateCcw, label: "Sıfırla", title: "Seçili satırların merge/fire/açıklama alanlarını temizle" },
        { key: "detail", icon: PanelRightOpen, label: "Detay", title: "Satır detayını göster" },
        { key: "addRow", icon: Plus, label: "Satır Ekle", title: "Yeni satır ekle" },
      ];
    case "KONTROL":
      return [
        { key: "validate", icon: CheckCircle2, label: "Doğrula", title: "Tüm satırları doğrula" },
        { key: "fire", icon: Flame, label: "Fire", title: "Kayıt geneli fire açıklamasını düzenle", danger: true },
        { key: "goPhase4", icon: ChevronRight, label: "Faz Geçişi", title: "Phase 4'e geçiş yap (blocker kontrolü yapılır)" },
      ];
    case "IS_EMRI":
      return [
        { key: "preview", icon: Eye, label: "Önizleme", title: "Export önizleme oluştur" },
        { key: "export", icon: Download, label: "Export", title: "Dosyaları export et" },
        { key: "retry", icon: RotateCcw, label: "Tekrar Dene", title: "Başarısız exportu tekrar dene" },
        { key: "manifest", icon: FileText, label: "Manifest", title: "Export manifestini görüntüle" },
        { key: "jobStatus", icon: Activity, label: "Durum", title: "İş emri durum takibi" },
      ];
    default:
      return [];
  }
}

// ─── Style constants (matching SiparisKontrolPage dark slate theme) ─────────

const SL_800 = "#1e293b";
const SL_700 = "#334155";
const SL_400 = "#94a3b8";
const SL_200 = "#e2e8f0";
const COLOR_PRIMARY = "#2563eb";
const COLOR_DANGER = "#dc2626";

const TAB_HEIGHT = 34;
const ICON_STRIP_HEIGHT = 74;

// ─── Static Style Constants ──────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  borderBottom: `1px solid ${SL_700}`,
  background: SL_800,
  flexShrink: 0,
};

const tabStripStyle: React.CSSProperties = {
  display: "flex",
  height: TAB_HEIGHT,
  borderBottom: `1px solid ${SL_700}`,
  background: SL_800,
};

const iconStripStyle: React.CSSProperties = {
  display: "flex",
  height: ICON_STRIP_HEIGHT,
  alignItems: "center",
  padding: "8px 10px",
  gap: 0,
  background: SL_800,
  overflowX: "auto",
};

const actionItemContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: "0 12px",
  minWidth: "fit-content",
};

const actionLabelStyle: React.CSSProperties = {
  fontFamily: "'Segoe UI', sans-serif",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  textAlign: "center",
  whiteSpace: "nowrap",
  letterSpacing: "0.5px",
  userSelect: "none",
};

// ─── Style Builder Functions ────────────────────────────────────────────────

/** Build tab button style based on active state */
function getTabButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: "0 1 auto",
    padding: "0 18px",
    border: "none",
    borderBottom: isActive ? `2px solid ${COLOR_PRIMARY}` : "2px solid transparent",
    background: isActive ? COLOR_PRIMARY : "transparent",
    color: isActive ? "#fff" : SL_400,
    fontFamily: "'Segoe UI', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "all 0.15s",
  };
}

/** Build action item border style based on position */
function getActionItemBorderStyle(idx: number, actionsLength: number): React.CSSProperties {
  return {
    ...actionItemContainerStyle,
    borderRight: idx < actionsLength - 1 ? `1px solid ${SL_700}` : "none",
  };
}

function getActionItemStyle(
  isDisabled: boolean,
  idx: number,
  actionsLength: number
): React.CSSProperties {
  return {
    ...getActionItemBorderStyle(idx, actionsLength),
    opacity: isDisabled ? 0.4 : 1,
  };
}

/** Build action button style based on disabled/danger/primary state */
function getActionButtonStyle(
  isDisabled: boolean,
  isDanger: boolean,
  isPrimary: boolean
): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    padding: 0,
    border: "none",
    background: isPrimary ? COLOR_PRIMARY : "transparent",
    color: isDanger ? COLOR_DANGER : isPrimary ? "#fff" : SL_200,
    cursor: isDisabled ? "not-allowed" : "pointer",
    borderRadius: 6,
    transition: "all 0.15s",
  };
}

/** Build label span style based on disabled state */
function getActionLabelSpanStyle(isDisabled: boolean): React.CSSProperties {
  return {
    ...actionLabelStyle,
    color: isDisabled ? SL_700 : SL_400,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SiparisKontrolRibbon: React.FC<SiparisKontrolRibbonProps> = ({
  activeTab,
  onTabChange,
  onAction,
  disabledActions = new Set(),
  saving = false,
  selectedCount = 0,
}) => {
  const tabs: RibbonTab[] = ["KAYIT", "CARI", "SATIR", "KONTROL", "IS_EMRI"];
  const actions = getActionsForTab(activeTab, saving, selectedCount);

  return (
    <div style={containerStyle}>
      {/* Tab strip — 28px */}
      <div
        role="tablist"
        aria-label="Siparis kontrol sekmeleri"
        style={tabStripStyle}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`ribbon-panel-${tab}`}
              onClick={() => onTabChange(tab)}
              style={getTabButtonStyle(isActive)}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget.style.background = `${COLOR_PRIMARY}20`);
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget.style.background = "transparent");
              }}
            >
              {RIBBON_TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* Icon strip — 56px */}
      <div
        id={`ribbon-panel-${activeTab}`}
        role="tabpanel"
        aria-label={`${RIBBON_TAB_LABELS[activeTab]} aksiyonlari`}
        style={iconStripStyle}
      >
        {actions.map((action, idx) => {
          const IconComp = action.loading ? Loader2 : action.icon;
          const isDisabled = disabledActions.has(action.key) || action.loading;
          const isDanger = action.danger;
          const isPrimary = action.primary && !action.loading;

          return (
            <React.Fragment key={action.key}>
              <div style={getActionItemStyle(isDisabled, idx, actions.length)}>
                <button
                  type="button"
                  aria-label={action.label}
                  title={action.title}
                  disabled={isDisabled}
                  onClick={() => onAction(action.key)}
                  style={getActionButtonStyle(isDisabled, isDanger, isPrimary)}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isPrimary) {
                      e.currentTarget.style.background = `${COLOR_PRIMARY}20`;
                      e.currentTarget.style.color = isDanger ? COLOR_DANGER : COLOR_PRIMARY;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled && !isPrimary) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = isDanger ? COLOR_DANGER : SL_200;
                    }
                  }}
                >
                  <IconComp
                    size={22}
                    className={action.loading ? "animate-spin" : undefined}
                  />
                </button>
                <span style={getActionLabelSpanStyle(isDisabled)}>
                  {action.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
