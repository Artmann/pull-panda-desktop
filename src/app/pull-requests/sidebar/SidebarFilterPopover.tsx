import { Check, ListFilter, Search } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import { Input } from '@/app/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/app/components/ui/popover'
import { cn } from '@/app/lib/utils'

import {
  buildFacetValues,
  countActiveFilters,
  countLabel,
  facets,
  toggleFilterValue,
  type FacetKey,
  type SidebarFilters,
  type SidebarRow
} from './sidebar-data'

interface SidebarFilterPopoverProps {
  /** Every row, before filtering — the facet counts describe the whole set. */
  allRows: readonly SidebarRow[]
  filters: SidebarFilters
  onFiltersChange: (filters: SidebarFilters) => void
  resultCount: number
}

export function SidebarFilterPopover({
  allRows,
  filters,
  onFiltersChange,
  resultCount
}: SidebarFilterPopoverProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [activeFacet, setActiveFacet] = useState<FacetKey>('repos')
  const [facetQuery, setFacetQuery] = useState('')

  const activeFilterCount = countActiveFilters(filters)

  const facet = facets.find((entry) => entry.key === activeFacet) ?? facets[0]
  const isSearchable = facet.key !== 'flags'

  const values = useMemo(
    () => buildFacetValues(allRows, facet.key),
    [allRows, facet.key]
  )

  const visibleValues = useMemo(() => {
    const query = facetQuery.trim().toLowerCase()

    if (query.length === 0) {
      return values
    }

    return values.filter((value) => value.label.toLowerCase().includes(query))
  }, [facetQuery, values])

  const selectFacet = (key: FacetKey) => {
    setActiveFacet(key)
    setFacetQuery('')
  }

  return (
    <Popover
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <PopoverTrigger
        aria-label="Filter pull requests"
        className={cn(
          'relative flex size-7.5 shrink-0 items-center justify-center rounded-md border',
          'cursor-pointer transition-colors',
          'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
          isOpen || activeFilterCount > 0
            ? 'border-primary/60 bg-primary/10 text-primary'
            : 'border-input text-muted-foreground hover:text-foreground'
        )}
        title="Filter"
        type="button"
      >
        <ListFilter className="size-3.5" />

        {activeFilterCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-2xs font-semibold tabular-nums leading-none">
            {activeFilterCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-64 p-0"
      >
        <div className="flex gap-0.5 p-1.5 pb-0">
          {facets.map((entry) => {
            const count = filters[entry.key].length

            return (
              <button
                key={entry.key}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs whitespace-nowrap',
                  'cursor-pointer transition-colors',
                  'focus-visible:ring-ring outline-none focus-visible:ring-2',
                  entry.key === facet.key
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => selectFacet(entry.key)}
                type="button"
              >
                {entry.label}

                {count > 0 && (
                  <span className="text-primary text-xs tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {isSearchable && (
          <div className="px-2 pt-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3 -translate-y-1/2" />

              <Input
                className="pl-7"
                maxLength={100}
                onChange={(event) => setFacetQuery(event.target.value)}
                placeholder={`Search ${facet.label.toLowerCase()}`}
                size="sm"
                type="text"
                value={facetQuery}
              />
            </div>
          </div>
        )}

        <div className="flex max-h-52 flex-col gap-px overflow-y-auto p-1.5">
          {visibleValues.map((value) => {
            const isChecked = filters[facet.key].includes(value.label)

            return (
              <button
                key={value.label}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-left',
                  'cursor-pointer transition-colors',
                  'focus-visible:ring-ring outline-none focus-visible:ring-2',
                  isChecked ? 'bg-accent' : 'hover:bg-accent/50'
                )}
                onClick={() =>
                  onFiltersChange(
                    toggleFilterValue(filters, facet.key, value.label)
                  )
                }
                type="button"
              >
                <span
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-xs border',
                    isChecked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input'
                  )}
                >
                  {isChecked && <Check className="size-2.5" />}
                </span>

                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-xs',
                    isChecked ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {value.label}
                </span>

                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {value.count}
                </span>
              </button>
            )
          })}

          {visibleValues.length === 0 && (
            <div className="text-muted-foreground px-2 py-6 text-center text-xs">
              No matches
            </div>
          )}
        </div>

        <div className="border-border bg-muted/40 flex items-center justify-between gap-2 border-t px-3 py-2">
          <button
            className={cn(
              'text-xs whitespace-nowrap transition-colors',
              'focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2',
              activeFilterCount > 0
                ? 'text-foreground hover:text-primary cursor-pointer'
                : 'text-muted-foreground/50 cursor-default'
            )}
            disabled={activeFilterCount === 0}
            onClick={() => {
              onFiltersChange({ ...filters, authors: [], flags: [], repos: [] })
              setFacetQuery('')
            }}
            type="button"
          >
            Clear all
          </button>

          <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
            {countLabel(resultCount)}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
