import { Link } from 'react-router'

import type { Review } from '@/types/pull-request'
import { Badge } from '@/app/components/ui/badge'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@/app/components/ui/tooltip'

interface ReviewBadgeProps {
  review: Review
  repositoryOwner: string
  repositoryName: string
  pullRequestNumber: number
}

export function ReviewBadge({
  review,
  repositoryOwner,
  repositoryName,
  pullRequestNumber
}: ReviewBadgeProps) {
  const isApproved = review.state === 'APPROVED'
  const isChangesRequested = review.state === 'CHANGES_REQUESTED'

  const badgeColor = isApproved
    ? 'bg-status-success border-status-success-border text-status-success-foreground'
    : isChangesRequested
      ? 'bg-status-danger border-status-danger-border text-status-danger-foreground'
      : 'bg-status-neutral border-status-neutral-border text-status-neutral-foreground'

  const reviewText = isApproved
    ? 'Approved'
    : isChangesRequested
      ? 'Requested changes'
      : 'Commented'

  const tooltipText = isApproved
    ? `${review.author.login} approved these changes`
    : isChangesRequested
      ? `${review.author.login} requested changes`
      : `${review.author.login} left review comments`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={`text-[11px] px-3 py-1 flex items-center gap-1.5 ${badgeColor} cursor-pointer`}
        >
          <img
            src={review.author.avatarUrl}
            alt={review.author.login}
            className="size-4 rounded-full ring-1 ring-foreground/10"
          />
          <Link
            className="hover:underline"
            to={`${repositoryOwner}/${repositoryName}/${pullRequestNumber.toString()}#reviews`}
          >
            {reviewText}
          </Link>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}
