import { useMemo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'
import { PullRequest } from '@/types/pull-request'

import {
  getPullRequestStatus,
  type PullRequestStatus
} from './pull-request-status'

// "Changes Requested" is too long for a narrow column, and the colour already
// carries most of the meaning there.
const compactLabels: Partial<Record<PullRequestStatus, string>> = {
  'Changes Requested': 'Changes'
}

interface PullRequestStatusBadgeProps {
  pullRequest: PullRequest
  size?: 'compact' | 'default'
}

export function PullRequestStatusBadge({
  pullRequest,
  size = 'default'
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

  const isCompact = size === 'compact'

  return (
    <span
      className={cn(
        'inline-flex items-center',
        'rounded-full border border-current/60',
        'font-medium whitespace-nowrap',
        isCompact
          ? 'gap-1 px-1.5 py-0 text-[10px]'
          : 'gap-1.5 px-2 py-0.5 text-[10px]',
        colorClass
      )}
      title={isCompact ? status : undefined}
    >
      <span
        aria-hidden
        className={cn(
          'rounded-full bg-current',
          isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'
        )}
      />
      {(isCompact && compactLabels[status]) || status}
    </span>
  )
}
