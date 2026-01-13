import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

import type { Theme } from '@/types/theme'

const SETTINGS_FILE = 'theme-settings.json'

interface ThemeSettings {
  theme: Theme
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

export function getThemePreference(): Theme | null {
  try {
    const settingsPath = getSettingsPath()
    if (!fs.existsSync(settingsPath)) {
      return null
    }

    const data = fs.readFileSync(settingsPath, 'utf8')

    let parsed
    try {
      parsed = JSON.parse(data)
    } catch (jsonError) {
      console.error('Invalid JSON in theme settings file:', jsonError)
      return null
    }

    // Validate the parsed data
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'theme' in parsed &&
      (parsed.theme === 'light' ||
        parsed.theme === 'dark' ||
        parsed.theme === 'system')
    ) {
      return parsed.theme
    }

    console.error('Invalid theme settings format:', parsed)
    return null
  } catch (error) {
    console.error('Failed to load theme preference:', error)
    return null
  }
}

export function setThemePreference(theme: Theme): void {
  try {
    const settingsPath = getSettingsPath()
    const settings: ThemeSettings = { theme }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.error('Failed to save theme preference:', error)
  }
}
