import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'

import { RateLimitTracker, RateLimitTrackerLive } from './rate-limit-tracker'

const runWithLayer = <A>(effect: Effect.Effect<A, never, RateLimitTracker>) =>
  Effect.runPromise(Effect.provide(effect, RateLimitTrackerLive))

describe('RateLimitTracker', () => {
  it('returns null snapshot before any update', async () => {
    const result = await runWithLayer(
      Effect.flatMap(RateLimitTracker, (tracker) => tracker.snapshot('rest'))
    )

    expect(result).toEqual(null)
  })

  it('updates rest state from headers and tracks separately from graphql', async () => {
    const program = Effect.gen(function* () {
      const tracker = yield* RateLimitTracker

      yield* tracker.updateFromHeaders('rest', {
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '2000000000'
      })

      const rest = yield* tracker.snapshot('rest')
      const graphql = yield* tracker.snapshot('graphql')

      return { rest, graphql }
    })

    const result = await runWithLayer(program)

    expect(result.rest?.remaining).toEqual(4500)
    expect(result.rest?.limit).toEqual(5000)
    expect(result.rest?.resetAt).toEqual(2000000000)
    expect(result.graphql).toEqual(null)
  })

  it('ignores header updates missing rate-limit fields', async () => {
    const program = Effect.gen(function* () {
      const tracker = yield* RateLimitTracker

      yield* tracker.updateFromHeaders('rest', { 'content-type': 'json' })

      return yield* tracker.snapshot('rest')
    })

    const result = await runWithLayer(program)

    expect(result).toEqual(null)
  })

  it('updates graphql state from GraphQL rateLimit object', async () => {
    const program = Effect.gen(function* () {
      const tracker = yield* RateLimitTracker

      yield* tracker.updateFromGraphQLRateLimit({
        remaining: 4200,
        limit: 5000,
        resetAt: '2033-05-18T03:33:20.000Z'
      })

      return yield* tracker.snapshot('graphql')
    })

    const result = await runWithLayer(program)

    expect(result?.remaining).toEqual(4200)
    expect(result?.limit).toEqual(5000)
    expect(result?.resetAt).toEqual(2000000000)
  })

  it('does not pause when quota is healthy', async () => {
    const program = Effect.gen(function* () {
      const tracker = yield* RateLimitTracker

      yield* tracker.updateFromHeaders('rest', {
        'x-ratelimit-remaining': '4000',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
      })

      return yield* tracker.shouldPause('rest')
    })

    const result = await runWithLayer(program)

    expect(result).toEqual(false)
  })

  it('pauses when quota is below threshold and reset is in the future', async () => {
    const program = Effect.gen(function* () {
      const tracker = yield* RateLimitTracker

      yield* tracker.updateFromHeaders('rest', {
        'x-ratelimit-remaining': '4',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600)
      })

      return yield* tracker.shouldPause('rest')
    })

    const result = await runWithLayer(program)

    expect(result).toEqual(true)
  })

  it('does not pause when quota is depleted but reset has passed', async () => {
    const program = Effect.gen(function* () {
      const tracker = yield* RateLimitTracker

      yield* tracker.updateFromHeaders('rest', {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1000'
      })

      return yield* tracker.shouldPause('rest')
    })

    const result = await runWithLayer(program)

    expect(result).toEqual(false)
  })
})
