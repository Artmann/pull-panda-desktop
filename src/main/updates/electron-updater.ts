// The Electron half of self-updating: it decides whether this build can update
// itself at all, and builds the backend that talks to the outside world. The
// state machine it hands that backend to lives in `./updater.ts`.
import { app, autoUpdater, net } from 'electron'

import {
  createUpdater,
  latestReleaseApiUrl,
  newerReleaseVersion,
  parseVersion,
  updateMessages,
  type UpdateBackend,
  type UpdateHandlers,
  type Updater
} from './updater'

// A hung request must become a settled rejection rather than a check that stays
// 'checking' forever and blocks every later one.
const githubTimeoutMilliseconds = 10_000

// update.electronjs.org is the free Squirrel feed for public repositories. It
// serves the darwin zip and the Squirrel.Windows RELEASES file attached to the
// latest GitHub release whose tag is valid semver.
function feedUrl(): string {
  return `https://update.electronjs.org/Artmann/pull-panda-desktop/${process.platform}-${process.arch}/${app.getVersion()}`
}

// Why this build has no update path, or null when it does.
function unsupportedReason(): string | null {
  if (!app.isPackaged) {
    // setFeedURL throws outright on an unsigned development build.
    return updateMessages.developmentBuild
  }

  if (process.platform === 'darwin' && !app.isInApplicationsFolder()) {
    // Squirrel.Mac swaps the bundle in place, which it cannot do on the
    // read-only volume a DMG mounts as.
    return updateMessages.notInApplicationsFolder
  }

  return null
}

// Squirrel does the work on macOS and Windows: one call starts the check, and
// an available update downloads itself without being asked.
function squirrelBackend(): UpdateBackend {
  return {
    check(): void {
      autoUpdater.setFeedURL({ url: feedUrl() })
      autoUpdater.checkForUpdates()
    },

    install(): void {
      autoUpdater.quitAndInstall()
    },

    subscribe(handlers: UpdateHandlers): () => void {
      const onAvailable = (): void => handlers.downloading()
      const onError = (error: Error): void => handlers.failed(error)
      const onNotAvailable = (): void => handlers.notFound()

      const onDownloaded = (
        _event: unknown,
        _releaseNotes: string,
        releaseName: string
      ): void => handlers.downloaded(parseVersion(releaseName ?? null))

      // The quit-to-install path is the hardest one to observe live, so leave a
      // trace of it in the log.
      const onQuitForUpdate = (): void => {
        console.log('Quitting to install an update.')
      }

      autoUpdater.on('before-quit-for-update', onQuitForUpdate)
      autoUpdater.on('error', onError)
      autoUpdater.on('update-available', onAvailable)
      autoUpdater.on('update-downloaded', onDownloaded)
      autoUpdater.on('update-not-available', onNotAvailable)

      return () => {
        autoUpdater.removeListener('before-quit-for-update', onQuitForUpdate)
        autoUpdater.removeListener('error', onError)
        autoUpdater.removeListener('update-available', onAvailable)
        autoUpdater.removeListener('update-downloaded', onDownloaded)
        autoUpdater.removeListener('update-not-available', onNotAvailable)
      }
    }
  }
}

// Electron's autoUpdater has no Linux support at all, so Linux gets the honest
// version: notice the new release, then point at the download.
function githubBackend(): UpdateBackend {
  let handlers: UpdateHandlers | null = null

  const load = async (): Promise<void> => {
    // net.fetch rather than the global one, so the check honours Chromium's
    // proxy configuration and the system certificate store.
    const response = await net.fetch(latestReleaseApiUrl(), {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': `PullPanda/${app.getVersion()}`
      },
      signal: AbortSignal.timeout(githubTimeoutMilliseconds)
    })

    if (!response.ok) {
      throw new Error(
        `GitHub answered ${response.status} for the latest release.`
      )
    }

    const version = newerReleaseVersion(await response.json(), app.getVersion())

    if (version === null) {
      handlers?.notFound()

      return
    }

    handlers?.found(version, updateMessages.linux)
  }

  return {
    check(): void {
      load().catch((error: unknown) => handlers?.failed(error))
    },

    install(): void {
      // Unreachable: this backend never reports an update as downloaded, so the
      // state machine never reaches 'ready', which is the only state that
      // installs.
      throw new Error('Pull Panda cannot install updates on Linux.')
    },

    subscribe(next: UpdateHandlers): () => void {
      handlers = next

      return () => {
        handlers = null
      }
    }
  }
}

export function makeElectronUpdater(): Updater {
  const backend =
    process.platform === 'linux' ? githubBackend() : squirrelBackend()

  return createUpdater({
    backend,
    currentVersion: app.getVersion(),
    logError: (message: string) => console.error(message),
    now: () => Date.now(),
    unsupported: unsupportedReason()
  })
}
