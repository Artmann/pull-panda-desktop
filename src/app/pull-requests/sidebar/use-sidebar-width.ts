import {
  useCallback,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react'

const storageKey = 'sidebar-width'

const defaultSidebarWidth = 340
const minSidebarWidth = 232
const maxSidebarWidth = 520

function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return defaultSidebarWidth
  }

  return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(width)))
}

function readStoredWidth(): number {
  try {
    const stored = window.localStorage.getItem(storageKey)

    if (stored === null) {
      return defaultSidebarWidth
    }

    return clampSidebarWidth(Number.parseInt(stored, 10))
  } catch {
    return defaultSidebarWidth
  }
}

function storeWidth(width: number): void {
  try {
    window.localStorage.setItem(storageKey, width.toString())
  } catch {
    // Width is a convenience. Losing it is not worth surfacing.
  }
}

export interface SidebarWidth {
  startResize: (event: ReactMouseEvent) => void
  width: number
}

export function useSidebarWidth(): SidebarWidth {
  const [width, setWidth] = useState(readStoredWidth)

  const startResize = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()

      const startX = event.clientX
      const startWidth = width

      let latest = startWidth

      const onMove = (moveEvent: MouseEvent) => {
        latest = clampSidebarWidth(startWidth + moveEvent.clientX - startX)

        setWidth(latest)
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)

        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        storeWidth(latest)
      }

      // Hold the resize cursor for the whole drag, even when the pointer
      // outruns the 4px handle.
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width]
  )

  return { startResize, width }
}
