import { appThemes } from '@/app/lib/themes'

export const darkStorageKey = 'app-theme-dark'
export const lightStorageKey = 'app-theme-light'

export function migrateFromLegacyKeys(): void {
  migrateSingleAppThemeKey()
  migrateCombinedCatppuccinValue()
  migrateCodeThemeKeys()
}

// Migrate from the old combined "catppuccin" value to the split variants.
function migrateCombinedCatppuccinValue(): void {
  if (localStorage.getItem(darkStorageKey) === 'catppuccin') {
    localStorage.setItem(darkStorageKey, 'catppuccin-mocha')
  }

  if (localStorage.getItem(lightStorageKey) === 'catppuccin') {
    localStorage.setItem(lightStorageKey, 'catppuccin-latte')
  }
}

// Migrate from the even older per-mode `code-theme-*` keys.
function migrateCodeThemeKeys(): void {
  const oldDark = localStorage.getItem('code-theme-dark')
  const oldLight = localStorage.getItem('code-theme-light')

  if (!oldDark && !oldLight) {
    return
  }

  const candidate = oldDark ?? oldLight
  const match = appThemes.find(
    (theme) =>
      theme.darkShikiTheme === candidate ||
      theme.lightShikiTheme === candidate ||
      theme.value === candidate
  )

  if (match && !localStorage.getItem(darkStorageKey)) {
    localStorage.setItem(darkStorageKey, match.value)
  }

  if (match && !localStorage.getItem(lightStorageKey)) {
    localStorage.setItem(lightStorageKey, match.value)
  }

  localStorage.removeItem('code-theme-dark')
  localStorage.removeItem('code-theme-light')
}

// Migrate from the old single `app-theme` key.
function migrateSingleAppThemeKey(): void {
  const oldValue = localStorage.getItem('app-theme')

  if (!oldValue) {
    return
  }

  const theme = appThemes.find((candidate) => candidate.value === oldValue)
  const modes = theme?.modes ?? 'both'

  if (modes === 'both' || modes === 'dark') {
    localStorage.setItem(darkStorageKey, oldValue)
  }

  if (modes === 'both' || modes === 'light') {
    localStorage.setItem(lightStorageKey, oldValue)
  }

  localStorage.removeItem('app-theme')
}
