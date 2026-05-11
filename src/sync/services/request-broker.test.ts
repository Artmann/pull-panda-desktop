import { Effect, Fiber, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import { RequestBroker, RequestBrokerLive } from './request-broker'

const runWithLayer = <A>(effect: Effect.Effect<A, never, RequestBroker>) =>
  Effect.runPromise(Effect.provide(effect, RequestBrokerLive))

describe('RequestBroker', () => {
  it('runs an effect under withSlot and returns its value', async () => {
    const program = Effect.gen(function* () {
      const broker = yield* RequestBroker

      return yield* broker.withSlot('rest', Effect.succeed(42))
    })

    const result = await runWithLayer(program)

    expect(result).toEqual(42)
  })

  it('propagates effect errors through withSlot', async () => {
    const program = Effect.gen(function* () {
      const broker = yield* RequestBroker

      return yield* broker.withSlot('rest', Effect.fail('boom'))
    })

    const result = await Effect.runPromise(
      Effect.provide(Effect.either(program), RequestBrokerLive)
    )

    expect(result._tag).toEqual('Left')
    expect(result._tag === 'Left' ? result.left : null).toEqual('boom')
  })

  it('recordCost is a no-op for zero or negative costs', async () => {
    const program = Effect.gen(function* () {
      const broker = yield* RequestBroker

      yield* broker.recordCost('rest', 0)
      yield* broker.recordCost('graphql', -10)

      return yield* broker.withSlot('rest', Effect.succeed('ok'))
    })

    const result = await runWithLayer(program)

    expect(result).toEqual('ok')
  })

  it('admits concurrent effects within the permit cap', async () => {
    const program = Effect.gen(function* () {
      const broker = yield* RequestBroker
      const counter = yield* Ref.make(0)

      const task = broker.withSlot(
        'rest',
        Effect.gen(function* () {
          yield* Ref.update(counter, (n) => n + 1)

          return yield* Ref.get(counter)
        })
      )

      const fibers = yield* Effect.forEach(
        Array.from({ length: 5 }),
        () => Effect.fork(task),
        { concurrency: 'unbounded' }
      )

      yield* Effect.forEach(fibers, Fiber.join, { discard: true })

      return yield* Ref.get(counter)
    })

    const result = await runWithLayer(program)

    expect(result).toEqual(5)
  })

  it('tracks rest and graphql cost windows independently', async () => {
    const program = Effect.gen(function* () {
      const broker = yield* RequestBroker

      yield* broker.recordCost('rest', 100)
      yield* broker.recordCost('graphql', 200)

      const rest = yield* broker.withSlot('rest', Effect.succeed('rest-ok'))
      const graphql = yield* broker.withSlot(
        'graphql',
        Effect.succeed('graphql-ok')
      )

      return { rest, graphql }
    })

    const result = await runWithLayer(program)

    expect(result).toEqual({ rest: 'rest-ok', graphql: 'graphql-ok' })
  })
})
