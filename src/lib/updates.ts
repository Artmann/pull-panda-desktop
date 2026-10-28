// The update status the main process shares with the renderer. Lives outside
// `src/main` so the preload and the renderer can import the types without
// pulling in Electron's main-process modules.

export type UpdateState =
  // A newer version exists but this platform cannot install it itself.
  | 'available'
  | 'checking'
  | 'downloading'
  | 'error'
  | 'idle'
  // On disk and installing it is one restart away.
  | 'ready'
  | 'unsupported'

export interface UpdateStatus {
  currentVersion: string
  lastCheckedAt: number | null
  message: string | null
  releaseNotesUrl: string | null
  state: UpdateState
  version: string | null
}
