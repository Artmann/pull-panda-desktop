import { ArrowDownUp, Check } from 'lucide-react'
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
      <PopoverTrigger
        aria-label={`Sort: ${activeLabel}`}
        className={cn(
          'flex size-7.5 shrink-0 items-center justify-center rounded-md border',
          'cursor-pointer transition-colors',
          'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
          isOpen
            ? 'border-primary/60 bg-primary/10 text-primary'
            : 'border-input text-muted-foreground hover:text-foreground'
        )}
        title={`Sort: ${activeLabel}`}
        type="button"
      >
        <ArrowDownUp className="size-3.5" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-52 p-1.5"
      >
        <div className="text-muted-foreground px-2 py-1.5 font-mono text-2xs tracking-widest uppercase">
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
