import { useMemo, useState, useRef, useEffect, useCallback, type ReactElement } from "react";
import type { User } from "../../types";
import {
  Activity,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  Cpu,
  Factory,
  FileText,
  Filter,
  Globe,
  HeadphonesIcon,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plug,
  Search,
  Settings,
  Star,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import "./sidebar.css";

const BRAND = {
  name: "Optiplan",
  version: "360",
  tagline: "AI Fabrika Kontrol Merkezi",
};

// --- localStorage keys ---
const LS_COLLAPSED_GROUPS = "optiplan-sidebar-collapsed-groups";
const LS_FAVORITES = "optiplan-sidebar-favorites";

function loadJsonArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch { /* ignore */ }
  return fallback;
}

// --- Types ---
interface BadgeCounts {
  orders?: number;
  kanban?: number;
  payment?: number;
  orchestrator?: number;
  systemLogs?: number;
}

interface SidebarProps {
  page: string;
  onNav: (page: string) => void;
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggle: () => void;
  userRole?: "ADMIN" | "OPERATOR" | "STATION";
  currentUser?: User | null;
  onLogout?: () => void;
  badgeCounts?: BadgeCounts;
}

interface MenuItem {
  id: string;
  icon: ReactElement;
  label: string;
  badge?: number;
}

interface MenuGroup {
  id: string;
  title: string;
  items: MenuItem[];
}

type PermissionState = {
  operations: {
    orders: boolean;
    kanban: boolean;
    reports: boolean;
    crm: boolean;
    payment: boolean;
    priceTracking: boolean;
    aiAssistant: boolean;
    orchestrator: boolean;
  };
  system: {
    settings: boolean;
    integrations: boolean;
    organization: boolean;
    stations: boolean;
  };
  users: {
    manage: boolean;
    roles: boolean;
    activity: boolean;
  };
  monitoring: {
    logs: boolean;
    audit: boolean;
    analytics: boolean;
  };
};

const ROLE_PERMISSIONS: Record<"ADMIN" | "OPERATOR" | "STATION", PermissionState> = {
  ADMIN: {
    operations: { orders: true, kanban: true, reports: true, crm: true, payment: true, priceTracking: true, aiAssistant: true, orchestrator: true },
    system: { settings: true, integrations: true, organization: true, stations: true },
    users: { manage: true, roles: true, activity: true },
    monitoring: { logs: true, audit: true, analytics: true },
  },
  OPERATOR: {
    operations: { orders: true, kanban: true, reports: true, crm: true, payment: true, priceTracking: true, aiAssistant: true, orchestrator: true },
    system: { settings: false, integrations: false, organization: false, stations: false },
    users: { manage: false, roles: false, activity: true },
    monitoring: { logs: true, audit: false, analytics: false },
  },
  STATION: {
    operations: { orders: false, kanban: true, reports: false, crm: false, payment: false, priceTracking: false, aiAssistant: false, orchestrator: false },
    system: { settings: false, integrations: false, organization: false, stations: true },
    users: { manage: false, roles: false, activity: false },
    monitoring: { logs: false, audit: false, analytics: false },
  },
};

