import { Settings2 } from "lucide-react";

import { THEMES } from "../../themes";
import { useUIStore } from "../../stores/uiStore";

export const ThemeToggle = () => {
  const themeName = useUIStore((s) => s.themeName);
  const theme = THEMES[themeName] ?? THEMES.dark;

  return (
    <button
      type="button"
      disabled
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#1E1E1E",
        border: "1px solid #333333",
        borderRadius: 20,
        cursor: "not-allowed",
        transition: "none",
        color: "#C6C6C6",
        fontSize: 13,
        fontWeight: 500,
      }}
      aria-label={`Tema profili: ${theme.label}`}
      title={`Tema profili: ${theme.label}`}
    >
      <Settings2 size={16} style={{ color: theme.preview.primary }} />
      <span>{theme.label}</span>
    </button>
  );
};

export default ThemeToggle;
