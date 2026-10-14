import { memo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import type { StatusCell, StatusSummary, StatusTone } from './status-summary'

// A faint wash of the status colour rather than the solid status border, so
// the outline reads as a tint of the gray dividers inside, not a second frame.
const borderClassNames: Record<StatusTone, string> = {
  danger: 'border-status-danger-foreground/30',
  neutral: 'border-border',
  success: 'border-status-success-foreground/30',
  warning: 'border-status-warning-foreground/30'
}

const dotClassNames: Record<StatusTone, string> = {
  danger: 'bg-status-danger-foreground',
  neutral: 'bg-muted-foreground',
  success: 'bg-status-success-foreground',
  warning: 'bg-status-warning-foreground'
}

const valueClassNames: Record<StatusTone, string> = {
  danger: 'text-status-danger-foreground',
  neutral: 'text-foreground',
  success: 'text-status-success-foreground',
  warning: 'text-status-warning-foreground'
}

/**
 * Four cells under the title that say whether the pull request can merge and,
 * if not, which part is in the way. The border takes the colour of the worst
 * cell, and each cell opens the tab that has the details.
 */
export const PullRequestStatusStrip = memo(function PullRequestStatusStrip({
  onSelectTab,
  summary
}: {
  onSelectTab: (tab: StatusCell['tab']) => void
  summary: StatusSummary
}): ReactElement {
  return (
    <section
      aria-label="Merge status"
      className={cn(
        'overflow-hidden rounded-lg border bg-card',
        borderClassNames[summary.tone]
      )}
    >
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {summary.cells.map((cell) => (
          <button
            className="flex min-w-0 cursor-pointer flex-col gap-0.5 bg-card px-3.5 pt-2.5 pb-3 text-left transition-colors hover:bg-muted/50"
            key={cell.key}
            onClick={() => {
              onSelectTab(cell.tab)
            }}
            type="button"
          >
            <span className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              <span
                aria-hidden
                className={cn('size-1.5 rounded-full', dotClassNames[cell.tone])}
              />
              {cell.label}
            </span>

            <span
              className={cn(
                'truncate text-xs font-semibold',
                valueClassNames[cell.tone]
              )}
            >
              {cell.value}
            </span>

            <span className="truncate text-xs text-muted-foreground">
              {cell.detail}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
})
