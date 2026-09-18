import { Search } from 'lucide-react'
import { type ReactElement } from 'react'

import { Input } from '@/app/components/ui/input'

import { SidebarFilterPopover } from './SidebarFilterPopover'
import { SidebarSortMenu } from './SidebarSortMenu'
import type { SidebarFilters, SidebarRow, SortId } from './sidebar-data'

interface SidebarSearchHeaderProps {
  allRows: readonly SidebarRow[]
  filters: SidebarFilters
  onFiltersChange: (filters: SidebarFilters) => void
  onSortChange: (sort: SortId) => void
  resultCount: number
  sort: SortId
}

export function SidebarSearchHeader({
  allRows,
  filters,
  onFiltersChange,
  onSortChange,
  resultCount,
  sort
}: SidebarSearchHeaderProps): ReactElement {
  return (
    <div className="border-sidebar-border flex shrink-0 items-center gap-1.5 border-b px-3 py-2.5">
      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3 -translate-y-1/2" />

        <Input
          className="pl-7"
          maxLength={100}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="Search pull requests"
          size="sm"
          type="text"
          value={filters.query}
        />
      </div>

      <SidebarFilterPopover
        allRows={allRows}
        filters={filters}
        onFiltersChange={onFiltersChange}
        resultCount={resultCount}
      />

      <SidebarSortMenu
        onSortChange={onSortChange}
        sort={sort}
      />
    </div>
  )
}
