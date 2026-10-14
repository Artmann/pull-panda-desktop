import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusCircle } from './StatusCircle'

const meta = {
  title: 'Components/StatusCircle',
  component: StatusCircle,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { state: 'success' }
} satisfies Meta<typeof StatusCircle>

export default meta

type Story = StoryObj<typeof meta>

export const Success: Story = { args: { state: 'success' } }

export const Failure: Story = { args: { state: 'failure' } }

export const Running: Story = { args: { state: 'running' } }

export const Warning: Story = { args: { state: 'warning' } }

export const Neutral: Story = { args: { state: 'neutral' } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StatusCircle state="success" />
      <StatusCircle state="failure" />
      <StatusCircle state="running" />
      <StatusCircle state="warning" />
      <StatusCircle state="neutral" />
    </div>
  )
}
