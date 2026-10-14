import { useEffect, useLayoutEffect, type RefObject } from 'react'

import type { PullRequestNavigationApi } from '@/app/pull-requests/PullRequestNavigationProvider'

function findScrollContainer(
  containerRef: RefObject<HTMLElement | null>
): HTMLElement | null {
  const scrollContainer = containerRef.current?.closest('.overflow-auto')

  return scrollContainer instanceof HTMLElement ? scrollContainer : null
}

/** Registers the page's scroll container with the navigation provider. */
export function useScrollContainerRegistration(
  containerRef: RefObject<HTMLElement | null>,
  navigation: PullRequestNavigationApi
): void {
  useEffect(
    function registerScrollContainer() {
      const scrollContainer = findScrollContainer(containerRef)

      if (!scrollContainer) {
        return
      }

      navigation.registerScrollContainer(scrollContainer)
    },
    [containerRef, navigation]
  )
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
