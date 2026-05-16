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
    background:
      'bg-[var(--status-success-foreground)] text-[var(--status-success)]',
    ring: 'ring-[var(--status-success)]'
  },
  'changes-requested': {
    background:
      'bg-[var(--status-danger-foreground)] text-[var(--status-danger)]',
    ring: 'ring-[var(--status-danger)]'
  },
  commented: {
    background: 'bg-amber-500 text-amber-50',
    ring: 'ring-amber-500'
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
      {status === 'approved' && <Check className="size-2.5" strokeWidth={3} />}

      {status === 'changes-requested' && (
        <X className="size-2.5" strokeWidth={3} />
      )}

      {status === 'commented' && (
        <MoreHorizontal className="size-2.5" strokeWidth={3} />
      )}
    </span>
  )
}
