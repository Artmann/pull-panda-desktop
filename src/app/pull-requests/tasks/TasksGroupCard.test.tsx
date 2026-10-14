/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
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
    key: 'checks',
    label: 'Checks',
    tasks: [],
    ...overrides
  }
}

describe('TasksGroupCard', () => {
  it('labels the section with the group name', () => {
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

    expect(screen.getByRole('region', { name: 'Checks' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Checks' })).toBeDefined()
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
