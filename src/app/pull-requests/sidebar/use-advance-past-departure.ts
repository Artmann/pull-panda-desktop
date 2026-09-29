import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import type { SidebarRow } from './sidebar-data'
import type { Departure } from './use-departing-rows'
import { useSelectPullRequest } from './use-sidebar-selection'

/**
 * Merging the pull request you are reading takes its row out from under you, so
 * move on to whichever row fills the gap it leaves behind. Returns a handler
 * for `useDepartingRows`, which calls it once the row has finished fading —
 * pulling the page away any earlier would bury the merge you just confirmed.
 */
export function useAdvancePastDeparture(
  rows: readonly SidebarRow[],
  selectedId: string | undefined
): (departure: Departure) => void {
  const navigate = useNavigate()

  const select = useSelectPullRequest()

  return useCallback(
    ({ index, pullRequestId }: Departure) => {
      if (pullRequestId !== selectedId) {
        return
      }

      const next = rows[Math.min(index, rows.length - 1)]

      if (!next) {
        navigate('/')

        return
      }

      select(next.pullRequest.id)
    },
    [navigate, rows, select, selectedId]
  )
}
