import { CircleArrowUpIcon } from 'lucide-react'
import { type ReactElement } from 'react'

import {
  openReleasePage,
  updateHeading,
  useInstallUpdate,
  useUpdateStatus
} from '@/app/lib/updates'
import type { UpdateStatus } from '@/lib/updates'

import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface UpdateIndicatorViewProps {
  isInstalling: boolean
  onInstall: () => void
  onOpenReleasePage: (url: string) => void
  status: UpdateStatus | null
}

// Absent from the footer unless there is something to act on: an update that
// is ready to install, or one this platform has to download by hand.
export function UpdateIndicatorView({
  isInstalling,
  onInstall,
  onOpenReleasePage,
  status
}: UpdateIndicatorViewProps): ReactElement | null {
  if (
    status === null ||
    (status.state !== 'available' && status.state !== 'ready')
  ) {
    return null
  }

  const heading = updateHeading(status)
  const releaseNotesUrl = status.releaseNotesUrl

  return (
    <Popover>
      <PopoverTrigger
        aria-label={heading}
        className="flex items-center gap-1 text-xs text-primary hover:brightness-125"
        title={heading}
        type="button"
      >
        <CircleArrowUpIcon className="size-3.5" />

        {status.state === 'ready' ? 'Restart to update' : 'Update available'}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="flex flex-col gap-3 text-sm"
      >
        <div className="flex flex-col gap-1">
          <p className="font-medium">{heading}</p>

          <p className="text-xs text-muted-foreground">
            {status.state === 'ready'
              ? 'Pull Panda will restart to finish installing. This takes a moment.'
              : status.message}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {status.state === 'ready' ? (
            <Button
              // Stays disabled once the restart is scheduled: the window is
              // about to close, and a second click could only fail.
              disabled={isInstalling}
              size="sm"
              onClick={onInstall}
            >
              {isInstalling ? 'Restarting…' : 'Restart to update'}
            </Button>
          ) : null}

          {releaseNotesUrl !== null ? (
            <Button
              size="sm"
              variant={status.state === 'ready' ? 'ghost' : 'outline'}
              onClick={() => onOpenReleasePage(releaseNotesUrl)}
            >
              {status.state === 'ready' ? 'Release notes' : 'Open release page'}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function UpdateIndicator(): ReactElement | null {
  const status = useUpdateStatus()
  const { install, isInstalling } = useInstallUpdate()

  return (
    <UpdateIndicatorView
      isInstalling={isInstalling}
      status={status}
      onInstall={install}
      onOpenReleasePage={openReleasePage}
    />
  )
}
