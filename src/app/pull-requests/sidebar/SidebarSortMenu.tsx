import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactElement } from 'react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/app/components/ui/popover'
import { cn } from '@/app/lib/utils'

import { sortOptions, type SortId } from './sidebar-data'

interface SidebarSortMenuProps {
  onSortChange: (sort: SortId) => void
  sort: SortId
}

export function SidebarSortMenu({
  onSortChange,
  sort
}: SidebarSortMenuProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  const activeLabel =
    sortOptions.find((option) => option.id === sort)?.label ?? ''

  return (
    <Popover
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      {/*
        The trigger is the caption itself, so it inherits the caption row's caps
        and tracking and has to opt back out: a sort order is a sentence, and
        setting it in caps beside the count is what made it read as a second
        label rather than as the control it is.
      */}
      <PopoverTrigger
        aria-label={`Sort: ${activeLabel}`}
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-sm',
          '-mx-1 -my-0.5 px-1 py-0.5',
          'text-2xs font-normal tracking-normal normal-case',
          'cursor-pointer transition-colors',
          'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
          isOpen
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        title={`Sort: ${activeLabel}`}
        type="button"
      >
        <span className="min-w-0 truncate">{activeLabel}</span>

        <ChevronDown className="size-3 shrink-0" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-52 p-1.5"
      >
        <div className="text-muted-foreground px-2 py-1.5 text-2xs font-semibold tracking-wider uppercase">
          Sort by
        </div>

        {sortOptions.map((option) => (
          <button
            key={option.id}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs',
              'cursor-pointer transition-colors',
              'focus-visible:ring-ring outline-none focus-visible:ring-2',
              option.id === sort
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
            onClick={() => {
              onSortChange(option.id)
              setIsOpen(false)
            }}
            type="button"
          >
            <span className="flex size-3 shrink-0 items-center justify-center">
              {option.id === sort && <Check className="text-primary size-3" />}
            </span>

            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
