import { useCallback, useEffect, useRef, type RefObject } from 'react'

export const toNavigationKey = (pullRequestId: string, tab: string): string =>
  `${pullRequestId}::${tab}`

/**
 * Records `element`'s scroll offset against whichever `prId::tab` key is active,
 * coalescing bursts into one write per frame. Returns a cleanup function.
 *
 * The key and the offset are both captured when the scroll event fires rather
 * than inside the animation frame. A tab change can land in between, and
 * reading them late files the scroll under the tab being switched *to* — which
 * is then restored on the next visit and drags the sticky header with it.
 */
function trackScrollPositions(
  element: HTMLElement,
  getActiveKey: () => string | null,
  positions: Map<string, number>
): () => void {
  let rafId: number | null = null
  let pending: { key: string; scrollTop: number } | null = null

  const onScroll = () => {
    const key = getActiveKey()

    if (!key) {
      return
    }

    // Overwriting `pending` is what keeps the coalescing: newest scroll wins.
    pending = { key, scrollTop: element.scrollTop }

    if (rafId !== null) {
      return
    }

    rafId = requestAnimationFrame(() => {
      rafId = null

      if (pending) {
        positions.set(pending.key, pending.scrollTop)
        pending = null
      }
    })
  }

  element.addEventListener('scroll', onScroll, { passive: true })

  return () => {
    element.removeEventListener('scroll', onScroll)

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  }
}

interface ScrollPositionRegistry {
  activeKeyRef: RefObject<string | null>
  containerRef: RefObject<HTMLElement | null>
  getScrollPosition: (pullRequestId: string, tab: string) => number
  registerScrollContainer: (element: HTMLElement | null) => void
  setActiveKey: (pullRequestId: string, tab: string) => void
}

/**
 * Owns the scroll container and the saved scroll offset for every
 * `prId::tab` key, so tabs and pull requests restore where they were left.
 */
export function useScrollPositionRegistry(): ScrollPositionRegistry {
  const activeKeyRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const scrollListenerCleanupRef = useRef<(() => void) | null>(null)
  const scrollPositionsRef = useRef<Map<string, number>>(new Map())

  const registerScrollContainer = useCallback((element: HTMLElement | null) => {
    if (containerRef.current === element) {
      return
    }

    scrollListenerCleanupRef.current?.()
    scrollListenerCleanupRef.current = null
    containerRef.current = element

    if (!element) {
      return
    }

    scrollListenerCleanupRef.current = trackScrollPositions(
      element,
      () => activeKeyRef.current,
      scrollPositionsRef.current
    )
  }, [])

  const setActiveKey = useCallback((pullRequestId: string, tab: string) => {
    activeKeyRef.current = toNavigationKey(pullRequestId, tab)
  }, [])

  const getScrollPosition = useCallback(
    (pullRequestId: string, tab: string): number => {
      return (
        scrollPositionsRef.current.get(toNavigationKey(pullRequestId, tab)) ?? 0
      )
    },
    []
  )

  useEffect(() => {
    return () => {
      scrollListenerCleanupRef.current?.()
      scrollListenerCleanupRef.current = null
    }
  }, [])

  return {
    activeKeyRef,
    containerRef,
    getScrollPosition,
    registerScrollContainer,
    setActiveKey
  }
}
