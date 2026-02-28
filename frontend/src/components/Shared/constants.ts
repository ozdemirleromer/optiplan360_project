import {
  DEFAULT_THEME,
  THEMES,
  getActiveTheme,
  type ThemeDef,
  type ThemeName,
} from "../../themes";

function hexToRgb(hex: string): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return "59,130,246";
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `${r},${g},${b}`;
}

const LETTER_SPACING_MAP = {
  tight: "-0.02em",
  normal: "0",
  wide: "0.03em",
} as const;

const LINE_HEIGHT_MAP = {
  compact: 1.3,
  normal: 1.5,
  relaxed: 1.7,
} as const;

type FontFamilySet = {
  heading: string;
  base: string;
  display: string;
  mono: string;
};

const DEFAULT_FONT_FAMILIES: FontFamilySet = {
  heading: '"Segoe UI", "Space Grotesk", system-ui, sans-serif',
  base: '"Segoe UI", "IBM Plex Sans", system-ui, sans-serif',
  display: '"Segoe UI", "Space Grotesk", system-ui, sans-serif',
  mono: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
};

const THEME_FONT_FAMILIES: Partial<Record<ThemeName, FontFamilySet>> = {
  // 1) Executive Slate
  neoCorporate: {
    heading: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    base: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    display: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
  // 2) Ledger Pro
  minimalStudio: {
    heading: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
    base: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
    display: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
    mono: '"Roboto Mono", "Cascadia Code", Consolas, monospace',
  },
  // 3) Industrial Matrix
  industrialGrid: {
    heading: '"Archivo Narrow", "Segoe UI", "Arial Narrow", system-ui, sans-serif',
    base: '"Barlow", "Segoe UI", system-ui, sans-serif',
    display: '"Archivo Narrow", "Segoe UI", "Arial Narrow", system-ui, sans-serif',
    mono: '"Roboto Mono", "Cascadia Code", Consolas, monospace',
  },
};

function resolveTheme(themeOrName?: ThemeDef | ThemeName): ThemeDef {
  if (!themeOrName) {
    return getActiveTheme();
  }

  if (typeof themeOrName === "string") {
    return THEMES[themeOrName] ?? THEMES[DEFAULT_THEME];
  }

  return themeOrName;
}

function buildTypography(theme: ThemeDef) {
  const design = theme.design;
  const letterSpacing = LETTER_SPACING_MAP[design.typography.letterSpacing] ?? LETTER_SPACING_MAP.normal;
  const lineHeight = LINE_HEIGHT_MAP[design.typography.lineHeight] ?? LINE_HEIGHT_MAP.normal;
  const fontFamily = THEME_FONT_FAMILIES[theme.name] ?? DEFAULT_FONT_FAMILIES;

  return {
    fontSize: {
      xs: 11,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      "2xl": 20,
      "3xl": 24,
      "4xl": 30,
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    fontFamily,
    scale: {
      h1: {
        size: 24,
        weight: design.typography.headingWeight,
        family: "heading",
        tracking: letterSpacing,
      },
      h2: {
        size: 20,
        weight: design.typography.headingWeight - 100,
        family: "heading",
        tracking: letterSpacing,
      },
      h3: {
        size: 16,
        weight: design.typography.headingWeight - 100,
        family: "heading",
        tracking: letterSpacing,
      },
      label: { size: 12, weight: 600, family: "base", tracking: "0.03em" },
      body: {
        size: 14,
        weight: design.typography.bodyWeight,
        family: "base",
        tracking: letterSpacing,
      },
      caption: { size: 11, weight: 500, family: "base", tracking: "0.02em" },
      data: { size: 14, weight: 500, family: "mono", tracking: "0.02em" },
      kpi: {
        size: 30,
        weight: design.typography.headingWeight,
        family: "heading",
        tracking: "-0.02em",
      },
    },
    lineHeight,
  };
}

let runtimeTheme: ThemeDef = resolveTheme();
let primaryRgb = runtimeTheme.primaryRgb || hexToRgb(runtimeTheme.colors.primary.DEFAULT);

export let COLORS = runtimeTheme.colors;
export let TYPOGRAPHY = buildTypography(runtimeTheme);
export let RADIUS = runtimeTheme.design.radius;
export let SHADOWS = runtimeTheme.design.shadows;

export function getRuntimeTheme(): ThemeDef {
  return runtimeTheme;
}

export function setRuntimeTheme(themeOrName: ThemeDef | ThemeName): ThemeDef {
  const nextTheme = resolveTheme(themeOrName);

  runtimeTheme = nextTheme;
  primaryRgb = nextTheme.primaryRgb || hexToRgb(nextTheme.colors.primary.DEFAULT);
  COLORS = nextTheme.colors;
  TYPOGRAPHY = buildTypography(nextTheme);
  RADIUS = nextTheme.design.radius;
  SHADOWS = nextTheme.design.shadows;

  return runtimeTheme;
}

export function primaryRgba(alpha: number): string {
  return `rgba(${primaryRgb},${alpha})`;
}

export const SPACING = {
  0: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
  "4xl": 96,
} as const;

export const TRANSITIONS = {
  fast: "all .15s ease",
  base: "all .22s ease",
  slow: "all .3s ease",
  spring: "all .28s cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export const Z_INDEX = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
};

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export function getStatusConfig() {
  return {
    DRAFT: { label: "Taslak", color: COLORS.gray[400], bg: "rgba(159,176,208,0.10)", icon: "DR" },
    NEW: { label: "Yeni", color: COLORS.info.DEFAULT, bg: COLORS.info.light, icon: "NW" },
    PENDING_APPROVAL: { label: "Onay Bekliyor", color: COLORS.warning.DEFAULT, bg: COLORS.warning.light, icon: "PA" },
    HOLD: { label: "Bekletme", color: COLORS.warning.DEFAULT, bg: COLORS.warning.light, icon: "HD" },
    IN_PRODUCTION: { label: "Üretimde", color: COLORS.accent.DEFAULT, bg: COLORS.accent[50], icon: "PR" },
    APPROVED: { label: "Onaylı", color: COLORS.success.DEFAULT, bg: COLORS.success.light, icon: "AP" },
    READY: { label: "Hazır", color: COLORS.success.DEFAULT, bg: COLORS.success.light, icon: "OK" },
    DELIVERED: { label: "Teslim", color: COLORS.primary[500], bg: COLORS.primary[50], icon: "TS" },
    CANCELLED: { label: "İptal", color: COLORS.danger.DEFAULT, bg: COLORS.danger.light, icon: "IP" },
    DONE: { label: "Tamamlandı", color: COLORS.gray[400], bg: "rgba(255,255,255,0.06)", icon: "DN" },
    COMPLETED: { label: "Tamamlandı", color: COLORS.gray[400], bg: "rgba(255,255,255,0.06)", icon: "DN" },
  } as const;
}
