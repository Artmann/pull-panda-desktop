import { useEffect, useRef, useState, type RefObject } from 'react'

import { scheduleIdleTask } from './idle-scheduler'

interface UseLazyRenderOptions {
  eager?: boolean
  enabled?: boolean
  rootMargin?: string
  timeout?: number
}

interface UseLazyRenderResult<ElementType extends HTMLElement> {
  ref: RefObject<ElementType | null>
  shouldRender: boolean
}

export function useLazyRender<ElementType extends HTMLElement>({
  eager = false,
  enabled = true,
  rootMargin = '800px 0px',
  timeout = 1000
}: UseLazyRenderOptions = {}): UseLazyRenderResult<ElementType> {
  const ref = useRef<ElementType>(null)
  const [shouldRender, setShouldRender] = useState(eager || !enabled)

  useEffect(() => {
    if (shouldRender || eager || !enabled) {
      setShouldRender(true)

      return
    }

    const element = ref.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      const scheduledTask = scheduleIdleTask(() => {
        setShouldRender(true)
      }, timeout)

      return () => scheduledTask.cancel()
    }

    let scheduledTask: ReturnType<typeof scheduleIdleTask> | null = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return
        }

        scheduledTask = scheduleIdleTask(() => {
          setShouldRender(true)
        }, timeout)
        observer.disconnect()
      },
      { rootMargin }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
      scheduledTask?.cancel()
    }
  }, [eager, enabled, rootMargin, shouldRender, timeout])

  return { ref, shouldRender }
}
