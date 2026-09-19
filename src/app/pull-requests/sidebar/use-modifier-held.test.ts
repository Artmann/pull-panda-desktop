/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useModifierHeld } from './use-modifier-held'

vi.mock('@/app/commands/utils', () => ({
  isMac: () => true
}))

function press(type: 'keydown' | 'keyup', init: KeyboardEventInit): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, init))
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useModifierHeld', () => {
  it('starts released', () => {
    expect(renderHook(() => useModifierHeld()).result.current).toEqual(false)
  })

  it('reports the modifier while it is held', () => {
    const { result } = renderHook(() => useModifierHeld())

    press('keydown', { key: 'Meta', metaKey: true })
    expect(result.current).toEqual(true)

    press('keyup', { key: 'Meta', metaKey: false })
    expect(result.current).toEqual(false)
  })

  it('ignores other keys', () => {
    const { result } = renderHook(() => useModifierHeld())

    press('keydown', { key: 'a' })

    expect(result.current).toEqual(false)
  })

  it('stays held while a character key is pressed with it', () => {
    const { result } = renderHook(() => useModifierHeld())

    press('keydown', { key: 'Meta', metaKey: true })
    press('keydown', { key: '1', metaKey: true })
    expect(result.current).toEqual(true)

    // Releasing the digit first, with the modifier still down.
    press('keyup', { key: '1', metaKey: true })
    expect(result.current).toEqual(true)

    press('keyup', { key: 'Meta', metaKey: false })
    expect(result.current).toEqual(false)
  })

  it('clears when the window loses focus, so Cmd+Tab leaves no stuck badge', () => {
    const { result } = renderHook(() => useModifierHeld())

    press('keydown', { key: 'Meta', metaKey: true })
    expect(result.current).toEqual(true)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current).toEqual(false)
  })

  it('clears when a context menu opens', () => {
    const { result } = renderHook(() => useModifierHeld())

    press('keydown', { key: 'Meta', metaKey: true })

    act(() => {
      window.dispatchEvent(new Event('contextmenu'))
    })

    expect(result.current).toEqual(false)
  })

  it('detaches its listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useModifierHeld())

    unmount()
    press('keydown', { key: 'Meta', metaKey: true })

    expect(result.current).toEqual(false)
  })
})
