import type { Meta, StoryObj } from '@storybook/react-vite'

import { Textarea } from './textarea'

const meta = {
  title: 'shadcn/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Leave a comment…' },
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  )
}

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled' },
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  )
}

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    defaultValue: 'Some invalid input that triggered a validation error.'
  },
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  )
}

export const Prefilled: Story = {
  args: {
    defaultValue:
      'LGTM — nice work on the Storybook integration. Just one nit: consider organizing stories by feature.'
  },
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  )
}
