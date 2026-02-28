import { Menu, X } from "lucide-react";
import { COLORS } from "../Shared/constants";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  userName?: string;
  userRole?: string;
}

export const MobileHeader = ({
  title,
  subtitle,
  isMenuOpen,
  onMenuToggle,
  userName,
  userRole,
}: MobileHeaderProps) => {
  return (
    <header
      className="mobile-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: `linear-gradient(180deg, rgba(14, 19, 31, 0.98), rgba(11, 15, 24, 0.95))`,
        borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Hamburger Menu Button */}
      <button
        type="button"
        onClick={onMenuToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          background: "transparent",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          color: COLORS.text,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        aria-label={isMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
        aria-expanded={isMenuOpen}
      >
        {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Title Section */}
      <div
        style={{
          flex: 1,
          textAlign: "center",
          margin: "0 12px",
          minWidth: 0,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11,
              color: COLORS.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* User Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.primary.DEFAULT}, #8b5cf6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          border: `2px solid ${COLORS.border}`,
        }}
        aria-label={`${userName || "Kullanıcı"} (${userRole || "Misafir"})`}
      >
        {userName
          ? userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : "??"}
      </div>
    </header>
  );
};

export default MobileHeader;
