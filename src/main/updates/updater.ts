// Pull Panda's self-update state machine.
//
// Electron's autoUpdater is fire-and-forget: `checkForUpdates()` returns
// nothing and every outcome arrives as an event, with no way to ask it what it
// is currently doing. This module owns that missing state and translates the
// events into it, so the rest of the app has a single value to read.
//
// The state machine is deliberately free of Electron and of `fetch`: both
// arrive through an UpdateBackend, so the transitions can be driven by a fake.
// `./electron-updater.ts` builds the real backends.

import invariant from 'tiny-invariant'

import type { UpdateStatus } from '../../lib/updates'

// How a backend reports the outcome of a check. A backend calls exactly one of
// these per check, except Squirrel, which reports `downloading` first and
// `downloaded` once the transfer finishes.
export interface UpdateHandlers {
  downloaded(version: string | null): void
  downloading(): void
  failed(error: unknown): void
  // A newer version exists that this platform cannot install itself, so the
  // backend supplies the message explaining what the user should do instead.
  found(version: string, message: string): void
  notFound(): void
}

export interface UpdateBackend {
  check(): void
  install(): void
  // Registering the listeners once and returning their removal keeps them off
  // the long-lived Electron singleton after the updater is disposed.
  subscribe(handlers: UpdateHandlers): () => void
}

export interface UpdaterOptions {
  backend: UpdateBackend
  currentVersion: string
  // Swallowing the cause would make a failed update undiagnosable, but the
  // state machine should not own the logger either.
  logError: (message: string) => void
  now: () => number
  // When set, the updater is inert and reports this as its message: there is no
  // update path from here, and the reason is something the user can act on.
  unsupported: string | null
}

export interface Updater {
  // Claims the install: the ready status when this caller got it, null when
  // nothing is ready or someone already holds it — the caller's cue to answer
  // the request with an error rather than restarting the app. Only one caller
  // can ever hold the claim, so the app can only be told to swap itself once.
  beginInstall(): UpdateStatus | null
  check(): void
  // Hands the claimed install to the backend. Reachable only by whoever
  // `beginInstall` said yes to.
  completeInstall(): void
  dispose(): void
  // Called with the new status after every transition. Returns the removal.
  onChange(listener: (status: UpdateStatus) => void): () => void
  status(): UpdateStatus
}

const repository = 'Artmann/pull-panda-desktop'

export const updateMessages = {
  checkFailed:
    'Pull Panda could not check for updates. Check your internet connection — it will try again automatically.',
  developmentBuild: 'Updates are only available in a packaged build.',
  downloadFailed:
    'The update could not be downloaded. Pull Panda will try again later, or you can download it from the release page.',
  linux:
    'Pull Panda cannot update itself on Linux. Download the latest .deb or .rpm from the release page.',
  notInApplicationsFolder:
    'Pull Panda cannot update itself from this location. Move Pull Panda to your Applications folder and restart it to get updates.',
  notReady: 'No update is ready to install yet.'
}

// Squirrel hands us a release *name*, not a version, and on Windows it is the
// only argument populated at all. Pull the version out rather than trusting the
// name to be a bare tag.
export function parseVersion(releaseName: string | null): string | null {
  if (releaseName === null) {
    return null
  }

  const match = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/.exec(releaseName)

  return match === null ? null : match[1]
}

export function releaseNotesUrl(version: string | null): string {
  if (version === null) {
    return `https://github.com/${repository}/releases/latest`
  }

  return `https://github.com/${repository}/releases/tag/v${version}`
}

export function latestReleaseApiUrl(): string {
  return `https://api.github.com/repos/${repository}/releases/latest`
}

function releaseParts(version: string): number[] {
  // Everything from the first prerelease or build separator on is dropped: a
  // prerelease sorts below its own release, which the caller handles.
  const core = version.replace(/^v/, '').split(/[-+]/)[0]

  return core.split('.').map((part) => Number.parseInt(part, 10))
}

// Hand-rolled rather than pulling in `semver` for one comparison. Only handles
// what release-please produces — `x.y.z`, optionally with a prerelease suffix,
// optionally `v`-prefixed.
export function isNewerVersion(current: string, candidate: string): boolean {
  const currentParts = releaseParts(current)
  const candidateParts = releaseParts(candidate)

  const unreadable =
    currentParts.length !== 3 ||
    candidateParts.length !== 3 ||
    [...currentParts, ...candidateParts].some((part) => Number.isNaN(part))

  if (unreadable) {
    // An unreadable version is not grounds for offering an update.
    return false
  }

  for (let index = 0; index < 3; index++) {
    if (candidateParts[index] !== currentParts[index]) {
      return candidateParts[index] > currentParts[index]
    }
  }

  // Same `x.y.z`: a prerelease of a version we already run is not an upgrade.
  return false
}

