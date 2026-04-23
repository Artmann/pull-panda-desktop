import type { Meta, StoryObj } from '@storybook/react-vite'

import { PandaMark, Wordmark } from './PandaMark'

const meta = {
  title: 'Components/PandaMark',
  component: PandaMark,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof PandaMark>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { size: 64 }
}

export const Sizes: Story = {
  render: () => (
    <div className="text-foreground flex items-end gap-6">
      <PandaMark size={16} />
      <PandaMark size={24} />
      <PandaMark size={48} />
      <PandaMark size={96} />
    </div>
  )
}

export const WithWordmark: Story = {
  render: () => <Wordmark />
}
