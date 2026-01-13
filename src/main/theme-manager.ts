import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

type Theme = 'light' | 'dark' | 'system'

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
    const settings: ThemeSettings = JSON.parse(data)
    return settings.theme
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
