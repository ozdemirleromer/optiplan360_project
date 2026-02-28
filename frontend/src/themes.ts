// ========================================
// OPTIPLAN360 - PROFESSIONAL THEME SYSTEM
// ========================================

export type ThemeName = "neoCorporate" | "minimalStudio" | "industrialGrid" | "deepSpace" | "cleanProfessional" | "electricPulse" | "lightNavy";

export interface ThemeDef {
  name: ThemeName;
  label: string;
  description: string;
  category: "corporate" | "minimal" | "industrial";
  preview: { bg: string; primary: string; accent: string };
  primaryRgb: string;

  design: {
    radius: {
      sm: number;
      md: number;
      lg: number;
      xl: number;
      "2xl": number;
      "3xl": number;
      full: number;
    };
    shadows: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      cardHover: string;
      glow: string;
    };
    typography: {
      headingWeight: 400 | 500 | 600 | 700 | 800 | 900;
      bodyWeight: 300 | 400 | 500 | 600;
      letterSpacing: "tight" | "normal" | "wide";
      lineHeight: "compact" | "normal" | "relaxed";
    };
    borders: {
      width: number;
      style: "solid" | "dashed" | "dotted";
    };
  };

  colors: {
    bg: { main: string; surface: string; elevated: string; overlay: string; subtle: string };
    primary: Record<string, string>;
    accent: Record<string, string>;
    success: { DEFAULT: string; light: string; dark: string };
    warning: { DEFAULT: string; light: string; dark: string; 800: string };
    danger: { DEFAULT: string; light: string; dark: string };
    info: { DEFAULT: string; light: string; dark: string; 500: string; 800: string };
    text: string;
    muted: string;
    border: string;
    border2: string;
    titlebar: { bg: string; text: string; active: string; button: string; buttonHover: string; close: string };
    secondary: { DEFAULT: string; 500: string };
    error: { DEFAULT: string; light: string; dark: string };
    surface: string;
    panel: string;
    gray: Record<number | string, string>;
  };
}

const SHARED = {
  success: { DEFAULT: "#10B981", light: "rgba(16,185,129,0.12)", dark: "#059669" },
  warning: { DEFAULT: "#F59E0B", light: "rgba(245,158,11,0.12)", dark: "#D97706", 800: "#92400E" },
  danger: { DEFAULT: "#EF4444", light: "rgba(239,68,68,0.12)", dark: "#DC2626" },
  error: { DEFAULT: "#EF4444", light: "rgba(239,68,68,0.12)", dark: "#DC2626" },
};

