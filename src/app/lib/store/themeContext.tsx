import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'

import { setAppThemeSetter } from '@/app/commands/theme-accessor'
import { applyThemePalette } from '@/app/lib/applyThemePalette'
import {
  appThemes,
  defaultThemeValue,
  getThemeByValue,
  type AppTheme
} from '@/app/lib/themes'

type AppThemeContextType = {
  appTheme: AppTheme
  setAppTheme: (value: string) => void
}

const AppThemeContext = createContext<AppThemeContextType | null>(null)

const storageKey = 'app-theme'

function migrateFromCodeTheme(): string | null {
  const oldDark = localStorage.getItem('code-theme-dark')
  const oldLight = localStorage.getItem('code-theme-light')

  if (!oldDark && !oldLight) {
    return null
  }

  // Try to find an app theme that matches the old code theme selection.
  const candidate = oldDark ?? oldLight
  const match = appThemes.find(
    (t) =>
      t.darkShikiTheme === candidate ||
      t.lightShikiTheme === candidate ||
      t.value === candidate
  )

  localStorage.removeItem('code-theme-dark')
  localStorage.removeItem('code-theme-light')

  return match?.value ?? null
}

function AppThemeApplicator({ appTheme }: { appTheme: AppTheme }): null {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const palette =
      resolvedTheme === 'dark' ? appTheme.dark : appTheme.light

    applyThemePalette(palette)
  }, [resolvedTheme, appTheme])

  return null
}

function ThemeSetterRegistrar(): null {
  const { setTheme } = useTheme()

  useEffect(() => {
    setAppThemeSetter('mode', setTheme)
  }, [setTheme])

  return null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    let stored = localStorage.getItem(storageKey)

    if (!stored) {
      stored = migrateFromCodeTheme()
    }

    return getThemeByValue(stored ?? defaultThemeValue)
  })

  const setAppTheme = (value: string) => {
    const theme = getThemeByValue(value)
    setAppThemeState(theme)
    localStorage.setItem(storageKey, theme.value)
  }

  useEffect(() => {
    setAppThemeSetter('theme', setAppTheme)
  }, [])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <ThemeSetterRegistrar />
      <AppThemeApplicator appTheme={appTheme} />
      <AppThemeContext.Provider value={{ appTheme, setAppTheme }}>
        {children}
      </AppThemeContext.Provider>
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
