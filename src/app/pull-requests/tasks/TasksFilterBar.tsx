import type { ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import type { TasksFilter } from './task-types'

interface TasksFilterBarProps {
  doneCount: number
  filter: TasksFilter
  onChangeFilter: (filter: TasksFilter) => void
  totalCount: number
}

const filterOptions: Array<{ key: TasksFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'blockers', label: 'Blockers' }
]

export function TasksFilterBar({
  doneCount,
  filter,
  onChangeFilter,
  totalCount
}: TasksFilterBarProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="inline-flex gap-0.5 rounded-md border border-border bg-card p-0.5">
        {filterOptions.map((option) => {
          const isSelected = option.key === filter

          return (
            <button
              key={option.key}
              aria-pressed={isSelected}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs transition-colors',
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

      <span className="text-xs text-muted-foreground tabular-nums">
        {doneCount} of {totalCount} done
      </span>
    </div>
  )
}
