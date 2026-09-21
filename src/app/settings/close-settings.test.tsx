/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { closeSettings, CloseSettingsButton } from './close-settings'

const mockNavigate = vi.fn()

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate
}))

function setHistoryState(state: { idx: number | null } | undefined) {
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { state },
    writable: true
  })
}

describe('closeSettings', () => {
  const originalHistoryState = window.history.state

  beforeEach(() => {
    mockNavigate.mockClear()
  })

  afterEach(() => {
    setHistoryState({ idx: originalHistoryState?.idx ?? null })
  })

  it('goes back when there is somewhere to go back to', () => {
    setHistoryState({ idx: 2 })

    closeSettings(mockNavigate)

    expect(mockNavigate.mock.calls).toEqual([[-1]])
  })

  it('goes home when settings is the first entry in the history', () => {
    setHistoryState({ idx: 0 })

    closeSettings(mockNavigate)

    expect(mockNavigate.mock.calls).toEqual([['/', { replace: true }]])
  })

  it('goes home when the history state is missing', () => {
    setHistoryState(undefined)

    closeSettings(mockNavigate)

    expect(mockNavigate.mock.calls).toEqual([['/', { replace: true }]])
  })
})

describe('CloseSettingsButton', () => {
  const originalHistoryState = window.history.state

  beforeEach(() => {
    mockNavigate.mockClear()
    setHistoryState({ idx: 1 })
  })

  afterEach(() => {
    setHistoryState({ idx: originalHistoryState?.idx ?? null })
  })

  it('closes settings when clicked', () => {
    render(<CloseSettingsButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))

    expect(mockNavigate.mock.calls).toEqual([[-1]])
  })

  it('closes settings when Escape is pressed', () => {
    render(<CloseSettingsButton />)

    fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })

    expect(mockNavigate.mock.calls).toEqual([[-1]])
  })

  it('leaves Escape alone when something else already handled it', () => {
    // Radix layers (the Select dropdowns on the settings page) dismiss on
    // Escape in the capture phase and mark the event as handled.
    const swallowEscape = (event: KeyboardEvent) => {
      event.preventDefault()
    }

    document.addEventListener('keydown', swallowEscape, { capture: true })

    try {
      render(<CloseSettingsButton />)

      fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })

      expect(mockNavigate.mock.calls).toEqual([])
    } finally {
      document.removeEventListener('keydown', swallowEscape, { capture: true })
    }
  })

  it('does not close settings when it has been unmounted', () => {
    const { unmount } = render(<CloseSettingsButton />)

    unmount()

    fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })

    expect(mockNavigate.mock.calls).toEqual([])
  })
})
