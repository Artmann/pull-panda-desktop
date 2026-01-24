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

    expect(screen.getByTestId('title-bar-back')).toBeDisabled()
  })

  it('enables back button when history index is greater than 0', () => {
    setHistoryState({ idx: 2 })

    render(<TitleBar />)

    expect(screen.getByTestId('title-bar-back')).not.toBeDisabled()
  })

  it('disables forward button when at max history index', () => {
    setHistoryState({ idx: 0 })

    render(<TitleBar />)

    expect(screen.getByTestId('title-bar-forward')).toBeDisabled()
  })

  it('calls navigate(-1) when back button is clicked', () => {
    setHistoryState({ idx: 1 })

    render(<TitleBar />)

    fireEvent.click(screen.getByTestId('title-bar-back'))

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

    fireEvent.click(screen.getByTestId('title-bar-forward'))

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
    expect(screen.getByTestId('title-bar-forward')).not.toBeDisabled()
  })

  it('handles undefined history state gracefully', () => {
    setHistoryState(undefined)

    render(<TitleBar />)

    expect(screen.getByTestId('title-bar-back')).toBeDisabled()
  })

  it('handles null idx in history state gracefully', () => {
    setHistoryState({ idx: null })

    render(<TitleBar />)

    expect(screen.getByTestId('title-bar-back')).toBeDisabled()
  })

  describe('window controls', () => {
    it('renders window control buttons on non-Mac platforms', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true
      })

      render(<TitleBar />)

      expect(screen.getByTestId('title-bar-minimize')).toBeInTheDocument()
      expect(screen.getByTestId('title-bar-maximize')).toBeInTheDocument()
      expect(screen.getByTestId('title-bar-close')).toBeInTheDocument()
    })

    it('calls windowMinimize when minimize button is clicked', () => {
      render(<TitleBar />)

      fireEvent.click(screen.getByTestId('title-bar-minimize'))

      expect(window.electron.windowMinimize).toHaveBeenCalled()
    })

    it('calls windowMaximize when maximize button is clicked', () => {
      render(<TitleBar />)

      fireEvent.click(screen.getByTestId('title-bar-maximize'))

      expect(window.electron.windowMaximize).toHaveBeenCalled()
    })

    it('calls windowClose when close button is clicked', () => {
      render(<TitleBar />)

      fireEvent.click(screen.getByTestId('title-bar-close'))

      expect(window.electron.windowClose).toHaveBeenCalled()
    })
  })
})
