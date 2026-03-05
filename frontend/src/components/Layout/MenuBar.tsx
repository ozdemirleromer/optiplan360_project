/**
 * Modern horizontal navbar - 64px height
 * Logo solda, menüler sağda, aktif durumda neon mavi alt çizgi
 */

import type { User } from "../../types";
import "./menubar.css";

interface MenuBarProps {
  page: string;
  onNav: (page: string) => void;
  userRole?: "ADMIN" | "OPERATOR" | "STATION";
  currentUser?: User | null;
  onLogout?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  page: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dosya", label: "Dosya", page: "orders" },
  { id: "cari", label: "Cari", page: "card-management" },
  { id: "siparis", label: "Sipariş", page: "order-editor" },
  { id: "raporlar", label: "Raporlar", page: "reports-analytics" },
];

export function MenuBar({ page, onNav }: MenuBarProps) {
  const handleNavClick = (targetPage: string) => {
    onNav(targetPage);
  };

  // Aktif sayfa tespiti
  const isActive = (navPage: string) => {
    return page === navPage;
  };

  return (
    <div className="menubar">
      {/* Logo Solda */}
      <div className="menubar-logo">
        OptiPlan 360
      </div>

      {/* Menüler Sağda */}
      <nav className="menubar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`menubar-nav-item ${isActive(item.page) ? "is-active" : ""}`}
            onClick={() => handleNavClick(item.page)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
