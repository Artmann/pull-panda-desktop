import { Context, Effect, Layer, Ref } from 'effect'

import type { RequestKind } from '../errors'

export interface RateLimitState {
  remaining: number
  limit: number
  resetAt: number
  lastUpdated: number
}

const lowQuotaThresholdPercent = 0.1

function thresholdFor(state: RateLimitState): number {
  return Math.max(state.limit * lowQuotaThresholdPercent, 5)
}

export class RateLimitTracker extends Context.Tag('sync/RateLimitTracker')<
  RateLimitTracker,
  {
    readonly snapshot: (
      kind: RequestKind
    ) => Effect.Effect<RateLimitState | null>
    readonly updateFromHeaders: (
      kind: RequestKind,
      headers: Record<string, string>
    ) => Effect.Effect<void>
    readonly updateFromGraphQLRateLimit: (rateLimit: {
      remaining: number
      limit: number
      resetAt: string
    }) => Effect.Effect<void>
    readonly shouldPause: (kind: RequestKind) => Effect.Effect<boolean>
    readonly waitUntilReset: (kind: RequestKind) => Effect.Effect<void>
  }
>() {}

function parseHeaders(
  headers: Record<string, string>
): RateLimitState | null {
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

export const RateLimitTrackerLive: Layer.Layer<RateLimitTracker> = Layer.effect(
  RateLimitTracker,
  Effect.gen(function* () {
    const restRef = yield* Ref.make<RateLimitState | null>(null)
    const graphqlRef = yield* Ref.make<RateLimitState | null>(null)

    const refFor = (kind: RequestKind) =>
      kind === 'graphql' ? graphqlRef : restRef

    const snapshot = (kind: RequestKind) => Ref.get(refFor(kind))

    return {
      snapshot,

      updateFromHeaders: (kind, headers) =>
        Effect.suspend(() => {
          const parsed = parseHeaders(headers)

          if (!parsed) {
            return Effect.void
          }

          return Ref.set(refFor(kind), parsed)
        }),

      updateFromGraphQLRateLimit: (rateLimit) =>
        Ref.set(graphqlRef, {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetAt: Math.floor(new Date(rateLimit.resetAt).getTime() / 1000),
          lastUpdated: Date.now()
        }),

      shouldPause: (kind) =>
        Effect.map(snapshot(kind), (state) => {
          if (!state) {
            return false
          }

          if (state.remaining >= thresholdFor(state)) {
            return false
          }

          const now = Math.floor(Date.now() / 1000)

          return state.resetAt > now
        }),

      waitUntilReset: (kind) =>
        Effect.gen(function* () {
          const state = yield* snapshot(kind)

          if (!state) {
            return
          }

          const now = Math.floor(Date.now() / 1000)
          const waitSeconds = Math.max(0, state.resetAt - now)
          const waitMs = (waitSeconds + 5) * 1000

          if (waitMs > 0) {
            yield* Effect.sleep(waitMs)
          }
        })
    }
  })
)
