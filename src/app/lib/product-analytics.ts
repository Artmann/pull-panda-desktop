import type {
  ProductScreen,
  RendererProductEvent
} from '@/types/product-analytics'

let lastScreen: ProductScreen | null = null

// Maps a route to a fixed screen name so ids and other path segments never
// leave the app.
export function screenForPath(path: string): ProductScreen | null {
  if (path === '/') {
    return 'home'
  }

  if (path.startsWith('/pull-requests/')) {
    return 'pull_request'
  }

  const screens: Record<string, ProductScreen> = {
    '/bg': 'background_syncer',
    '/onboarding': 'onboarding',
    '/settings': 'settings',
    '/sign-in': 'sign_in',
    '/telemetry': 'telemetry'
  }

  return screens[path] ?? null
}

export function trackCommand(
  command: string,
  source: 'palette' | 'shortcut'
): void {
  trackEvent({ name: 'command_run', properties: { command, source } })
}

export function trackEvent(event: RendererProductEvent): void {
  try {
    window.usage.trackEvent(event)
  } catch {
    // Analytics are best-effort; tests and Storybook have no preload bridge.
  }
}

// Moving between two pull requests stays on the same screen, so only screen
// changes are recorded.
export function trackScreen(path: string): void {
  const screen = screenForPath(path)

  if (!screen || screen === lastScreen) {
    return
  }

  lastScreen = screen
  trackEvent({ name: 'screen_viewed', properties: { screen } })
}
