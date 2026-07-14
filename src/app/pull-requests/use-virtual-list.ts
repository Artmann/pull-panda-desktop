import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

interface UseVirtualListOptions {
  count: number
  estimateSize: (index: number) => number
  getItemKey?: (index: number) => string | number
  overscan?: number
}

interface UseVirtualListResult {
  listRef: (element: HTMLDivElement | null) => void
  scrollMargin: number
  virtualizer: Virtualizer<HTMLElement, Element>
}

function initialViewportHeight(): number {
  return typeof window === 'undefined' ? 800 : window.innerHeight
}

/**
 * Virtualizes a list that lives inside the shared, app level scroll container
 * (the closest `.overflow-auto` ancestor) rather than scrolling on its own.
 *
 * Because the list is only one part of a larger scrolling page, the virtualizer
 * needs to know how far down the list starts within the scroll content. That
 * offset is tracked as `scrollMargin` and re-measured whenever the list resizes,
 * the viewport resizes, or the user scrolls — so content rendered above the list
 * (descriptions, checks, headers) staying in sync as it grows and shrinks.
 */
export function useVirtualList({
  count,
  estimateSize,
  getItemKey,
  overscan = 6
}: UseVirtualListOptions): UseVirtualListResult {
  const listElementRef = useRef<HTMLDivElement | null>(null)
  const scrollElementRef = useRef<HTMLElement | null>(null)

  const [scrollMargin, setScrollMargin] = useState(0)

  const measureScrollMargin = useCallback(() => {
    const listElement = listElementRef.current
    const scrollElement = scrollElementRef.current

    if (!listElement || !scrollElement) {
      return
    }

    const listRect = listElement.getBoundingClientRect()
    const scrollRect = scrollElement.getBoundingClientRect()

    // Distance from the top of the scroll content to the top of the list,
    // independent of the current scroll position.
    const nextScrollMargin =
      listRect.top - scrollRect.top + scrollElement.scrollTop

    setScrollMargin((previous) =>
      Math.abs(previous - nextScrollMargin) < 1 ? previous : nextScrollMargin
    )
  }, [])

  const measureElement = useCallback(
    (element: Element) => {
      const height = element.getBoundingClientRect().height

      if (height > 0) {
        return height
      }

      // The list lives inside a tab panel that stays mounted while hidden.
      // Hidden rows measure 0, and recording that would poison the size
      // cache for the whole list (every row collapses to the same offset and
      // tall cards paint over each other). Fall back to the estimate; the
      // resize observer re-measures with real sizes once visible again.
      const index = Number(element.getAttribute('data-index'))

      return Number.isNaN(index) ? 0 : estimateSize(index)
    },
    [estimateSize]
  )

  const virtualizer = useVirtualizer({
    count,
    estimateSize,
    getItemKey,
    getScrollElement: () => scrollElementRef.current,
    // Seed the viewport height so the first paint (before the scroll container
    // is measured) renders a screenful instead of flashing empty. The real
    // size replaces this as soon as the layout effect measures the container.
    initialRect: { height: initialViewportHeight(), width: 0 },
    measureElement,
    overscan,
    scrollMargin
  })

  const listRef = useCallback(
    (element: HTMLDivElement | null) => {
      listElementRef.current = element

      const scrollElement = element?.closest('.overflow-auto') ?? null

      scrollElementRef.current =
        scrollElement instanceof HTMLElement ? scrollElement : null

      measureScrollMargin()
    },
    [measureScrollMargin]
  )

  useLayoutEffect(
    function trackScrollMargin() {
      const listElement = listElementRef.current
      const scrollElement = scrollElementRef.current

      if (!listElement || !scrollElement) {
        return
      }

      measureScrollMargin()

      const resizeObserver = new ResizeObserver(() => {
        measureScrollMargin()
      })

      resizeObserver.observe(listElement)
      resizeObserver.observe(scrollElement)

      let rafId: number | null = null

      const onScroll = () => {
        if (rafId !== null) {
          return
        }

        rafId = requestAnimationFrame(() => {
          rafId = null

          measureScrollMargin()
        })
      }

      scrollElement.addEventListener('scroll', onScroll)

      return () => {
        resizeObserver.disconnect()
        scrollElement.removeEventListener('scroll', onScroll)

        if (rafId !== null) {
          cancelAnimationFrame(rafId)
        }
      }
    },
    [count, measureScrollMargin]
  )

  return { listRef, scrollMargin, virtualizer }
}
