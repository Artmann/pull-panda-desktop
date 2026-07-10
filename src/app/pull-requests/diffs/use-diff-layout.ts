import { useCallback, useState } from 'react'

import type { DiffLayout } from './PierreDiff'

// Persist the split/unified diff preference in localStorage, mirroring the
// theme-preference pattern in `src/app/lib/store`. Unified is the default.
const storageKey = 'diff-layout'

function readStoredLayout(): DiffLayout {
  return localStorage.getItem(storageKey) === 'split' ? 'split' : 'unified'
}

export function useDiffLayout(): [DiffLayout, (layout: DiffLayout) => void] {
  const [layout, setLayoutState] = useState<DiffLayout>(readStoredLayout)

  const setLayout = useCallback((next: DiffLayout) => {
    setLayoutState(next)
    localStorage.setItem(storageKey, next)
  }, [])

  return [layout, setLayout]
}
