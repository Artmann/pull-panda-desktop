import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import {
  setAppThemeSetter,
  setResolvedMode
} from '@/app/commands/theme-accessor'
import { applyThemePalette } from '@/app/lib/applyThemePalette'
import {
  darkStorageKey,
  lightStorageKey,
  migrateFromLegacyKeys
} from '@/app/lib/store/themeMigration'
import {
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

  const setAppTheme = useCallback(
    (value: string) => {
      const theme = getThemeByValue(value)

      if (mode === 'dark') {
        setDarkThemeValue(theme.value)
        localStorage.setItem(darkStorageKey, theme.value)
      } else {
        setLightThemeValue(theme.value)
        localStorage.setItem(lightStorageKey, theme.value)
      }
    },
    [mode]
  )

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
  }, [setAppTheme])

  const value = useMemo(
    () => ({ appTheme, setAppTheme }),
    [appTheme, setAppTheme]
  )

  return (
    <AppThemeContext.Provider value={value}>
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
