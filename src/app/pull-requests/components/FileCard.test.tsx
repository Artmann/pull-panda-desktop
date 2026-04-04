/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { FileCard, FileCardBody, FileCardHeader } from './FileCard'

function renderFileCard(headerChildren?: React.ReactNode) {
  return render(
    <FileCard>
      <FileCardHeader>{headerChildren}</FileCardHeader>
      <FileCardBody>
        <div data-testid="body-content">Body content</div>
      </FileCardBody>
    </FileCard>
  )
}

describe('FileCard', () => {
  it('shows body content by default', () => {
    renderFileCard()

    expect(screen.getByTestId('body-content')).toBeInTheDocument()
  })

  it('collapses when clicking the header', () => {
    renderFileCard()

    fireEvent.click(screen.getByRole('banner'))

    expect(screen.queryByTestId('body-content')).not.toBeInTheDocument()
  })

  it('expands when clicking the header again', () => {
    renderFileCard()
    const header = screen.getByRole('banner')

    fireEvent.click(header)
    fireEvent.click(header)

    expect(screen.getByTestId('body-content')).toBeInTheDocument()
  })

  it('collapses when clicking the chevron button', () => {
    renderFileCard()

    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByTestId('body-content')).not.toBeInTheDocument()
  })

  it('does not collapse when clicking a non-chevron button inside the header', () => {
    renderFileCard(<button data-testid="other-button">Action</button>)

    fireEvent.click(screen.getByTestId('other-button'))

    expect(screen.getByTestId('body-content')).toBeInTheDocument()
  })
})

describe('FileCard scroll adjustment on collapse', () => {
  let rafCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    rafCallbacks = []

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        rafCallbacks.push(callback)

        return rafCallbacks.length
      }
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRaf() {
    const callbacks = [...rafCallbacks]
    rafCallbacks = []

    act(() => {
      for (const callback of callbacks) {
        callback(0)
      }
    })
  }

  it('adjusts scroll position when collapsing', () => {
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'overflow-auto'
    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 500,
      writable: true
    })
    scrollContainer.getBoundingClientRect = () =>
      ({ top: 32, left: 0, right: 800, bottom: 600, width: 800, height: 568 }) as DOMRect
    document.body.appendChild(scrollContainer)

    render(
      <FileCard>
        <FileCardHeader>file.tsx</FileCardHeader>
        <FileCardBody>
          <div data-testid="body-content">Diff content</div>
        </FileCardBody>
      </FileCard>,
      { container: scrollContainer }
    )

    const card = scrollContainer.firstElementChild as HTMLElement
    card.getBoundingClientRect = () =>
      ({ top: -200, left: 0, right: 800, bottom: 108, width: 800, height: 308 }) as DOMRect

    fireEvent.click(screen.getByRole('banner'))
    flushRaf()

    expect(scrollContainer.scrollTop).toEqual(500 + (-200 - 32 - 76))

    document.body.removeChild(scrollContainer)
  })

  it('does not adjust scroll position when expanding', () => {
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'overflow-auto'
    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 500,
      writable: true
    })
    document.body.appendChild(scrollContainer)

    render(
      <FileCard>
        <FileCardHeader>file.tsx</FileCardHeader>
        <FileCardBody>
          <div data-testid="body-content">Diff content</div>
        </FileCardBody>
      </FileCard>,
      { container: scrollContainer }
    )

    // Collapse first
    fireEvent.click(screen.getByRole('banner'))
    flushRaf()

    // Reset scrollTop for the expand check
    scrollContainer.scrollTop = 300

    // Expand
    fireEvent.click(screen.getByRole('banner'))
    flushRaf()

    expect(scrollContainer.scrollTop).toEqual(300)

    document.body.removeChild(scrollContainer)
  })

  it('schedules scroll via requestAnimationFrame', () => {
    renderFileCard()

    fireEvent.click(screen.getByRole('banner'))

    expect(window.requestAnimationFrame).toHaveBeenCalledOnce()
  })
})
