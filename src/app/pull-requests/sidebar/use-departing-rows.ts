import { useEffect, useMemo, useRef, useState } from 'react'

import type { PullRequest } from '@/types/pull-request'

import {
  getMergeReadiness,
  needsAttention,
  type SidebarRow
} from './sidebar-data'

/**
 * How long a row spends fading out before it leaves the list. Kept in step by
 * hand with the `duration-300` on the row wrapper in `SidebarList`.
 */
export const departureDurationMs = 300

/** A row on its way out, pinned to the index it held while it was still live. */
export interface Departure {
  index: number
  pullRequestId: string
  row: SidebarRow
}

export interface DepartureState {
  departures: ReadonlyMap<string, Departure>
  rows: readonly SidebarRow[]
}

interface DepartingRows {
  departingIds: ReadonlySet<string>
  rows: readonly SidebarRow[]
}

function pullRequestsById(
  pullRequests: readonly PullRequest[]
): Map<string, PullRequest> {
  return new Map(
    pullRequests.map((pullRequest) => [pullRequest.id, pullRequest])
  )
}

/**
 * The row as it should look on its way out: the pull request it has become, so
 * the badge reads `Merged`, but the check rollup it already had, because
 * nothing is going to sync checks for a pull request that is no longer open.
 */
function departingRow(
  previous: SidebarRow,
  pullRequest: PullRequest
): SidebarRow {
  return {
    checkRollup: previous.checkRollup,
    mergeReadiness: getMergeReadiness(pullRequest, previous.checkRollup),
    needsAttention: needsAttention(pullRequest, previous.checkRollup),
    pullRequest,
    unread: previous.unread
  }
}

/**
 * Works out which rows have just left for good. A row whose pull request
 * stopped being open is held back for one fade; a row that went because the
 * reader typed in the search box or changed a filter is dropped straight away,
 * the way it always was.
 */
export function nextDepartureState(
  state: DepartureState,
  rows: readonly SidebarRow[],
  pullRequests: readonly PullRequest[]
): DepartureState {
  const liveIds = new Set(rows.map((row) => row.pullRequest.id))
  const departures = new Map<string, Departure>()

  // A merge that failed is rolled back to `OPEN`, which puts the pull request
  // back in the list. Keeping the departure as well would render one key twice
  // and break the virtualizer.
  for (const [pullRequestId, departure] of state.departures) {
    if (!liveIds.has(pullRequestId)) {
      departures.set(pullRequestId, departure)
    }
  }

  const byId = pullRequestsById(pullRequests)

  state.rows.forEach((previousRow, index) => {
    const pullRequestId = previousRow.pullRequest.id

    if (liveIds.has(pullRequestId) || departures.has(pullRequestId)) {
      return
    }

    const pullRequest = byId.get(pullRequestId)

    if (pullRequest?.state === 'OPEN') {
      return
    }

    departures.set(pullRequestId, {
      index,
      pullRequestId,
      row: pullRequest ? departingRow(previousRow, pullRequest) : previousRow
    })
  })

  return { departures, rows }
}

/**
 * Puts each departing row back where it was. Pinning the index rather than
 * letting the row sort again matters: merging changes `state`, `updatedAt` and
 * whether the pull request needs attention, all of which the sort reads, so an
 * unpinned row would jump somewhere else on its way out.
 */
export function mergeDepartures(
  rows: readonly SidebarRow[],
  departures: ReadonlyMap<string, Departure>
): readonly SidebarRow[] {
  if (departures.size === 0) {
    return rows
  }

  const merged = [...rows]

  const ordered = [...departures.values()].sort((a, b) => a.index - b.index)

  for (const departure of ordered) {
    merged.splice(Math.min(departure.index, merged.length), 0, departure.row)
  }

  return merged
}

function withoutDeparture(
  state: DepartureState,
  pullRequestId: string
): DepartureState {
  if (!state.departures.has(pullRequestId)) {
    return state
  }

  const departures = new Map(state.departures)

  departures.delete(pullRequestId)

  return { departures, rows: state.rows }
}

/**
 * Holds a row in the list for one fade after its pull request stops being open,
 * then drops it and reports the gap it left so the caller can move on.
 */
export function useDepartingRows(
  rows: readonly SidebarRow[],
  pullRequests: readonly PullRequest[],
  onDeparted: (departure: Departure) => void
): DepartingRows {
  const [state, setState] = useState<DepartureState>(() => ({
    departures: new Map<string, Departure>(),
    rows
  }))

  const onDepartedRef = useRef(onDeparted)
  const timeouts = useRef(new Map<string, number>())

  // The diff has to run during the render that drops the row rather than in an
  // effect afterwards. React would unmount the row first, and an effect putting
  // it back would mount a brand new node with nothing for the browser to fade
  // from.
  if (state.rows !== rows) {
    setState(nextDepartureState(state, rows, pullRequests))
  }

  useEffect(() => {
    onDepartedRef.current = onDeparted
  }, [onDeparted])

  useEffect(() => {
    const handles = timeouts.current

    for (const [pullRequestId, departure] of state.departures) {
      if (handles.has(pullRequestId)) {
        continue
      }

      handles.set(
        pullRequestId,
        window.setTimeout(() => {
          handles.delete(pullRequestId)

          setState((current) => withoutDeparture(current, pullRequestId))

          onDepartedRef.current(departure)
        }, departureDurationMs)
      )
    }

    // A departure that was cancelled because the pull request came back leaves
    // its timer behind.
    for (const [pullRequestId, handle] of handles) {
      if (!state.departures.has(pullRequestId)) {
        window.clearTimeout(handle)

        handles.delete(pullRequestId)
      }
    }
  }, [state.departures])

  useEffect(() => {
    const handles = timeouts.current

    return () => {
      for (const handle of handles.values()) {
        window.clearTimeout(handle)
      }

      handles.clear()
    }
  }, [])

  const departingIds = useMemo(
    () => new Set(state.departures.keys()),
    [state.departures]
  )

  const visibleRows = useMemo(
    () => mergeDepartures(rows, state.departures),
    [rows, state.departures]
  )

  return { departingIds, rows: visibleRows }
}
