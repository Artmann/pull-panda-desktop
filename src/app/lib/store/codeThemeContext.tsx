import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'

import { setCodeThemeSetters } from '@/app/commands/code-theme-accessor'
import {
  defaultDarkTheme,
  defaultLightTheme,
  getThemeBackgroundColor,
  getThemeDiffColors,
  type DarkCodeTheme,
  type LightCodeTheme,
  type ThemeDiffColors
} from '@/app/lib/codeThemes'

type CodeThemeContextType = {
  darkBackground: string
  darkDiffColors: ThemeDiffColors
  darkTheme: DarkCodeTheme
  lightBackground: string
  lightDiffColors: ThemeDiffColors
  lightTheme: LightCodeTheme
  setDarkTheme: (theme: DarkCodeTheme) => void
  setLightTheme: (theme: LightCodeTheme) => void
}

const CodeThemeContext = createContext<CodeThemeContextType | null>(null)

const storageKeyDark = 'code-theme-dark'
const storageKeyLight = 'code-theme-light'

export function CodeThemeProvider({
  children
}: {
  children: ReactNode
}): ReactNode {
  const [darkTheme, setDarkThemeState] = useState<DarkCodeTheme>(() => {
    const stored = localStorage.getItem(storageKeyDark) as DarkCodeTheme | null

    return stored ?? defaultDarkTheme
  })
  const [lightTheme, setLightThemeState] = useState<LightCodeTheme>(() => {
    const stored = localStorage.getItem(
      storageKeyLight
    ) as LightCodeTheme | null

    return stored ?? defaultLightTheme
  })
  const [darkBackground, setDarkBackground] = useState<string>(() =>
    getThemeBackgroundColor(
      localStorage.getItem(storageKeyDark) ?? defaultDarkTheme
    )
  )
  const [darkDiffColors, setDarkDiffColors] = useState<ThemeDiffColors>(() =>
    getThemeDiffColors(localStorage.getItem(storageKeyDark) ?? defaultDarkTheme)
  )
  const [lightBackground, setLightBackground] = useState<string>(() =>
    getThemeBackgroundColor(
      localStorage.getItem(storageKeyLight) ?? defaultLightTheme
    )
  )
  const [lightDiffColors, setLightDiffColors] = useState<ThemeDiffColors>(() =>
    getThemeDiffColors(
      localStorage.getItem(storageKeyLight) ?? defaultLightTheme
    )
  )

  const setDarkTheme = (theme: DarkCodeTheme) => {
    setDarkThemeState(theme)
    setDarkBackground(getThemeBackgroundColor(theme))
    setDarkDiffColors(getThemeDiffColors(theme))
    localStorage.setItem(storageKeyDark, theme)
  }

  const setLightTheme = (theme: LightCodeTheme) => {
    setLightThemeState(theme)
    setLightBackground(getThemeBackgroundColor(theme))
    setLightDiffColors(getThemeDiffColors(theme))
    localStorage.setItem(storageKeyLight, theme)
  }

  useEffect(() => {
    setCodeThemeSetters({ setDarkTheme, setLightTheme })
  }, [])

  return (
    <CodeThemeContext.Provider
      value={{
        darkBackground,
        darkDiffColors,
        darkTheme,
        lightBackground,
        lightDiffColors,
        lightTheme,
        setDarkTheme,
        setLightTheme
      }}
    >
      {children}
    </CodeThemeContext.Provider>
  )
}

export function useCodeTheme(): CodeThemeContextType {
  const context = useContext(CodeThemeContext)

  if (!context) {
    throw new Error('useCodeTheme must be used within CodeThemeProvider')
  }

  return context
}
