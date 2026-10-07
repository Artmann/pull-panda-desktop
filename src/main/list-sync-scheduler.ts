export type WindowState = 'blurred' | 'focused' | 'hidden'

export interface RateLimitBudget {
  limit: number
  remaining: number
  // Unix time in seconds, as GitHub reports it.
  resetAt: number
}

interface WindowLike {
  isDestroyed: () => boolean
  isFocused: () => boolean
  isMinimized: () => boolean
  isVisible: () => boolean
}

export function windowStateOf(window: WindowLike | null): WindowState {
  if (!window || window.isDestroyed()) {
    return 'hidden'
  }

  if (!window.isVisible() || window.isMinimized()) {
    return 'hidden'
  }

  return window.isFocused() ? 'focused' : 'blurred'
}

const baseDelayMs: Record<WindowState, number> = {
  blurred: 60_000,
  focused: 15_000,
  hidden: 5 * 60_000
}

const resetPaddingMs = 5_000

// How long to wait before the next list probe. The probe is cheap (about 3
// GraphQL points), so it runs often while the user is looking at the app and
// backs off when the window is in the background. As the GraphQL budget runs
// low the delay stretches, and below 10% background syncing waits for the
// budget to reset so user actions still have room.
export function computeListSyncDelay(
  windowState: WindowState,
  budget: RateLimitBudget | null,
  now: number = Date.now()
): number {
  const base = baseDelayMs[windowState]

  if (!budget || budget.limit <= 0) {
    return base
  }

  const ratio = budget.remaining / budget.limit

  if (ratio < 0.1) {
    const untilReset = budget.resetAt * 1000 - now + resetPaddingMs

    return Math.max(base, untilReset)
  }

  if (ratio < 0.25) {
    return base * 4
  }

  if (ratio < 0.5) {
    return base * 2
  }

  return base
}

interface ListSyncSchedulerOptions {
  getBudget: () => Promise<RateLimitBudget | null>
  getWindowState: () => WindowState
  // Requests closer together than this are merged into one run.
  minimumGapMs?: number
  run: () => Promise<void>
}

const defaultMinimumGapMs = 5_000

// Runs the list sync on a timer, and on demand (window focus, wake from
// sleep, manual refresh). Only one run is in flight at a time; a request
// that arrives during a run is remembered and runs right after, instead of
// being dropped.
export class ListSyncScheduler {
  private lastRunStartedAt = 0
  private readonly minimumGapMs: number
  private rerunRequested = false
  private running = false
  private stopped = true
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: ListSyncSchedulerOptions) {
    this.minimumGapMs = options.minimumGapMs ?? defaultMinimumGapMs
  }

  requestSync(): void {
    if (this.stopped) {
      return
    }

    if (this.running) {
      this.rerunRequested = true

      return
    }

    const sinceLastRun = Date.now() - this.lastRunStartedAt

    this.schedule(Math.max(0, this.minimumGapMs - sinceLastRun))
  }

  start(): void {
    if (!this.stopped) {
      return
    }

    this.stopped = false
    this.requestSync()
  }

  stop(): void {
    this.stopped = true
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async runOnce(): Promise<void> {
    this.timer = null
    this.running = true
    this.lastRunStartedAt = Date.now()

    try {
      await this.options.run()
    } catch (error) {
      console.error('List sync failed:', error)
    }

    // Stay marked as running while the budget is read, so a request that
    // arrives meanwhile sets `rerunRequested` instead of being overwritten.
    const budget = await this.options.getBudget().catch((): null => null)
    const delay = this.rerunRequested
      ? this.minimumGapMs
      : computeListSyncDelay(this.options.getWindowState(), budget)

    this.rerunRequested = false
    this.running = false

    if (this.stopped) {
      return
    }

    this.schedule(delay)
  }

  private schedule(delayMs: number): void {
    this.clearTimer()

    this.timer = setTimeout(() => {
      void this.runOnce()
    }, delayMs)
  }
}
