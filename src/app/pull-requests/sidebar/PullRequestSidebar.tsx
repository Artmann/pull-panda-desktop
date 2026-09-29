import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { useLocation } from 'react-router'

import { getCheckRollup, type CheckRollup } from '@/app/components/check-rollup'
import { extractPullRequestId } from '@/app/commands/context'
import { useAppSelector } from '@/app/store/hooks'
import type { Check } from '@/types/pull-request-details'

import {
  buildRows,
  emptyFilters,
  filterRows,
  hasActiveFilters,
  sortRows,
  type SidebarFilters,
  type SortId
} from './sidebar-data'
import { SidebarList } from './SidebarList'
import { SidebarSearchHeader } from './SidebarSearchHeader'
import { useAdvancePastDeparture } from './use-advance-past-departure'
import { useDepartingRows } from './use-departing-rows'
import { useSidebarSelection } from './use-sidebar-selection'
import { useSidebarWidth } from './use-sidebar-width'

function buildCheckRollups(checks: Check[]): Map<string, CheckRollup> {
  const byPullRequest = new Map<string, Check[]>()

  for (const check of checks) {
    const existing = byPullRequest.get(check.pullRequestId)

    if (existing) {
      existing.push(check)
    } else {
      byPullRequest.set(check.pullRequestId, [check])
    }
  }

  const rollups = new Map<string, CheckRollup>()

  for (const [pullRequestId, items] of byPullRequest) {
    rollups.set(pullRequestId, getCheckRollup(items))
  }

  return rollups
}

export function PullRequestSidebar(): ReactElement {
  const location = useLocation()

  const pullRequests = useAppSelector((state) => state.pullRequests.items)
  const checks = useAppSelector((state) => state.checks.items)

  const [filters, setFilters] = useState<SidebarFilters>(emptyFilters)
  const [sort, setSort] = useState<SortId>('needs')

  const { startResize, width } = useSidebarWidth()

  const selectedId = extractPullRequestId(location.pathname)

  const checkRollups = useMemo(() => buildCheckRollups(checks), [checks])

  // Open pull requests only. One that has just been merged or closed is held
  // back for a moment by `useDepartingRows` so its row can fade out.
  const listed = useMemo(
    () => pullRequests.filter((pullRequest) => pullRequest.state === 'OPEN'),
    [pullRequests]
  )

  const allRows = useMemo(
    () => buildRows(listed, checkRollups),
    [checkRollups, listed]
  )

  const liveRows = useMemo(
    () => sortRows(filterRows(allRows, filters), sort),
    [allRows, filters, sort]
  )

  const advancePastDeparture = useAdvancePastDeparture(liveRows, selectedId)

  const { departingIds, rows: visibleRows } = useDepartingRows(
    liveRows,
    pullRequests,
    advancePastDeparture
  )

  const select = useSidebarSelection(visibleRows, selectedId)

  return (
    <>
      <aside
        aria-label="Pull requests"
        className="bg-sidebar border-sidebar-border flex min-h-0 shrink-0 flex-col border-r"
        style={{ width: `${width.toString()}px` }}
      >
        <SidebarSearchHeader
          allRows={allRows}
          filters={filters}
          onFiltersChange={setFilters}
          resultCount={visibleRows.length}
        />

        <SidebarList
          departingIds={departingIds}
          hasFilters={hasActiveFilters(filters)}
          onClearFilters={() => setFilters(emptyFilters)}
          onSelect={select}
          onSortChange={setSort}
          rows={visibleRows}
          selectedId={selectedId}
          sort={sort}
        />
      </aside>

      <div
        aria-hidden
        className="hover:bg-primary/60 -ml-0.5 w-1 shrink-0 cursor-col-resize transition-colors"
        onMouseDown={startResize}
      />
    </>
  )
}
