import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'

import {
  setAppThemeSetter,
  setResolvedMode
} from '@/app/commands/theme-accessor'
import { applyThemePalette } from '@/app/lib/applyThemePalette'
import {
  appThemes,
  defaultDarkThemeValue,
  defaultLightThemeValue,
  getThemeByValue,
  type AppTheme
} from '@/app/lib/themes'

type AppThemeContextType = {
  appTheme: AppTheme
  setAppTheme: (value: string) => void
}

const AppThemeContext = createContext<AppThemeContextType | null>(null)

const darkStorageKey = 'app-theme-dark'
const lightStorageKey = 'app-theme-light'

function migrateFromLegacyKeys(): void {
  // Migrate from the old single `app-theme` key.
  const oldSingle = localStorage.getItem('app-theme')

  if (oldSingle) {
    const theme = appThemes.find((t) => t.value === oldSingle)
    const modes = theme?.modes ?? 'both'

    if (modes === 'both' || modes === 'dark') {
      localStorage.setItem(darkStorageKey, oldSingle)
    }

    if (modes === 'both' || modes === 'light') {
      localStorage.setItem(lightStorageKey, oldSingle)
    }

    localStorage.removeItem('app-theme')
  }

  // Migrate from the old combined "catppuccin" value to the split variants.
  const storedDark = localStorage.getItem(darkStorageKey)
  const storedLight = localStorage.getItem(lightStorageKey)

  if (storedDark === 'catppuccin') {
    localStorage.setItem(darkStorageKey, 'catppuccin-mocha')
  }

  if (storedLight === 'catppuccin') {
    localStorage.setItem(lightStorageKey, 'catppuccin-latte')
  }

  // Migrate from even older per-mode code-theme keys.
  const oldDark = localStorage.getItem('code-theme-dark')
  const oldLight = localStorage.getItem('code-theme-light')

  if (oldDark || oldLight) {
    const candidate = oldDark ?? oldLight
    const match = appThemes.find(
      (t) =>
        t.darkShikiTheme === candidate ||
        t.lightShikiTheme === candidate ||
        t.value === candidate
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
}

function readStoredTheme(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback
}

function ThemeProviderInner({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light'

  const [darkThemeValue, setDarkThemeValue] = useState(() =>
    readStoredTheme(darkStorageKey, defaultDarkThemeValue)
  )

  const [lightThemeValue, setLightThemeValue] = useState(() =>
    readStoredTheme(lightStorageKey, defaultLightThemeValue)
  )

  const activeValue = mode === 'dark' ? darkThemeValue : lightThemeValue
  const appTheme = getThemeByValue(activeValue)

  const setAppTheme = (value: string) => {
    const theme = getThemeByValue(value)

    if (mode === 'dark') {
      setDarkThemeValue(theme.value)
      localStorage.setItem(darkStorageKey, theme.value)
    } else {
      setLightThemeValue(theme.value)
      localStorage.setItem(lightStorageKey, theme.value)
    }
  }

  // Apply the palette to CSS variables whenever the theme or mode changes.
  useEffect(() => {
    const palette = mode === 'dark' ? appTheme.dark : appTheme.light
    applyThemePalette(palette)
  }, [mode, appTheme])

  // Keep the resolved mode accessor in sync.
  useEffect(() => {
    setResolvedMode(mode)
  }, [mode])

  // Register setters for the command palette.
  useEffect(() => {
    setAppThemeSetter('mode', setTheme)
  }, [setTheme])

  useEffect(() => {
    setAppThemeSetter('theme', setAppTheme)
  }, [mode])

  return (
    <AppThemeContext.Provider value={{ appTheme, setAppTheme }}>
      {children}
    </AppThemeContext.Provider>
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useState(() => migrateFromLegacyKeys())

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </NextThemesProvider>
  )
}

export function useAppTheme(): AppThemeContextType {
  const context = useContext(AppThemeContext)

  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider')
  }

  return context
}
