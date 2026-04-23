// Theme palette type covering all CSS variables used in the app.
// Each theme provides both a light and dark variant for the UI,
// plus the corresponding Shiki theme name for code highlighting.

export type ThemePalette = {
  accent: string
  accentForeground: string
  background: string
  border: string
  card: string
  cardForeground: string
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
  destructive: string
  destructiveForeground: string
  foreground: string
  input: string
  muted: string
  mutedForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  ring: string
  secondary: string
  secondaryForeground: string
  sidebar: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarRing: string
  statusDanger: string
  statusDangerBorder: string
  statusDangerForeground: string
  statusMerged: string
  statusMergedBorder: string
  statusMergedForeground: string
  statusNeutral: string
  statusNeutralBorder: string
  statusNeutralForeground: string
  statusSuccess: string
  statusSuccessBorder: string
  statusSuccessForeground: string
  statusWarning: string
  statusWarningBorder: string
  statusWarningForeground: string
  titlebar: string
}

export type AppTheme = {
  dark: ThemePalette
  darkShikiTheme: string
  label: string
  light: ThemePalette
  lightShikiTheme: string
  modes: 'both' | 'dark' | 'light'
  value: string
}

// ---------------------------------------------------------------------------
// Neutral fallback palettes (Catppuccin Latte / Mocha).
// Used for themes that only have a dark or light variant.
// ---------------------------------------------------------------------------

const catppuccinLattePalette: ThemePalette = {
  accent: 'oklch(0.8 0.01 265)',
  accentForeground: 'oklch(0.42 0.03 280)',
  background: 'oklch(0.96 0.005 270)',
  border: 'oklch(0.876 0.017 268)',
  card: 'oklch(0.96 0.005 270)',
  cardForeground: 'oklch(0.42 0.03 280)',
  chart1: 'oklch(0.53 0.22 25)',
  chart2: 'oklch(0.65 0.18 55)',
  chart3: 'oklch(0.75 0.15 95)',
  chart4: 'oklch(0.6 0.18 155)',
  chart5: 'oklch(0.55 0.2 260)',
  destructive: 'oklch(0.53 0.22 25)',
  destructiveForeground: 'oklch(0.96 0.005 270)',
  foreground: 'oklch(0.42 0.03 280)',
  input: 'oklch(0.876 0.017 268)',
  muted: 'oklch(0.85 0.01 265)',
  mutedForeground: 'oklch(0.52 0.02 270)',
  popover: 'oklch(0.96 0.005 270)',
  popoverForeground: 'oklch(0.42 0.03 280)',
  primary: 'oklch(0.55 0.2 260)',
  primaryForeground: 'oklch(0.96 0.005 270)',
  ring: 'oklch(0.65 0.15 275)',
  secondary: 'oklch(0.85 0.01 265)',
  secondaryForeground: 'oklch(0.42 0.03 280)',
  sidebar: 'oklch(0.93 0.008 270)',
  sidebarAccent: 'oklch(0.85 0.01 265)',
  sidebarAccentForeground: 'oklch(0.42 0.03 280)',
  sidebarBorder: 'oklch(0.876 0.017 268)',
  sidebarForeground: 'oklch(0.42 0.03 280)',
  sidebarPrimary: 'oklch(0.55 0.2 260)',
  sidebarPrimaryForeground: 'oklch(0.96 0.005 270)',
  sidebarRing: 'oklch(0.65 0.15 275)',
  statusDanger: 'oklch(0.95 0.02 25)',
  statusDangerBorder: 'oklch(0.87 0.05 25)',
  statusDangerForeground: 'oklch(0.4 0.12 25)',
  statusMerged: 'oklch(0.95 0.02 300)',
  statusMergedBorder: 'oklch(0.87 0.05 300)',
  statusMergedForeground: 'oklch(0.4 0.12 300)',
  statusNeutral: 'oklch(0.95 0.005 270)',
  statusNeutralBorder: 'oklch(0.87 0.01 270)',
  statusNeutralForeground: 'oklch(0.45 0.02 270)',
  statusSuccess: 'oklch(0.96 0.02 150)',
  statusSuccessBorder: 'oklch(0.87 0.04 150)',
  statusSuccessForeground: 'oklch(0.4 0.1 150)',
  statusWarning: 'oklch(0.96 0.03 80)',
  statusWarningBorder: 'oklch(0.87 0.05 80)',
  statusWarningForeground: 'oklch(0.4 0.1 80)',
  titlebar: 'oklch(0.909 0.012 265)'
}

