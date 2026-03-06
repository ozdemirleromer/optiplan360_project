import { DEFAULT_THEME, THEMES, type ThemeDef, type ThemeName } from "./themes";
import { TYPOGRAPHY, setRuntimeTheme } from "./components/Shared/constants";

function hexToRgba(hex: string | undefined | null, alpha: number): string {
  if (!hex) return `rgba(124,58,237,${alpha})`;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToRgbStr(hex: string | undefined | null): string {
  if (!hex) return "0,120,212";
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "0,120,212";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function resolveTheme(themeOrName: ThemeDef | ThemeName): ThemeDef {
  if (typeof themeOrName === "string") {
    return THEMES[themeOrName] ?? THEMES[DEFAULT_THEME];
  }
  return themeOrName;
}

function applyCssVariables(theme: ThemeDef): void {
  if (typeof document === "undefined") return;

  type LegacyScale = { [key: string]: string | undefined; DEFAULT?: string; dark?: string; highlight?: string };
  type LegacyColors = ThemeDef["colors"] & {
    border2?: string;
    gray?: Record<string, string>;
    titlebar?: { bg?: string; text?: string; close?: string };
    primary?: string | LegacyScale;
    accent?: string | LegacyScale;
    success?: string | LegacyScale;
    warning?: string | LegacyScale;
    danger?: string | LegacyScale;
    border?: string | LegacyScale;
    bg?: ThemeDef["colors"]["bg"] & { subtle?: string };
  };
  type LegacyDesign = ThemeDef["design"] & {
    radius?: ThemeDef["design"]["radius"] & { xl?: number };
    shadows?: ThemeDef["design"]["shadows"] & { glow?: string };
  };
  const c = theme.colors as LegacyColors;
  const d = theme.design as LegacyDesign;
  const root = document.documentElement;
  root.setAttribute("data-ui-theme", theme.name);

  // Renkleri duz string veya eski obje yapisindan guvenli oku
  const primary: string = typeof c.primary === "string" ? c.primary : (c.primary?.DEFAULT ?? "#0078D4");
  const accent: string  = typeof c.accent  === "string" ? c.accent  : (c.accent?.DEFAULT  ?? "#005A9E");
  const success: string = typeof c.success === "string" ? c.success : (c.success?.DEFAULT ?? "#107C10");
  const warning: string = typeof c.warning === "string" ? c.warning : (c.warning?.DEFAULT ?? "#FFB900");
  const danger: string  = typeof c.danger  === "string" ? c.danger  : (c.danger?.DEFAULT  ?? "#EF4444");
  const primaryRgbVal   = hexToRgbStr(primary);

  root.style.setProperty("--bg-main",       c.bg?.main      ?? "#F0F0F0");
  root.style.setProperty("--bg-surface",    c.bg?.surface   ?? "#FFFFFF");
  root.style.setProperty("--bg-elevated",   c.bg?.elevated  ?? "#EFEFEF");
  root.style.setProperty("--bg-card",       c.bg?.surface   ?? "#FFFFFF");
  root.style.setProperty("--bg-card-hover", c.bg?.elevated  ?? "#EFEFEF");
  root.style.setProperty("--bg-overlay",    c.bg?.overlay   ?? "rgba(255,255,255,0.95)");
  root.style.setProperty("--bg-subtle",     c.bg?.subtle    ?? c.bg?.elevated ?? "#EFEFEF");

  root.style.setProperty("--primary",       primary);
  root.style.setProperty("--primary-hover", c.primary?.[600] ?? accent);
  root.style.setProperty("--primary-rgb",   primaryRgbVal);
  root.style.setProperty("--primary-glow",  `rgba(${primaryRgbVal},0.20)`);

  root.style.setProperty("--accent",        accent);
  root.style.setProperty("--accent-hover",  c.accent?.[600] ?? accent);
  root.style.setProperty("--accent-glow",   hexToRgba(accent, 0.24));

  root.style.setProperty("--success",       success);
  root.style.setProperty("--warning",       warning);
  root.style.setProperty("--danger",        danger);
  root.style.setProperty("--danger-hover",  c.danger?.dark ?? danger);

  root.style.setProperty("--text-main",  c.text  ?? "#1F1F1F");
  root.style.setProperty("--text-muted", c.muted ?? "#757575");
  root.style.setProperty("--text-dim",   c.gray?.[500] ?? c.muted ?? "#9CA3AF");

  root.style.setProperty("--border",           typeof c.border === "string" ? c.border : (c.border?.DEFAULT ?? "#C6C6C6"));
  root.style.setProperty("--border-highlight", c.border2 ?? c.border?.highlight ?? "#A0A0A0");

  root.style.setProperty("--titlebar-bg",    c.titlebar?.bg    ?? primary);
  root.style.setProperty("--titlebar-text",  c.titlebar?.text  ?? "#FFFFFF");
  root.style.setProperty("--titlebar-close", c.titlebar?.close ?? "#E81123");

  root.style.setProperty("--radius-sm", `${d.radius?.sm ?? 2}px`);
  root.style.setProperty("--radius-md", `${d.radius?.md ?? 4}px`);
  root.style.setProperty("--radius-lg", `${d.radius?.lg ?? 6}px`);
  root.style.setProperty("--radius-xl", `${d.radius?.xl ?? d.radius?.lg ?? 8}px`);

  root.style.setProperty("--shadow-card",     d.shadows?.sm   ?? "0 1px 2px rgba(0,0,0,0.05)");
  root.style.setProperty("--shadow-elevated", d.shadows?.md   ?? "0 2px 4px rgba(0,0,0,0.1)");
  root.style.setProperty("--shadow-glow",     d.shadows?.glow ?? d.shadows?.lg ?? "0 4px 8px rgba(0,0,0,0.15)");

  try {
    root.style.setProperty("--font-heading", TYPOGRAPHY.fontFamily.heading);
    root.style.setProperty("--font-body",    TYPOGRAPHY.fontFamily.base);
    root.style.setProperty("--font-mono",    TYPOGRAPHY.fontFamily.mono);
  } catch {
    // TYPOGRAPHY henuz hazir degilse sessizce gec
  }
}

export function syncRuntimeTheme(themeOrName: ThemeDef | ThemeName): ThemeDef {
  const theme = resolveTheme(themeOrName);
  const appliedTheme = setRuntimeTheme(theme);
  applyCssVariables(appliedTheme);
  return appliedTheme;
}
