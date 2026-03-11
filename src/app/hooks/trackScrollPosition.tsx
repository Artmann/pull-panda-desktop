import { throttle } from 'radash'
import { useEffect } from 'react'

export function useTrackScrollPosition(
  ref: React.RefObject<HTMLDivElement>,
  callback: (scrollTop: number) => void,
  deps: React.DependencyList = []
): void {
  useEffect(
    function trackScrollPosition() {
      const element = ref.current

      if (!element) {
        return
      }

      const handleScroll = throttle({ interval: 100 }, () => {
        callback(element.scrollTop)
      })

      element.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        if (element) {
          element.removeEventListener('scroll', handleScroll)
        }
      }
    },
    [ref, callback, ...deps]
  )
}
