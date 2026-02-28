import { Moon, Sun } from "lucide-react";
import { useMemo } from "react";
import { useUIStore } from "../../stores/uiStore";

export const ThemeToggle = () => {
  const themeName = useUIStore((s) => s.themeName);
  const setThemeName = useUIStore((s) => s.setThemeName);
  const isDark = themeName !== "cleanProfessional";
  const nextTheme = useMemo(
    () => (isDark ? "cleanProfessional" : "electricPulse"),
    [isDark],
  );

  return (
    <button
      type="button"
      onClick={() => setThemeName(nextTheme)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 12px",
        background: isDark
          ? "linear-gradient(135deg, rgba(var(--primary-rgb),0.20), rgba(124,58,237,0.16))"
          : "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(16,185,129,0.12))",
        border: isDark
          ? "1px solid rgba(var(--primary-rgb),0.40)"
          : "1px solid rgba(37,99,235,0.25)",
        borderRadius: 20,
        cursor: "pointer",
        transition: "all 0.3s ease",
        color: "var(--text-main)",
        fontSize: 13,
        fontWeight: 500,
      }}
      aria-label={isDark ? "Aydinlik temaya gec" : "Karanlik temaya gec"}
      title={isDark ? "Aydinlik tema" : "Karanlik tema"}
    >
      {isDark ? (
        <>
          <Sun size={16} style={{ color: "#fbbf24" }} />
          <span style={{ display: "none" }} className="show-desktop-inline">
            Aydinlik
          </span>
        </>
      ) : (
        <>
          <Moon size={16} style={{ color: "#4f46e5" }} />
          <span style={{ display: "none" }} className="show-desktop-inline">
            Karanlik
          </span>
        </>
      )}
    </button>
  );
};

export default ThemeToggle;
