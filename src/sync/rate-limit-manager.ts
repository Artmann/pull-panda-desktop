import { log } from 'tiny-typescript-logger'

interface RateLimitState {
  remaining: number
  limit: number
  resetAt: number // Unix timestamp in seconds
  lastUpdated: number
}

type RateLimitType = 'graphql' | 'rest'

const lowQuotaThresholdPercent = 0.1 // 10%

class RateLimitManager {
  graphql: RateLimitState | null = null
  rest: RateLimitState | null = null

  updateFromHeaders(
    type: RateLimitType,
    headers: Record<string, string>
  ): void {
    const state = this.parseHeaders(headers)

    if (state) {
      this[type] = state

      const threshold = Math.max(state.limit * lowQuotaThresholdPercent, 5)

      if (state.remaining < threshold) {
        log.info(
          `[RateLimit] ${type} quota low: ${state.remaining}/${state.limit}, resets at ${new Date(state.resetAt * 1000).toISOString()}`
        )
      }
    }
  }

  updateFromGraphQL(rateLimit: {
    limit: number
    remaining: number
    resetAt: string
  }): void {
    const state: RateLimitState = {
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
      resetAt: Math.floor(new Date(rateLimit.resetAt).getTime() / 1000),
      lastUpdated: Date.now()
    }

    this.graphql = state

    const threshold = Math.max(state.limit * lowQuotaThresholdPercent, 5)

    if (state.remaining < threshold) {
      log.info(
        `[RateLimit] graphql quota low: ${state.remaining}/${state.limit}, resets at ${new Date(state.resetAt * 1000).toISOString()}`
      )
    }
  }

  shouldPause(type: RateLimitType): boolean {
    const state = this[type]

    if (!state) {
      return false
    }

    const threshold = Math.max(state.limit * lowQuotaThresholdPercent, 5)

    // If remaining quota is below threshold, we should pause
    if (state.remaining < threshold) {
      // But only if the reset time hasn't passed yet
      const now = Math.floor(Date.now() / 1000)

      return state.resetAt > now
    }

    return false
  }

  getWaitTimeMs(type: RateLimitType): number {
    const state = this[type]

    if (!state) {
      return 0
    }

    const now = Math.floor(Date.now() / 1000)
    const waitSeconds = Math.max(0, state.resetAt - now)

    // Add a small buffer (5 seconds) to ensure the reset has actually happened
    return (waitSeconds + 5) * 1000
  }

  getRemainingQuota(type: RateLimitType): number | null {
    const state = this[type]

    return state?.remaining ?? null
  }

  private parseHeaders(headers: Record<string, string>): RateLimitState | null {
    const remaining = headers['x-ratelimit-remaining']
    const limit = headers['x-ratelimit-limit']
    const resetAt = headers['x-ratelimit-reset']

    if (!remaining || !limit || !resetAt) {
      return null
    }

    return {
      remaining: parseInt(remaining, 10),
      limit: parseInt(limit, 10),
      resetAt: parseInt(resetAt, 10),
      lastUpdated: Date.now()
    }
  }
}

export const rateLimitManager = new RateLimitManager()

export function getRetryAfterMs(
  headers: Record<string, string>
): number | null {
  const retryAfter = headers['retry-after']

  if (retryAfter) {
    return parseInt(retryAfter, 10) * 1000
  }

  const resetAt = headers['x-ratelimit-reset']

  if (resetAt) {
    const resetTimestamp = parseInt(resetAt, 10)
    const now = Math.floor(Date.now() / 1000)
    const waitSeconds = Math.max(0, resetTimestamp - now)

    return (waitSeconds + 5) * 1000
  }

  return null
}

export function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; message?: string }

    // HTTP 429 (Too Many Requests) or 403 with rate limit message
    if (err.status === 429) {
      return true
    }

    if (err.status === 403 && err.message?.includes('rate limit')) {
      return true
    }

    // GraphQL rate limit error
    if (err.message?.includes('API rate limit exceeded')) {
      return true
    }
  }

  return false
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
