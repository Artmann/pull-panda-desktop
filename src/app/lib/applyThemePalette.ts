import type { ThemePalette } from './themes'

const variableMap: Record<keyof ThemePalette, string> = {
  accent: '--accent',
  accentForeground: '--accent-foreground',
  background: '--background',
  border: '--border',
  card: '--card',
  cardForeground: '--card-foreground',
  chart1: '--chart-1',
  chart2: '--chart-2',
  chart3: '--chart-3',
  chart4: '--chart-4',
  chart5: '--chart-5',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  foreground: '--foreground',
  input: '--input',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  ring: '--ring',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  sidebar: '--sidebar',
  sidebarAccent: '--sidebar-accent',
  sidebarAccentForeground: '--sidebar-accent-foreground',
  sidebarBorder: '--sidebar-border',
  sidebarForeground: '--sidebar-foreground',
  sidebarPrimary: '--sidebar-primary',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
  sidebarRing: '--sidebar-ring',
  statusDanger: '--status-danger',
  statusDangerBorder: '--status-danger-border',
  statusDangerForeground: '--status-danger-foreground',
  statusMerged: '--status-merged',
  statusMergedBorder: '--status-merged-border',
  statusMergedForeground: '--status-merged-foreground',
  statusNeutral: '--status-neutral',
  statusNeutralBorder: '--status-neutral-border',
  statusNeutralForeground: '--status-neutral-foreground',
  statusSuccess: '--status-success',
  statusSuccessBorder: '--status-success-border',
  statusSuccessForeground: '--status-success-foreground',
  statusWarning: '--status-warning',
  statusWarningBorder: '--status-warning-border',
  statusWarningForeground: '--status-warning-foreground'
}

export function applyThemePalette(palette: ThemePalette): void {
  const root = document.documentElement.style

  for (const [key, cssVariable] of Object.entries(variableMap)) {
    root.setProperty(cssVariable, palette[key as keyof ThemePalette])
  }
}
