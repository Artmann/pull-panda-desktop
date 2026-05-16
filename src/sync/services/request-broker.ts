import { Context, Effect, Layer, Ref } from 'effect'

import type { RequestKind } from '../errors'

const defaultMaxConcurrent = 30
const defaultRestPointsPerMinute = 700
const defaultGraphqlPointsPerMinute = 1500
const windowMs = 60_000

interface PointEntry {
  timestamp: number
  cost: number
}

function trimWindow(window: PointEntry[]): PointEntry[] {
  const cutoff = Date.now() - windowMs

  return window.filter((entry) => entry.timestamp >= cutoff)
}

function windowCost(window: PointEntry[]): number {
  return window.reduce((sum, entry) => sum + entry.cost, 0)
}

export class RequestBroker extends Context.Tag('sync/RequestBroker')<
  RequestBroker,
  {
    readonly recordCost: (
      kind: RequestKind,
      cost: number
    ) => Effect.Effect<void>
    readonly withSlot: <A, E, R>(
      kind: RequestKind,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>
  }
>() {}

export const RequestBrokerLive: Layer.Layer<RequestBroker> = Layer.effect(
  RequestBroker,
  Effect.gen(function* () {
    const semaphore = yield* Effect.makeSemaphore(defaultMaxConcurrent)
    const restWindow = yield* Ref.make<PointEntry[]>([])
    const graphqlWindow = yield* Ref.make<PointEntry[]>([])

    const windowRef = (kind: RequestKind) =>
      kind === 'graphql' ? graphqlWindow : restWindow

    const budgetFor = (kind: RequestKind) =>
      kind === 'graphql'
        ? defaultGraphqlPointsPerMinute
        : defaultRestPointsPerMinute

    const waitForWindow = (kind: RequestKind): Effect.Effect<void> =>
      Effect.gen(function* () {
        const ref = windowRef(kind)
        const budget = budgetFor(kind)

        while (true) {
          const trimmed = yield* Ref.modify(ref, (entries) => {
            const next = trimWindow(entries)

            return [next, next]
          })

          if (windowCost(trimmed) < budget) {
            return
          }

          const oldest = trimmed[0]
          const waitMs = Math.max(50, oldest.timestamp + windowMs - Date.now())

          yield* Effect.sleep(waitMs)
        }
      })

    return {
      recordCost: (kind, cost) =>
        cost <= 0
          ? Effect.void
          : Ref.update(windowRef(kind), (entries) =>
              trimWindow([...entries, { timestamp: Date.now(), cost }])
            ),

      withSlot: (kind, effect) =>
        Effect.zipRight(waitForWindow(kind), semaphore.withPermits(1)(effect))
    }
  })
)
