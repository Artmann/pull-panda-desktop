import type { UpdateStatus } from '../../lib/updates'
import { makeElectronUpdater } from './electron-updater'
import { updateMessages, type Updater } from './updater'

// The first check waits until startup has settled, then the app checks a few
// times a day. Squirrel downloads in the background, so a long-running session
// still ends up one restart away from the latest release.
const initialCheckDelayMs = 30 * 1000
const checkIntervalMs = 6 * 60 * 60 * 1000

// Long enough for the IPC reply to reach the renderer before the app starts
// quitting under it.
const installDelayMs = 250

let updater: Updater | null = null
let initialCheckTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null

export function startUpdates(
  onStatusChanged: (status: UpdateStatus) => void
): void {
  if (updater) {
    return
  }

  const created = makeElectronUpdater()

  created.onChange(onStatusChanged)
  updater = created

  initialCheckTimer = setTimeout(() => created.check(), initialCheckDelayMs)
  intervalTimer = setInterval(() => created.check(), checkIntervalMs)
}

export function stopUpdates(): void {
  if (initialCheckTimer) {
    clearTimeout(initialCheckTimer)
  }

  if (intervalTimer) {
    clearInterval(intervalTimer)
  }

  initialCheckTimer = null
  intervalTimer = null

  updater?.dispose()
  updater = null
}

export function getUpdateStatus(): UpdateStatus | null {
  return updater?.status() ?? null
}

export function checkForUpdates(): UpdateStatus | null {
  updater?.check()

  return getUpdateStatus()
}

// Claims the install and hands it to Squirrel shortly after, which quits the
// app and relaunches it on the new version. Throws when nothing is ready, so
// the renderer's invoke rejects instead of waiting for a restart that never
// comes.
export function installUpdate(): UpdateStatus {
  const current = updater
  const status = current?.beginInstall() ?? null

  if (!current || status === null) {
    throw new Error(updateMessages.notReady)
  }

  setTimeout(() => current.completeInstall(), installDelayMs)

  return status
}
