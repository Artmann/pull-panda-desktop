/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createPullRequest,
  createSimpleTask
} from './__test-helpers__/factories'
import { TasksGroupCard } from './TasksGroupCard'
import type { TaskGroup } from './task-types'

beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn()
  }))
})

function buildGroup(overrides: Partial<TaskGroup> = {}): TaskGroup {
  return {
    key: 'ci',
    label: 'CI & automation',
    tasks: [],
    ...overrides
  }
}

describe('TasksGroupCard', () => {
  it('renders the group label', () => {
    const group = buildGroup({
      tasks: [createSimpleTask({ id: 't-1', title: 'task one' })]
    })

    render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={group.tasks}
      />
    )

    expect(screen.getByText('CI & automation')).toBeDefined()
  })

  it('singularizes "1 blocker"', () => {
    const group = buildGroup({
      tasks: [
        createSimpleTask({
          id: 't-block',
          severity: 'blocker',
          title: 'blocker'
        })
      ]
    })

    render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={group.tasks}
      />
    )

    expect(screen.getByText('1 blocker')).toBeDefined()
  })

  it('pluralizes "3 blockers"', () => {
    const group = buildGroup({
      tasks: [
        createSimpleTask({ id: 't1', severity: 'blocker', title: 'a' }),
        createSimpleTask({ id: 't2', severity: 'blocker', title: 'b' }),
        createSimpleTask({ id: 't3', severity: 'blocker', title: 'c' })
      ]
    })

    render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={group.tasks}
      />
    )

    expect(screen.getByText('3 blockers')).toBeDefined()
  })

  it('hides the warning indicator when there are no warnings', () => {
    const group = buildGroup({
      tasks: [createSimpleTask({ id: 't1', severity: 'done', title: 'a' })]
    })

    const { container } = render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={group.tasks}
      />
    )

    // Warning text uses the text-status-warning-foreground class
    const warningSpans = container.querySelectorAll(
      '.text-status-warning-foreground'
    )

    expect(warningSpans.length).toEqual(0)
  })

  it('renders the done/total ratio', () => {
    const group = buildGroup({
      tasks: [
        createSimpleTask({ id: 't1', severity: 'done', title: 'a' }),
        createSimpleTask({ id: 't2', severity: 'blocker', title: 'b' }),
        createSimpleTask({ id: 't3', severity: 'warning', title: 'c' })
      ]
    })

    render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={group.tasks}
      />
    )

    expect(screen.getByText('1/3')).toBeDefined()
  })

  it('hides the rows when the header is clicked', () => {
    const group = buildGroup({
      tasks: [createSimpleTask({ id: 't1', title: 'visible task' })]
    })

    render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={group.tasks}
      />
    )

    expect(screen.getByText('visible task')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /CI & automation/i }))

    expect(screen.queryByText('visible task')).toEqual(null)
  })

  it('only renders visibleTasks, not the full group.tasks list', () => {
    const all = [
      createSimpleTask({ id: 't1', title: 'shown' }),
      createSimpleTask({ id: 't2', title: 'hidden' })
    ]
    const group = buildGroup({ tasks: all })

    render(
      <TasksGroupCard
        group={group}
        pullRequest={createPullRequest()}
        visibleTasks={[all[0]]}
      />
    )

    expect(screen.getByText('shown')).toBeDefined()
    expect(screen.queryByText('hidden')).toEqual(null)
  })
})
