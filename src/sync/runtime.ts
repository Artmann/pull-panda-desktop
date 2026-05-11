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

export async function disposeSyncRuntime(): Promise<void> {
  if (runtime) {
    await runtime.dispose()
    runtime = null
  }
}
