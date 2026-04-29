import { CheckIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import type { TasksFilter } from './task-types'

interface TasksFilterBarProps {
  filter: TasksFilter
  hideResolved: boolean
  onChangeFilter: (filter: TasksFilter) => void
  onToggleHideResolved: () => void
}

const filterOptions: Array<{ key: TasksFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'blockers', label: 'Blockers only' }
]

export function TasksFilterBar({
  filter,
  hideResolved,
  onChangeFilter,
  onToggleHideResolved
}: TasksFilterBarProps): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex gap-0.5 rounded-md border border-border bg-card p-0.5">
        {filterOptions.map((option) => {
          const isSelected = option.key === filter

          return (
            <button
              key={option.key}
              className={cn(
                'cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                onChangeFilter(option.key)
              }}
              type="button"
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      <button
        aria-pressed={hideResolved}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors',
          'text-muted-foreground hover:text-foreground'
        )}
        onClick={onToggleHideResolved}
        type="button"
      >
        <span
          className={cn(
            'flex size-3 items-center justify-center rounded-sm border',
            hideResolved
              ? 'border-status-success-border bg-status-success-foreground text-background'
              : 'border-border bg-transparent'
          )}
        >
          {hideResolved && <CheckIcon className="size-2.5" />}
        </span>
        Hide resolved
      </button>
    </div>
  )
}
