import { Effect } from 'effect'

import {
  syncPullRequests,
  syncStalePullRequests
} from '../../../sync/operations/sync-pull-requests'
import { ResourceEventBus } from '../../../sync/services/resource-event-bus'

export const triggerManualSync = Effect.gen(function* () {
  const eventBus = yield* ResourceEventBus

  const work = Effect.gen(function* () {
    const probe = yield* Effect.either(syncPullRequests)

    if (probe._tag === 'Left') {
      console.error('Manual sync: failed to fetch pull requests:', probe.left)
      yield* eventBus.emitSyncComplete

      return
    }

    yield* syncStalePullRequests(probe.right.syncedIds).pipe(
      Effect.catchAll((error) => {
        console.error('Manual sync: failed to reconcile stale PRs:', error)

        return Effect.succeed(0)
      })
    )

    yield* eventBus.emitSyncComplete
  })

  // forkDaemon detaches the fiber from the request scope so the response can
  // return immediately while the sync runs in the background.
  yield* Effect.forkDaemon(work)

  return { success: true } as const
})
