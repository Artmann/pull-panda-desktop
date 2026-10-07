import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

import type { PullRequestNavigationApi } from '@/app/pull-requests/PullRequestNavigationProvider'
import { clamp01 } from '@/math'

function findScrollContainer(
  containerRef: RefObject<HTMLElement | null>
): HTMLElement | null {
  const scrollContainer = containerRef.current?.closest('.overflow-auto')

  return scrollContainer instanceof HTMLElement ? scrollContainer : null
}

/**
 * Registers the page's scroll container with the navigation provider and
 * returns how far (0 to 1) the sticky header has transitioned in.
 */
export function useStickyHeaderProgress(
  containerRef: RefObject<HTMLElement | null>,
  navigation: PullRequestNavigationApi
): number {
  const [stickyHeaderProgress, setStickyHeaderProgress] = useState(0)

  useEffect(
    function trackScrollPosition() {
      const scrollContainer = findScrollContainer(containerRef)

      if (!scrollContainer) {
        return
      }

      navigation.registerScrollContainer(scrollContainer)

      let rafId: number | null = null

      const onScroll = () => {
        if (rafId !== null) {
          return
        }

        rafId = requestAnimationFrame(() => {
          rafId = null
          const threshold = 110
          const progress = clamp01(
            Math.min(scrollContainer.scrollTop, threshold) / threshold
          )

          setStickyHeaderProgress(progress)
        })
      }

      scrollContainer.addEventListener('scroll', onScroll, { passive: true })

      onScroll()

      return () => {
        scrollContainer.removeEventListener('scroll', onScroll)

        if (rafId !== null) {
          cancelAnimationFrame(rafId)
        }
      }
    },
    [containerRef, navigation]
  )

  return stickyHeaderProgress
}

/** Restores the saved scroll offset whenever the pull request or tab changes. */
export function useScrollRestoration(
  containerRef: RefObject<HTMLElement | null>,
  navigation: PullRequestNavigationApi,
  id: string | undefined,
  activeTab: string
): void {
  useLayoutEffect(
    function restoreScrollPosition() {
      if (!id) {
        return
      }

      const scrollContainer = findScrollContainer(containerRef)

      if (!scrollContainer) {
        return
      }

      navigation.setActiveKey(id, activeTab)

      const saved = navigation.getScrollPosition(id, activeTab)

      scrollContainer.scrollTop = saved
    },
    [activeTab, containerRef, id, navigation]
  )
}
