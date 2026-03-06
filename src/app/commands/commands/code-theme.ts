import { Palette } from 'lucide-react'

import { commandRegistry } from '@/app/commands/registry'
import type { Command } from '@/app/commands/types'
import { getResolvedMode, getThemeSetter } from '@/app/commands/theme-accessor'
import { getThemesForMode } from '@/app/lib/themes'

const selectTheme: Command<string> = {
  id: 'appearance.select-theme',
  label: 'Select Theme',
  icon: Palette,
  group: 'appearance',
  param: {
    type: 'select',
    placeholder: 'Select a theme...',
    getOptions: () =>
      getThemesForMode(getResolvedMode()).map((theme) => ({
        id: theme.value,
        label: theme.label,
        value: theme.value
      }))
  },
  isAvailable: () => true,
  execute: (_context, themeValue) => {
    if (themeValue) {
      getThemeSetter()(themeValue)
    }
  }
}

commandRegistry.register(selectTheme)
