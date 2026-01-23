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
      Approved: 'bg-green-100 text-green-800 border-green-200',
      'Changes Requested': 'bg-red-100 text-red-800 border-red-200',
      Closed: 'bg-red-100 text-red-800 border-red-200',
      Draft: 'bg-gray-100 text-gray-800 border-gray-200',
      Merged: 'bg-purple-100 text-purple-800 border-purple-200',
      Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }

    return colorMap[status]
  }, [status])

  return (
    <Badge
      variant="outline"
      className={cn(statusColorClasses, 'capitalize text-xs')}
    >
      {status}
    </Badge>
  )
}
