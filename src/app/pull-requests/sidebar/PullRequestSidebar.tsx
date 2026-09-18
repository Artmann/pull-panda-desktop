import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { getCheckRollup, type CheckRollup } from '@/app/components/check-rollup'
import { extractPullRequestId } from '@/app/commands/context'
import { setSidebarNavigation } from '@/app/commands/sidebar-accessor'
import { useAppSelector } from '@/app/store/hooks'
import type { Check } from '@/types/pull-request-details'

import {
  buildRows,
  emptyFilters,
  filterRows,
  hasActiveFilters,
  sortOptions,
  sortRows,
  stepIndex,
  type SidebarFilters,
  type SortId
} from './sidebar-data'
import { SidebarList } from './SidebarList'
import { SidebarSearchHeader } from './SidebarSearchHeader'
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
  const navigate = useNavigate()

  const pullRequests = useAppSelector((state) => state.pullRequests.items)
  const checks = useAppSelector((state) => state.checks.items)

  const [filters, setFilters] = useState<SidebarFilters>(emptyFilters)
  const [sort, setSort] = useState<SortId>('needs')

  const { startResize, width } = useSidebarWidth()

  const selectedId = extractPullRequestId(location.pathname)

  const checkRollups = useMemo(() => buildCheckRollups(checks), [checks])

  // Open pull requests only, plus whichever one is open right now — merging a
  // pull request from the detail page should not make it vanish underneath you.
  const listed = useMemo(
    () =>
      pullRequests.filter(
        (pullRequest) =>
          pullRequest.state === 'OPEN' || pullRequest.id === selectedId
      ),
    [pullRequests, selectedId]
  )

  const allRows = useMemo(
    () => buildRows(listed, checkRollups),
    [checkRollups, listed]
  )

  const visibleRows = useMemo(
    () => sortRows(filterRows(allRows, filters), sort),
    [allRows, filters, sort]
  )

  const select = useCallback(
    (pullRequestId: string) => {
      navigate(`/pull-requests/${pullRequestId}`)
    },
    [navigate]
  )

  const step = useCallback(
    (offset: number) => {
      const next = stepIndex(visibleRows, selectedId, offset)

      if (next !== undefined) {
        select(visibleRows[next].pullRequest.id)
      }
    },
    [select, selectedId, visibleRows]
  )

  useEffect(() => {
    setSidebarNavigation({
      selectNext: () => step(1),
      selectPrevious: () => step(-1)
    })

    return () => {
      setSidebarNavigation(null)
    }
  }, [step])

  const sortLabel =
    sortOptions.find((option) => option.id === sort)?.label ?? ''

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
          onSortChange={setSort}
          resultCount={visibleRows.length}
          sort={sort}
        />

        <SidebarList
          hasFilters={hasActiveFilters(filters)}
          onClearFilters={() => setFilters(emptyFilters)}
          onSelect={select}
          rows={visibleRows}
          selectedId={selectedId}
          sortLabel={sortLabel}
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
