import { Layer, ManagedRuntime } from 'effect'

import { makeSyncLayer, type SyncLayer } from './layer'

export type SyncRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<SyncLayer>,
  never
>

let runtime: SyncRuntime | null = null

export function initializeSyncRuntime(
  getToken: () => string | null
): SyncRuntime {
  if (runtime) {
    return runtime
  }

  runtime = ManagedRuntime.make(makeSyncLayer(getToken))

  return runtime
}

export function getSyncRuntime(): SyncRuntime {
  if (!runtime) {
    throw new Error(
      'Sync runtime not initialized. Call initializeSyncRuntime() first.'
    )
  }

  return runtime
}

// Non-throwing accessor for shutdown paths that may run before the runtime is
// initialized (e.g. the `electron-squirrel-startup` early-quit flow). All
// other call sites should keep using `getSyncRuntime()` so misuse stays loud.
export function tryGetSyncRuntime(): SyncRuntime | null {
  return runtime
}

export async function disposeSyncRuntime(): Promise<void> {
  if (runtime) {
    await runtime.dispose()
    runtime = null
  }
}
