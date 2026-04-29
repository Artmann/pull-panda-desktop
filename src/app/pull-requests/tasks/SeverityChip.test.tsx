/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SeverityChip } from './SeverityChip'

describe('SeverityChip', () => {
  it('renders the Blocker label with danger styling', () => {
    render(<SeverityChip severity="blocker" />)

    const chip = screen.getByText('Blocker')

    expect(chip).toBeDefined()
    expect(chip.className).toContain('text-status-danger-foreground')
  })

  it('renders the Warning label with warning styling', () => {
    render(<SeverityChip severity="warning" />)

    const chip = screen.getByText('Warning')

    expect(chip).toBeDefined()
    expect(chip.className).toContain('text-status-warning-foreground')
  })

  it('renders the Done label with success styling', () => {
    render(<SeverityChip severity="done" />)

    const chip = screen.getByText('Done')

    expect(chip).toBeDefined()
    expect(chip.className).toContain('text-status-success-foreground')
  })

  it('renders nothing for info severity', () => {
    const { container } = render(<SeverityChip severity="info" />)

    expect(container.firstChild).toEqual(null)
  })
})
