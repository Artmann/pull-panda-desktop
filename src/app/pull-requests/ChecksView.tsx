import dayjs from 'dayjs'
import { ArrowUpRightIcon } from 'lucide-react'
import { memo, useEffect, useMemo, useState, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import { getLatestChecks } from '@/app/components/check-rollup'
import {
  StatusCircle,
  type StatusCircleState
} from '@/app/components/StatusCircle'
import { TimeAgo } from '@/app/components/TimeAgo'
import { firstPlainLine } from '@/app/lib/plain-text'
import { cn } from '@/app/lib/utils'
import { useAppSelector } from '@/app/store/hooks'
import type { Check } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { Duration } from './components/Duration'

type SuiteStatus = 'cancelled' | 'failure' | 'pending' | 'running' | 'success'

export const ChecksView = memo(function ChecksView({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const allChecks: Check[] = useAppSelector(
    (state) =>
      state.checks.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const suites = useMemo(() => {
    const grouped = getLatestChecks(allChecks).reduce<Record<string, Check[]>>(
      (accumulator, check) => {
        const suiteName = check.suiteName ?? 'Unknown'
        ;(accumulator[suiteName] ??= []).push(check)

        return accumulator
      },
      {}
    )

    return Object.keys(grouped)
      .sort()
      .map((name) => ({
        checks: grouped[name].sort((a, b) => a.name.localeCompare(b.name)),
        name
      }))
  }, [allChecks])

  if (suites.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No checks found.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7 pt-5 text-sm">
      {suites.map((suite) => (
        <section
          aria-label={suite.name}
          className="flex flex-col"
          key={suite.name}
        >
          <div className="flex items-center justify-between px-0.5 pb-2">
            <h3 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              {suite.name}
            </h3>

            <SuiteStatusPill status={getSuiteStatus(suite.checks)} />
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {suite.checks.map((check) => (
              <CheckRow
                check={check}
                key={check.id}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
})

function CheckRow({ check }: { check: Check }): ReactElement {
  const state = getCheckState(check)
  const detailsUrl = check.detailsUrl
  const summary = firstPlainLine(check.message)

  return (
    <div className="flex items-center gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0">
      <StatusCircle
        label={checkStateLabels[state]}
        state={state}
      />

      <div className="min-w-0 flex-1">
        <div className="font-medium">{check.name}</div>

        {summary ? (
          // One plain line, like the rest of the row. The full report is a
          // click away behind Logs.
          <div
            className={cn(
              'truncate text-xs',
              state === 'failure'
                ? 'text-status-danger-foreground'
                : 'text-muted-foreground'
            )}
            title={summary}
          >
            {summary}
          </div>
        ) : (
          state === 'running' &&
          check.gitHubCreatedAt && (
            <div className="text-xs text-muted-foreground">
              Running · started <TimeAgo dateTime={check.gitHubCreatedAt} />
            </div>
          )
        )}
      </div>

      <div className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        <CheckDuration check={check} />
      </div>

      {detailsUrl && (
        <button
          className="flex shrink-0 cursor-pointer items-center gap-0.5 text-xs text-primary hover:underline"
          onClick={() => {
            window.electron.openUrl(detailsUrl)
          }}
          title="Open the logs on GitHub"
          type="button"
        >
          Logs
          <ArrowUpRightIcon className="size-3" />
        </button>
      )}
    </div>
  )
}

const checkStateLabels: Record<StatusCircleState, string> = {
  failure: 'Failed',
  neutral: 'Skipped',
  running: 'Running',
  success: 'Passed',
  warning: 'Needs attention'
}

const failedConclusions = new Set([
  'error',
  'failure',
  'startup_failure',
  'timed_out'
])

function getCheckState(check: Check): StatusCircleState {
  const conclusion = check.conclusion?.toLowerCase() ?? ''

  if (isRunning(check)) {
    return 'running'
  }

  if (failedConclusions.has(conclusion)) {
    return 'failure'
  }

  if (conclusion === 'action_required') {
    return 'warning'
  }

  if (conclusion === 'success') {
    return 'success'
  }

  return 'neutral'
}

function getSuiteStatus(checks: Check[]): SuiteStatus {
  const states = checks.map(getCheckState)

  if (states.includes('failure')) {
    return 'failure'
  }

  if (states.includes('running')) {
    return 'running'
  }

  if (
    checks.some((check) => check.conclusion?.toLowerCase() === 'cancelled')
  ) {
    return 'cancelled'
  }

  const allCompleted = checks.every(
    (check) =>
      check.conclusion !== null || check.state?.toLowerCase() === 'completed'
  )

  return allCompleted ? 'success' : 'pending'
}

const suiteStatusPills: Record<SuiteStatus, { className: string; label: string }> =
  {
    cancelled: {
      className: 'bg-status-neutral text-status-neutral-foreground',
      label: 'Cancelled'
    },
    failure: {
      className: 'bg-status-danger text-status-danger-foreground',
      label: 'Failing'
    },
    pending: {
      className: 'bg-status-warning text-status-warning-foreground',
      label: 'Pending'
    },
    running: {
      className: 'bg-status-warning text-status-warning-foreground',
      label: 'In progress'
    },
    success: {
      className: 'bg-status-success text-status-success-foreground',
      label: 'All passed'
    }
  }

function SuiteStatusPill({ status }: { status: SuiteStatus }): ReactElement {
  const pill = suiteStatusPills[status]

  return (
    <span className={cn('rounded-full px-2 text-2xs', pill.className)}>
      {pill.label}
    </span>
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