function buildMenuGroups(permissions: PermissionState, badgeCounts?: BadgeCounts): MenuGroup[] {
  const operationsItems: MenuItem[] = [
    permissions.operations.orders
      ? { id: "orders", icon: <Package size={18} aria-hidden="true" />, label: "Siparişler", badge: badgeCounts?.orders }
      : null,
    permissions.operations.kanban
      ? { id: "kanban", icon: <Workflow size={18} aria-hidden="true" />, label: "Akış Panoları", badge: badgeCounts?.kanban }
      : null,
    permissions.operations.crm || permissions.operations.orders
      ? { id: "card-management", icon: <Briefcase size={18} aria-hidden="true" />, label: "Müşteri Yönetimi", badge: badgeCounts?.payment }
      : null,
    permissions.operations.crm
      ? { id: "crm-tickets", icon: <HeadphonesIcon size={18} aria-hidden="true" />, label: "Destek Biletleri" }
      : null,
    permissions.operations.priceTracking
      ? { id: "price-tracking", icon: <TrendingUp size={18} aria-hidden="true" />, label: "Fiyat Takip" }
      : null,
  ].filter(Boolean) as MenuItem[];

  const productionItems: MenuItem[] = [
    permissions.operations.orchestrator
      ? { id: "orchestrator", icon: <Cpu size={18} aria-hidden="true" />, label: "OptiPlanning Jobs", badge: badgeCounts?.orchestrator }
      : null,
    permissions.operations.orchestrator
      ? { id: "product-search", icon: <Search size={18} aria-hidden="true" />, label: "Ürün Arama" }
      : null,
    permissions.system.stations
      ? { id: "stations", icon: <Factory size={18} aria-hidden="true" />, label: "İstasyonlar" }
      : null,
  ].filter(Boolean) as MenuItem[];

  const analyticsItems: MenuItem[] = [
    { id: "dashboard", icon: <LayoutDashboard size={18} aria-hidden="true" />, label: "AI Gösterge Paneli" },
    permissions.operations.reports || permissions.monitoring.analytics
      ? { id: "reports-analytics", icon: <BarChart3 size={18} aria-hidden="true" />, label: "Raporlar & Analitik" }
      : null,
    permissions.operations.aiAssistant
      ? { id: "ai-assistant", icon: <Bot size={18} aria-hidden="true" />, label: "AI Asistan" }
      : null,
  ].filter(Boolean) as MenuItem[];

  const monitoringItems: MenuItem[] = [
    permissions.system.integrations
      ? { id: "integration-health", icon: <Activity size={18} aria-hidden="true" />, label: "Entegrasyon Durumu" }
      : null,
    permissions.monitoring.logs || permissions.monitoring.audit
      ? { id: "system-logs", icon: <FileText size={18} aria-hidden="true" />, label: "Sistem Günlükleri", badge: badgeCounts?.systemLogs }
      : null,
    permissions.users.activity
      ? { id: "user-activity", icon: <Activity size={18} aria-hidden="true" />, label: "Kullanıcı Aktivitesi" }
      : null,
  ].filter(Boolean) as MenuItem[];

  const settingsItems: MenuItem[] = [
    permissions.system.organization
      ? { id: "organization", icon: <Building2 size={18} aria-hidden="true" />, label: "Organizasyon" }
      : null,
    permissions.system.settings
      ? { id: "config", icon: <Settings size={18} aria-hidden="true" />, label: "Sistem Ayarları" }
      : null,
    permissions.system.integrations
      ? { id: "integrations", icon: <Plug size={18} aria-hidden="true" />, label: "Entegrasyonlar" }
      : null,
    permissions.users.manage || permissions.users.roles
      ? { id: "user-management", icon: <Users size={18} aria-hidden="true" />, label: "Kullanıcı Yönetimi" }
      : null,
    permissions.system.settings
      ? { id: "workflows", icon: <Workflow size={18} aria-hidden="true" />, label: "Otomasyonlar" }
      : null,
    permissions.system.settings
      ? { id: "api-portal", icon: <Globe size={18} aria-hidden="true" />, label: "API Portal" }
      : null,
    permissions.system.settings
      ? { id: "ai-config", icon: <Settings size={18} aria-hidden="true" />, label: "AI Konfigürasyon" }
      : null,
  ].filter(Boolean) as MenuItem[];

  return [
    { id: "operations", title: "Operasyonlar", items: operationsItems },
    { id: "production", title: "Üretim", items: productionItems },
    { id: "analytics", title: "Analiz & AI", items: analyticsItems },
    { id: "monitoring", title: "İzleme", items: monitoringItems },
    { id: "settings", title: "Ayarlar", items: settingsItems },
  ].filter((group) => group.items.length > 0);
}

// --- Tooltip Component (sidebar-specific, CSS-based) ---
function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sidebar-tooltip-wrapper">
      {children}
      <span className="sidebar-tooltip">{label}</span>
    </div>
  );
}

