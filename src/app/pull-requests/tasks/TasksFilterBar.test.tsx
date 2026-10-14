/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TasksFilterBar } from './TasksFilterBar'

function renderBar(
  overrides: {
    filter?: 'all' | 'open' | 'blockers'
  } = {}
) {
  const onChangeFilter = vi.fn()

  render(
    <TasksFilterBar
      doneCount={2}
      filter={overrides.filter ?? 'all'}
      onChangeFilter={onChangeFilter}
      totalCount={9}
    />
  )

  return { onChangeFilter }
}

describe('TasksFilterBar', () => {
  it('renders all three filter buttons', () => {
    renderBar()

    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['All', 'Open', 'Blockers'])
  })

  it('marks the active filter as pressed', () => {
    renderBar({ filter: 'open' })

    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-pressed'))
    ).toEqual(['false', 'true', 'false'])
  })

  it('calls onChangeFilter when a filter button is clicked', () => {
    const { onChangeFilter } = renderBar({ filter: 'all' })

    fireEvent.click(screen.getByRole('button', { name: 'Blockers' }))

    expect(onChangeFilter).toHaveBeenCalledWith('blockers')
  })

  it('shows how many tasks are done', () => {
    renderBar()

    expect(screen.getByText('2 of 9 done')).toBeDefined()
  })
})
