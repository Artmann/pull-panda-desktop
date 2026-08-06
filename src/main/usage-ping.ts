import { app } from 'electron'

import { isUsageReportingEnabled, loadUsageSettings } from './usage-settings'

const usagePingIntervalMs = 60 * 60 * 1000
const usagePingUrl =
  process.env.PULL_PANDA_USAGE_PING_URL ?? 'https://pullpanda.io/api/app/ping'

interface UsagePingPayload {
  appVersion: string
  installId: string
  locale: string
  osVersion: string
  platform: NodeJS.Platform
  timezone: string
}

export async function sendUsagePing(): Promise<void> {
  try {
    if (!isUsageReportingEnabled()) {
      return
    }

    await fetch(usagePingUrl, {
      body: JSON.stringify(buildPayload()),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    })
  } catch {
    // Usage pings are best-effort: failures must never block startup or
    // surface anywhere in the UI.
  }
}

export function startUsagePingScheduler(): void {
  void sendUsagePing()

  setInterval(() => {
    void sendUsagePing()
  }, usagePingIntervalMs)
}

// Field length caps mirror the endpoint's validation schema, which rejects
// the whole payload on overflow rather than truncating.
function buildPayload(): UsagePingPayload {
  return {
    appVersion: app.getVersion().slice(0, 32),
    installId: loadUsageSettings().installId,
    locale: app.getLocale().slice(0, 16),
    osVersion: process.getSystemVersion().slice(0, 64),
    platform: process.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 64)
  }
}
