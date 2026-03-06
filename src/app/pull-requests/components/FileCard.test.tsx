/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

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
    renderFileCard(
      <button data-testid="other-button">Action</button>
    )

    fireEvent.click(screen.getByTestId('other-button'))

    expect(screen.getByTestId('body-content')).toBeInTheDocument()
  })
})