const neoCorporate: ThemeDef = {
  name: "neoCorporate",
  label: "Executive Slate",
  description: "Top command bar and KPI-driven corporate control surface",
  category: "corporate",
  preview: { bg: "#0F172A", primary: "#3B82F6", accent: "#8B5CF6" },
  primaryRgb: "59,130,246",
  design: {
    radius: { sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, full: 9999 },
    shadows: {
      xs: "0 2px 8px rgba(0,0,0,0.08)",
      sm: "0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
      md: "0 8px 24px rgba(0,0,0,0.16), 0 4px 8px rgba(0,0,0,0.1)",
      lg: "0 16px 40px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.12)",
      xl: "0 24px 56px rgba(0,0,0,0.24), 0 12px 24px rgba(0,0,0,0.14)",
      cardHover: "0 12px 32px rgba(59,130,246,0.2), 0 6px 12px rgba(0,0,0,0.15)",
      glow: "0 0 0 1px rgba(59,130,246,0.3), 0 0 24px rgba(59,130,246,0.15)",
    },
    typography: { headingWeight: 700, bodyWeight: 400, letterSpacing: "normal", lineHeight: "relaxed" },
    borders: { width: 1, style: "solid" },
  },
  colors: {
    bg: { main: "#0F172A", surface: "#1E293B", elevated: "#334155", overlay: "rgba(15,23,42,0.95)", subtle: "rgba(255,255,255,0.05)" },
    primary: {
      DEFAULT: "#3B82F6", 50: "#EFF6FF", 100: "#DBEAFE", 200: "#BFDBFE",
      300: "#93C5FD", 400: "#60A5FA", 500: "#3B82F6", 600: "#2563EB",
      700: "#1D4ED8", 800: "#1E40AF", 900: "#1E3A8A",
    },
    accent: {
      DEFAULT: "#8B5CF6", 50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE",
      300: "#C4B5FD", 400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED",
      700: "#6D28D9", 800: "#5B21B6", 900: "#4C1D95",
    },
    ...SHARED,
    info: { DEFAULT: "#06B6D4", light: "rgba(6,182,212,0.12)", dark: "#0891B2", 500: "#06B6D4", 800: "#155E75" },
    text: "#F1F5F9",
    muted: "#94A3B8",
    border: "#334155",
    border2: "#475569",
    titlebar: { bg: "#0F172A", text: "#94A3B8", active: "#3B82F6", button: "#1E293B", buttonHover: "#334155", close: "#EF4444" },
    secondary: { DEFAULT: "#8B5CF6", 500: "#8B5CF6" },
    surface: "rgba(255,255,255,0.05)",
    panel: "#1E293B",
    gray: {
      50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1",
      400: "#94A3B8", 500: "#64748B", 600: "#475569", 700: "#334155",
      800: "#1E293B", 900: "#0F172A",
    },
  },
};

const minimalStudio: ThemeDef = {
  name: "minimalStudio",
  label: "Ledger Pro",
  description: "Table-first finance workspace with audit-friendly hierarchy",
  category: "minimal",
  preview: { bg: "#F8FAF7", primary: "#1F2937", accent: "#6B8E23" },
  primaryRgb: "31,41,55",
  design: {
    radius: { sm: 2, md: 4, lg: 6, xl: 8, "2xl": 10, "3xl": 12, full: 9999 },
    shadows: {
      xs: "0 1px 2px rgba(0,0,0,0.05)",
      sm: "0 1px 3px rgba(0,0,0,0.08)",
      md: "0 2px 6px rgba(0,0,0,0.10)",
      lg: "0 4px 12px rgba(0,0,0,0.12)",
      xl: "0 8px 24px rgba(0,0,0,0.15)",
      cardHover: "0 4px 16px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.1)",
      glow: "0 0 0 2px rgba(0,0,0,0.15)",
    },
    typography: { headingWeight: 600, bodyWeight: 400, letterSpacing: "tight", lineHeight: "compact" },
    borders: { width: 1, style: "solid" },
  },
  colors: {
    bg: { main: "#F8FAF7", surface: "#FFFFFF", elevated: "#F1F5EE", overlay: "rgba(248,250,247,0.98)", subtle: "rgba(31,41,55,0.02)" },
    primary: {
      DEFAULT: "#1F2937", 50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0",
      300: "#CBD5E1", 400: "#94A3B8", 500: "#64748B", 600: "#475569",
      700: "#334155", 800: "#1F2937", 900: "#0F172A",
    },
    accent: {
      DEFAULT: "#6B8E23", 50: "#F6FAEC", 100: "#EAF4D8", 200: "#D5E9B0",
      300: "#B7D880", 400: "#95BF4F", 500: "#6B8E23", 600: "#56751C",
      700: "#455D17", 800: "#364913", 900: "#29370E",
    },
    success: { DEFAULT: "#059669", light: "rgba(5,150,105,0.10)", dark: "#047857" },
    warning: { DEFAULT: "#D97706", light: "rgba(217,119,6,0.10)", dark: "#B45309", 800: "#92400E" },
    danger: { DEFAULT: "#DC2626", light: "rgba(220,38,38,0.10)", dark: "#B91C1C" },
    error: { DEFAULT: "#DC2626", light: "rgba(220,38,38,0.10)", dark: "#B91C1C" },
    info: { DEFAULT: "#0284C7", light: "rgba(2,132,199,0.10)", dark: "#0369A1", 500: "#0284C7", 800: "#075985" },
    text: "#1F2937",
    muted: "#5F6B5E",
    border: "#D8E0D2",
    border2: "#C8D2C0",
    titlebar: { bg: "#EFF4EA", text: "#5F6B5E", active: "#1F2937", button: "#E2EADF", buttonHover: "#D6E0D0", close: "#DC2626" },
    secondary: { DEFAULT: "#6B8E23", 500: "#6B8E23" },
    surface: "rgba(31,41,55,0.02)",
    panel: "#FFFFFF",
    gray: {
      50: "#F8FAF7", 100: "#EFF4EA", 200: "#E2EADF", 300: "#D4DECF",
      400: "#AAB8A8", 500: "#829281", 600: "#5F6B5E", 700: "#455342",
      800: "#2D372C", 900: "#1D241C",
    },
  },
};

