import { Palette } from 'lucide-react'

import { getCodeThemeSetters } from '@/app/commands/code-theme-accessor'
import { commandRegistry } from '@/app/commands/registry'
import type { Command } from '@/app/commands/types'
import {
  darkCodeThemes,
  lightCodeThemes,
  type DarkCodeTheme,
  type LightCodeTheme
} from '@/app/lib/codeThemes'

const selectDarkCodeTheme: Command<DarkCodeTheme> = {
  id: 'appearance.dark-code-theme',
  label: 'Select Dark Code Theme',
  icon: Palette,
  group: 'appearance',
  param: {
    type: 'select',
    placeholder: 'Select a dark code theme...',
    getOptions: () =>
      darkCodeThemes.map((theme) => ({
        id: theme.value,
        label: theme.label,
        value: theme.value
      }))
  },
  isAvailable: () => true,
  execute: (_context, themeValue) => {
    if (themeValue) {
      getCodeThemeSetters().setDarkTheme(themeValue)
    }
  }
}

const selectLightCodeTheme: Command<LightCodeTheme> = {
  id: 'appearance.light-code-theme',
  label: 'Select Light Code Theme',
  icon: Palette,
  group: 'appearance',
  param: {
    type: 'select',
    placeholder: 'Select a light code theme...',
    getOptions: () =>
      lightCodeThemes.map((theme) => ({
        id: theme.value,
        label: theme.label,
        value: theme.value
      }))
  },
  isAvailable: () => true,
  execute: (_context, themeValue) => {
    if (themeValue) {
      getCodeThemeSetters().setLightTheme(themeValue)
    }
  }
}

commandRegistry.register(selectDarkCodeTheme)
commandRegistry.register(selectLightCodeTheme)
