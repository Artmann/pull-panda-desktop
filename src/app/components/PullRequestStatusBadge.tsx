import { useMemo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'
import { PullRequest } from '@/types/pull-request'

import {
  getPullRequestStatus,
  type PullRequestStatus
} from './pull-request-status'

interface PullRequestStatusBadgeProps {
  pullRequest: PullRequest
}

export function PullRequestStatusBadge({
  pullRequest
}: PullRequestStatusBadgeProps): ReactElement {
  const status = useMemo(() => getPullRequestStatus(pullRequest), [pullRequest])

  const colorClass = useMemo((): string => {
    const map: Record<PullRequestStatus, string> = {
      Approved: 'text-status-success-foreground',
      'Changes Requested': 'text-status-danger-foreground',
      Closed: 'text-status-danger-foreground',
      Draft: 'text-muted-foreground',
      Merged: 'text-status-merged-foreground',
      Pending: 'text-status-warning-foreground'
    }

    return map[status]
  }, [status])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'rounded-full border border-current/60',
        'px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
        colorClass
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {status}
    </span>
  )
}