const industrialGrid: ThemeDef = {
  name: "industrialGrid",
  label: "Industrial Matrix",
  description: "Hard-edged production interface with grid and contrast blocks",
  category: "industrial",
  preview: { bg: "#1A1A1A", primary: "#FCD34D", accent: "#F97316" },
  primaryRgb: "252,211,77",
  design: {
    radius: { sm: 0, md: 0, lg: 0, xl: 2, "2xl": 2, "3xl": 3, full: 0 },
    shadows: {
      xs: "none",
      sm: "0 0 0 1px rgba(255,255,255,0.1)",
      md: "0 0 0 2px rgba(255,255,255,0.1)",
      lg: "0 0 0 2px rgba(252,211,77,0.3)",
      xl: "0 0 0 3px rgba(252,211,77,0.4)",
      cardHover: "0 0 0 2px rgba(252,211,77,0.6)",
      glow: "0 0 0 2px rgba(252,211,77,0.8), 0 0 16px rgba(252,211,77,0.3)",
    },
    typography: { headingWeight: 800, bodyWeight: 500, letterSpacing: "wide", lineHeight: "compact" },
    borders: { width: 2, style: "solid" },
  },
  colors: {
    bg: { main: "#1A1A1A", surface: "#242424", elevated: "#2E2E2E", overlay: "rgba(26,26,26,0.98)", subtle: "rgba(255,255,255,0.03)" },
    primary: {
      DEFAULT: "#FCD34D", 50: "#FEFCE8", 100: "#FEF9C3", 200: "#FEF08A",
      300: "#FDE047", 400: "#FACC15", 500: "#FCD34D", 600: "#CA8A04",
      700: "#A16207", 800: "#854D0E", 900: "#713F12",
    },
    accent: {
      DEFAULT: "#F97316", 50: "#FFF7ED", 100: "#FFEDD5", 200: "#FED7AA",
      300: "#FDBA74", 400: "#FB923C", 500: "#F97316", 600: "#EA580C",
      700: "#C2410C", 800: "#9A3412", 900: "#7C2D12",
    },
    ...SHARED,
    info: { DEFAULT: "#22D3EE", light: "rgba(34,211,238,0.12)", dark: "#06B6D4", 500: "#22D3EE", 800: "#155E75" },
    text: "#FAFAFA",
    muted: "#A3A3A3",
    border: "#3F3F3F",
    border2: "#525252",
    titlebar: { bg: "#1A1A1A", text: "#A3A3A3", active: "#FCD34D", button: "#2E2E2E", buttonHover: "#3F3F3F", close: "#EF4444" },
    secondary: { DEFAULT: "#F97316", 500: "#F97316" },
    surface: "rgba(255,255,255,0.03)",
    panel: "#242424",
    gray: {
      50: "#FAFAFA", 100: "#F5F5F5", 200: "#E5E5E5", 300: "#D4D4D4",
      400: "#A3A3A3", 500: "#737373", 600: "#525252", 700: "#404040",
      800: "#262626", 900: "#171717",
    },
  },
};


