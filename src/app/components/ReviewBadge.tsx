import type { Review } from '@/types/pull-request-details'
import { Badge } from '@/app/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'

interface ReviewBadgeProps {
  review: Review
}

export function ReviewBadge({ review }: ReviewBadgeProps) {
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
    ? `${review.authorLogin} approved these changes`
    : isChangesRequested
      ? `${review.authorLogin} requested changes`
      : `${review.authorLogin} left review comments`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={`text-[11px] px-3 py-1 flex items-center gap-1.5 ${badgeColor}`}
        >
          {review.authorAvatarUrl && (
            <img
              alt={review.authorLogin ?? ''}
              className="size-4 rounded-full ring-1 ring-foreground/10"
              src={review.authorAvatarUrl}
            />
          )}
          {reviewText}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}
