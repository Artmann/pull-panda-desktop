import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProgressRing } from './ProgressRing'

const meta = {
  title: 'Components/ProgressRing',
  component: ProgressRing,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { percentage: 50 }
} satisfies Meta<typeof ProgressRing>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { percentage: 0 } }

export const Partial: Story = { args: { percentage: 40 } }

export const Complete: Story = { args: { percentage: 100 } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <ProgressRing percentage={0} />
      <ProgressRing percentage={25} />
      <ProgressRing percentage={50} />
      <ProgressRing percentage={75} />
      <ProgressRing percentage={100} />
    </div>
  )
}
