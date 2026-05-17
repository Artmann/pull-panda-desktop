import { Layer, ManagedRuntime } from 'effect'

import { makeAppLayer, type AppLayer } from './layer'

export type AppRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<AppLayer>,
  never
>

let runtime: AppRuntime | null = null

export function initializeAppRuntime(
  getToken: () => string | null
): AppRuntime {
  if (runtime) {
    return runtime
  }

  runtime = ManagedRuntime.make(makeAppLayer(getToken))

  return runtime
}

export function getAppRuntime(): AppRuntime {
  if (!runtime) {
    throw new Error(
      'App runtime not initialized. Call initializeAppRuntime() first.'
    )
  }

  return runtime
}

// Non-throwing accessor for shutdown paths that may run before the runtime is
// initialized (e.g. the `electron-squirrel-startup` early-quit flow). All
// other call sites should keep using `getAppRuntime()` so misuse stays loud.
export function tryGetAppRuntime(): AppRuntime | null {
  return runtime
}

export async function disposeAppRuntime(): Promise<void> {
  if (runtime) {
    await runtime.dispose()
    runtime = null
  }
}
