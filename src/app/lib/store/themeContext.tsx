import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { useEffect, type ReactNode } from 'react'

import { setThemeSetter } from '@/app/commands/theme-accessor'

type ThemeProviderProps = {
  children: ReactNode
}

function ThemeSetterRegistrar(): null {
  const { setTheme } = useTheme()

  useEffect(() => {
    setThemeSetter(setTheme)
  }, [setTheme])

  return null
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeSetterRegistrar />
      {children}
    </NextThemesProvider>
  )
}
