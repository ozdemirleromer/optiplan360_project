import { Settings2 } from "lucide-react";

import { useUIStore } from "../../stores/uiStore";

export const ThemeToggle = () => {
  const themeName = useUIStore((s) => s.themeName);

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
      aria-label="Tema profili: Industrial Grid"
      title="Tema profili: Industrial Grid (kilitli)"
    >
      <Settings2 size={16} style={{ color: "#38BDF8" }} />
      <span>{themeName === "industrialGrid" ? "Industrial" : "Locked"}</span>
    </button>
  );
};

export default ThemeToggle;

