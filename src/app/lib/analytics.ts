import type { PostHog } from 'posthog-js'

const analyticsStorageKey = 'analytics-enabled'

export function getStoredAnalyticsEnabled(): boolean {
  // Default to enabled when no preference has been recorded yet.
  const stored = localStorage.getItem(analyticsStorageKey)

  if (stored === null) {
    return true
  }

  return stored === 'true'
}

export function setStoredAnalyticsEnabled(enabled: boolean): void {
  localStorage.setItem(analyticsStorageKey, String(enabled))
}

export function applyAnalyticsConsent(
  posthog: PostHog | undefined,
  enabled: boolean
): void {
  if (!posthog) {
    return
  }

  if (enabled) {
    posthog.opt_in_capturing()
  } else {
    posthog.opt_out_capturing()
  }
}
