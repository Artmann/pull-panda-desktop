import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import {
  rateLimitManager,
  getRetryAfterMs,
  isRateLimitError,
  sleep
} from './rate-limit-manager'

describe('rateLimitManager', () => {
  beforeEach(() => {
    rateLimitManager.graphql = null
    rateLimitManager.rest = null
  })

  describe('updateFromHeaders', () => {
    it('should update state from valid headers', () => {
      const headers = {
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1704067200'
      }

      rateLimitManager.updateFromHeaders('graphql', headers)

      expect(rateLimitManager.graphql).toEqual({
        remaining: 4500,
        limit: 5000,
        resetAt: 1704067200,
        lastUpdated: expect.any(Number)
      })
    })

    it('should not update state from incomplete headers', () => {
      const headers = {
        'x-ratelimit-remaining': '4500'
      }

      rateLimitManager.updateFromHeaders('graphql', headers)

      expect(rateLimitManager.graphql).toBeNull()
    })

    it('should update rest and graphql separately', () => {
      rateLimitManager.updateFromHeaders('graphql', {
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1704067200'
      })

      rateLimitManager.updateFromHeaders('rest', {
        'x-ratelimit-remaining': '3000',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1704067300'
      })

      expect(rateLimitManager.graphql?.remaining).toEqual(4500)
      expect(rateLimitManager.rest?.remaining).toEqual(3000)
    })
  })

  describe('shouldPause', () => {
    it('should return false when no state exists', () => {
      expect(rateLimitManager.shouldPause('graphql')).toEqual(false)
    })

    it('should return false when quota is above threshold', () => {
      rateLimitManager.graphql = {
        remaining: 500,
        limit: 5000,
        resetAt: Math.floor(Date.now() / 1000) + 3600,
        lastUpdated: Date.now()
      }

      expect(rateLimitManager.shouldPause('graphql')).toEqual(false)
    })

    it('should return true when quota is below threshold and reset is in future', () => {
      rateLimitManager.graphql = {
        remaining: 50,
        limit: 5000,
        resetAt: Math.floor(Date.now() / 1000) + 3600,
        lastUpdated: Date.now()
      }

      expect(rateLimitManager.shouldPause('graphql')).toEqual(true)
    })

    it('should return false when quota is below threshold but reset has passed', () => {
      rateLimitManager.graphql = {
        remaining: 50,
        limit: 5000,
        resetAt: Math.floor(Date.now() / 1000) - 100, // Reset already happened
        lastUpdated: Date.now()
      }

      expect(rateLimitManager.shouldPause('graphql')).toEqual(false)
    })
  })

  describe('getWaitTimeMs', () => {
    it('should return 0 when no state exists', () => {
      expect(rateLimitManager.getWaitTimeMs('graphql')).toEqual(0)
    })

    it('should return wait time until reset plus buffer', () => {
      const resetIn = 60 // 60 seconds from now
      const resetAt = Math.floor(Date.now() / 1000) + resetIn

      rateLimitManager.graphql = {
        remaining: 50,
        limit: 5000,
        resetAt,
        lastUpdated: Date.now()
      }

      const waitTime = rateLimitManager.getWaitTimeMs('graphql')

      // Should be approximately 65 seconds (60 + 5 buffer) in ms
      expect(waitTime).toBeGreaterThanOrEqual(64000)
      expect(waitTime).toBeLessThanOrEqual(66000)
    })

    it('should return buffer time when reset has passed', () => {
      rateLimitManager.graphql = {
        remaining: 50,
        limit: 5000,
        resetAt: Math.floor(Date.now() / 1000) - 100,
        lastUpdated: Date.now()
      }

      const waitTime = rateLimitManager.getWaitTimeMs('graphql')

      // Should just be the 5 second buffer
      expect(waitTime).toEqual(5000)
    })
  })

  describe('getRemainingQuota', () => {
    it('should return null when no state exists', () => {
      expect(rateLimitManager.getRemainingQuota('graphql')).toBeNull()
    })

    it('should return remaining quota', () => {
      rateLimitManager.graphql = {
        remaining: 4500,
        limit: 5000,
        resetAt: 1704067200,
        lastUpdated: Date.now()
      }

      expect(rateLimitManager.getRemainingQuota('graphql')).toEqual(4500)
    })
  })
})

describe('getRetryAfterMs', () => {
  it('should return retry-after in milliseconds when present', () => {
    const headers = {
      'retry-after': '120'
    }

    expect(getRetryAfterMs(headers)).toEqual(120000)
  })

  it('should calculate wait time from reset header when retry-after missing', () => {
    const resetIn = 60
    const resetAt = Math.floor(Date.now() / 1000) + resetIn

    const headers = {
      'x-ratelimit-reset': resetAt.toString()
    }

    const waitTime = getRetryAfterMs(headers)

    expect(waitTime).toBeGreaterThanOrEqual(64000)
    expect(waitTime).toBeLessThanOrEqual(66000)
  })

  it('should return null when no relevant headers present', () => {
    const headers = {}

    expect(getRetryAfterMs(headers)).toBeNull()
  })
})

describe('isRateLimitError', () => {
  it('should return true for 429 status', () => {
    const error = { status: 429, message: 'Too Many Requests' }

    expect(isRateLimitError(error)).toEqual(true)
  })

  it('should return true for 403 with rate limit message', () => {
    const error = { status: 403, message: 'API rate limit exceeded for user' }

    expect(isRateLimitError(error)).toEqual(true)
  })

  it('should return false for 403 without rate limit message', () => {
    const error = { status: 403, message: 'Forbidden' }

    expect(isRateLimitError(error)).toEqual(false)
  })

  it('should return true for GraphQL rate limit error', () => {
    const error = { message: 'API rate limit exceeded for user ID 91954' }

    expect(isRateLimitError(error)).toEqual(true)
  })

  it('should return false for non-rate-limit errors', () => {
    const error = { status: 500, message: 'Internal Server Error' }

    expect(isRateLimitError(error)).toEqual(false)
  })

  it('should return false for null/undefined', () => {
    expect(isRateLimitError(null)).toEqual(false)
    expect(isRateLimitError(undefined)).toEqual(false)
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should resolve after the specified time', async () => {
    const promise = sleep(1000)

    vi.advanceTimersByTime(999)

    // Promise should not be resolved yet
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toEqual(false)

    vi.advanceTimersByTime(1)
    await Promise.resolve()

    expect(resolved).toEqual(true)
  })
})
