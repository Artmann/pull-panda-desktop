/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TitleBar } from './TitleBar'

const mockNavigate = vi.fn()
const mockLocation: {
  pathname: string
  search: string
  hash: string
  state: unknown
  key: string
} = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
}

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation
}))

function setHistoryState(state: { idx: number | null } | undefined) {
  Object.defineProperty(window, 'history', {
    value: { state },
    writable: true,
    configurable: true
  })
}

describe('TitleBar', () => {
  const originalHistoryState = window.history.state
  const originalNavigatorPlatform = navigator.platform

  beforeEach(() => {
    mockNavigate.mockClear()

    setHistoryState({ idx: 0 })

    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true
    })

    window.electron = {
      ...window.electron,
      openUrl: vi.fn(),
      windowClose: vi.fn(),
      windowMaximize: vi.fn(),
      windowMinimize: vi.fn()
    }
  })

  afterEach(() => {
    Object.defineProperty(window, 'history', {
      value: { state: originalHistoryState },
      writable: true
    })

    Object.defineProperty(navigator, 'platform', {
      value: originalNavigatorPlatform,
      writable: true
    })
  })

  it('renders the title', () => {
    render(<TitleBar />)

    expect(screen.getByText('Pull Panda')).toBeInTheDocument()
  })

  it('renders navigation buttons', () => {
    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')

    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('disables back button when at history index 0', () => {
    setHistoryState({ idx: 0 })

    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const backButton = buttons[0]

    expect(backButton).toBeDisabled()
  })

  it('enables back button when history index is greater than 0', () => {
    setHistoryState({ idx: 2 })

    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const backButton = buttons[0]

    expect(backButton).not.toBeDisabled()
  })

  it('disables forward button when at max history index', () => {
    setHistoryState({ idx: 0 })

    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const forwardButton = buttons[1]

    expect(forwardButton).toBeDisabled()
  })

  it('calls navigate(-1) when back button is clicked', () => {
    setHistoryState({ idx: 1 })

    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const backButton = buttons[0]

    fireEvent.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('calls navigate(1) when forward button is clicked', () => {
    setHistoryState({ idx: 0 })

    const { rerender } = render(<TitleBar />)

    // Simulate navigating forward to index 1
    setHistoryState({ idx: 1 })
    mockLocation.pathname = '/pull-requests/1'
    rerender(<TitleBar />)

    // Now go back to index 0
    setHistoryState({ idx: 0 })
    mockLocation.pathname = '/'
    rerender(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const forwardButton = buttons[1]

    fireEvent.click(forwardButton)

    expect(mockNavigate).toHaveBeenCalledWith(1)
  })

  it('tracks max history index across navigations', () => {
    setHistoryState({ idx: 0 })

    const { rerender } = render(<TitleBar />)

    // Simulate navigating to index 1
    setHistoryState({ idx: 1 })
    mockLocation.pathname = '/page1'
    rerender(<TitleBar />)

    // Simulate navigating to index 2
    setHistoryState({ idx: 2 })
    mockLocation.pathname = '/page2'
    rerender(<TitleBar />)

    // Go back to index 1
    setHistoryState({ idx: 1 })
    mockLocation.pathname = '/page1'
    rerender(<TitleBar />)

    // Forward button should be enabled since max was 2
    const buttons = screen.getAllByRole('button')
    const forwardButton = buttons[1]

    expect(forwardButton).not.toBeDisabled()
  })

  it('handles undefined history state gracefully', () => {
    setHistoryState(undefined)

    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const backButton = buttons[0]

    expect(backButton).toBeDisabled()
  })

  it('handles null idx in history state gracefully', () => {
    setHistoryState({ idx: null })

    render(<TitleBar />)

    const buttons = screen.getAllByRole('button')
    const backButton = buttons[0]

    expect(backButton).toBeDisabled()
  })

  describe('window controls', () => {
    it('renders window control buttons on non-Mac platforms', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true
      })

      render(<TitleBar />)

      const buttons = screen.getAllByRole('button')

      // Should have navigation (2) + window controls (3) = 5 buttons
      expect(buttons.length).toEqual(5)
    })

    it('calls windowMinimize when minimize button is clicked', () => {
      render(<TitleBar />)

      const buttons = screen.getAllByRole('button')
      const minimizeButton = buttons[2]

      fireEvent.click(minimizeButton)

      expect(window.electron.windowMinimize).toHaveBeenCalled()
    })

    it('calls windowMaximize when maximize button is clicked', () => {
      render(<TitleBar />)

      const buttons = screen.getAllByRole('button')
      const maximizeButton = buttons[3]

      fireEvent.click(maximizeButton)

      expect(window.electron.windowMaximize).toHaveBeenCalled()
    })

    it('calls windowClose when close button is clicked', () => {
      render(<TitleBar />)

      const buttons = screen.getAllByRole('button')
      const closeButton = buttons[4]

      fireEvent.click(closeButton)

      expect(window.electron.windowClose).toHaveBeenCalled()
    })
  })
})
