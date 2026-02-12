import type { DarkCodeTheme, LightCodeTheme } from '@/app/lib/codeThemes'

type CodeThemeSetters = {
  setDarkTheme: (theme: DarkCodeTheme) => void
  setLightTheme: (theme: LightCodeTheme) => void
}

let codeThemeSetters: CodeThemeSetters | null = null

export function setCodeThemeSetters(setters: CodeThemeSetters): void {
  codeThemeSetters = setters
}

export function getCodeThemeSetters(): CodeThemeSetters {
  if (!codeThemeSetters) {
    throw new Error('Code theme setters not initialized')
  }

  return codeThemeSetters
}
