import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from 'react'

import type { Theme, ResolvedTheme } from '@/types/theme'

export type { Theme, ResolvedTheme }

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light')

  // Get system theme and set up listener
  useEffect(() => {
    const updateSystemTheme = async () => {
      const shouldUseDark = await window.electron.getSystemTheme()
      setSystemTheme(shouldUseDark ? 'dark' : 'light')
    }

    updateSystemTheme()

    // Listen for system theme changes
    const cleanup = window.electron.onSystemThemeChange((shouldUseDark) => {
      setSystemTheme(shouldUseDark ? 'dark' : 'light')
    })

    return cleanup
  }, [])

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await window.electron.getThemePreference()
      if (savedTheme) {
        setThemeState(savedTheme)
      }
    }
    loadTheme()
  }, [])

  // Calculate resolved theme
  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? systemTheme : theme

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolvedTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    window.electron.setThemePreference(newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    if (theme === 'system') {
      // If on system, switch to opposite of current resolved theme
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    } else if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }, [theme, resolvedTheme, setTheme])

  // Set up keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + D
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        toggleTheme()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTheme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
