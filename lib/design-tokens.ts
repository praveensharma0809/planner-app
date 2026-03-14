/**
 * StudyHard — Design Tokens
 *
 * Single source of truth for colors, spacing, radii, and shadow scales.
 * CSS variable counterparts are declared in app/globals.css under the
 * `--sh-*` and `--sidebar-*` namespaces.
 */

// ─── Colors ───────────────────────────────────────────────────

export const colors = {
  bg: {
    base:     '#0B0D12',
    surface:  '#11141B',
    elevated: '#161922',
    overlay:  '#1A1D27',
  },
  border: {
    subtle:  'rgba(255, 255, 255, 0.05)',
    default: 'rgba(255, 255, 255, 0.08)',
    strong:  'rgba(255, 255, 255, 0.12)',
  },
  primary: {
    DEFAULT: '#7C6CFF',
    light:   '#A89EFF',
    dark:    '#5E4FD9',
    muted:   'rgba(124, 108, 255, 0.14)',
    glow:    'rgba(124, 108, 255, 0.28)',
  },
  accent: {
    DEFAULT: '#9F7AEA',
    light:   '#B794F4',
    dark:    '#805AD5',
  },
  text: {
    primary:   '#F0F2F8',
    secondary: '#8B91A8',
    muted:     'rgba(255, 255, 255, 0.38)',
    disabled:  'rgba(255, 255, 255, 0.18)',
  },
  success: {
    DEFAULT: '#34D399',
    light:   '#6EE7B7',
    dark:    '#10B981',
    muted:   'rgba(52, 211, 153, 0.15)',
    glow:    'rgba(52, 211, 153, 0.25)',
  },
  warning: {
    DEFAULT: '#F59E0B',
    light:   '#FCD34D',
    dark:    '#D97706',
    muted:   'rgba(245, 158, 11, 0.15)',
    glow:    'rgba(245, 158, 11, 0.25)',
  },
  danger: {
    DEFAULT: '#EF4444',
    light:   '#FCA5A5',
    dark:    '#DC2626',
    muted:   'rgba(239, 68, 68, 0.15)',
    glow:    'rgba(239, 68, 68, 0.25)',
  },
} as const

// ─── Spacing (4 px grid) ──────────────────────────────────────

export const spacing = {
  '0':  '0px',
  '1':  '4px',
  '2':  '8px',
  '3':  '12px',
  '4':  '16px',
  '5':  '20px',
  '6':  '24px',
  '8':  '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
} as const

// ─── Border Radius ────────────────────────────────────────────

export const radius = {
  sm:   '6px',
  md:   '10px',
  lg:   '14px',
  xl:   '18px',
  '2xl':'24px',
  full: '9999px',
} as const

// ─── Shadows ──────────────────────────────────────────────────

export const shadow = {
  sm:      '0 1px 3px rgba(0, 0, 0, 0.30)',
  md:      '0 4px 12px rgba(0, 0, 0, 0.40)',
  lg:      '0 8px 30px rgba(0, 0, 0, 0.50)',
  xl:      '0 16px 50px rgba(0, 0, 0, 0.60)',
  primary: '0 4px 20px rgba(124, 108, 255, 0.30)',
  success: '0 4px 12px rgba(52, 211, 153, 0.25)',
  warning: '0 4px 12px rgba(245, 158, 11, 0.25)',
  danger:  '0 4px 12px rgba(239, 68, 68, 0.25)',
} as const

// ─── Composite export ─────────────────────────────────────────

const tokens = { colors, spacing, radius, shadow }
export default tokens
