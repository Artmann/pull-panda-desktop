/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCheckTask,
  createPullRequest,
  createRequirementTask,
  createReviewStateTask,
  createSimpleTask,
  createThreadTask
} from './__test-helpers__/factories'
import { TaskRow } from './TaskRow'

vi.mock('./expansions/ThreadExpansion', () => ({
  ThreadExpansion: () => (
    <div data-testid="thread-expansion-stub">thread expansion</div>
  )
}))

vi.mock('./expansions/RequirementExpansion', () => ({
  RequirementExpansion: ({ task }: { task: { description: string } }) => (
    <div data-testid="requirement-expansion-stub">{task.description}</div>
  )
}))

beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn()
  }))

  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    takeRecords: vi.fn().mockReturnValue([]),
    unobserve: vi.fn()
  }))
})

beforeEach(() => {
  window.electron = {
    ...window.electron,
    openUrl: vi.fn()
  }
})

function renderRow(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { _: (state = {}) => state }
  })

  return render(<Provider store={store}>{ui}</Provider>)
}

describe('TaskRow', () => {
  it('renders a non-expandable simple task without a chevron', () => {
    renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createSimpleTask({ title: 'All checks passed' })}
      />
    )

    expect(screen.getByText('All checks passed')).toBeDefined()
    expect(screen.queryByLabelText(/expand task/i)).toEqual(null)
    expect(screen.queryByLabelText(/collapse task/i)).toEqual(null)
  })

  it('shows the check icon for done tasks', () => {
    const { container } = renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createSimpleTask({ severity: 'done', title: 'Resolved' })}
      />
    )

    expect(container.querySelector('.line-through')).not.toEqual(null)
  })

  it('renders a collapse button on expandable tasks', () => {
    renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createCheckTask({ title: 'lint' })}
      />
    )

    expect(screen.getByLabelText('Expand task')).toBeDefined()
  })

  it('toggles expanded state when the body is clicked', () => {
    renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createCheckTask({
          message: 'Build failed at step 3',
          title: 'lint'
        })}
      />
    )

    expect(screen.queryByText('Build failed at step 3')).toEqual(null)

    fireEvent.click(screen.getByText('lint'))

    expect(screen.getByText('Build failed at step 3')).toBeDefined()
    expect(screen.getByLabelText('Collapse task')).toBeDefined()
  })

  it('keeps the expansion mounted on first paint when defaultOpen is true', () => {
    renderRow(
      <TaskRow
        defaultOpen
        pullRequest={createPullRequest()}
        task={createReviewStateTask({
          summary: 'Address the requested changes.',
          title: 'alice requested changes'
        })}
      />
    )

    expect(screen.getByText('Address the requested changes.')).toBeDefined()
  })

  it('toggles aria-label between Expand and Collapse', () => {
    renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createRequirementTask({
          description: 'Two approving reviews are required.'
        })}
      />
    )

    const button = screen.getByLabelText('Expand task')

    fireEvent.click(button)

    expect(screen.getByLabelText('Collapse task')).toBeDefined()
  })

  it('opens the task action URL via window.electron and does not toggle the row', () => {
    renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createCheckTask({
          action: { label: 'View details', url: 'https://example.com/run/1' },
          message: 'Build failed at step 3',
          title: 'lint'
        })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /view details/i }))

    expect(window.electron.openUrl).toHaveBeenCalledWith(
      'https://example.com/run/1'
    )
    // Row stayed collapsed — body content not visible.
    expect(screen.queryByText('Build failed at step 3')).toEqual(null)
  })

  it('hides the action button on done tasks', () => {
    renderRow(
      <TaskRow
        pullRequest={createPullRequest()}
        task={createSimpleTask({
          action: { label: 'View details', url: 'https://example.com' },
          severity: 'done',
          title: 'All checks have passed'
        })}
      />
    )

    expect(screen.queryByRole('button', { name: /view details/i })).toEqual(
      null
    )
  })

  it('renders thread tasks inline rather than in the appended layout', () => {
    const { container } = renderRow(
      <TaskRow
        defaultOpen
        pullRequest={createPullRequest()}
        task={createThreadTask({ title: 'alice: Please rename this.' })}
      />
    )

    // Inline thread expansion uses the bg-muted/30 container with border-y-2.
    expect(container.querySelector('.border-y-2')).not.toEqual(null)
  })
})
