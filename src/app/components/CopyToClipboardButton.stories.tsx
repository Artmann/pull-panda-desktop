import type { Meta, StoryObj } from '@storybook/react-vite'

import { CopyToClipboardButton } from './CopyToClipboardButton'

const meta = {
  title: 'Components/CopyToClipboardButton',
  component: CopyToClipboardButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof CopyToClipboardButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { value: 'https://github.com/artgaard/pull-panda' }
}

export const WithLabel: Story = {
  args: { value: 'some-secret-token' },
  render: (args) => (
    <div className="flex items-center gap-2">
      <code className="bg-muted rounded px-2 py-1 text-xs">{args.value}</code>
      <CopyToClipboardButton {...args} />
    </div>
  )
}
