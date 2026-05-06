import { log } from 'tiny-typescript-logger'

import { rateLimitManager, sleep } from './rate-limit-manager'

export type RequestKind = 'graphql' | 'rest'

interface BrokerOptions {
  maxConcurrent: number
  restPointsPerMinute: number
  graphqlPointsPerMinute: number
}

const defaultOptions: BrokerOptions = {
  maxConcurrent: 30,
  restPointsPerMinute: 700,
  graphqlPointsPerMinute: 1500
}

const windowMs = 60_000

interface PointEntry {
  timestamp: number
  cost: number
}

interface Waiter {
  resolve: () => void
}

class RequestBroker {
  private inFlight = 0
  private waiters: Waiter[] = []
  private restWindow: PointEntry[] = []
  private graphqlWindow: PointEntry[] = []
  private options: BrokerOptions = defaultOptions

  configure(options: Partial<BrokerOptions>): void {
    this.options = { ...this.options, ...options }
  }

  async acquire(kind: RequestKind): Promise<() => void> {
    await this.waitForWindow(kind)
    await this.waitForSlot()

    this.inFlight++

    let released = false

    return () => {
      if (released) {
        return
      }

      released = true
      this.inFlight = Math.max(0, this.inFlight - 1)

      const next = this.waiters.shift()

      if (next) {
        next.resolve()
      }
    }
  }

  recordCost(kind: RequestKind, cost: number): void {
    if (cost <= 0) {
      return
    }

    const window = this.getWindow(kind)

    window.push({ timestamp: Date.now(), cost })
    this.trimWindow(window)
  }

  getWindowCost(kind: RequestKind): number {
    const window = this.getWindow(kind)

    this.trimWindow(window)

    return window.reduce((sum, entry) => sum + entry.cost, 0)
  }

  getInFlight(): number {
    return this.inFlight
  }

  reset(): void {
    this.inFlight = 0
    this.waiters = []
    this.restWindow = []
    this.graphqlWindow = []
  }

  private getWindow(kind: RequestKind): PointEntry[] {
    return kind === 'graphql' ? this.graphqlWindow : this.restWindow
  }

  private getBudget(kind: RequestKind): number {
    return kind === 'graphql'
      ? this.options.graphqlPointsPerMinute
      : this.options.restPointsPerMinute
  }

  private trimWindow(window: PointEntry[]): void {
    const cutoff = Date.now() - windowMs

    while (window.length > 0 && window[0].timestamp < cutoff) {
      window.shift()
    }
  }

  private async waitForWindow(kind: RequestKind): Promise<void> {
    const budget = this.getBudget(kind)
    const window = this.getWindow(kind)

    for (;;) {
      this.trimWindow(window)

      const used = window.reduce((sum, entry) => sum + entry.cost, 0)

      if (used < budget) {
        return
      }

      const oldest = window[0]
      const waitMs = Math.max(50, oldest.timestamp + windowMs - Date.now())

      log.info(
        `[Broker] ${kind} sliding window full (${used}/${budget}); waiting ${Math.round(
          waitMs / 1000
        )}s`
      )

      await sleep(waitMs)
    }
  }

  private async waitForSlot(): Promise<void> {
    if (this.inFlight < this.options.maxConcurrent) {
      return
    }

    await new Promise<void>((resolve) => {
      this.waiters.push({ resolve })
    })
  }
}

export const requestBroker = new RequestBroker()

const baseBackoffMs = 1_000
const maxBackoffMs = 30_000

export function computeBackoffMs(
  attempt: number,
  retryAfterMs: number | null
): number {
  const exponential = Math.min(
    maxBackoffMs,
    baseBackoffMs * Math.pow(2, attempt)
  )
  const jitter = Math.floor(Math.random() * 500)
  const exponentialWithJitter = exponential + jitter

  if (retryAfterMs === null) {
    return exponentialWithJitter
  }

  return Math.max(retryAfterMs, exponentialWithJitter)
}

export const maxRetries = 3

export async function checkPrimaryRateLimit(kind: RequestKind): Promise<void> {
  if (!rateLimitManager.shouldPause(kind)) {
    return
  }

  const waitMs = rateLimitManager.getWaitTimeMs(kind)

  log.info(
    `[Broker] ${kind} primary rate limit low; waiting ${Math.round(
      waitMs / 1000
    )}s until reset`
  )

  await sleep(waitMs)
}
