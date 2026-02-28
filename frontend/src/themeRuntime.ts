import { DEFAULT_THEME, THEMES, type ThemeDef, type ThemeName } from "./themes";
import { TYPOGRAPHY, setRuntimeTheme } from "./components/Shared/constants";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(124,58,237,${alpha})`;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveTheme(themeOrName: ThemeDef | ThemeName): ThemeDef {
  if (typeof themeOrName === "string") {
    return THEMES[themeOrName] ?? THEMES[DEFAULT_THEME];
  }

  return themeOrName;
}

function applyCssVariables(theme: ThemeDef): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-ui-theme", theme.name);
  const accentHover = theme.colors.accent[600] ?? theme.colors.accent.DEFAULT;
  const accentGlow = hexToRgba(theme.colors.accent.DEFAULT, 0.24);
  const textDim = theme.colors.gray[500] ?? theme.colors.muted;

  root.style.setProperty("--bg-main", theme.colors.bg.main);
  root.style.setProperty("--bg-surface", theme.colors.bg.surface);
  root.style.setProperty("--bg-elevated", theme.colors.bg.elevated);
  root.style.setProperty("--bg-card", theme.colors.bg.surface);
  root.style.setProperty("--bg-card-hover", theme.colors.bg.elevated);
  root.style.setProperty("--bg-overlay", theme.colors.bg.overlay);
  root.style.setProperty("--bg-subtle", theme.colors.bg.subtle);

  root.style.setProperty("--primary", theme.colors.primary.DEFAULT);
  root.style.setProperty("--primary-hover", theme.colors.primary[600]);
  root.style.setProperty("--primary-rgb", theme.primaryRgb);
  root.style.setProperty("--primary-glow", `rgba(${theme.primaryRgb},0.20)`);

  root.style.setProperty("--accent", theme.colors.accent.DEFAULT);
  root.style.setProperty("--accent-hover", accentHover);
  root.style.setProperty("--accent-glow", accentGlow);

  root.style.setProperty("--success", theme.colors.success.DEFAULT);
  root.style.setProperty("--warning", theme.colors.warning.DEFAULT);
  root.style.setProperty("--danger", theme.colors.danger.DEFAULT);
  root.style.setProperty("--danger-hover", theme.colors.danger.dark);

  root.style.setProperty("--text-main", theme.colors.text);
  root.style.setProperty("--text-muted", theme.colors.muted);
  root.style.setProperty("--text-dim", textDim);

  root.style.setProperty("--border", theme.colors.border);
  root.style.setProperty("--border-highlight", theme.colors.border2);

  root.style.setProperty("--titlebar-bg", theme.colors.titlebar.bg);
  root.style.setProperty("--titlebar-text", theme.colors.titlebar.text);
  root.style.setProperty("--titlebar-close", theme.colors.titlebar.close);

  root.style.setProperty("--radius-sm", `${theme.design.radius.sm}px`);
  root.style.setProperty("--radius-md", `${theme.design.radius.md}px`);
  root.style.setProperty("--radius-lg", `${theme.design.radius.lg}px`);
  root.style.setProperty("--radius-xl", `${theme.design.radius.xl}px`);

  root.style.setProperty("--shadow-card", theme.design.shadows.sm);
  root.style.setProperty("--shadow-elevated", theme.design.shadows.md);
  root.style.setProperty("--shadow-glow", theme.design.shadows.glow);

  root.style.setProperty("--font-heading", TYPOGRAPHY.fontFamily.heading);
  root.style.setProperty("--font-body", TYPOGRAPHY.fontFamily.base);
  root.style.setProperty("--font-mono", TYPOGRAPHY.fontFamily.mono);
}

export function syncRuntimeTheme(themeOrName: ThemeDef | ThemeName): ThemeDef {
  const theme = resolveTheme(themeOrName);
  const appliedTheme = setRuntimeTheme(theme);
  applyCssVariables(appliedTheme);
  return appliedTheme;
}