const deepSpace: ThemeDef = {
  name: "deepSpace",
  label: "Deep Space (v1)",
  description: "Futuristic dark mode with glassmorphism and nebula effects",
  category: "industrial",
  preview: { bg: "#030712", primary: "#6366F1", accent: "#06B6D4" },
  primaryRgb: "99,102,241",
  design: {
    radius: { sm: 4, md: 8, lg: 16, xl: 24, "2xl": 32, "3xl": 40, full: 9999 },
    shadows: {
      xs: "0 2px 4px rgba(0,0,0,0.4)",
      sm: "0 4px 8px rgba(0,0,0,0.5)",
      md: "0 8px 16px rgba(0,0,0,0.6)",
      lg: "0 16px 32px rgba(0,0,0,0.6)",
      xl: "0 24px 48px rgba(0,0,0,0.7)",
      cardHover: "0 0 20px rgba(99,102,241,0.3), 0 0 0 1px rgba(255,255,255,0.1)",
      glow: "0 0 30px rgba(6,182,212,0.4)",
    },
    typography: { headingWeight: 700, bodyWeight: 400, letterSpacing: "normal", lineHeight: "relaxed" },
    borders: { width: 1, style: "solid" },
  },
  colors: {
    bg: { main: "#030712", surface: "rgba(17, 24, 39, 0.6)", elevated: "rgba(31, 41, 55, 0.6)", overlay: "rgba(3, 7, 18, 0.8)", subtle: "rgba(255,255,255,0.03)" },
    primary: {
      DEFAULT: "#6366F1", 50: "#EEF2FF", 100: "#E0E7FF", 200: "#C7D2FE",
      300: "#A5B4FC", 400: "#818CF8", 500: "#6366F1", 600: "#4F46E5",
      700: "#4338CA", 800: "#3730A3", 900: "#312E81",
    },
    accent: {
      DEFAULT: "#06B6D4", 50: "#ECFEFF", 100: "#CFFAFE", 200: "#A5F3FC",
      300: "#67E8F9", 400: "#22D3EE", 500: "#06B6D4", 600: "#0891B2",
      700: "#0E7490", 800: "#155E75", 900: "#164E63",
    },
    ...SHARED,
    info: { DEFAULT: "#3B82F6", light: "rgba(59,130,246,0.12)", dark: "#2563EB", 500: "#3B82F6", 800: "#1E40AF" },
    text: "#F8FAFC",
    muted: "#94A3B8",
    border: "rgba(255,255,255,0.08)",
    border2: "rgba(255,255,255,0.15)",
    titlebar: { bg: "#030712", text: "#94A3B8", active: "#6366F1", button: "rgba(255,255,255,0.05)", buttonHover: "rgba(255,255,255,0.1)", close: "#EF4444" },
    secondary: { DEFAULT: "#06B6D4", 500: "#06B6D4" },
    surface: "rgba(17, 24, 39, 0.4)",
    panel: "rgba(17, 24, 39, 0.6)",
    gray: {
      50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1",
      400: "#94A3B8", 500: "#64748B", 600: "#475569", 700: "#334155",
      800: "#1E293B", 900: "#0F172A",
    },
  },
};

