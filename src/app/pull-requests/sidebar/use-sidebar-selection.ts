import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'

import { setSidebarNavigation } from '@/app/commands/sidebar-accessor'

import { usePullRequestNavigation } from '../PullRequestNavigationProvider'
import { pullRequestPath } from '../pull-request-path'
import { stepIndex, type SidebarRow } from './sidebar-data'

/**
 * Navigating to a pull request, carrying the tab across so that moving between
 * them keeps you on Files or Checks rather than dropping you back on Overview.
 */
export function useSelectPullRequest(): (pullRequestId: string) => void {
  const navigate = useNavigate()
  const navigation = usePullRequestNavigation()

  return useCallback(
    (pullRequestId: string) => {
      navigate(pullRequestPath(pullRequestId, navigation.getActiveTab()))
    },
    [navigate, navigation]
  )
}

/**
 * Selecting rows, and publishing that to the command registry so the keyboard
 * shortcuts can drive the sidebar from outside React.
 */
export function useSidebarSelection(
  rows: readonly SidebarRow[],
  selectedId: string | undefined
): (pullRequestId: string) => void {
  const select = useSelectPullRequest()

  const step = useCallback(
    (offset: number) => {
      const next = stepIndex(rows, selectedId, offset)

      if (next !== undefined) {
        select(rows[next].pullRequest.id)
      }
    },
    [rows, select, selectedId]
  )

  const selectIndex = useCallback(
    (index: number) => {
      const row = rows[index]

      if (row) {
        select(row.pullRequest.id)
      }
    },
    [rows, select]
  )

  useEffect(() => {
    setSidebarNavigation({
      selectIndex,
      selectNext: () => step(1),
      selectPrevious: () => step(-1)
    })

    return () => {
      setSidebarNavigation(null)
    }
  }, [selectIndex, step])

  return select
}
