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
    filter: 'all',
    hideResolved: false,
    onChangeFilter: () => undefined,
    onToggleHideResolved: () => undefined
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
  const [hideResolved, setHideResolved] = useState(false)

  return (
    <TasksFilterBar
      filter={filter}
      hideResolved={hideResolved}
      onChangeFilter={setFilter}
      onToggleHideResolved={() => {
        setHideResolved((value) => !value)
      }}
    />
  )
}

export const All: Story = {
  render: () => <InteractiveFilterBar initialFilter="all" />
}

export const Open: Story = {
  render: () => <InteractiveFilterBar initialFilter="open" />
}

export const BlockersOnly: Story = {
  render: () => <InteractiveFilterBar initialFilter="blockers" />
}
