export const darkCodeThemes = [
  {
    background: '#303446',
    label: 'Catppuccin Frappé',
    value: 'catppuccin-frappe'
  },
  {
    background: '#303446',
    label: 'Catppuccin Macchiato',
    value: 'catppuccin-macchiato'
  },
  {
    background: '#1e1e2e',
    label: 'Catppuccin Mocha',
    value: 'catppuccin-mocha'
  },
  {
    background: '#282a36',
    label: 'Dracula',
    value: 'dracula'
  },
  {
    background: '#24292e',
    label: 'GitHub Dark',
    value: 'github-dark'
  },
  {
    background: '#272822',
    label: 'Monokai',
    value: 'monokai'
  },
  {
    background: '#2e3440',
    label: 'Nord',
    value: 'nord'
  },
  {
    background: '#282c34',
    label: 'One Dark Pro',
    value: 'one-dark-pro'
  },
  {
    background: '#002b36',
    label: 'Solarized Dark',
    value: 'solarized-dark'
  }
] as const

export const lightCodeThemes = [
  {
    background: '#eff1f5',
    label: 'Catppuccin Latte',
    value: 'catppuccin-latte'
  },
  {
    background: '#ffffff',
    label: 'GitHub Light',
    value: 'github-light'
  },
  {
    background: '#ffffff',
    label: 'Light+ (VS Code)',
    value: 'light-plus'
  },
  {
    background: '#ffffff',
    label: 'Min Light',
    value: 'min-light'
  },
  {
    background: '#fdf6e3',
    label: 'Solarized Light',
    value: 'solarized-light'
  },
  {
    background: '#ffffff',
    label: 'Vitesse Light',
    value: 'vitesse-light'
  }
] as const

export type DarkCodeTheme = (typeof darkCodeThemes)[number]['value']
export type LightCodeTheme = (typeof lightCodeThemes)[number]['value']

export const allCodeThemeValues = [
  ...darkCodeThemes.map((theme) => theme.value),
  ...lightCodeThemes.map((theme) => theme.value)
] as const

export const defaultDarkTheme: DarkCodeTheme = 'catppuccin-mocha'
export const defaultLightTheme: LightCodeTheme = 'catppuccin-latte'

export function getThemeBackgroundColor(themeName: string): string {
  const allThemes = [...darkCodeThemes, ...lightCodeThemes]
  const theme = allThemes.find((t) => t.value === themeName)

  return theme?.background ?? '#1e1e1e'
}

export type ThemeDiffColors = {
  diffAdd: string
  diffRemove: string
}

const additionBase = 'rgb(0, 255, 0)'
const deletionBase = 'rgb(255, 0, 0)'

export function getDiffColors(
  themeName: string,
  isDark: boolean
): ThemeDiffColors {
  const background = getThemeBackgroundColor(themeName)
  const ratio = isDark ? '80%' : '88%'

  return {
    diffAdd: `color-mix(in lab, ${background} ${ratio}, ${additionBase})`,
    diffRemove: `color-mix(in lab, ${background} ${ratio}, ${deletionBase})`
  }
}
