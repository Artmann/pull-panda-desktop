import type { Meta, StoryObj } from '@storybook/react-vite'

import { Bubble, BubbleContent, BubbleGroup } from './bubble'

const meta = {
  title: 'shadcn/Bubble',
  component: Bubble,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Bubble>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <BubbleGroup className="w-96">
      <Bubble variant="default">
        <BubbleContent>A default bubble.</BubbleContent>
      </Bubble>

      <Bubble variant="secondary">
        <BubbleContent>A secondary bubble.</BubbleContent>
      </Bubble>

      <Bubble variant="muted">
        <BubbleContent>A muted bubble.</BubbleContent>
      </Bubble>

      <Bubble variant="outline">
        <BubbleContent>An outline bubble.</BubbleContent>
      </Bubble>

      <Bubble variant="ghost">
        <BubbleContent>A ghost bubble without background.</BubbleContent>
      </Bubble>

      <Bubble variant="destructive">
        <BubbleContent>A destructive bubble for errors.</BubbleContent>
      </Bubble>
    </BubbleGroup>
  )
}

export const AlignedEnd: Story = {
  render: () => (
    <BubbleGroup className="w-96">
      <Bubble
        align="end"
        variant="secondary"
      >
        <BubbleContent>A bubble aligned to the end.</BubbleContent>
      </Bubble>
    </BubbleGroup>
  )
}