// --- Collapsed User Popup ---
function CollapsedUserPopup({
  displayName,
  userRole,
  onLogout,
}: {
  displayName: string;
  userRole: string;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  return (
    <div className="sidebar-collapsed-user-popup-anchor" ref={popupRef}>
      <button
        type="button"
        className="sidebar-user-avatar sidebar-collapsed-avatar-btn"
        onClick={() => setOpen((p) => !p)}
        aria-label={`Kullanici: ${displayName} (${userRole})`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {displayName
          .split(" ")
          .map((w) => w[0] ?? "")
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </button>
      {open && (
        <div className="sidebar-collapsed-user-popup" role="menu" aria-label="Kullanici menusu">
          <div className="sidebar-popup-user-info">
            <span className="sidebar-popup-user-name">{displayName}</span>
            <span className="sidebar-popup-user-role">{userRole}</span>
          </div>
          <button
            type="button"
            className="sidebar-popup-logout"
            onClick={() => {
              onLogout?.();
              setOpen(false);
            }}
            role="menuitem"
          >
            <LogOut size={14} />
            Cikis Yap
          </button>
        </div>
      )}
    </div>
  );
}

// ===== MAIN SIDEBAR =====
export const Sidebar = ({
  page,
  onNav,
  collapsed,
  mobileOpen = false,
  onToggle,
  userRole = "ADMIN",
  currentUser,
  onLogout,
  badgeCounts,
}: SidebarProps) => {
  const displayName =
    currentUser?.fullName || currentUser?.username || currentUser?.email || "Kullanici";

  const avatarLetters = displayName
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // --- Permissions ---
  const { hasPermission, loading, error } = usePermissions();

  const permissions = useMemo<PermissionState>(() => {
    if (loading || error) {
      return ROLE_PERMISSIONS[userRole] ?? ROLE_PERMISSIONS.STATION;
    }
    return {
      operations: {
        orders: hasPermission("orders:view"),
        kanban: hasPermission("kanban:view"),
        reports: hasPermission("reports:view"),
        crm: hasPermission("crm:view"),
        payment: hasPermission("payment:view"),
        priceTracking: hasPermission("price_tracking:view"),
        aiAssistant: hasPermission("ai_assistant:view"),
        orchestrator: hasPermission("orchestrator:view"),
      },
      system: {
        settings: hasPermission("settings:view"),
        integrations: hasPermission("integrations:view"),
        organization: hasPermission("organization:view"),
        stations: hasPermission("stations:view"),
      },
      users: {
        manage: hasPermission("users:manage"),
        roles: hasPermission("roles:manage"),
        activity: hasPermission("activity:view"),
      },
      monitoring: {
        logs: hasPermission("logs:view"),
        audit: hasPermission("audit:view"),
        analytics: hasPermission("analytics:view"),
      },
    };
  }, [error, hasPermission, loading, userRole]);

  const menuGroups = useMemo(() => buildMenuGroups(permissions, badgeCounts), [permissions, badgeCounts]);

  // --- Favorites (localStorage persisted) ---
  const [favorites, setFavorites] = useState<string[]>(() => loadJsonArray<string>(LS_FAVORITES, []));

  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(itemId) ? prev.filter((f) => f !== itemId) : [...prev, itemId];
      localStorage.setItem(LS_FAVORITES, JSON.stringify(next));
      return next;
    });
  }, []);

  const favoriteItems = useMemo(() => {
    if (favorites.length === 0) return [];
    const allItems = menuGroups.flatMap((g) => g.items);
    return favorites
      .map((fav) => allItems.find((item) => item.id === fav))
      .filter(Boolean) as MenuItem[];
  }, [favorites, menuGroups]);

  // --- Group collapse/expand (localStorage persisted) ---
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() =>
    loadJsonArray<string>(LS_COLLAPSED_GROUPS, [])
  );

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId];
      localStorage.setItem(LS_COLLAPSED_GROUPS, JSON.stringify(next));
      return next;
    });
  }, []);

  // --- Sidebar filter ---
  const [filterText, setFilterText] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);

  const filteredGroups = useMemo(() => {
    if (!filterText.trim()) return menuGroups;
    const q = filterText.toLowerCase();
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [menuGroups, filterText]);

  // --- Render a single nav button ---
  const renderNavButton = (item: MenuItem, showFavStar: boolean) => {
    const isActive = page === item.id;
    const isFav = favorites.includes(item.id);

    const navButton = (
      <button
        type="button"
        className={`sidebar-nav-btn ${isActive ? "is-active" : ""} ${collapsed ? "is-collapsed" : ""}`}
        onClick={() => onNav(item.id)}
        aria-current={isActive ? "page" : undefined}
        aria-label={`${item.label}${item.badge ? ` (${item.badge} yeni)` : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <span className="sidebar-nav-icon" aria-hidden="true">
          {item.icon}
        </span>
        {!collapsed ? <span className="sidebar-nav-label">{item.label}</span> : null}
        {!collapsed && item.badge ? <span className="sidebar-nav-badge">{item.badge}</span> : null}
        {collapsed && item.badge ? <span className="sidebar-nav-badge-dot" /> : null}
      </button>
    );

    if (collapsed) {
      return (
        <SidebarTooltip key={item.id} label={item.label}>
          {navButton}
        </SidebarTooltip>
      );
    }

    return (
      <div key={item.id} className="sidebar-nav-item">
        {navButton}
        {showFavStar ? (
          <button
            type="button"
            className={`sidebar-fav-btn ${isFav ? "is-fav" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            aria-label={isFav ? `${item.label} favorilerden cikar` : `${item.label} favorilere ekle`}
            title={isFav ? "Favorilerden cikar" : "Favorilere ekle"}
          >
            <Star size={12} fill={isFav ? "currentColor" : "none"} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <nav className={`sidebar-shell ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-open" : ""}`} aria-label="Ana navigasyon">
      {/* Brand */}
      <div className={`sidebar-brand ${collapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-brand-mark"
          onClick={onToggle}
          title={collapsed ? "Menuyu genislet" : "Menuyu daralt"}
          aria-label="Kenar menusu ac veya kapat"
        >
          {BRAND.name[0]}
        </button>

        {!collapsed ? (
          <>
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-title">
                {BRAND.name}
                <span>{BRAND.version}</span>
              </div>
              <div className="sidebar-brand-sub">{BRAND.tagline}</div>
            </div>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={onToggle}
              aria-label="Menuyu daralt"
              title="Menuyu daralt"
            >
              <ChevronsLeft size={15} />
            </button>
          </>
        ) : null}
      </div>

      {/* Filter input (expanded only) */}
      {!collapsed ? (
        <div className="sidebar-filter">
          <Filter size={14} className="sidebar-filter-icon" />
          <input
            ref={filterInputRef}
            type="text"
            className="sidebar-filter-input"
            placeholder="Menu ara..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label="Menu oegeleri filtrele"
          />
          {filterText ? (
            <button
              type="button"
              className="sidebar-filter-clear"
              onClick={() => setFilterText("")}
              aria-label="Filtreyi temizle"
            >
              &times;
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Scrollable menu area */}
      <div className="sidebar-scroll" role="region" aria-label="Menu listesi">
        {/* Favorites group */}
        {favoriteItems.length > 0 && !filterText ? (
          <section className="sidebar-group sidebar-group-favorites">
            {!collapsed ? <h2 className="sidebar-group-title sidebar-group-title-fav">Favoriler</h2> : null}
            <div className="sidebar-group-items">
              {favoriteItems.map((item) => renderNavButton(item, false))}
            </div>
          </section>
        ) : null}

        {/* Regular groups */}
        {filteredGroups.map((group) => {
          const isGroupCollapsed = collapsedGroups.includes(group.id) && !filterText;
          return (
            <section key={group.id} className="sidebar-group">
              {!collapsed ? (
                <button
                  type="button"
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!isGroupCollapsed}
                  aria-controls={`sidebar-group-${group.id}`}
                >
                  <h2 className="sidebar-group-title">{group.title}</h2>
                  <span className="sidebar-group-chevron" aria-hidden="true">
                    {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </span>
                </button>
              ) : null}
              {!isGroupCollapsed ? (
                <div className="sidebar-group-items" id={`sidebar-group-${group.id}`}>
                  {group.items.map((item) => renderNavButton(item, !collapsed))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* User footer */}
      <div className="sidebar-user">
        {collapsed ? (
          <CollapsedUserPopup
            displayName={displayName}
            userRole={userRole}
            onLogout={onLogout}
          />
        ) : (
          <>
            <div className="sidebar-user-row">
              <div className="sidebar-user-avatar" aria-label={`Kullanici: ${displayName} (${userRole})`}>
                {avatarLetters}
              </div>
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name">{displayName}</div>
                <div className="sidebar-user-role">{userRole}</div>
              </div>
            </div>
            <button type="button" className="sidebar-logout" onClick={() => onLogout?.()} aria-label="Oturumu kapat">
              <LogOut size={14} />
              Cikis Yap
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
