import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

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

export const Controlled: Story = {
  render: () => {
    const [checked, setChecked] = useState(true)

    return (
      <div className="flex items-center gap-3">
        <Switch
          checked={checked}
          onCheckedChange={setChecked}
        />
        <span className="text-sm text-muted-foreground">
          {checked ? 'On' : 'Off'}
        </span>
      </div>
    )
  }
}

export const WithLabel: Story = {
  render: () => (
    <label className="flex items-center gap-3 cursor-pointer">
      <Switch defaultChecked />
      <span className="text-sm">Share usage analytics</span>
    </label>
  )
}
