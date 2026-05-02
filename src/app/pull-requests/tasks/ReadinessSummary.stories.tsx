import type { Meta, StoryObj } from '@storybook/react-vite'

import { ReadinessSummary } from './ReadinessSummary'

const meta = {
  title: 'Components/ReadinessSummary',
  component: ReadinessSummary,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof ReadinessSummary>

export default meta

type Story = StoryObj<typeof meta>

export const Ready: Story = {
  args: {
    blockers: 0,
    done: 12,
    info: 0,
    total: 12,
    warnings: 0
  }
}

export const OneBlocker: Story = {
  args: {
    blockers: 1,
    done: 8,
    info: 1,
    total: 12,
    warnings: 2
  }
}

export const ManyBlockers: Story = {
  args: {
    blockers: 4,
    done: 3,
    info: 0,
    total: 14,
    warnings: 7
  }
}

export const NoTasks: Story = {
  args: {
    blockers: 0,
    done: 0,
    info: 0,
    total: 0,
    warnings: 0
  }
}
