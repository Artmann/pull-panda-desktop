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

    if (approvalCount > 1) {
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
      Approved: 'bg-[oklch(0.52_0.17_150)] text-white border-transparent',
      'Changes Requested':
        'bg-[oklch(0.52_0.19_25)] text-white border-transparent',
      Closed: 'bg-[oklch(0.52_0.19_25)] text-white border-transparent',
      Draft: 'bg-[oklch(0.55_0.02_270)] text-white border-transparent',
      Merged: 'bg-[oklch(0.50_0.20_300)] text-white border-transparent',
      Pending: 'bg-[oklch(0.55_0.16_260)] text-white border-transparent'
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
