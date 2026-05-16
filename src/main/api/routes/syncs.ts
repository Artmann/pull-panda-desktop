import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  syncPullRequests,
  syncStalePullRequests
} from '../../../sync/operations/sync-pull-requests'
import { getSyncRuntime } from '../../../sync/runtime'
import { ResourceEventBus } from '../../../sync/services/resource-event-bus'

import type { AppEnv } from './comments'

export const syncsRoute = new Hono<AppEnv>()

syncsRoute.post('/', (context) => {
  const runtime = getSyncRuntime()

  const program = Effect.gen(function* () {
    const eventBus = yield* ResourceEventBus

    const probeResult = yield* Effect.either(syncPullRequests)

    if (probeResult._tag === 'Left') {
      console.error(
        'Manual sync: failed to fetch pull requests:',
        probeResult.left
      )
      yield* eventBus.emitSyncComplete

      return
    }

    yield* syncStalePullRequests(probeResult.right.syncedIds).pipe(
      Effect.catchAll((error) => {
        console.error('Manual sync: failed to reconcile stale PRs:', error)

        return Effect.succeed(0)
      })
    )

    yield* eventBus.emitSyncComplete
  })

  runtime.runPromise(program).catch((error) => {
    console.error('Manual sync failed:', error)
  })

  return context.json({ success: true })
})
