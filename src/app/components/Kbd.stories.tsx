import type { Meta, StoryObj } from '@storybook/react-vite'

import { Kbd, modifierKey, shortcutLabel } from './Kbd'

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { children: 'K' }
} satisfies Meta<typeof Kbd>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Chord: Story = {
  render: () => (
    <div className="flex items-center gap-0.5">
      <Kbd>{modifierKey()}</Kbd>

      <Kbd>K</Kbd>
    </div>
  )
}

export const OneChip: Story = {
  render: () => <Kbd>{shortcutLabel('1')}</Kbd>
}

/** On a tooltip the keycap sits on inverted colours and has to be told so. */
export const OnATooltipSurface: Story = {
  render: () => (
    <div className="bg-foreground text-background flex items-center gap-2 rounded-md px-3 py-1.5 text-xs">
      Next section
      <Kbd className="border-background/40 text-background">J</Kbd>
    </div>
  )
}

export const InASentence: Story = {
  render: () => (
    <p className="text-muted-foreground max-w-xs text-sm">
      Press <Kbd>{modifierKey()}</Kbd> <Kbd>K</Kbd> to open the command palette.
    </p>
  )
}
