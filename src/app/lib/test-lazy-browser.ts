import { act } from '@testing-library/react'
import { vi } from 'vitest'

export interface LazyBrowserTestHarness {
  flushIdleCallbacks: () => Promise<void>
  triggerIntersecting: () => void
}

export function setupLazyBrowserTestHarness(): LazyBrowserTestHarness {
  let intersectionCallback: IntersectionObserverCallback | null = null
  const idleCallbacks: IdleRequestCallback[] = []

  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      intersectionCallback = callback
    }

    disconnect() {
      // Mock
    }

    observe() {
      // Mock
    }

    unobserve() {
      // Mock
    }
  } as unknown as typeof IntersectionObserver

  Object.assign(window, {
    cancelIdleCallback: vi.fn(),
    requestIdleCallback: vi.fn((callback: IdleRequestCallback) => {
      idleCallbacks.push(callback)

      return idleCallbacks.length
    })
  })

  return {
    flushIdleCallbacks: async () => {
      while (idleCallbacks.length > 0) {
        const callback = idleCallbacks.shift()

        await act(async () => {
          callback?.({ didTimeout: false, timeRemaining: () => 10 })
        })
      }
    },
    triggerIntersecting: () => {
      act(() => {
        intersectionCallback?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
    }
  }
}
