/**
 * Pillar 12 §3 — locked design tokens. Single source of truth for colours,
 * radius, spacing, type. Tailwind preset consumes these.
 */
export const tokens = {
  color: {
    bg: '#0b0d0e',
    surface: '#14181a',
    surface2: '#1a1f22',

    line: '#2a3136',
    line2: '#3a4248',

    text: '#e8ece9',
    mute: '#7d8a90',
    mute2: '#566268',

    // Action / Accent
    accent: '#f5d60a', // Volt yellow
    accentDim: '#8a7a10',

    // Semantic
    success: '#6cd29a',
    warning: '#ff8b3d',
    danger: '#ff5a5a',
    info: '#3dd8ff',
  },
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '8px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
  },
  fontFamily: {
    mono: '"JetBrains Mono", ui-monospace, monospace',
    sans: '"IBM Plex Sans Arabic", ui-sans-serif, system-ui',
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '22px',
  },
} as const;

export type AntagnaTokens = typeof tokens;
