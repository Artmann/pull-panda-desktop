import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'

const meta = {
  title: 'shadcn/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link'
      ]
    },
    size: {
      control: 'select',
      options: [
        'default',
        'sm',
        'lg',
        'xs',
        'icon',
        'icon-sm',
        'icon-lg',
        'icon-xs'
      ]
    }
  },
  args: { children: 'Button' }
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Destructive: Story = { args: { variant: 'destructive' } }

export const Outline: Story = { args: { variant: 'outline' } }

export const Secondary: Story = { args: { variant: 'secondary' } }

export const Ghost: Story = { args: { variant: 'ghost' } }

export const Link: Story = { args: { variant: 'link' } }

const variants = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link'
] as const

const sizes = ['xs', 'sm', 'default', 'lg'] as const

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      {variants.map((variant) => (
        <div key={variant} className="flex items-center gap-3">
          <div className="text-muted-foreground w-24 text-xs font-medium">
            {variant}
          </div>
          {sizes.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
        </div>
      ))}
    </div>
  )
}