const cleanProfessional: ThemeDef = {
  name: "cleanProfessional",
  label: "Clean Pro (v2)",
  description: "Corporate light interface with a consistent navy-blue tinted palette",
  category: "corporate",
  preview: { bg: "#EFF2F7", primary: "#1B4F8E", accent: "#0E7490" },
  primaryRgb: "27,79,142",
  design: {
    radius: { sm: 6, md: 8, lg: 12, xl: 16, "2xl": 24, "3xl": 32, full: 9999 },
    shadows: {
      xs: "0 1px 2px rgba(27,79,142,0.06)",
      sm: "0 1px 4px rgba(27,79,142,0.08), 0 1px 2px rgba(0,0,0,0.04)",
      md: "0 4px 8px rgba(27,79,142,0.10), 0 2px 4px rgba(0,0,0,0.05)",
      lg: "0 10px 20px rgba(27,79,142,0.12), 0 4px 8px rgba(0,0,0,0.06)",
      xl: "0 20px 32px rgba(27,79,142,0.14), 0 8px 16px rgba(0,0,0,0.06)",
      cardHover: "0 8px 20px rgba(27,79,142,0.14), 0 0 0 1px rgba(27,79,142,0.08)",
      glow: "0 0 0 3px rgba(27,79,142,0.18)",
    },
    typography: { headingWeight: 700, bodyWeight: 400, letterSpacing: "tight", lineHeight: "normal" },
    borders: { width: 1, style: "solid" },
  },
  colors: {
    bg: {
      main: "#EFF2F7",       // blue-tinted light gray — page background
      surface: "#FFFFFF",    // pure white — cards / panels
      elevated: "#E6ECF5",   // slightly darker blue-tint — modals / dropdowns
      overlay: "rgba(240,244,250,0.97)",
      subtle: "rgba(27,79,142,0.03)",
    },
    primary: {
      DEFAULT: "#1B4F8E",     // deep corporate blue
      50: "#EFF4FD", 100: "#D9E5F8", 200: "#B3CBEF",
      300: "#7AAEE2", 400: "#4A8FD5", 500: "#2272C3",
      600: "#1B4F8E", 700: "#163F72", 800: "#102E55", 900: "#0B1F39",
    },
    accent: {
      DEFAULT: "#0E7490",     // teal — complementary accent
      50: "#F0FAFC", 100: "#CCEEF5", 200: "#99DDEB",
      300: "#5EC8DC", 400: "#29B0CB", 500: "#0E96B0",
      600: "#0E7490", 700: "#0B5A70", 800: "#084252", 900: "#052E39",
    },
    success: { DEFAULT: "#0D9466", light: "rgba(13,148,102,0.10)", dark: "#067A53" },
    warning: { DEFAULT: "#B45309", light: "rgba(180,83,9,0.10)", dark: "#92400E", 800: "#78350F" },
    danger: { DEFAULT: "#B91C1C", light: "rgba(185,28,28,0.10)", dark: "#991B1B" },
    error: { DEFAULT: "#B91C1C", light: "rgba(185,28,28,0.10)", dark: "#991B1B" },
    info: { DEFAULT: "#1B4F8E", light: "rgba(27,79,142,0.10)", dark: "#163F72", 500: "#2272C3", 800: "#102E55" },
    text: "#1A2233",          // near-black with blue tint — high contrast
    muted: "#5A6A8A",         // blue-gray — clearly readable on white
    border: "#C8D4E8",       // blue-tinted light border
    border2: "#A8BEDD",       // slightly darker divider
    titlebar: {
      bg: "#FFFFFF",
      text: "#5A6A8A",
      active: "#1B4F8E",
      button: "#EFF2F7",
      buttonHover: "#DDE5F2",
      close: "#B91C1C",
    },
    secondary: { DEFAULT: "#5A6A8A", 500: "#5A6A8A" },
    surface: "#FFFFFF",
    panel: "#FFFFFF",
    gray: {
      50: "#F8FAFD", 100: "#EFF2F7", 200: "#DDE5F2",
      300: "#C8D4E8", 400: "#9BACC8", 500: "#7188A8",
      600: "#506080", 700: "#3A4D6A", 800: "#253350", 900: "#141E33",
    },
  },
};

