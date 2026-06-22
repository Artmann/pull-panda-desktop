import type { Meta, StoryObj } from '@storybook/react-vite'

import { Link } from './Link'

const meta = {
  title: 'Components/Link',
  component: Link,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    children: 'Open pull-panda on GitHub',
    href: 'https://github.com/artmann/pull-panda-desktop'
  }
} satisfies Meta<typeof Link>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomClassName: Story = {
  args: {
    className: 'text-primary underline underline-offset-4'
  }
}

export const WrappingChildren: Story = {
  args: {
    className:
      'flex items-center gap-2 rounded-sm border border-border px-4 py-3',
    children: (
      <div className="text-sm">
        <div className="font-semibold">Pull Panda</div>
        <div className="text-muted-foreground">
          https://github.com/artmann/pull-panda-desktop
        </div>
      </div>
    )
  }
}
