import type { ReactElement } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { cn } from '@/app/lib/utils'
import type { Review } from '@/types/pull-request-details'

interface ReviewBadgeProps {
  review: Review
}

export function ReviewBadge({ review }: ReviewBadgeProps): ReactElement {
  const isApproved = review.state === 'APPROVED'
  const isChangesRequested = review.state === 'CHANGES_REQUESTED'

  const colorClass = isApproved
    ? 'text-[var(--status-success-foreground)]'
    : isChangesRequested
      ? 'text-[var(--status-danger-foreground)]'
      : 'text-muted-foreground'

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
        <span
          className={cn(
            'inline-flex items-center gap-1.5',
            'rounded-full border border-current/60',
            'px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
            colorClass
          )}
        >
          {review.authorAvatarUrl ? (
            <img
              alt={review.authorLogin ?? ''}
              className="size-3 rounded-full ring-1 ring-current/20"
              src={review.authorAvatarUrl}
            />
          ) : (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-current"
            />
          )}
          {reviewText}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}
