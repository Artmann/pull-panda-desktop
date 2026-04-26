/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLazyRender } from './lazy-render'

let intersectionCallback: IntersectionObserverCallback | null = null
let idleCallback: IdleRequestCallback | null = null

function LazyProbe({ eager = false }: { eager?: boolean }) {
  const { ref, shouldRender } = useLazyRender<HTMLDivElement>({ eager })

  return (
    <div ref={ref}>
      {shouldRender ? (
        <span>Heavy content</span>
      ) : (
        <span>Searchable fallback</span>
      )}
    </div>
  )
}

describe('useLazyRender', () => {
  beforeEach(() => {
    intersectionCallback = null
    idleCallback = null

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
        idleCallback = callback

        return 1
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('waits for visibility and idle time before rendering heavy content', () => {
    render(<LazyProbe />)

    expect(screen.getByText('Searchable fallback')).toBeInTheDocument()
    expect(screen.queryByText('Heavy content')).toEqual(null)

    act(() => {
      intersectionCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry
      ], {} as IntersectionObserver)
    })

    expect(screen.queryByText('Heavy content')).toEqual(null)

    act(() => {
      idleCallback?.({ didTimeout: false, timeRemaining: () => 10 })
    })

    expect(screen.getByText('Heavy content')).toBeInTheDocument()
  })

  it('renders immediately when marked eager', () => {
    render(<LazyProbe eager />)

    expect(screen.getByText('Heavy content')).toBeInTheDocument()
  })
})
