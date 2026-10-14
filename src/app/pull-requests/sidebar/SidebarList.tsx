import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type ReactElement } from 'react'

import { maximumJumpShortcuts } from '@/app/commands/sidebar-accessor'
import { cn } from '@/app/lib/utils'

import { PullRequestSidebarRow } from './PullRequestSidebarRow'
import type { SidebarRow, SidebarView, SortId } from './sidebar-data'
import { SidebarSortMenu } from './SidebarSortMenu'
import { SidebarViewSwitch } from './SidebarViewSwitch'
import { useModifierHeld } from './use-modifier-held'

// Two lines of text plus padding, and the 4px gap below each row. Rows are a
// fixed height in practice; `measureElement` corrects anything that is not.
const estimatedRowHeight = 64

function initialViewportHeight(): number {
  return typeof window === 'undefined' ? 800 : window.innerHeight
}

interface SidebarListProps {
  /** Rows on their way out of the list — see `use-departing-rows`. */
  departingIds: ReadonlySet<string>
  hasFilters: boolean
  hiddenCount: number
  onClearFilters: () => void
  onSelect: (pullRequestId: string) => void
  onSortChange: (sort: SortId) => void
  onViewChange: (view: SidebarView) => void
  rows: readonly SidebarRow[]
  selectedId: string | undefined
  sort: SortId
  view: SidebarView
}

export function SidebarList({
  departingIds,
  hasFilters,
  hiddenCount,
  onClearFilters,
  onSelect,
  onSortChange,
  onViewChange,
  rows,
  selectedId,
  sort,
  view
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
        <SidebarViewSwitch
          count={rows.length}
          hiddenCount={hiddenCount}
          onViewChange={onViewChange}
          view={view}
        />

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
            view={view}
          />
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize().toString()}px` }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]

              const isDeparting = departingIds.has(row.pullRequest.id)

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  className={cn(
                    'absolute top-0 left-0 w-full pb-1',
                    // The row stays mounted for the whole fade, so this is a
                    // transition from the row as it was rather than an entry
                    // animation on a fresh node.
                    'transition-opacity duration-300 ease-out motion-reduce:transition-none',
                    isDeparting && 'pointer-events-none opacity-0'
                  )}
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

function emptyMessage(hasFilters: boolean, view: SidebarView): string {
  if (hasFilters) {
    return 'No pull requests match'
  }

  return view === 'hidden' ? 'No hidden pull requests' : 'No open pull requests'
}

function SidebarEmptyState({
  hasFilters,
  onClearFilters,
  view
}: {
  hasFilters: boolean
  onClearFilters: () => void
  view: SidebarView
}): ReactElement {
  return (
    <div className="text-muted-foreground px-3 py-6 text-center text-xs leading-relaxed">
      {emptyMessage(hasFilters, view)}

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
