import type { Meta, StoryObj } from '@storybook/react-vite'

import { Switch } from './switch'

const meta = {
  title: 'shadcn/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Switch />
}

export const Checked: Story = {
  render: () => <Switch defaultChecked />
}

export const Disabled: Story = {
  render: () => <Switch disabled />
}

export const DisabledChecked: Story = {
  render: () => (
    <Switch
      defaultChecked
      disabled
    />
  )
}

export const WithLabel: Story = {
  render: () => (
    <label className="flex items-center gap-2 text-sm">
      <Switch defaultChecked />
      Share anonymous usage data
    </label>
  )
}
