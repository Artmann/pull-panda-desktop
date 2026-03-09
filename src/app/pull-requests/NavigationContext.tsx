import { throttle } from 'radash'
import { createContext, useEffect } from 'react'

interface INavigationContext {
  scrollContainerRef: React.RefObject<HTMLDivElement> | null
}

export const NavigationContext = createContext<INavigationContext>({
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
  const context = {
    scrollContainerRef
  }

  useEffect(
    function trackScrollPosition() {
      const element = scrollContainerRef.current

      if (!element) {
        return
      }

      const handleScroll = throttle({ interval: 100 }, () => {
        console.log('Scroll position:', element.scrollTop)
      })

      element.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        if (element) {
          element.removeEventListener('scroll', handleScroll)
        }
      }
    },
    [scrollContainerRef]
  )

  return (
    <NavigationContext.Provider value={context}>
      {children}
    </NavigationContext.Provider>
  )
}
