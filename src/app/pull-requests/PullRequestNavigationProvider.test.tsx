/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PullRequestNavigationProvider,
  usePullRequestNavigation,
  type PullRequestNavigationApi
} from './PullRequestNavigationProvider'

let pendingFrames: FrameRequestCallback[] = []
let originalRequestAnimationFrame: typeof window.requestAnimationFrame
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame

function flushFrames(): void {
  const frames = pendingFrames

  pendingFrames = []
  frames.forEach((frame) => frame(0))
}

function buildScrollContainer(): HTMLElement {
  const element = document.createElement('div')

  // jsdom has no layout, so scrollTop is not writable by default.
  let scrollTop = 0

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value
    }
  })

  document.body.append(element)

  return element
}

function renderProvider(): PullRequestNavigationApi {
  let api: PullRequestNavigationApi | null = null

  function Probe(): null {
    const navigation = usePullRequestNavigation()

    useEffect(() => {
      api = navigation
    }, [navigation])

    return null
  }

  render(
    <MemoryRouter>
      <PullRequestNavigationProvider>
        <Probe />
      </PullRequestNavigationProvider>
    </MemoryRouter>
  )

  if (!api) {
    throw new Error('Navigation API was not captured')
  }

  return api
}

beforeEach(() => {
  pendingFrames = []
  originalRequestAnimationFrame = window.requestAnimationFrame
  originalCancelAnimationFrame = window.cancelAnimationFrame

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    pendingFrames.push(callback)

    return pendingFrames.length
  }) as typeof window.requestAnimationFrame

  window.cancelAnimationFrame = (() => {
    pendingFrames = []
  }) as typeof window.cancelAnimationFrame
})

afterEach(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame
  window.cancelAnimationFrame = originalCancelAnimationFrame
  document.body.innerHTML = ''
})

describe('PullRequestNavigationProvider scroll positions', () => {
  it('records the scroll position against the tab that was open', () => {
    const navigation = renderProvider()
    const container = buildScrollContainer()

    navigation.registerScrollContainer(container)
    navigation.setActiveKey('pr-1', 'files')

    container.scrollTop = 500
    container.dispatchEvent(new Event('scroll'))
    flushFrames()

    expect(navigation.getScrollPosition('pr-1', 'files')).toEqual(500)
  })

  it('keeps the newest position when several scrolls share a frame', () => {
    const navigation = renderProvider()
    const container = buildScrollContainer()

    navigation.registerScrollContainer(container)
    navigation.setActiveKey('pr-1', 'files')

    for (const offset of [100, 250, 400]) {
      container.scrollTop = offset
      container.dispatchEvent(new Event('scroll'))
    }

    flushFrames()

    expect(navigation.getScrollPosition('pr-1', 'files')).toEqual(400)
  })

  it('does not leak a pending scroll into the tab being switched to', () => {
    const navigation = renderProvider()
    const container = buildScrollContainer()

    navigation.registerScrollContainer(container)
    navigation.setActiveKey('pr-1', 'files')

    // Scroll the Files tab. The write is deferred to the next frame.
    container.scrollTop = 500
    container.dispatchEvent(new Event('scroll'))

    // Switch to Overview before that frame runs, which is what happens when a
    // tab change lands between the scroll event and its animation frame.
    navigation.setActiveKey('pr-1', 'overview')
    flushFrames()

    // Overview was never scrolled, so it must still be at the top.
    expect(navigation.getScrollPosition('pr-1', 'overview')).toEqual(0)
  })
})