// Reads GitHub's latest-release response and returns its version when it is
// newer than the one running, or null when there is nothing to update to.
export function newerReleaseVersion(
  release: unknown,
  currentVersion: string
): string | null {
  const tagName =
    typeof release === 'object' &&
    release !== null &&
    'tag_name' in release &&
    typeof release.tag_name === 'string'
      ? release.tag_name
      : null

  if (tagName === null) {
    throw new Error('The latest GitHub release has no tag name.')
  }

  const version = parseVersion(tagName)

  if (version === null || !isNewerVersion(currentVersion, version)) {
    return null
  }

  return version
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// What the updater is doing right now. Nothing else is ever in flight: an
// install is claimed rather than reported, and by the time one is handed over
// the process is on its way out.
type Activity = 'checking' | 'downloading' | 'idle'

// What the last completed check learned, and the only thing that owns a
// message, a version, or a notes URL. Held apart from the activity so a check
// in flight never carries the message of the one before it.
type Knowledge =
  | { kind: 'available'; message: string; version: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' }
  | { kind: 'ready'; version: string | null }
  | { kind: 'unsupported'; message: string }

export function createUpdater(options: UpdaterOptions): Updater {
  const { backend, currentVersion, logError, now, unsupported } = options

  let activity: Activity = 'idle'

  // One-way: once someone holds the claim the process is on its way out, so
  // there is nothing to release it for.
  let claimed = false

  let knowledge: Knowledge =
    unsupported === null
      ? { kind: 'none' }
      : { kind: 'unsupported', message: unsupported }

  let lastCheckedAt: number | null = null

  const listeners = new Set<(status: UpdateStatus) => void>()

  // The one place the two halves become the flat status the renderer reads. An
  // activity outranks the knowledge behind it.
  function project(): UpdateStatus {
    const base = { currentVersion, lastCheckedAt }

    if (activity !== 'idle') {
      return {
        ...base,
        message: null,
        releaseNotesUrl: null,
        state: activity,
        version: null
      }
    }

    switch (knowledge.kind) {
      case 'available':
        return {
          ...base,
          message: knowledge.message,
          releaseNotesUrl: releaseNotesUrl(knowledge.version),
          state: 'available',
          version: knowledge.version
        }

      case 'error':
        return {
          ...base,
          message: knowledge.message,
          releaseNotesUrl: null,
          state: 'error',
          version: null
        }

      case 'none':
        return {
          ...base,
          message: null,
          releaseNotesUrl: null,
          state: 'idle',
          version: null
        }

      case 'ready':
        return {
          ...base,
          message: null,
          releaseNotesUrl: releaseNotesUrl(knowledge.version),
          state: 'ready',
          version: knowledge.version
        }

      case 'unsupported':
        return {
          ...base,
          message: knowledge.message,
          releaseNotesUrl: null,
          state: 'unsupported',
          version: null
        }
    }
  }

  function notify(): void {
    const status = project()

    for (const listener of listeners) {
      listener(status)
    }
  }

  function fail(error: unknown, message: string): void {
    activity = 'idle'
    knowledge = { kind: 'error', message }
    lastCheckedAt = now()

    logError(`Pull Panda could not update itself: ${describeError(error)}`)
    notify()
  }

  // An inert updater must not attach listeners: on an unpackaged build touching
  // the feed at all throws, and there is nothing to listen to anyway.
  const unsubscribe =
    unsupported === null
      ? backend.subscribe({
          downloaded: (version) => {
            activity = 'idle'
            knowledge = { kind: 'ready', version }
            lastCheckedAt = now()
            notify()
          },

          downloading: () => {
            activity = 'downloading'
            notify()
          },

          failed: (error) => {
            // Which message applies depends on how far the attempt got, and
            // only the activity it is ending still knows that.
            fail(
              error,
              activity === 'downloading'
                ? updateMessages.downloadFailed
                : updateMessages.checkFailed
            )
          },

          found: (version, message) => {
            activity = 'idle'
            knowledge = { kind: 'available', message, version }
            lastCheckedAt = now()
            notify()
          },

          notFound: () => {
            activity = 'idle'
            knowledge = { kind: 'none' }
            lastCheckedAt = now()
            notify()
          }
        })
      : (): void => undefined

  return {
    beginInstall(): UpdateStatus | null {
      // The claim is taken at ask time rather than at hand-off time. The
      // install reaches the backend on a short delay so the IPC reply can leave
      // first, and a second request in that gap must be refused, not told it
      // succeeded.
      if (project().state !== 'ready' || claimed) {
        return null
      }

      claimed = true

      return project()
    },

    check(): void {
      // Squirrel downloads the update again for every extra `checkForUpdates()`
      // call, and once one is ready there is nothing left to learn.
      const busy =
        activity !== 'idle' ||
        knowledge.kind === 'ready' ||
        knowledge.kind === 'unsupported'

      if (busy) {
        return
      }

      activity = 'checking'
      notify()

      try {
        backend.check()
      } catch (error) {
        fail(error, updateMessages.checkFailed)
      }
    },

    completeInstall(): void {
      invariant(claimed, 'The install was claimed before it was handed over.')

      backend.install()
    },

    dispose(): void {
      unsubscribe()
      listeners.clear()
    },

    onChange(listener: (status: UpdateStatus) => void): () => void {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },

    status(): UpdateStatus {
      return project()
    }
  }
}
