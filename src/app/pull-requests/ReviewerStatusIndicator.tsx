import { Check, MoreHorizontal, X } from 'lucide-react'
import type { ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

export type ReviewerStatus =
  | 'approved'
  | 'changes-requested'
  | 'commented'
  | 'pending'

interface ReviewerStatusIndicatorProps {
  status: ReviewerStatus
}

const statusStyles: Record<
  Exclude<ReviewerStatus, 'pending'>,
  { background: string; ring: string }
> = {
  approved: {
    background: 'bg-status-success-foreground text-status-success',
    ring: 'ring-status-success'
  },
  'changes-requested': {
    background: 'bg-status-danger-foreground text-status-danger',
    ring: 'ring-status-danger'
  },
  commented: {
    background: 'bg-status-warning-foreground text-status-warning',
    ring: 'ring-status-warning'
  }
}

export function ReviewerStatusIndicator({
  status
}: ReviewerStatusIndicatorProps): ReactElement | null {
  if (status === 'pending') {
    return null
  }

  const style = statusStyles[status]

  return (
    <span
      aria-hidden
      className={cn(
        'absolute -bottom-0.5 -right-0.5',
        'flex items-center justify-center',
        'size-3.5 rounded-full',
        'ring-2 ring-background',
        style.background
      )}
    >
      {status === 'approved' && (
        <Check
          className="size-2.5"
          strokeWidth={3}
        />
      )}

      {status === 'changes-requested' && (
        <X
          className="size-2.5"
          strokeWidth={3}
        />
      )}

      {status === 'commented' && (
        <MoreHorizontal
          className="size-2.5"
          strokeWidth={3}
        />
      )}
    </span>
  )
}
