import { createContext } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import { useTrackScrollPosition } from '@/app/hooks/trackScrollPosition'

interface INavigationContext {
  currentTab: string
  isPullRequestPage: boolean
  pullRequestId: string | null
  scrollContainerRef: React.RefObject<HTMLDivElement> | null
}

export const NavigationContext = createContext<INavigationContext>({
  currentTab: 'overview',
  isPullRequestPage: false,
  pullRequestId: null,
  scrollContainerRef: null
})

interface NavigationContextProviderProps {
  children: React.ReactNode
  scrollContainerRef: React.RefObject<HTMLDivElement>
}

export function NavigationContextProvider({
  children,
  scrollContainerRef
}: NavigationContextProviderProps): React.ReactElement {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()

  const prMatch = pathname.match(/^\/pull-requests\/([^/]+)$/)
  const isPullRequestPage = prMatch !== null
  const pullRequestId = prMatch?.[1] ?? null
  const currentTab = searchParams.get('tab') ?? 'overview'

  console.log('NavigationContextProvider:', {
    isPullRequestPage,
    pullRequestId,
    currentTab
  })

  useTrackScrollPosition(scrollContainerRef, (scrollTop) => {
    console.log('Scroll position:', scrollTop)

    if (isPullRequestPage) {
      const key = `pr-${pullRequestId}-${currentTab}`

      console.log('Saving scroll position for key:', key)
    }
  })

  const context = {
    currentTab,
    isPullRequestPage,
    pullRequestId,
    scrollContainerRef
  }

  return (
    <NavigationContext.Provider value={context}>
      {children}
    </NavigationContext.Provider>
  )
}
