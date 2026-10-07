/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addLandmark,
  findNextLandmark,
  findPreviousLandmark,
  getSortedLandmarks,
  scrollToLandmark,
  type LandmarkRegistry
} from './landmarks'

function createElement(top: number): HTMLElement {
  const element = document.createElement('div')

  element.getBoundingClientRect = () => ({ top }) as DOMRect
  document.body.appendChild(element)

  return element
}

function createContainer(top: number, scrollTop: number): HTMLElement {
  const container = createElement(top)

  container.scrollTop = scrollTop
  container.scrollTo = vi.fn()

  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('addLandmark', () => {
  it('registers the element under its scope and id', () => {
    const registry: LandmarkRegistry = new Map()
    const element = createElement(0)

    addLandmark(registry, 'pr-1::overview', 'comment-1', element)

    expect(registry).toEqual(
      new Map([['pr-1::overview', new Map([['comment-1', element]])]])
    )
  })

  it('removes the element and the empty scope on cleanup', () => {
    const registry: LandmarkRegistry = new Map()
    const cleanup = addLandmark(
      registry,
      'pr-1::overview',
      'comment-1',
      createElement(0)
    )

    cleanup()

    expect(registry).toEqual(new Map())
  })

  it('keeps a newer element registered under the same id', () => {
    const registry: LandmarkRegistry = new Map()
    const newer = createElement(0)
    const cleanup = addLandmark(
      registry,
      'pr-1::overview',
      'comment-1',
      createElement(0)
    )

    addLandmark(registry, 'pr-1::overview', 'comment-1', newer)
    cleanup()

    expect(registry).toEqual(
      new Map([['pr-1::overview', new Map([['comment-1', newer]])]])
    )
  })

  it('ignores a missing element or scope', () => {
    const registry: LandmarkRegistry = new Map()

    addLandmark(registry, '', 'comment-1', createElement(0))
    addLandmark(registry, 'pr-1::overview', 'comment-1', null)

    expect(registry).toEqual(new Map())
  })
})

describe('getSortedLandmarks', () => {
  it('returns connected landmarks ordered by their position', () => {
    const registry: LandmarkRegistry = new Map()
    const lower = createElement(300)
    const upper = createElement(100)
    const detached = document.createElement('div')

    addLandmark(registry, 'scope', 'lower', lower)
    addLandmark(registry, 'scope', 'upper', upper)
    addLandmark(registry, 'scope', 'detached', detached)

    expect(getSortedLandmarks(registry, 'scope')).toEqual([upper, lower])
  })

  it('returns nothing without an active scope', () => {
    expect(getSortedLandmarks(new Map(), null)).toEqual([])
    expect(getSortedLandmarks(new Map(), 'scope')).toEqual([])
  })
})

describe('findNextLandmark and findPreviousLandmark', () => {
  it('find the landmarks around the jump position', () => {
    const container = createContainer(0, 0)
    const first = createElement(20)
    const second = createElement(200)
    const third = createElement(400)

    expect(findNextLandmark(container, [first, second, third])).toEqual(second)
    expect(findPreviousLandmark(container, [first, second, third])).toEqual(
      first
    )
  })

  it('return nothing when there is no landmark in that direction', () => {
    const container = createContainer(0, 0)
    const landmark = createElement(500)

    expect(findPreviousLandmark(container, [landmark])).toEqual(null)
    expect(findNextLandmark(container, [])).toEqual(undefined)
  })
})

describe('scrollToLandmark', () => {
  it('scrolls the landmark to just below the top of the container', () => {
    const container = createContainer(50, 100)
    const landmark = createElement(350)

    scrollToLandmark(container, landmark)

    expect(container.scrollTo).toHaveBeenCalledWith({
      behavior: 'smooth',
      top: 320
    })
  })

  it('never scrolls above the top', () => {
    const container = createContainer(0, 0)
    const landmark = createElement(10)

    scrollToLandmark(container, landmark)

    expect(container.scrollTo).toHaveBeenCalledWith({
      behavior: 'smooth',
      top: 0
    })
  })
})
