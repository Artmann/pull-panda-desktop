import { useMemo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'
import { PullRequest } from '@/types/pull-request'

type PullRequestStatus =
  | 'Approved'
  | 'Changes Requested'
  | 'Closed'
  | 'Draft'
  | 'Merged'
  | 'Pending'

interface PullRequestStatusBadgeProps {
  pullRequest: PullRequest
}

export function PullRequestStatusBadge({
  pullRequest
}: PullRequestStatusBadgeProps): ReactElement {
  const { approvalCount, changesRequestedCount } = pullRequest

  const status = useMemo((): PullRequestStatus => {
    if (pullRequest.state === 'MERGED') {
      return 'Merged'
    }

    if (pullRequest.state === 'CLOSED') {
      return 'Closed'
    }

    if (changesRequestedCount > 0) {
      return 'Changes Requested'
    }

    if (approvalCount > 0) {
      return 'Approved'
    }

    if (pullRequest.isDraft) {
      return 'Draft'
    }

    return 'Pending'
  }, [
    approvalCount,
    changesRequestedCount,
    pullRequest.isDraft,
    pullRequest.state
  ])

  const colorClass = useMemo((): string => {
    const map: Record<PullRequestStatus, string> = {
      Approved: 'text-[var(--status-success-foreground)]',
      'Changes Requested': 'text-[var(--status-danger-foreground)]',
      Closed: 'text-[var(--status-danger-foreground)]',
      Draft: 'text-muted-foreground',
      Merged: 'text-[var(--status-merged-foreground)]',
      Pending: 'text-[var(--status-warning-foreground)]'
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
