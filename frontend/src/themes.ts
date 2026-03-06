export type ThemeName = "light" | "dark";

export interface ThemeDef {
  name: ThemeName;
  label: string;
  preview: { bg: string; primary: string; accent: string };
  colors: {
    bg: { main: string; surface: string; elevated: string; overlay: string };
    primary: string;
    accent: string;
    text: string;
    muted: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
  design: {
    radius: { sm: number; md: number; lg: number };
    shadows: { sm: string; md: string; lg: string };
  };
}

const lightTheme: ThemeDef = {
  name: "light",
  label: "Light",
  preview: { bg: "#FFFFFF", primary: "#0078D4", accent: "#005A9E" },
  colors: {
    bg: { main: "#F0F0F0", surface: "#FFFFFF", elevated: "#EFEFEF", overlay: "rgba(255,255,255,0.95)" },
    primary: "#0078D4",
    accent: "#005A9E",
    text: "#1F1F1F",
    muted: "#757575",
    border: "#C6C6C6",
    success: "#107C10",
    warning: "#FFB900",
    danger: "#EF4444",
  },
  design: {
    radius: { sm: 0, md: 0, lg: 0 },
    shadows: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 2px 4px rgba(0,0,0,0.1)", lg: "0 4px 8px rgba(0,0,0,0.15)" },
  },
};

const darkTheme: ThemeDef = {
  name: "dark",
  label: "Dark",
  preview: { bg: "#121212", primary: "#38BDF8", accent: "#0EA5E9" },
  colors: {
    bg: { main: "#121212", surface: "#1E1E1E", elevated: "#242424", overlay: "rgba(18,18,18,0.95)" },
    primary: "#0078D4",
    accent: "#005A9E",
    text: "#F3F4F6",
    muted: "#C6C6C6",
    border: "#333333",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  design: {
    radius: { sm: 0, md: 0, lg: 0 },
    shadows: { sm: "0 1px 2px rgba(0,0,0,0.3)", md: "0 2px 4px rgba(0,0,0,0.4)", lg: "0 4px 8px rgba(0,0,0,0.5)" },
  },
};

export const THEMES: Record<ThemeName, ThemeDef> = {
  light: lightTheme,
  dark: darkTheme,
};
export const THEME_LIST: ThemeDef[] = [lightTheme, darkTheme];
export const DEFAULT_THEME: ThemeName = "dark";

function isThemeName(value: unknown): value is ThemeName {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem("optiplan-ui-storage");
    if (stored) {
      const parsed = JSON.parse(stored);
      const name = parsed?.state?.themeName;
      if (isThemeName(name)) {
        return name;
      }
    }
  } catch {
    // Ignore malformed storage payload and use default theme.
  }
  return DEFAULT_THEME;
}

export function getActiveTheme(): ThemeDef {
  return THEME_LIST.find((t) => t.name === getStoredTheme()) || THEME_LIST[1];
}
