/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TasksFilterBar } from './TasksFilterBar'

function renderBar(
  overrides: {
    filter?: 'all' | 'open' | 'blockers'
    hideResolved?: boolean
  } = {}
) {
  const onChangeFilter = vi.fn()
  const onToggleHideResolved = vi.fn()

  render(
    <TasksFilterBar
      filter={overrides.filter ?? 'all'}
      hideResolved={overrides.hideResolved ?? false}
      onChangeFilter={onChangeFilter}
      onToggleHideResolved={onToggleHideResolved}
    />
  )

  return { onChangeFilter, onToggleHideResolved }
}

describe('TasksFilterBar', () => {
  it('renders all three filter buttons', () => {
    renderBar()

    expect(screen.getByRole('button', { name: 'All' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Open' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Blockers only' })).toBeDefined()
  })

  it('marks the active filter button with the selected styling', () => {
    renderBar({ filter: 'open' })

    const open = screen.getByRole('button', { name: 'Open' })
    const all = screen.getByRole('button', { name: 'All' })

    expect(open.className).toContain('bg-muted')
    expect(all.className).not.toContain('bg-muted')
  })

  it('calls onChangeFilter when a filter button is clicked', () => {
    const { onChangeFilter } = renderBar({ filter: 'all' })

    fireEvent.click(screen.getByRole('button', { name: 'Blockers only' }))

    expect(onChangeFilter).toHaveBeenCalledWith('blockers')
  })

  it('calls onToggleHideResolved when the hide-resolved button is clicked', () => {
    const { onToggleHideResolved } = renderBar({ hideResolved: false })

    fireEvent.click(screen.getByRole('button', { name: /hide resolved/i }))

    expect(onToggleHideResolved).toHaveBeenCalledTimes(1)
  })

  it('reflects the hideResolved state via aria-pressed', () => {
    renderBar({ hideResolved: true })

    const button = screen.getByRole('button', { name: /hide resolved/i })

    expect(button.getAttribute('aria-pressed')).toEqual('true')
  })
})
