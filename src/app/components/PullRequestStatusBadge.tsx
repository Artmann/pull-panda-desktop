import { useMemo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'
import { PullRequest } from '@/types/pull-request'
import { Badge } from './ui/badge'

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

  const statusColorClasses = useMemo((): string => {
    const colorMap: Record<PullRequestStatus, string> = {
      Approved:
        'bg-status-success border-status-success-border text-status-success-foreground',
      'Changes Requested':
        'bg-status-danger border-status-danger-border text-status-danger-foreground',
      Closed:
        'bg-status-danger border-status-danger-border text-status-danger-foreground',
      Draft:
        'bg-status-neutral border-status-neutral-border text-status-neutral-foreground',
      Merged:
        'bg-status-merged border-status-merged-border text-status-merged-foreground',
      Pending: 'bg-primary text-primary-foreground border-transparent'
    }

    return colorMap[status]
  }, [status])

  return (
    <Badge
      variant="outline"
      className={cn(statusColorClasses, 'capitalize text-[10px]')}
    >
      {status}
    </Badge>
  )
}
