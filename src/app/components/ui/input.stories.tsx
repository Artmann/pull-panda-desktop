import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from './input'

const meta = {
  title: 'shadcn/Input',
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'radio', options: ['default', 'sm'] }
  }
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Search repositories…' },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  )
}

export const Small: Story = {
  args: { size: 'sm', placeholder: 'Small input' },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  )
}

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled input' },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  )
}

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    defaultValue: 'not-an-email',
    placeholder: 'email@example.com'
  },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  )
}

export const Password: Story = {
  args: { type: 'password', defaultValue: 'hunter2' },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  )
}
