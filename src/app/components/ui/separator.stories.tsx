import type { Meta, StoryObj } from '@storybook/react-vite'

import { Separator } from './separator'

const meta = {
  title: 'shadcn/Separator',
  component: Separator,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Separator>

export default meta

type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-80">
      <p className="text-sm font-medium">Radix Primitives</p>
      <p className="text-muted-foreground text-xs">
        An open-source UI component library.
      </p>
      <Separator className="my-4" />
      <div className="text-muted-foreground flex h-5 items-center gap-3 text-xs">
        <span>Blog</span>
        <Separator orientation="vertical" />
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Source</span>
      </div>
    </div>
  )
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-16 items-center gap-4">
      <span>Left</span>
      <Separator orientation="vertical" />
      <span>Middle</span>
      <Separator orientation="vertical" />
      <span>Right</span>
    </div>
  )
}
