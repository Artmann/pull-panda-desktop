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
    const result = yield* syncPullRequests.pipe(
      Effect.catchAll((error) => {
        console.error(
          'Manual sync: failed to fetch pull requests:',
          error
        )

        return Effect.succeed({
          synced: 0,
          syncedIds: new Set<string>(),
          errors: [String(error)],
          hasChanges: false
        })
      })
    )

    yield* syncStalePullRequests(result.syncedIds).pipe(
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
