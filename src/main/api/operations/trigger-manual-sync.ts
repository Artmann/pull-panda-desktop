import { Effect } from 'effect'

import { requestManualSync } from '../../sync-requests'

// Hands the request to the list sync scheduler, which runs it right away (or
// right after a sync already in flight) and pushes the result to the renderer.
export const triggerManualSync = Effect.sync(() => {
  requestManualSync()

  return { success: true } as const
})
