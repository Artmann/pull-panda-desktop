/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setFpsCounterVisible,
  subscribeToFpsCounterVisible
} from '@/app/lib/fps-counter-state'

import { FpsCounter } from './FpsCounter'

let animationFrameCallbacks: FrameRequestCallback[] = []

function flushAnimationFrame(timestamp: number) {
  const callback = animationFrameCallbacks.shift()

  act(() => {
    callback?.(timestamp)
  })
}

describe('FpsCounter', () => {
  beforeEach(() => {
    animationFrameCallbacks = []
    setFpsCounterVisible(false)

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        animationFrameCallbacks.push(callback)

        return animationFrameCallbacks.length
      }
    )

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      // Mock
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not measure frames when hidden', () => {
    render(<FpsCounter />)

    expect(screen.queryByText(/FPS/)).toEqual(null)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('measures FPS with requestAnimationFrame when visible', () => {
    render(<FpsCounter />)

    act(() => {
      setFpsCounterVisible(true)
    })

    flushAnimationFrame(0)
    flushAnimationFrame(1000)

    expect(screen.getByText('1 FPS')).toBeInTheDocument()
    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it('notifies subscribers when visibility changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToFpsCounterVisible(listener)

    setFpsCounterVisible(true)
    unsubscribe()
    setFpsCounterVisible(false)

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
