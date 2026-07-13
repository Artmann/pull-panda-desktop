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

interface ReviewBadgeVariant {
  colorClass: string
  label: string
  tooltipSuffix: string
}

const fallbackVariant: ReviewBadgeVariant = {
  colorClass: 'text-muted-foreground',
  label: 'Commented',
  tooltipSuffix: 'left review comments'
}

const variantsByState: Record<string, ReviewBadgeVariant | undefined> = {
  APPROVED: {
    colorClass: 'text-status-success-foreground',
    label: 'Approved',
    tooltipSuffix: 'approved these changes'
  },
  CHANGES_REQUESTED: {
    colorClass: 'text-status-danger-foreground',
    label: 'Requested changes',
    tooltipSuffix: 'requested changes'
  }
}

export function ReviewBadge({ review }: ReviewBadgeProps): ReactElement {
  const variant = variantsByState[review.state] ?? fallbackVariant

  const tooltipText = `${review.authorLogin} ${variant.tooltipSuffix}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1.5',
            'rounded-full border border-current/60',
            'px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
            variant.colorClass
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
          {variant.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}
