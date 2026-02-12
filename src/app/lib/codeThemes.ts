export const darkCodeThemes = [
  {
    background: '#1e1e2e',
    diffAdd: 'rgb(71 91 83)',
    diffRemove: 'rgb(131 76 76)',
    label: 'Catppuccin Mocha',
    value: 'catppuccin-mocha'
  },
  {
    background: '#282a36',
    diffAdd: 'rgb(71 91 83)',
    diffRemove: 'rgb(131 76 76)',
    label: 'Dracula',
    value: 'dracula'
  },
  {
    background: '#24292e',
    diffAdd: 'rgb(71 91 83)',
    diffRemove: 'rgb(131 76 76)',
    label: 'GitHub Dark',
    value: 'github-dark'
  },
  {
    background: '#272822',
    diffAdd: '#5B715B',
    diffRemove: 'rgb(119 84 84)',
    label: 'Monokai',
    value: 'monokai'
  },
  {
    background: '#2e3440',
    diffAdd: '#2e4a3e',
    diffRemove: '#4a3040',
    label: 'Nord',
    value: 'nord'
  },
  {
    background: '#282c34',
    diffAdd: 'rgb(71 91 83)',
    diffRemove: 'rgb(131 76 76)',
    label: 'One Dark Pro',
    value: 'one-dark-pro'
  },
  {
    background: '#002b36',
    diffAdd: '#004030',
    diffRemove: '#3b2030',
    label: 'Solarized Dark',
    value: 'solarized-dark'
  }
] as const

export const lightCodeThemes = [
  {
    background: '#eff1f5',
    diffAdd: '#B5E3C6',
    diffRemove: 'rgb(229 180 180)',
    label: 'Catppuccin Latte',
    value: 'catppuccin-latte'
  },
  {
    background: '#ffffff',
    diffAdd: '#e6ffec',
    diffRemove: '#ffebe9',
    label: 'GitHub Light',
    value: 'github-light'
  },
  {
    background: '#ffffff',
    diffAdd: '#e6ffec',
    diffRemove: '#ffebe9',
    label: 'Light+ (VS Code)',
    value: 'light-plus'
  },
  {
    background: '#ffffff',
    diffAdd: '#e6ffec',
    diffRemove: '#ffebe9',
    label: 'Min Light',
    value: 'min-light'
  },
  {
    background: '#fdf6e3',
    diffAdd: '#e8f5e0',
    diffRemove: '#f5e0e0',
    label: 'Solarized Light',
    value: 'solarized-light'
  },
  {
    background: '#ffffff',
    diffAdd: '#e6ffec',
    diffRemove: '#ffebe9',
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

export function getThemeDiffColors(themeName: string): ThemeDiffColors {
  const allThemes = [...darkCodeThemes, ...lightCodeThemes]
  const theme = allThemes.find((t) => t.value === themeName)

  return {
    diffAdd: theme?.diffAdd ?? 'rgb(71 91 83)',
    diffRemove: theme?.diffRemove ?? 'rgb(131 76 76)'
  }
}
