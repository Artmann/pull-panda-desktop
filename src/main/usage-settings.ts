import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface UsageSettings {
  enabled: boolean
  installId: string
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'usage-settings.json')
}

export function isUsageReportingEnabled(): boolean {
  return loadUsageSettings().enabled
}

export function loadUsageSettings(): UsageSettings {
  const stored = readStoredValues()

  const enabled = typeof stored.enabled === 'boolean' ? stored.enabled : true
  const installId =
    typeof stored.installId === 'string' && uuidPattern.test(stored.installId)
      ? stored.installId
      : randomUUID()

  const settings: UsageSettings = { enabled, installId }

  if (stored.enabled !== enabled || stored.installId !== installId) {
    try {
      saveUsageSettings(settings)
    } catch {
      // An unwritable disk still gets a working in-memory session; the
      // install id just won't survive a restart.
    }
  }

  return settings
}

export function setUsageReportingEnabled(enabled: boolean): void {
  const settings = loadUsageSettings()

  saveUsageSettings({ ...settings, enabled })
}

function readStoredValues(): Partial<UsageSettings> {
  const storePath = getStorePath()

  if (!fs.existsSync(storePath)) {
    return {}
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Partial<UsageSettings>
  } catch {
    return {}
  }
}

function saveUsageSettings(settings: UsageSettings): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(settings, null, 2), 'utf-8')
}
