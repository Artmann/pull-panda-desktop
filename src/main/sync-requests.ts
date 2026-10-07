// Lets code outside main.ts (such as the HTTP API) ask for a pull request
// list sync without importing main.ts. main.ts registers the handler once
// the scheduler exists.
let manualSyncHandler: (() => void) | null = null

export function setManualSyncHandler(handler: (() => void) | null): void {
  manualSyncHandler = handler
}

export function requestManualSync(): boolean {
  if (!manualSyncHandler) {
    return false
  }

  manualSyncHandler()

  return true
}
