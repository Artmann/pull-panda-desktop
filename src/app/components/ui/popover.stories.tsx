import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const meta = {
  title: 'shadcn/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>

      <PopoverContent>
        <div className="text-sm">
          Popovers close on Escape and on a click outside.
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const AlignedToStart: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Aligned start</Button>
      </PopoverTrigger>

      <PopoverContent align="start">
        <div className="text-sm">
          Anchored to the left edge of the trigger, the way the sidebar filter
          menu is.
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const Open: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Already open</Button>
      </PopoverTrigger>

      <PopoverContent align="start">
        <div className="text-sm">Rendered open so the docs page shows it.</div>
      </PopoverContent>
    </Popover>
  )
}
