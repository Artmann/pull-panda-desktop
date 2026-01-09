// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Duration } from './Duration'

describe('Duration', () => {
  it('displays the correct duration.', () => {
    render(<Duration timeInSeconds={3670} />)

    expect(screen.getByText('1h 1m 10s')).toBeInTheDocument()
  })

  it('displays only seconds when less than a minute', () => {
    render(<Duration timeInSeconds={45} />)

    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  it('displays minutes and seconds when less than an hour', () => {
    render(<Duration timeInSeconds={125} />)

    expect(screen.getByText('2m 5s')).toBeInTheDocument()
  })

  it('displays hours and minutes when seconds is zero', () => {
    render(<Duration timeInSeconds={7200} />)

    expect(screen.getByText('2h')).toBeInTheDocument()
  })

  it('displays only minutes when hours and seconds are zero', () => {
    render(<Duration timeInSeconds={180} />)

    expect(screen.getByText('3m')).toBeInTheDocument()
  })

  it('displays 0s for zero seconds', () => {
    render(<Duration timeInSeconds={0} />)

    expect(screen.getByText('0s')).toBeInTheDocument()
  })

  it('returns null when timeInSeconds is undefined', () => {
    const { container } = render(<Duration timeInSeconds={undefined} />)

    expect(container.firstChild).toBeNull()
  })
})
