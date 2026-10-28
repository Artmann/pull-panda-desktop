import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { UpdateStatus } from '@/lib/updates'

const installFailedMessage =
  'The update could not be started. Try again, or download it from the release page.'

// A manual check only reports back once it settles. Squirrel always answers,
// but a toast spinning forever would be worse than giving up quietly.
const checkTimeoutMs = 60 * 1000

const readyToastId = 'update-ready'

export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  // Subscribes to an external source, which is what effects are for.
  useEffect(() => {
    let isActive = true

    const unsubscribe = window.updater.onStatusChanged(setStatus)

    window.updater
      .getStatus()
      .then((current) => {
        // A pushed status that arrived first is newer than this answer.
        if (isActive) {
          setStatus((previous) => previous ?? current)
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load the update status:', error)
      })

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

  return status
}

// Resolves to whether the restart was scheduled. A failure is shown as a toast
// here, so callers only need to reset their own pending state.
function installUpdate(): Promise<boolean> {
  return window.updater
    .install()
    .then(() => true)
    .catch((error: unknown) => {
      console.error('Failed to install the update:', error)
      toast.error(installFailedMessage)

      return false
    })
}

// Stays installing once the restart is scheduled: the window is about to
// close, and a second click could only fail.
export function useInstallUpdate(): {
  install: () => void
  isInstalling: boolean
} {
  const [isInstalling, setIsInstalling] = useState(false)

  const install = (): void => {
    setIsInstalling(true)

    // installUpdate reports its own failures and never rejects.
    void installUpdate().then((scheduled) => {
      if (!scheduled) {
        setIsInstalling(false)
      }
    })
  }

  return { install, isInstalling }
}

export function updateHeading(status: UpdateStatus): string {
  const subject =
    status.version === null ? 'An update' : `Pull Panda ${status.version}`

  return status.state === 'ready'
    ? `${subject} is ready`
    : `${subject} is available`
}

export function describeUpdateStatus(status: UpdateStatus): string {
  switch (status.state) {
    case 'available':
      return `${updateHeading(status)}. ${status.message ?? ''}`.trim()

    case 'checking':
      return 'Checking for updates…'

    case 'downloading':
      return 'Downloading the latest version…'

    case 'error':
    case 'unsupported':
      return status.message ?? 'Updates are unavailable.'

    case 'idle':
      return status.lastCheckedAt === null
        ? 'Pull Panda checks for updates automatically.'
        : `Up to date. Last checked ${new Date(status.lastCheckedAt).toLocaleString()}.`

    case 'ready':
      return `${updateHeading(status)}. Restart Pull Panda to finish installing it.`
  }
}

export function showUpdateReadyToast(status: UpdateStatus): void {
  toast.success(updateHeading(status), {
    action: {
      label: 'Restart',
      onClick: () => {
        // installUpdate reports its own failures and never rejects.
        void installUpdate()
      }
    },
    description: 'Restart Pull Panda to finish installing it.',
    duration: Infinity,
    id: readyToastId
  })
}

export function openReleasePage(url: string): void {
  window.electron.openUrl(url).catch((error: unknown) => {
    console.error('Failed to open the release page:', error)
    toast.error('Could not open the release page in your browser.')
  })
}

function showAvailableToast(
  toastId: string | number,
  status: UpdateStatus
): void {
  const url = status.releaseNotesUrl

  toast.info(updateHeading(status), {
    action:
      url === null
        ? undefined
        : { label: 'Open release page', onClick: () => openReleasePage(url) },
    description: status.message ?? undefined,
    id: toastId
  })
}

// Turns the outcome of a manual check into the toast that was showing
// "Checking for updates…".
export function reportCheckResult(
  toastId: string | number,
  status: UpdateStatus
): void {
  switch (status.state) {
    case 'available':
      showAvailableToast(toastId, status)
      break

    case 'downloading':
      toast.info('Downloading the update', {
        description: 'Pull Panda will let you know when it is ready.',
        id: toastId
      })
      break

    case 'error':
    case 'unsupported':
      toast.error(describeUpdateStatus(status), { id: toastId })
      break

    case 'idle':
      toast.success(`Pull Panda ${status.currentVersion} is up to date.`, {
        id: toastId
      })
      break

    case 'ready':
      toast.dismiss(toastId)
      showUpdateReadyToast(status)
      break

    case 'checking':
      break
  }
}

// Starts a check and reports how it went in a single toast.
export function checkForUpdates(): void {
  const toastId = toast.loading('Checking for updates…')

  let settled = false

  const settle = (status: UpdateStatus | null): void => {
    if (settled) {
      return
    }

    settled = true
    unsubscribe()
    clearTimeout(timeout)

    if (status === null) {
      toast.error('Could not check for updates.', { id: toastId })

      return
    }

    reportCheckResult(toastId, status)
  }

  const unsubscribe = window.updater.onStatusChanged((status) => {
    if (status.state !== 'checking') {
      settle(status)
    }
  })

  const timeout = setTimeout(() => {
    settled = true
    unsubscribe()
    toast.dismiss(toastId)
  }, checkTimeoutMs)

  window.updater
    .check()
    .then((status) => {
      // A check that could not start (already downloading, already ready,
      // unsupported) answers right away instead of through an event.
      if (status === null || status.state !== 'checking') {
        settle(status)
      }
    })
    .catch((error: unknown) => {
      console.error('Failed to check for updates:', error)
      settle(null)
    })
}
