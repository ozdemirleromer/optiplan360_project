/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-ui-theme="electricPulse"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Sora"', '"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', '"Sora"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'monospace'],
      },
      colors: {
        bg: {
          main: 'var(--bg-main)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-card-hover)',
        },
        text: {
          main: 'var(--text-main)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
        },
        border: {
          DEFAULT: 'var(--border)',
          highlight: 'var(--border-highlight)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          glow: 'var(--primary-glow)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          glow: 'var(--accent-glow)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        glow: 'var(--shadow-glow)',
        pulse: '0 0 0 1px rgba(var(--primary-rgb), 0.25), 0 0 32px rgba(var(--primary-rgb), 0.24)',
      },
      backgroundImage: {
        'electric-grid':
          'radial-gradient(circle at 18% -5%, rgba(var(--primary-rgb), 0.18), transparent 36%), radial-gradient(circle at 86% 6%, rgba(124, 58, 237, 0.18), transparent 34%), linear-gradient(180deg, rgba(10,10,13,0.95), rgba(9,9,11,0.98))',
        'aurora-pulse':
          'linear-gradient(120deg, rgba(var(--primary-rgb),0.28), rgba(124,58,237,0.28), rgba(56,189,248,0.24))',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'electric-float': 'electric-float 8s ease-in-out infinite',
        'electric-scan': 'electric-scan 1.8s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px var(--primary-glow)' },
          '100%': { boxShadow: '0 0 20px var(--primary-glow), 0 0 10px var(--primary)' },
        },
        'electric-float': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -6px, 0)' },
        },
        'electric-scan': {
          '0%': { transform: 'translateX(-110%)' },
          '100%': { transform: 'translateX(120%)' },
        },
      }
    },
  },
  plugins: [],
}
