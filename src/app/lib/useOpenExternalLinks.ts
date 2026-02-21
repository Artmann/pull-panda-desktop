import type { RefObject } from 'react'
import { useEffect } from 'react'

export function useOpenExternalLinks(
  containerRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a')

      if (!anchor) {
        return
      }

      const href = anchor.getAttribute('href')

      if (!href) {
        return
      }

      event.preventDefault()
      window.electron.openUrl(href)
    }

    container.addEventListener('click', handleClick)

    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [containerRef])
}
