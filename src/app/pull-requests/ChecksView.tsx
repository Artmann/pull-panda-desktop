import dayjs from 'dayjs'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  Loader2Icon,
  XCircleIcon
} from 'lucide-react'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'

import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/lib/utils'
import { useAppSelector } from '@/app/store/hooks'
import type { Check } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { Duration } from './components/Duration'

export function ChecksView({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const details = useAppSelector(
    (state) => state.pullRequestDetails[pullRequest.id]
  )
  const allChecks = details?.checks ?? []

  // Deduplicate checks by name, keeping the most recent one.
  const checksByName = new Map<string, Check>()

  for (const check of allChecks) {
    const existing = checksByName.get(check.name)

    if (!existing || new Date(check.syncedAt) > new Date(existing.syncedAt)) {
      checksByName.set(check.name, check)
    }
  }
  const checks = Array.from(checksByName.values())

  const checksGroupedBySuiteName = checks.reduce<Record<string, typeof checks>>(
    (accumulator, check) => {
      const suiteName = check.suiteName ?? 'Unknown'

      if (!accumulator[suiteName]) {
        accumulator[suiteName] = []
      }

      accumulator[suiteName].push(check)

      return accumulator
    },
    {}
  )

  const sortedSuiteNames = Object.keys(checksGroupedBySuiteName).sort()

  if (checks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No checks found.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 text-sm pt-6">
      <div className="flex flex-col gap-6">
        {sortedSuiteNames.map((suiteName) => {
          const suiteChecks = (checksGroupedBySuiteName[suiteName] || []).sort(
            (a, b) => a.name.localeCompare(b.name)
          )

          const hasFailingChecks = suiteChecks.some(
            (check) =>
              check.conclusion?.toLowerCase() === 'failure' ||
              check.conclusion?.toLowerCase() === 'startup_failure'
          )
          const hasRunningChecks = suiteChecks.some(isRunning)
          const hasCancelledChecks = suiteChecks.some(
            (check) => check.conclusion?.toLowerCase() === 'cancelled'
          )
          const allChecksAreSuccessful = suiteChecks.every(
            (check) => check.conclusion?.toLowerCase() === 'success'
          )

          const getSuiteStatus = () => {
            if (hasFailingChecks) {
              return 'failure'
            }

            if (hasRunningChecks) {
              return 'running'
            }

            if (hasCancelledChecks) {
              return 'cancelled'
            }

            if (allChecksAreSuccessful) {
              return 'success'
            }

            return 'pending'
          }

          return (
            <div key={suiteName}>
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <StatusIcon status={getSuiteStatus()} />
                </div>

                <div className="font-medium">{suiteName}</div>
                <div>
                  <StatusBadge status={getSuiteStatus()} />
                </div>
              </div>

              <div className="flex flex-col gap-2 pl-4">
                {suiteChecks.map((check) => (
                  <CheckRow
                    key={check.id}
                    url={check.detailsUrl}
                  >
                    <div>
                      <CheckStatusIcon check={check} />
                    </div>

                    <div className="flex-1">
                      <div className="font-medium group-hover:text-accent-foreground transition-colors">
                        {check.name}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {check.message ?? ''}
                      </div>
                    </div>

                    <div className="text-muted-foreground text-xs">
                      <CheckDuration check={check} />
                    </div>

                    <div className="text-muted-foreground text-xs w-4">
                      {check.detailsUrl && (
                        <ExternalLinkIcon className="size-3 text-muted-foreground" />
                      )}
                    </div>
                  </CheckRow>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CheckDuration({ check }: { check: Check }): ReactElement {
  const [durationInSeconds, setDurationInSeconds] = useState(
    check.durationInSeconds ?? 0
  )

  useEffect(() => {
    const handler = setInterval(() => {
      const duration = isRunning(check)
        ? calculateRunningCheckDuration(check)
        : check.durationInSeconds

      setDurationInSeconds(duration ?? 0)
    }, 100)

    return () => {
      clearInterval(handler)
    }
  }, [
    check.id,
    check.state,
    check.durationInSeconds,
    check.gitHubCreatedAt,
    check
  ])

  return <Duration timeInSeconds={durationInSeconds} />
}

function isRunning(check: Check): boolean {
  return (
    check.state?.toLowerCase() === 'in_progress' ||
    check.state?.toLowerCase() === 'queued'
  )
}

function calculateRunningCheckDuration(check: Check): number {
  if (!check.gitHubCreatedAt) {
    console.warn('gitHubCreatedAt is missing for check:', check.id)

    return check.durationInSeconds ?? 0
  }

  const startTime = dayjs(check.gitHubCreatedAt)
  const currentTime = dayjs()

  return currentTime.diff(startTime, 'seconds')
}

function CheckRow({
  children,
  url
}: {
  children: ReactNode
  url?: string | null
}): ReactElement {
  const classNames = cn(
    'py-2 px-3',
    'rounded-md',
    'group',
    'flex items-center gap-3',
    'transition-colors hover:bg-muted/50'
  )

  if (url) {
    const handleClick = (event: React.MouseEvent) => {
      event.preventDefault()
      window.electron.openUrl(url)
    }

    return (
      <a
        className={cn(classNames, 'cursor-pointer')}
        href={url}
        onClick={handleClick}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    )
  }

  return <div className={classNames}>{children}</div>
}

function CheckStatusIcon({ check }: { check: Check }): ReactElement {
  if (check.state?.toLowerCase() === 'in_progress') {
    return <Loader2Icon className="size-3 text-yellow-600 animate-spin" />
  }

  if (check.state?.toLowerCase() === 'queued') {
    return <ClockIcon className="size-3 text-yellow-600" />
  }

  if (check.conclusion?.toLowerCase() === 'success') {
    return <CheckCircle2Icon className="size-3 text-green-600" />
  }

  if (
    ['failure', 'startup_failure'].includes(
      check.conclusion?.toLowerCase() ?? ''
    )
  ) {
    return <XCircleIcon className="size-3 text-red-600" />
  }

  if (
    ['neutral', 'cancelled', 'stale', 'skipped'].includes(
      check.conclusion?.toLowerCase() ?? ''
    )
  ) {
    return <AlertTriangleIcon className="size-3 text-gray-500" />
  }

  if (check.state?.toLowerCase() === 'timed_out') {
    return <ClockIcon className="size-3 text-yellow-600" />
  }

  if (check.state?.toLowerCase() === 'action_required') {
    return <AlertTriangleIcon className="size-3 text-yellow-600" />
  }

  return <ClockIcon className="size-3 text-yellow-600" />
}

function StatusIcon({ status }: { status: string }): ReactElement {
  if (status === 'success') {
    return <CheckCircle2Icon className="size-4 text-green-600" />
  }

  if (status === 'failure') {
    return <XCircleIcon className="size-4 text-red-600" />
  }

  if (status === 'running') {
    return <Loader2Icon className="size-4 text-yellow-600 animate-spin" />
  }

  if (status === 'pending') {
    return <Loader2Icon className="size-4 text-yellow-600 animate-spin" />
  }

  if (status === 'cancelled') {
    return <AlertTriangleIcon className="size-4 text-gray-500" />
  }

  return <ClockIcon className="size-4 text-gray-400" />
}

function StatusBadge({ status }: { status: string }): ReactElement {
  if (status === 'success') {
    return (
      <Badge
        className="bg-green-50 text-green-700 border-green-200"
        variant="secondary"
      >
        Success
      </Badge>
    )
  }

  if (status === 'running') {
    return (
      <Badge
        className="bg-yellow-50 text-yellow-700 border-yellow-200"
        variant="secondary"
      >
        Running
      </Badge>
    )
  }

  if (status === 'failure') {
    return <Badge variant="destructive">Failed</Badge>
  }

  if (status === 'pending') {
    return (
      <Badge
        className="bg-yellow-50 text-yellow-700 border-yellow-200"
        variant="secondary"
      >
        Pending
      </Badge>
    )
  }

  if (status === 'cancelled') {
    return (
      <Badge
        className="bg-gray-50 text-gray-600 border-gray-200"
        variant="secondary"
      >
        Cancelled
      </Badge>
    )
  }

  return <Badge variant="secondary">Unknown</Badge>
}
