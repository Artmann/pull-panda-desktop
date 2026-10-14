import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { TasksFilterBar } from './TasksFilterBar'
import type { TasksFilter } from './task-types'

const meta = {
  title: 'Components/TasksFilterBar',
  component: TasksFilterBar,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    doneCount: 2,
    filter: 'all',
    onChangeFilter: () => undefined,
    totalCount: 9
  }
} satisfies Meta<typeof TasksFilterBar>

export default meta

type Story = StoryObj<typeof meta>

function InteractiveFilterBar({
  initialFilter
}: {
  initialFilter: TasksFilter
}) {
  const [filter, setFilter] = useState<TasksFilter>(initialFilter)

  return (
    <TasksFilterBar
      doneCount={2}
      filter={filter}
      onChangeFilter={setFilter}
      totalCount={9}
    />
  )
}

export const All: Story = {
  render: () => <InteractiveFilterBar initialFilter="all" />
}

export const Open: Story = {
  render: () => <InteractiveFilterBar initialFilter="open" />
}

export const Blockers: Story = {
  render: () => <InteractiveFilterBar initialFilter="blockers" />
}
