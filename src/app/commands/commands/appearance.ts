import { Monitor, Moon, Sun } from 'lucide-react'

import { commandRegistry } from '../registry'
import { getThemeSetter } from '../theme-accessor'

commandRegistry.register({
  id: 'appearance.light-mode',
  label: 'Switch to Light Mode',
  icon: Sun,
  group: 'appearance',
  isAvailable: () => true,
  execute: () => {
    const setTheme = getThemeSetter()

    setTheme('light')
  }
})

commandRegistry.register({
  id: 'appearance.dark-mode',
  label: 'Switch to Dark Mode',
  icon: Moon,
  group: 'appearance',
  isAvailable: () => true,
  execute: () => {
    const setTheme = getThemeSetter()

    setTheme('dark')
  }
})

commandRegistry.register({
  id: 'appearance.system-theme',
  label: 'Switch to System Theme',
  icon: Monitor,
  group: 'appearance',
  isAvailable: () => true,
  execute: () => {
    const setTheme = getThemeSetter()

    setTheme('system')
  }
})
