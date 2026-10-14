import { useMemo, useState } from 'react'

import {
  isHidden,
  rowsForView,
  type SidebarRow,
  type SidebarView
} from './sidebar-data'

interface SidebarViewState {
  hiddenCount: number
  setView: (view: SidebarView) => void
  view: SidebarView
  /** The rows the current view starts from, before filters. */
  viewRows: SidebarRow[]
}

/** Which list the sidebar shows: the main one, or the hidden pull requests. */
export function useSidebarView(
  rows: readonly SidebarRow[],
  query: string
): SidebarViewState {
  const [view, setView] = useState<SidebarView>('main')

  const hiddenCount = useMemo(
    () => rows.filter((row) => isHidden(row.pullRequest)).length,
    [rows]
  )

  const viewRows = useMemo(
    () => rowsForView(rows, view, query),
    [query, rows, view]
  )

  return { hiddenCount, setView, view, viewRows }
}