const electricPulse: ThemeDef = {
  name: "electricPulse",
  label: "Electric Pulse (v3)",
  description: "High energy dark mode with vibrant neon gradients",
  category: "industrial",
  preview: { bg: "#09090B", primary: "#FF3D00", accent: "#7C3AED" },
  primaryRgb: "255, 61, 0",
  design: {
    radius: { sm: 4, md: 12, lg: 20, xl: 24, "2xl": 32, "3xl": 40, full: 9999 },
    shadows: {
      xs: "0 1px 2px rgba(0,0,0,0.5)",
      sm: "0 1px 3px rgba(0,0,0,0.5)",
      md: "0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.3)",
      lg: "0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3)",
      xl: "0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.3)",
      cardHover: "0 0 25px rgba(255, 61, 0, 0.25), 0 0 0 2px rgba(255, 61, 0, 0.1)",
      glow: "0 0 20px rgba(255, 61, 0, 0.4)",
    },
    typography: { headingWeight: 700, bodyWeight: 500, letterSpacing: "wide", lineHeight: "relaxed" },
    borders: { width: 1, style: "solid" },
  },
  colors: {
    bg: { main: "#09090B", surface: "#18181B", elevated: "#27272A", overlay: "rgba(9, 9, 11, 0.95)", subtle: "rgba(255,255,255,0.02)" },
    primary: {
      DEFAULT: "#FF3D00", 50: "#FFF7ED", 100: "#FFEDD5", 200: "#FED7AA",
      300: "#FDBA74", 400: "#FB923C", 500: "#FF3D00", 600: "#EA580C",
      700: "#C2410C", 800: "#9A3412", 900: "#7C2D12",
    },
    accent: {
      DEFAULT: "#7C3AED", 50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE",
      300: "#C4B5FD", 400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED",
      700: "#6D28D9", 800: "#5B21B6", 900: "#4C1D95",
    },
    ...SHARED,
    info: { DEFAULT: "#3B82F6", light: "rgba(59,130,246,0.12)", dark: "#2563EB", 500: "#3B82F6", 800: "#1E40AF" },
    text: "#FAFAFA",
    muted: "#A1A1AA",
    border: "#3F3F46",
    border2: "#52525B",
    titlebar: { bg: "#09090B", text: "#A1A1AA", active: "#FF3D00", button: "#18181B", buttonHover: "#27272A", close: "#EF4444" },
    secondary: { DEFAULT: "#7C3AED", 500: "#7C3AED" },
    surface: "#18181B",
    panel: "#18181B",
    gray: {
      50: "#FAFAFA", 100: "#F4F4F5", 200: "#E4E4E7", 300: "#D4D4D8",
      400: "#A1A1AA", 500: "#71717A", 600: "#52525B", 700: "#3F3F46",
      800: "#27272A", 900: "#18181B",
    },
  },
};

