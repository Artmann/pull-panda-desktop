import type { Meta, StoryObj } from '@storybook/react-vite'

import { SeverityChip } from './SeverityChip'

const meta = {
  title: 'Components/SeverityChip',
  component: SeverityChip,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { severity: 'blocker' }
} satisfies Meta<typeof SeverityChip>

export default meta

type Story = StoryObj<typeof meta>

export const Blocker: Story = { args: { severity: 'blocker' } }

export const Warning: Story = { args: { severity: 'warning' } }

export const Info: Story = { args: { severity: 'info' } }

export const Done: Story = { args: { severity: 'done' } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <SeverityChip severity="blocker" />
      <SeverityChip severity="warning" />
      <SeverityChip severity="info" />
      <SeverityChip severity="done" />
    </div>
  )
}