const catppuccinMochaPalette: ThemePalette = {
  accent: 'oklch(0.36 0.02 275)',
  accentForeground: 'oklch(0.87 0.03 275)',
  background: 'oklch(0.22 0.02 280)',
  border: 'oklch(0.36 0.02 275)',
  card: 'oklch(0.27 0.02 278)',
  cardForeground: 'oklch(0.87 0.03 275)',
  chart1: 'oklch(0.72 0.14 10)',
  chart2: 'oklch(0.75 0.14 55)',
  chart3: 'oklch(0.85 0.12 95)',
  chart4: 'oklch(0.7 0.16 155)',
  chart5: 'oklch(0.77 0.12 255)',
  destructive: 'oklch(0.72 0.14 10)',
  destructiveForeground: 'oklch(0.22 0.02 280)',
  foreground: 'oklch(0.87 0.03 275)',
  input: 'oklch(0.36 0.02 275)',
  muted: 'oklch(0.29 0.02 275)',
  mutedForeground: 'oklch(0.73 0.02 270)',
  popover: 'oklch(0.22 0.02 280)',
  popoverForeground: 'oklch(0.87 0.03 275)',
  primary: 'oklch(0.77 0.12 255)',
  primaryForeground: 'oklch(0.22 0.02 280)',
  ring: 'oklch(0.8 0.1 275)',
  secondary: 'oklch(0.29 0.02 275)',
  secondaryForeground: 'oklch(0.87 0.03 275)',
  sidebar: 'oklch(0.19 0.02 280)',
  sidebarAccent: 'oklch(0.29 0.02 275)',
  sidebarAccentForeground: 'oklch(0.87 0.03 275)',
  sidebarBorder: 'oklch(0.36 0.02 275)',
  sidebarForeground: 'oklch(0.87 0.03 275)',
  sidebarPrimary: 'oklch(0.77 0.12 255)',
  sidebarPrimaryForeground: 'oklch(0.22 0.02 280)',
  sidebarRing: 'oklch(0.8 0.1 275)',
  statusDanger: 'oklch(0.27 0.03 25)',
  statusDangerBorder: 'oklch(0.38 0.05 25)',
  statusDangerForeground: 'oklch(0.82 0.08 25)',
  statusMerged: 'oklch(0.27 0.03 300)',
  statusMergedBorder: 'oklch(0.38 0.05 300)',
  statusMergedForeground: 'oklch(0.82 0.08 300)',
  statusNeutral: 'oklch(0.27 0.005 270)',
  statusNeutralBorder: 'oklch(0.38 0.01 270)',
  statusNeutralForeground: 'oklch(0.82 0.02 270)',
  statusSuccess: 'oklch(0.27 0.03 150)',
  statusSuccessBorder: 'oklch(0.38 0.04 150)',
  statusSuccessForeground: 'oklch(0.82 0.08 150)',
  statusWarning: 'oklch(0.27 0.03 80)',
  statusWarningBorder: 'oklch(0.38 0.05 80)',
  statusWarningForeground: 'oklch(0.82 0.08 80)',
  titlebar: 'oklch(0.22 0.02 280)'
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

export const appThemes: AppTheme[] = [
  // --- Catppuccin Latte (light) - default light theme ---
  {
    dark: catppuccinLattePalette,
    darkShikiTheme: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'light',
    value: 'catppuccin-latte'
  },

  // --- Catppuccin Mocha (dark) - default dark theme ---
  {
    dark: catppuccinMochaPalette,
    darkShikiTheme: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    light: catppuccinMochaPalette,
    lightShikiTheme: 'catppuccin-mocha',
    modes: 'dark',
    value: 'catppuccin-mocha'
  },

  // --- Catppuccin Frappé (dark only, Latte for light) ---
  {
    dark: {
      ...catppuccinMochaPalette,
      accent: 'oklch(0.42 0.02 270)',
      accentForeground: 'oklch(0.85 0.03 270)',
      background: 'oklch(0.3 0.02 270)',
      border: 'oklch(0.42 0.02 270)',
      card: 'oklch(0.34 0.02 268)',
      cardForeground: 'oklch(0.85 0.03 270)',
      foreground: 'oklch(0.85 0.03 270)',
      input: 'oklch(0.42 0.02 270)',
      muted: 'oklch(0.36 0.02 270)',
      mutedForeground: 'oklch(0.7 0.02 268)',
      popover: 'oklch(0.3 0.02 270)',
      popoverForeground: 'oklch(0.85 0.03 270)',
      primary: 'oklch(0.72 0.12 250)',
      primaryForeground: 'oklch(0.3 0.02 270)',
      ring: 'oklch(0.72 0.1 270)',
      secondary: 'oklch(0.36 0.02 270)',
      secondaryForeground: 'oklch(0.85 0.03 270)',
      sidebar: 'oklch(0.27 0.02 270)',
      sidebarAccent: 'oklch(0.36 0.02 270)',
      sidebarAccentForeground: 'oklch(0.85 0.03 270)',
      sidebarBorder: 'oklch(0.42 0.02 270)',
      sidebarForeground: 'oklch(0.85 0.03 270)',
      sidebarPrimary: 'oklch(0.72 0.12 250)',
      sidebarPrimaryForeground: 'oklch(0.3 0.02 270)',
      sidebarRing: 'oklch(0.72 0.1 270)',
      titlebar: 'oklch(0.3 0.02 270)'
    },
    darkShikiTheme: 'catppuccin-frappe',
    label: 'Catppuccin Frappé',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'dark',
    value: 'catppuccin-frappe'
  },

  // --- Catppuccin Macchiato (dark only, Latte for light) ---
  {
    dark: {
      ...catppuccinMochaPalette,
      accent: 'oklch(0.38 0.02 278)',
      accentForeground: 'oklch(0.86 0.03 276)',
      background: 'oklch(0.25 0.02 278)',
      border: 'oklch(0.38 0.02 278)',
      card: 'oklch(0.3 0.02 276)',
      cardForeground: 'oklch(0.86 0.03 276)',
      foreground: 'oklch(0.86 0.03 276)',
      input: 'oklch(0.38 0.02 278)',
      muted: 'oklch(0.32 0.02 276)',
      mutedForeground: 'oklch(0.72 0.02 272)',
      popover: 'oklch(0.25 0.02 278)',
      popoverForeground: 'oklch(0.86 0.03 276)',
      primary: 'oklch(0.74 0.12 252)',
      primaryForeground: 'oklch(0.25 0.02 278)',
      ring: 'oklch(0.76 0.1 276)',
      secondary: 'oklch(0.32 0.02 276)',
      secondaryForeground: 'oklch(0.86 0.03 276)',
      sidebar: 'oklch(0.22 0.02 278)',
      sidebarAccent: 'oklch(0.32 0.02 276)',
      sidebarAccentForeground: 'oklch(0.86 0.03 276)',
      sidebarBorder: 'oklch(0.38 0.02 278)',
      sidebarForeground: 'oklch(0.86 0.03 276)',
      sidebarPrimary: 'oklch(0.74 0.12 252)',
      sidebarPrimaryForeground: 'oklch(0.25 0.02 278)',
      sidebarRing: 'oklch(0.76 0.1 276)',
      titlebar: 'oklch(0.25 0.02 278)'
    },
    darkShikiTheme: 'catppuccin-macchiato',
    label: 'Catppuccin Macchiato',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'dark',
    value: 'catppuccin-macchiato'
  },

  // --- Dracula (dark only, neutral light fallback) ---
  {
    dark: {
      accent: 'oklch(0.38 0.03 270)',
      accentForeground: 'oklch(0.92 0.01 280)',
      background: 'oklch(0.25 0.03 280)',
      border: 'oklch(0.38 0.03 270)',
      card: 'oklch(0.3 0.03 278)',
      cardForeground: 'oklch(0.92 0.01 280)',
      chart1: 'oklch(0.72 0.16 350)',
      chart2: 'oklch(0.75 0.15 145)',
      chart3: 'oklch(0.82 0.12 80)',
      chart4: 'oklch(0.7 0.18 280)',
      chart5: 'oklch(0.68 0.15 10)',
      destructive: 'oklch(0.72 0.16 350)',
      destructiveForeground: 'oklch(0.25 0.03 280)',
      foreground: 'oklch(0.92 0.01 280)',
      input: 'oklch(0.38 0.03 270)',
      muted: 'oklch(0.32 0.03 275)',
      mutedForeground: 'oklch(0.68 0.02 270)',
      popover: 'oklch(0.25 0.03 280)',
      popoverForeground: 'oklch(0.92 0.01 280)',
      primary: 'oklch(0.72 0.18 280)',
      primaryForeground: 'oklch(0.25 0.03 280)',
      ring: 'oklch(0.72 0.18 280)',
      secondary: 'oklch(0.32 0.03 275)',
      secondaryForeground: 'oklch(0.92 0.01 280)',
      sidebar: 'oklch(0.22 0.03 280)',
      sidebarAccent: 'oklch(0.32 0.03 275)',
      sidebarAccentForeground: 'oklch(0.92 0.01 280)',
      sidebarBorder: 'oklch(0.38 0.03 270)',
      sidebarForeground: 'oklch(0.92 0.01 280)',
      sidebarPrimary: 'oklch(0.72 0.18 280)',
      sidebarPrimaryForeground: 'oklch(0.25 0.03 280)',
      sidebarRing: 'oklch(0.72 0.18 280)',
      statusDanger: 'oklch(0.3 0.04 350)',
      statusDangerBorder: 'oklch(0.4 0.06 350)',
      statusDangerForeground: 'oklch(0.82 0.08 350)',
      statusMerged: 'oklch(0.3 0.04 280)',
      statusMergedBorder: 'oklch(0.4 0.06 280)',
      statusMergedForeground: 'oklch(0.82 0.08 280)',
      statusNeutral: 'oklch(0.3 0.005 270)',
      statusNeutralBorder: 'oklch(0.4 0.01 270)',
      statusNeutralForeground: 'oklch(0.82 0.02 270)',
      statusSuccess: 'oklch(0.3 0.04 145)',
      statusSuccessBorder: 'oklch(0.4 0.06 145)',
      statusSuccessForeground: 'oklch(0.82 0.08 145)',
      statusWarning: 'oklch(0.3 0.04 80)',
      statusWarningBorder: 'oklch(0.4 0.06 80)',
      statusWarningForeground: 'oklch(0.82 0.08 80)',
      titlebar: 'oklch(0.25 0.03 280)'
    },
    darkShikiTheme: 'dracula',
    label: 'Dracula',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'dark',
    value: 'dracula'
  },

  // --- GitHub (Light / Dark) ---
  {
    dark: {
      accent: 'oklch(0.33 0.015 220)',
      accentForeground: 'oklch(0.9 0.01 220)',
      background: 'oklch(0.18 0.01 250)',
      border: 'oklch(0.35 0.015 220)',
      card: 'oklch(0.22 0.01 245)',
      cardForeground: 'oklch(0.9 0.01 220)',
      chart1: 'oklch(0.65 0.16 20)',
      chart2: 'oklch(0.7 0.14 55)',
      chart3: 'oklch(0.75 0.12 95)',
      chart4: 'oklch(0.6 0.15 155)',
      chart5: 'oklch(0.65 0.15 250)',
      destructive: 'oklch(0.65 0.2 25)',
      destructiveForeground: 'oklch(0.18 0.01 250)',
      foreground: 'oklch(0.9 0.01 220)',
      input: 'oklch(0.35 0.015 220)',
      muted: 'oklch(0.26 0.012 225)',
      mutedForeground: 'oklch(0.65 0.015 220)',
      popover: 'oklch(0.2 0.01 245)',
      popoverForeground: 'oklch(0.9 0.01 220)',
      primary: 'oklch(0.65 0.15 250)',
      primaryForeground: 'oklch(0.98 0.005 220)',
      ring: 'oklch(0.65 0.15 250)',
      secondary: 'oklch(0.26 0.012 225)',
      secondaryForeground: 'oklch(0.9 0.01 220)',
      sidebar: 'oklch(0.16 0.01 250)',
      sidebarAccent: 'oklch(0.26 0.012 225)',
      sidebarAccentForeground: 'oklch(0.9 0.01 220)',
      sidebarBorder: 'oklch(0.35 0.015 220)',
      sidebarForeground: 'oklch(0.9 0.01 220)',
      sidebarPrimary: 'oklch(0.65 0.15 250)',
      sidebarPrimaryForeground: 'oklch(0.98 0.005 220)',
      sidebarRing: 'oklch(0.65 0.15 250)',
      statusDanger: 'oklch(0.24 0.03 25)',
      statusDangerBorder: 'oklch(0.35 0.05 25)',
      statusDangerForeground: 'oklch(0.8 0.08 25)',
      statusMerged: 'oklch(0.24 0.03 290)',
      statusMergedBorder: 'oklch(0.35 0.05 290)',
      statusMergedForeground: 'oklch(0.8 0.08 290)',
      statusNeutral: 'oklch(0.24 0.005 220)',
      statusNeutralBorder: 'oklch(0.35 0.01 220)',
      statusNeutralForeground: 'oklch(0.8 0.02 220)',
      statusSuccess: 'oklch(0.24 0.03 150)',
      statusSuccessBorder: 'oklch(0.35 0.05 150)',
      statusSuccessForeground: 'oklch(0.8 0.08 150)',
      statusWarning: 'oklch(0.24 0.03 80)',
      statusWarningBorder: 'oklch(0.35 0.05 80)',
      statusWarningForeground: 'oklch(0.8 0.08 80)',
      titlebar: 'oklch(0.18 0.01 250)'
    },
    darkShikiTheme: 'github-dark',
    label: 'GitHub',
    light: {
      accent: 'oklch(0.93 0.008 220)',
      accentForeground: 'oklch(0.3 0.03 220)',
      background: 'oklch(0.99 0.002 220)',
      border: 'oklch(0.88 0.01 220)',
      card: 'oklch(0.99 0.002 220)',
      cardForeground: 'oklch(0.3 0.03 220)',
      chart1: 'oklch(0.55 0.2 25)',
      chart2: 'oklch(0.65 0.16 55)',
      chart3: 'oklch(0.7 0.14 95)',
      chart4: 'oklch(0.55 0.16 155)',
      chart5: 'oklch(0.55 0.18 250)',
      destructive: 'oklch(0.55 0.22 25)',
      destructiveForeground: 'oklch(0.99 0.002 220)',
      foreground: 'oklch(0.3 0.03 220)',
      input: 'oklch(0.88 0.01 220)',
      muted: 'oklch(0.94 0.006 220)',
      mutedForeground: 'oklch(0.55 0.015 220)',
      popover: 'oklch(0.99 0.002 220)',
      popoverForeground: 'oklch(0.3 0.03 220)',
      primary: 'oklch(0.55 0.18 250)',
      primaryForeground: 'oklch(0.99 0.002 220)',
      ring: 'oklch(0.55 0.18 250)',
      secondary: 'oklch(0.94 0.006 220)',
      secondaryForeground: 'oklch(0.3 0.03 220)',
      sidebar: 'oklch(0.97 0.003 220)',
      sidebarAccent: 'oklch(0.94 0.006 220)',
      sidebarAccentForeground: 'oklch(0.3 0.03 220)',
      sidebarBorder: 'oklch(0.88 0.01 220)',
      sidebarForeground: 'oklch(0.3 0.03 220)',
      sidebarPrimary: 'oklch(0.55 0.18 250)',
      sidebarPrimaryForeground: 'oklch(0.99 0.002 220)',
      sidebarRing: 'oklch(0.55 0.18 250)',
      statusDanger: 'oklch(0.96 0.02 25)',
      statusDangerBorder: 'oklch(0.88 0.04 25)',
      statusDangerForeground: 'oklch(0.4 0.12 25)',
      statusMerged: 'oklch(0.96 0.02 290)',
      statusMergedBorder: 'oklch(0.88 0.04 290)',
      statusMergedForeground: 'oklch(0.4 0.12 290)',
      statusNeutral: 'oklch(0.96 0.004 220)',
      statusNeutralBorder: 'oklch(0.88 0.008 220)',
      statusNeutralForeground: 'oklch(0.45 0.02 220)',
      statusSuccess: 'oklch(0.96 0.02 150)',
      statusSuccessBorder: 'oklch(0.88 0.04 150)',
      statusSuccessForeground: 'oklch(0.4 0.1 150)',
      statusWarning: 'oklch(0.96 0.03 80)',
      statusWarningBorder: 'oklch(0.88 0.05 80)',
      statusWarningForeground: 'oklch(0.4 0.1 80)',
      titlebar: 'oklch(0.97 0.003 220)'
    },
    lightShikiTheme: 'github-light',
    modes: 'both',
    value: 'github'
  },

  // --- Light+ (VS Code) (light only, neutral dark fallback) ---
  {
    dark: catppuccinMochaPalette,
    darkShikiTheme: 'catppuccin-mocha',
    label: 'Light+ (VS Code)',
    light: {
      accent: 'oklch(0.93 0.006 240)',
      accentForeground: 'oklch(0.25 0.02 240)',
      background: 'oklch(0.99 0.001 240)',
      border: 'oklch(0.87 0.008 240)',
      card: 'oklch(0.99 0.001 240)',
      cardForeground: 'oklch(0.25 0.02 240)',
      chart1: 'oklch(0.55 0.22 25)',
      chart2: 'oklch(0.65 0.16 55)',
      chart3: 'oklch(0.7 0.14 95)',
      chart4: 'oklch(0.55 0.16 155)',
      chart5: 'oklch(0.5 0.2 240)',
      destructive: 'oklch(0.55 0.22 25)',
      destructiveForeground: 'oklch(0.99 0.001 240)',
      foreground: 'oklch(0.25 0.02 240)',
      input: 'oklch(0.87 0.008 240)',
      muted: 'oklch(0.94 0.005 240)',
      mutedForeground: 'oklch(0.52 0.015 240)',
      popover: 'oklch(0.99 0.001 240)',
      popoverForeground: 'oklch(0.25 0.02 240)',
      primary: 'oklch(0.5 0.2 240)',
      primaryForeground: 'oklch(0.99 0.001 240)',
      ring: 'oklch(0.5 0.2 240)',
      secondary: 'oklch(0.94 0.005 240)',
      secondaryForeground: 'oklch(0.25 0.02 240)',
      sidebar: 'oklch(0.96 0.003 240)',
      sidebarAccent: 'oklch(0.94 0.005 240)',
      sidebarAccentForeground: 'oklch(0.25 0.02 240)',
      sidebarBorder: 'oklch(0.87 0.008 240)',
      sidebarForeground: 'oklch(0.25 0.02 240)',
      sidebarPrimary: 'oklch(0.5 0.2 240)',
      sidebarPrimaryForeground: 'oklch(0.99 0.001 240)',
      sidebarRing: 'oklch(0.5 0.2 240)',
      statusDanger: 'oklch(0.96 0.02 25)',
      statusDangerBorder: 'oklch(0.88 0.04 25)',
      statusDangerForeground: 'oklch(0.4 0.12 25)',
      statusMerged: 'oklch(0.96 0.02 300)',
      statusMergedBorder: 'oklch(0.88 0.04 300)',
      statusMergedForeground: 'oklch(0.4 0.12 300)',
      statusNeutral: 'oklch(0.96 0.004 240)',
      statusNeutralBorder: 'oklch(0.88 0.008 240)',
      statusNeutralForeground: 'oklch(0.45 0.02 240)',
      statusSuccess: 'oklch(0.96 0.02 150)',
      statusSuccessBorder: 'oklch(0.88 0.04 150)',
      statusSuccessForeground: 'oklch(0.4 0.1 150)',
      statusWarning: 'oklch(0.96 0.03 80)',
      statusWarningBorder: 'oklch(0.88 0.05 80)',
      statusWarningForeground: 'oklch(0.4 0.1 80)',
      titlebar: 'oklch(0.96 0.003 240)'
    },
    lightShikiTheme: 'light-plus',
    modes: 'light',
    value: 'light-plus'
  },

  // --- Min Light (light only, neutral dark fallback) ---
  {
    dark: catppuccinMochaPalette,
    darkShikiTheme: 'catppuccin-mocha',
    label: 'Min Light',
    light: {
      accent: 'oklch(0.93 0.003 0)',
      accentForeground: 'oklch(0.2 0.01 0)',
      background: 'oklch(0.99 0.001 0)',
      border: 'oklch(0.88 0.005 0)',
      card: 'oklch(0.99 0.001 0)',
      cardForeground: 'oklch(0.2 0.01 0)',
      chart1: 'oklch(0.55 0.2 25)',
      chart2: 'oklch(0.65 0.16 55)',
      chart3: 'oklch(0.7 0.14 95)',
      chart4: 'oklch(0.55 0.16 155)',
      chart5: 'oklch(0.5 0.18 250)',
      destructive: 'oklch(0.55 0.22 25)',
      destructiveForeground: 'oklch(0.99 0.001 0)',
      foreground: 'oklch(0.2 0.01 0)',
      input: 'oklch(0.88 0.005 0)',
      muted: 'oklch(0.95 0.003 0)',
      mutedForeground: 'oklch(0.55 0.01 0)',
      popover: 'oklch(0.99 0.001 0)',
      popoverForeground: 'oklch(0.2 0.01 0)',
      primary: 'oklch(0.5 0.18 250)',
      primaryForeground: 'oklch(0.99 0.001 0)',
      ring: 'oklch(0.5 0.18 250)',
      secondary: 'oklch(0.95 0.003 0)',
      secondaryForeground: 'oklch(0.2 0.01 0)',
      sidebar: 'oklch(0.97 0.002 0)',
      sidebarAccent: 'oklch(0.95 0.003 0)',
      sidebarAccentForeground: 'oklch(0.2 0.01 0)',
      sidebarBorder: 'oklch(0.88 0.005 0)',
      sidebarForeground: 'oklch(0.2 0.01 0)',
      sidebarPrimary: 'oklch(0.5 0.18 250)',
      sidebarPrimaryForeground: 'oklch(0.99 0.001 0)',
      sidebarRing: 'oklch(0.5 0.18 250)',
      statusDanger: 'oklch(0.96 0.02 25)',
      statusDangerBorder: 'oklch(0.88 0.04 25)',
      statusDangerForeground: 'oklch(0.4 0.12 25)',
      statusMerged: 'oklch(0.96 0.02 300)',
      statusMergedBorder: 'oklch(0.88 0.04 300)',
      statusMergedForeground: 'oklch(0.4 0.12 300)',
      statusNeutral: 'oklch(0.96 0.003 0)',
      statusNeutralBorder: 'oklch(0.88 0.005 0)',
      statusNeutralForeground: 'oklch(0.45 0.01 0)',
      statusSuccess: 'oklch(0.96 0.02 150)',
      statusSuccessBorder: 'oklch(0.88 0.04 150)',
      statusSuccessForeground: 'oklch(0.4 0.1 150)',
      statusWarning: 'oklch(0.96 0.03 80)',
      statusWarningBorder: 'oklch(0.88 0.05 80)',
      statusWarningForeground: 'oklch(0.4 0.1 80)',
      titlebar: 'oklch(0.97 0.002 0)'
    },
    lightShikiTheme: 'min-light',
    modes: 'light',
    value: 'min-light'
  },

  // --- Monokai (dark only, neutral light fallback) ---
  {
    dark: {
      accent: 'oklch(0.35 0.02 85)',
      accentForeground: 'oklch(0.92 0.01 85)',
      background: 'oklch(0.24 0.015 85)',
      border: 'oklch(0.37 0.02 85)',
      card: 'oklch(0.28 0.015 85)',
      cardForeground: 'oklch(0.92 0.01 85)',
      chart1: 'oklch(0.72 0.16 350)',
      chart2: 'oklch(0.8 0.14 100)',
      chart3: 'oklch(0.7 0.18 55)',
      chart4: 'oklch(0.65 0.2 300)',
      chart5: 'oklch(0.65 0.15 200)',
      destructive: 'oklch(0.72 0.16 350)',
      destructiveForeground: 'oklch(0.24 0.015 85)',
      foreground: 'oklch(0.92 0.01 85)',
      input: 'oklch(0.37 0.02 85)',
      muted: 'oklch(0.32 0.015 85)',
      mutedForeground: 'oklch(0.65 0.015 85)',
      popover: 'oklch(0.24 0.015 85)',
      popoverForeground: 'oklch(0.92 0.01 85)',
      primary: 'oklch(0.8 0.14 100)',
      primaryForeground: 'oklch(0.24 0.015 85)',
      ring: 'oklch(0.8 0.14 100)',
      secondary: 'oklch(0.32 0.015 85)',
      secondaryForeground: 'oklch(0.92 0.01 85)',
      sidebar: 'oklch(0.21 0.015 85)',
      sidebarAccent: 'oklch(0.32 0.015 85)',
      sidebarAccentForeground: 'oklch(0.92 0.01 85)',
      sidebarBorder: 'oklch(0.37 0.02 85)',
      sidebarForeground: 'oklch(0.92 0.01 85)',
      sidebarPrimary: 'oklch(0.8 0.14 100)',
      sidebarPrimaryForeground: 'oklch(0.24 0.015 85)',
      sidebarRing: 'oklch(0.8 0.14 100)',
      statusDanger: 'oklch(0.28 0.03 350)',
      statusDangerBorder: 'oklch(0.38 0.05 350)',
      statusDangerForeground: 'oklch(0.82 0.08 350)',
      statusMerged: 'oklch(0.28 0.03 300)',
      statusMergedBorder: 'oklch(0.38 0.05 300)',
      statusMergedForeground: 'oklch(0.82 0.08 300)',
      statusNeutral: 'oklch(0.28 0.005 85)',
      statusNeutralBorder: 'oklch(0.38 0.01 85)',
      statusNeutralForeground: 'oklch(0.82 0.02 85)',
      statusSuccess: 'oklch(0.28 0.03 100)',
      statusSuccessBorder: 'oklch(0.38 0.05 100)',
      statusSuccessForeground: 'oklch(0.82 0.08 100)',
      statusWarning: 'oklch(0.28 0.03 55)',
      statusWarningBorder: 'oklch(0.38 0.05 55)',
      statusWarningForeground: 'oklch(0.82 0.08 55)',
      titlebar: 'oklch(0.24 0.015 85)'
    },
    darkShikiTheme: 'monokai',
    label: 'Monokai',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'dark',
    value: 'monokai'
  },

  // --- Nord (dark only, neutral light fallback) ---
  {
    dark: {
      accent: 'oklch(0.38 0.02 230)',
      accentForeground: 'oklch(0.88 0.01 230)',
      background: 'oklch(0.27 0.02 240)',
      border: 'oklch(0.38 0.02 230)',
      card: 'oklch(0.31 0.02 235)',
      cardForeground: 'oklch(0.88 0.01 230)',
      chart1: 'oklch(0.68 0.12 15)',
      chart2: 'oklch(0.72 0.1 55)',
      chart3: 'oklch(0.78 0.1 100)',
      chart4: 'oklch(0.7 0.1 190)',
      chart5: 'oklch(0.65 0.1 260)',
      destructive: 'oklch(0.68 0.12 15)',
      destructiveForeground: 'oklch(0.27 0.02 240)',
      foreground: 'oklch(0.88 0.01 230)',
      input: 'oklch(0.38 0.02 230)',
      muted: 'oklch(0.34 0.02 235)',
      mutedForeground: 'oklch(0.65 0.015 230)',
      popover: 'oklch(0.27 0.02 240)',
      popoverForeground: 'oklch(0.88 0.01 230)',
      primary: 'oklch(0.7 0.1 230)',
      primaryForeground: 'oklch(0.27 0.02 240)',
      ring: 'oklch(0.7 0.1 230)',
      secondary: 'oklch(0.34 0.02 235)',
      secondaryForeground: 'oklch(0.88 0.01 230)',
      sidebar: 'oklch(0.24 0.02 240)',
      sidebarAccent: 'oklch(0.34 0.02 235)',
      sidebarAccentForeground: 'oklch(0.88 0.01 230)',
      sidebarBorder: 'oklch(0.38 0.02 230)',
      sidebarForeground: 'oklch(0.88 0.01 230)',
      sidebarPrimary: 'oklch(0.7 0.1 230)',
      sidebarPrimaryForeground: 'oklch(0.27 0.02 240)',
      sidebarRing: 'oklch(0.7 0.1 230)',
      statusDanger: 'oklch(0.3 0.03 15)',
      statusDangerBorder: 'oklch(0.4 0.05 15)',
      statusDangerForeground: 'oklch(0.8 0.06 15)',
      statusMerged: 'oklch(0.3 0.03 300)',
      statusMergedBorder: 'oklch(0.4 0.05 300)',
      statusMergedForeground: 'oklch(0.8 0.06 300)',
      statusNeutral: 'oklch(0.3 0.005 230)',
      statusNeutralBorder: 'oklch(0.4 0.01 230)',
      statusNeutralForeground: 'oklch(0.8 0.02 230)',
      statusSuccess: 'oklch(0.3 0.03 150)',
      statusSuccessBorder: 'oklch(0.4 0.05 150)',
      statusSuccessForeground: 'oklch(0.8 0.06 150)',
      statusWarning: 'oklch(0.3 0.03 80)',
      statusWarningBorder: 'oklch(0.4 0.05 80)',
      statusWarningForeground: 'oklch(0.8 0.06 80)',
      titlebar: 'oklch(0.27 0.02 240)'
    },
    darkShikiTheme: 'nord',
    label: 'Nord',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'dark',
    value: 'nord'
  },

  // --- One Dark Pro (dark only, neutral light fallback) ---
  {
    dark: {
      accent: 'oklch(0.36 0.015 230)',
      accentForeground: 'oklch(0.85 0.01 230)',
      background: 'oklch(0.25 0.015 240)',
      border: 'oklch(0.36 0.015 230)',
      card: 'oklch(0.29 0.015 235)',
      cardForeground: 'oklch(0.85 0.01 230)',
      chart1: 'oklch(0.7 0.14 15)',
      chart2: 'oklch(0.72 0.12 55)',
      chart3: 'oklch(0.78 0.12 100)',
      chart4: 'oklch(0.65 0.14 190)',
      chart5: 'oklch(0.65 0.16 260)',
      destructive: 'oklch(0.7 0.14 15)',
      destructiveForeground: 'oklch(0.25 0.015 240)',
      foreground: 'oklch(0.85 0.01 230)',
      input: 'oklch(0.36 0.015 230)',
      muted: 'oklch(0.32 0.015 235)',
      mutedForeground: 'oklch(0.62 0.012 230)',
      popover: 'oklch(0.25 0.015 240)',
      popoverForeground: 'oklch(0.85 0.01 230)',
      primary: 'oklch(0.65 0.16 260)',
      primaryForeground: 'oklch(0.25 0.015 240)',
      ring: 'oklch(0.65 0.16 260)',
      secondary: 'oklch(0.32 0.015 235)',
      secondaryForeground: 'oklch(0.85 0.01 230)',
      sidebar: 'oklch(0.22 0.015 240)',
      sidebarAccent: 'oklch(0.32 0.015 235)',
      sidebarAccentForeground: 'oklch(0.85 0.01 230)',
      sidebarBorder: 'oklch(0.36 0.015 230)',
      sidebarForeground: 'oklch(0.85 0.01 230)',
      sidebarPrimary: 'oklch(0.65 0.16 260)',
      sidebarPrimaryForeground: 'oklch(0.25 0.015 240)',
      sidebarRing: 'oklch(0.65 0.16 260)',
      statusDanger: 'oklch(0.28 0.03 15)',
      statusDangerBorder: 'oklch(0.38 0.05 15)',
      statusDangerForeground: 'oklch(0.8 0.08 15)',
      statusMerged: 'oklch(0.28 0.03 300)',
      statusMergedBorder: 'oklch(0.38 0.05 300)',
      statusMergedForeground: 'oklch(0.8 0.08 300)',
      statusNeutral: 'oklch(0.28 0.005 230)',
      statusNeutralBorder: 'oklch(0.38 0.01 230)',
      statusNeutralForeground: 'oklch(0.8 0.02 230)',
      statusSuccess: 'oklch(0.28 0.03 150)',
      statusSuccessBorder: 'oklch(0.38 0.05 150)',
      statusSuccessForeground: 'oklch(0.8 0.08 150)',
      statusWarning: 'oklch(0.28 0.03 80)',
      statusWarningBorder: 'oklch(0.38 0.05 80)',
      statusWarningForeground: 'oklch(0.8 0.08 80)',
      titlebar: 'oklch(0.25 0.015 240)'
    },
    darkShikiTheme: 'one-dark-pro',
    label: 'One Dark Pro',
    light: catppuccinLattePalette,
    lightShikiTheme: 'catppuccin-latte',
    modes: 'dark',
    value: 'one-dark-pro'
  },

  // --- Solarized (Light / Dark) ---
  {
    dark: {
      accent: 'oklch(0.3 0.03 205)',
      accentForeground: 'oklch(0.8 0.03 195)',
      background: 'oklch(0.15 0.04 205)',
      border: 'oklch(0.32 0.03 200)',
      card: 'oklch(0.2 0.04 205)',
      cardForeground: 'oklch(0.8 0.03 195)',
      chart1: 'oklch(0.62 0.18 25)',
      chart2: 'oklch(0.68 0.14 55)',
      chart3: 'oklch(0.72 0.12 100)',
      chart4: 'oklch(0.62 0.12 175)',
      chart5: 'oklch(0.58 0.18 260)',
      destructive: 'oklch(0.62 0.18 25)',
      destructiveForeground: 'oklch(0.15 0.04 205)',
      foreground: 'oklch(0.8 0.03 195)',
      input: 'oklch(0.32 0.03 200)',
      muted: 'oklch(0.24 0.035 205)',
      mutedForeground: 'oklch(0.6 0.03 200)',
      popover: 'oklch(0.15 0.04 205)',
      popoverForeground: 'oklch(0.8 0.03 195)',
      primary: 'oklch(0.58 0.18 260)',
      primaryForeground: 'oklch(0.15 0.04 205)',
      ring: 'oklch(0.58 0.18 260)',
      secondary: 'oklch(0.24 0.035 205)',
      secondaryForeground: 'oklch(0.8 0.03 195)',
      sidebar: 'oklch(0.13 0.04 205)',
      sidebarAccent: 'oklch(0.24 0.035 205)',
      sidebarAccentForeground: 'oklch(0.8 0.03 195)',
      sidebarBorder: 'oklch(0.32 0.03 200)',
      sidebarForeground: 'oklch(0.8 0.03 195)',
      sidebarPrimary: 'oklch(0.58 0.18 260)',
      sidebarPrimaryForeground: 'oklch(0.15 0.04 205)',
      sidebarRing: 'oklch(0.58 0.18 260)',
      statusDanger: 'oklch(0.2 0.04 25)',
      statusDangerBorder: 'oklch(0.32 0.06 25)',
      statusDangerForeground: 'oklch(0.78 0.08 25)',
      statusMerged: 'oklch(0.2 0.04 300)',
      statusMergedBorder: 'oklch(0.32 0.06 300)',
      statusMergedForeground: 'oklch(0.78 0.08 300)',
      statusNeutral: 'oklch(0.2 0.005 200)',
      statusNeutralBorder: 'oklch(0.32 0.01 200)',
      statusNeutralForeground: 'oklch(0.78 0.02 200)',
      statusSuccess: 'oklch(0.2 0.04 150)',
      statusSuccessBorder: 'oklch(0.32 0.06 150)',
      statusSuccessForeground: 'oklch(0.78 0.08 150)',
      statusWarning: 'oklch(0.2 0.04 80)',
      statusWarningBorder: 'oklch(0.32 0.06 80)',
      statusWarningForeground: 'oklch(0.78 0.08 80)',
      titlebar: 'oklch(0.15 0.04 205)'
    },
    darkShikiTheme: 'solarized-dark',
    label: 'Solarized',
    light: {
      accent: 'oklch(0.89 0.015 85)',
      accentForeground: 'oklch(0.4 0.04 200)',
      background: 'oklch(0.95 0.02 85)',
      border: 'oklch(0.84 0.02 85)',
      card: 'oklch(0.95 0.02 85)',
      cardForeground: 'oklch(0.4 0.04 200)',
      chart1: 'oklch(0.6 0.2 25)',
      chart2: 'oklch(0.68 0.16 55)',
      chart3: 'oklch(0.72 0.14 100)',
      chart4: 'oklch(0.58 0.15 175)',
      chart5: 'oklch(0.55 0.2 260)',
      destructive: 'oklch(0.6 0.2 25)',
      destructiveForeground: 'oklch(0.95 0.02 85)',
      foreground: 'oklch(0.4 0.04 200)',
      input: 'oklch(0.84 0.02 85)',
      muted: 'oklch(0.9 0.018 85)',
      mutedForeground: 'oklch(0.55 0.03 200)',
      popover: 'oklch(0.95 0.02 85)',
      popoverForeground: 'oklch(0.4 0.04 200)',
      primary: 'oklch(0.55 0.2 260)',
      primaryForeground: 'oklch(0.95 0.02 85)',
      ring: 'oklch(0.55 0.2 260)',
      secondary: 'oklch(0.9 0.018 85)',
      secondaryForeground: 'oklch(0.4 0.04 200)',
      sidebar: 'oklch(0.92 0.018 85)',
      sidebarAccent: 'oklch(0.9 0.018 85)',
      sidebarAccentForeground: 'oklch(0.4 0.04 200)',
      sidebarBorder: 'oklch(0.84 0.02 85)',
      sidebarForeground: 'oklch(0.4 0.04 200)',
      sidebarPrimary: 'oklch(0.55 0.2 260)',
      sidebarPrimaryForeground: 'oklch(0.95 0.02 85)',
      sidebarRing: 'oklch(0.55 0.2 260)',
      statusDanger: 'oklch(0.93 0.02 25)',
      statusDangerBorder: 'oklch(0.84 0.04 25)',
      statusDangerForeground: 'oklch(0.42 0.12 25)',
      statusMerged: 'oklch(0.93 0.02 300)',
      statusMergedBorder: 'oklch(0.84 0.04 300)',
      statusMergedForeground: 'oklch(0.42 0.12 300)',
      statusNeutral: 'oklch(0.93 0.005 85)',
      statusNeutralBorder: 'oklch(0.84 0.01 85)',
      statusNeutralForeground: 'oklch(0.45 0.02 85)',
      statusSuccess: 'oklch(0.93 0.02 150)',
      statusSuccessBorder: 'oklch(0.84 0.04 150)',
      statusSuccessForeground: 'oklch(0.42 0.1 150)',
      statusWarning: 'oklch(0.93 0.03 80)',
      statusWarningBorder: 'oklch(0.84 0.04 80)',
      statusWarningForeground: 'oklch(0.42 0.1 80)',
      titlebar: 'oklch(0.92 0.018 85)'
    },
    lightShikiTheme: 'solarized-light',
    modes: 'both',
    value: 'solarized'
  },

  // --- Vitesse Light (light only, neutral dark fallback) ---
  {
    dark: catppuccinMochaPalette,
    darkShikiTheme: 'catppuccin-mocha',
    label: 'Vitesse Light',
    light: {
      accent: 'oklch(0.93 0.005 50)',
      accentForeground: 'oklch(0.3 0.02 50)',
      background: 'oklch(0.99 0.002 50)',
      border: 'oklch(0.88 0.008 50)',
      card: 'oklch(0.99 0.002 50)',
      cardForeground: 'oklch(0.3 0.02 50)',
      chart1: 'oklch(0.55 0.2 25)',
      chart2: 'oklch(0.65 0.16 55)',
      chart3: 'oklch(0.7 0.14 100)',
      chart4: 'oklch(0.55 0.16 155)',
      chart5: 'oklch(0.55 0.16 45)',
      destructive: 'oklch(0.55 0.22 25)',
      destructiveForeground: 'oklch(0.99 0.002 50)',
      foreground: 'oklch(0.3 0.02 50)',
      input: 'oklch(0.88 0.008 50)',
      muted: 'oklch(0.95 0.004 50)',
      mutedForeground: 'oklch(0.55 0.012 50)',
      popover: 'oklch(0.99 0.002 50)',
      popoverForeground: 'oklch(0.3 0.02 50)',
      primary: 'oklch(0.55 0.16 45)',
      primaryForeground: 'oklch(0.99 0.002 50)',
      ring: 'oklch(0.55 0.16 45)',
      secondary: 'oklch(0.95 0.004 50)',
      secondaryForeground: 'oklch(0.3 0.02 50)',
      sidebar: 'oklch(0.97 0.003 50)',
      sidebarAccent: 'oklch(0.95 0.004 50)',
      sidebarAccentForeground: 'oklch(0.3 0.02 50)',
      sidebarBorder: 'oklch(0.88 0.008 50)',
      sidebarForeground: 'oklch(0.3 0.02 50)',
      sidebarPrimary: 'oklch(0.55 0.16 45)',
      sidebarPrimaryForeground: 'oklch(0.99 0.002 50)',
      sidebarRing: 'oklch(0.55 0.16 45)',
      statusDanger: 'oklch(0.96 0.02 25)',
      statusDangerBorder: 'oklch(0.88 0.04 25)',
      statusDangerForeground: 'oklch(0.4 0.12 25)',
      statusMerged: 'oklch(0.96 0.02 300)',
      statusMergedBorder: 'oklch(0.88 0.04 300)',
      statusMergedForeground: 'oklch(0.4 0.12 300)',
      statusNeutral: 'oklch(0.96 0.003 50)',
      statusNeutralBorder: 'oklch(0.88 0.006 50)',
      statusNeutralForeground: 'oklch(0.45 0.015 50)',
      statusSuccess: 'oklch(0.96 0.02 150)',
      statusSuccessBorder: 'oklch(0.88 0.04 150)',
      statusSuccessForeground: 'oklch(0.4 0.1 150)',
      statusWarning: 'oklch(0.96 0.03 80)',
      statusWarningBorder: 'oklch(0.88 0.05 80)',
      statusWarningForeground: 'oklch(0.4 0.1 80)',
      titlebar: 'oklch(0.97 0.003 50)'
    },
    lightShikiTheme: 'vitesse-light',
    modes: 'light',
    value: 'vitesse-light'
  }
]

export const defaultDarkThemeValue = 'catppuccin-mocha'
export const defaultLightThemeValue = 'catppuccin-latte'

export function getThemesForMode(mode: 'dark' | 'light'): AppTheme[] {
  return appThemes.filter((t) => t.modes === 'both' || t.modes === mode)
}

export function getThemeByValue(value: string): AppTheme {
  return appThemes.find((t) => t.value === value) ?? appThemes[0]
}

// All unique Shiki theme names used across all app themes.
export const allShikiThemeValues = [
  ...new Set(
    appThemes.flatMap((theme) => [theme.lightShikiTheme, theme.darkShikiTheme])
  )
]

// Diff color generation (moved from codeThemes.ts).
export type ThemeDiffColors = {
  diffAdd: string
  diffRemove: string
}

const additionBase = 'rgb(0, 255, 0)'
const deletionBase = 'rgb(255, 0, 0)'

export function getDiffColors(
  background: string,
  isDark: boolean
): ThemeDiffColors {
  const ratio = isDark ? '80%' : '88%'

  return {
    diffAdd: `color-mix(in lab, ${background} ${ratio}, ${additionBase})`,
    diffRemove: `color-mix(in lab, ${background} ${ratio}, ${deletionBase})`
  }
}
