/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReadinessSummary } from './ReadinessSummary'

describe('ReadinessSummary', () => {
  it('shows the ready headline when there are no blockers', () => {
    render(
      <ReadinessSummary
        blockers={0}
        done={3}
        info={0}
        total={3}
        warnings={0}
      />
    )

    expect(screen.getByText('Ready to merge')).toBeDefined()
  })

  it('singularizes the blocker headline at one', () => {
    render(
      <ReadinessSummary
        blockers={1}
        done={0}
        info={0}
        total={1}
        warnings={0}
      />
    )

    expect(screen.getByText('1 blocker before this can merge')).toBeDefined()
  })

  it('pluralizes the blocker headline above one', () => {
    render(
      <ReadinessSummary
        blockers={3}
        done={0}
        info={0}
        total={3}
        warnings={0}
      />
    )

    expect(screen.getByText('3 blockers before this can merge')).toBeDefined()
  })

  it('renders the done/total subheadline with pluralized warnings', () => {
    render(
      <ReadinessSummary
        blockers={1}
        done={2}
        info={1}
        total={5}
        warnings={2}
      />
    )

    expect(
      screen.getByText('2/5 resolved · 2 warnings · 1 informational')
    ).toBeDefined()
  })

  it('renders the empty subheadline when there are no tasks', () => {
    render(
      <ReadinessSummary
        blockers={0}
        done={0}
        info={0}
        total={0}
        warnings={0}
      />
    )

    expect(screen.getByText('No tasks to resolve.')).toBeDefined()
  })

  it('renders 100% in the progress ring when total is zero', () => {
    render(
      <ReadinessSummary
        blockers={0}
        done={0}
        info={0}
        total={0}
        warnings={0}
      />
    )

    expect(screen.getByText('100%')).toBeDefined()
  })

  it('rounds the progress ring percentage from done/total', () => {
    render(
      <ReadinessSummary
        blockers={0}
        done={1}
        info={0}
        total={3}
        warnings={0}
      />
    )

    // 1/3 → 33%
    expect(screen.getByText('33%')).toBeDefined()
  })
})
