import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type ReactElement } from 'react'

import { maximumJumpShortcuts } from '@/app/commands/sidebar-accessor'

import { PullRequestSidebarRow } from './PullRequestSidebarRow'
import { countLabel, type SidebarRow, type SortId } from './sidebar-data'
import { SidebarSortMenu } from './SidebarSortMenu'
import { useModifierHeld } from './use-modifier-held'

// Two lines of text plus padding, and the 4px gap below each row. Rows are a
// fixed height in practice; `measureElement` corrects anything that is not.
const estimatedRowHeight = 64

function initialViewportHeight(): number {
  return typeof window === 'undefined' ? 800 : window.innerHeight
}

interface SidebarListProps {
  hasFilters: boolean
  onClearFilters: () => void
  onSelect: (pullRequestId: string) => void
  onSortChange: (sort: SortId) => void
  rows: readonly SidebarRow[]
  selectedId: string | undefined
  sort: SortId
}

export function SidebarList({
  hasFilters,
  onClearFilters,
  onSelect,
  onSortChange,
  rows,
  selectedId,
  sort
}: SidebarListProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const isModifierHeld = useModifierHeld()

  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => estimatedRowHeight,
    getItemKey: (index) => rows[index].pullRequest.id,
    getScrollElement: () => scrollRef.current,
    // Seed the viewport so the first paint renders a screenful rather than
    // nothing; the real height replaces it as soon as the container is
    // measured.
    initialRect: { height: initialViewportHeight(), width: 0 },
    measureElement: (element) =>
      element.getBoundingClientRect().height || estimatedRowHeight,
    overscan: 8
  })

  const selectedIndex = rows.findIndex(
    (row) => row.pullRequest.id === selectedId
  )

  // Keep the selected row on screen when it moves by keyboard rather than
  // click, and when a re-sort moves it. `auto` leaves the scroll position alone
  // when the row is already visible. Keyed on the index so ordinary data
  // refreshes do not yank the list.
  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
    }
  }, [selectedIndex, virtualizer])

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <>
      <div className="text-muted-foreground flex shrink-0 items-center justify-between gap-2 px-3 pt-2.5 pb-3 text-2xs font-semibold tracking-wider uppercase">
        <span className="shrink-0 whitespace-nowrap">
          {countLabel(rows.length)}
        </span>

        <SidebarSortMenu
          onSortChange={onSortChange}
          sort={sort}
        />
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto pr-2 pb-4"
      >
        {rows.length === 0 ? (
          <SidebarEmptyState
            hasFilters={hasFilters}
            onClearFilters={onClearFilters}
          />
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize().toString()}px` }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full pb-1"
                  data-index={virtualRow.index}
                  style={{
                    transform: `translateY(${virtualRow.start.toString()}px)`
                  }}
                >
                  <PullRequestSidebarRow
                    hotkey={
                      isModifierHeld && virtualRow.index < maximumJumpShortcuts
                        ? virtualRow.index + 1
                        : undefined
                    }
                    isSelected={row.pullRequest.id === selectedId}
                    onSelect={onSelect}
                    row={row}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function SidebarEmptyState({
  hasFilters,
  onClearFilters
}: {
  hasFilters: boolean
  onClearFilters: () => void
}): ReactElement {
  return (
    <div className="text-muted-foreground px-3 py-6 text-center text-xs leading-relaxed">
      {hasFilters ? 'No pull requests match' : 'No open pull requests'}

      {hasFilters && (
        <>
          <br />

          <button
            className="text-primary cursor-pointer hover:underline"
            onClick={onClearFilters}
            type="button"
          >
            Clear filters
          </button>
        </>
      )}
    </div>
  )
}