// ── Light Navy ───────────────────────────────────────────────────────────────
const lightNavy: ThemeDef = {
  name: "lightNavy",
  label: "Light Navy",
  description: "Sadece lacivert ve beyaz — monokromatik kurumsal arayüz",
  category: "corporate",
  preview: { bg: "#EDF0F5", primary: "#1E3A5F", accent: "#4D7AB8" },
  primaryRgb: "30,58,95",
  design: {
    radius: { sm: 6, md: 8, lg: 12, xl: 16, "2xl": 20, "3xl": 28, full: 9999 },
    shadows: {
      xs: "0 1px 2px rgba(30,58,95,0.06)",
      sm: "0 2px 6px rgba(30,58,95,0.09), 0 1px 2px rgba(0,0,0,0.04)",
      md: "0 4px 12px rgba(30,58,95,0.11), 0 2px 4px rgba(0,0,0,0.05)",
      lg: "0 10px 24px rgba(30,58,95,0.13), 0 4px 8px rgba(0,0,0,0.06)",
      xl: "0 20px 40px rgba(30,58,95,0.15), 0 8px 16px rgba(0,0,0,0.06)",
      cardHover: "0 8px 24px rgba(30,58,95,0.16), 0 0 0 1px rgba(30,58,95,0.10)",
      glow: "0 0 0 3px rgba(30,58,95,0.18)",
    },
    typography: { headingWeight: 700, bodyWeight: 400, letterSpacing: "tight", lineHeight: "normal" },
    borders: { width: 1, style: "solid" },
  },
  colors: {
    bg: {
      main: "#EDF0F5",           // açık gri-beyaz sayfa zemini
      surface: "#FFFFFF",           // beyaz kart/panel
      elevated: "#E2E7F0",           // biraz daha koyu lacivert tonu
      overlay: "rgba(237,240,245,0.97)",
      subtle: "rgba(30,58,95,0.04)",
    },
    primary: {
      DEFAULT: "#1E3A5F",            // ana lacivert
      50: "#EEF2F8", 100: "#D5DFED", 200: "#ABBFDB",
      300: "#7A9CC4", 400: "#507CAD", 500: "#2F62A0",
      600: "#1E3A5F", 700: "#172E4A", 800: "#102136", 900: "#091522",
    },
    accent: {
      DEFAULT: "#4D7AB8",            // orta tonu lacivert (primary'den açık)
      50: "#EEF3FA", 100: "#D1DFF2", 200: "#A3BFE5",
      300: "#759ED7", 400: "#4D7AB8", 500: "#3A6099",
      600: "#2A4875", 700: "#1E3456", 800: "#122038", 900: "#080D1A",
    },
    // ── Semantic renkler: tamamı lacivert spektrumu ──────────────────────────
    // Yeşil YOK, sarı YOK, kırmızı YOK — sadece lacivert tonları
    success: {
      DEFAULT: "#1E3A5F",            // koyu lacivert (onay/tamamlandı)
      light: "rgba(30,58,95,0.10)",
      dark: "#172D4A",
    },
    warning: {
      DEFAULT: "#344060",            // orta-koyu lacivert (uyarı)
      light: "rgba(52,64,96,0.10)",
      dark: "#202D45",
      800: "#111B2D",
    },
    danger: {
      DEFAULT: "#202D45",            // koyu lacivert (hata/tehlike)
      light: "rgba(32,45,69,0.12)",
      dark: "#111B2D",
    },
    error: {
      DEFAULT: "#202D45",
      light: "rgba(32,45,69,0.12)",
      dark: "#111B2D",
    },
    info: {
      DEFAULT: "#4D7AB8",            // açık-orta lacivert
      light: "rgba(77,122,184,0.10)",
      dark: "#1E3A5F",
      500: "#4D7AB8",
      800: "#0E2338",
    },
    text: "#0D1B2E",              // en koyu lacivert (okunabilirlik)
    muted: "#4B5E7A",             // orta lacivert-gri
    border: "#C0CBDB",             // açık lacivert kenarlık
    border2: "#A4B3C8",
    titlebar: {
      bg: "#FFFFFF",
      text: "#4B5E7A",
      active: "#1E3A5F",
      button: "#EDF0F5",
      buttonHover: "#D5DFED",
      close: "#1E3A5F",        // kırmızı yok — lacivert çarpı
    },
    secondary: { DEFAULT: "#4B5E7A", 500: "#4B5E7A" },
    surface: "#FFFFFF",
    panel: "#FFFFFF",
    gray: {
      50: "#F8F9FC", 100: "#EDF0F5", 200: "#D5DFED",
      300: "#C0CBDB", 400: "#8FA0B8", 500: "#637894",
      600: "#4B5E7A", 700: "#344060", 800: "#202D45", 900: "#0D1B2E",
    },
  },
};

export const THEMES: Record<ThemeName, ThemeDef> = {
  neoCorporate,
  minimalStudio,
  industrialGrid,
  deepSpace,
  cleanProfessional,
  electricPulse,
  lightNavy,
};

export const THEME_LIST: ThemeDef[] = [
  lightNavy,
  electricPulse,
  deepSpace,
  cleanProfessional,
  neoCorporate,
  minimalStudio,
  industrialGrid,
];

export const DEFAULT_THEME: ThemeName = "electricPulse";

function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && value in THEMES;
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
    // ignore
  }
  return DEFAULT_THEME;
}

export function getActiveTheme(): ThemeDef {
  return THEMES[getStoredTheme()];
}

export function getThemeDesign() {
  return getActiveTheme().design;
}
