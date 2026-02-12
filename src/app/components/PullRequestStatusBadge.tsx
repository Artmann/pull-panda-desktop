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
      Approved: 'bg-[#40a02b] text-white/70 border-transparent',
      'Changes Requested': 'bg-[#e64553] text-white/70 border-transparent',
      Closed: 'bg-[#e64553] text-white/70 border-transparent',
      Draft: 'bg-[#7c7f93] text-white/70 border-transparent',
      Merged: 'bg-[#8839ef] text-white/70 border-transparent',
      Pending: 'bg-[#7287fd] text-white/70 border-transparent'
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
