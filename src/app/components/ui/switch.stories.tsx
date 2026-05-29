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

export const Off: Story = { args: { checked: false } }

export const On: Story = { args: { checked: true } }

export const Disabled: Story = { args: { checked: true, disabled: true } }

export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)

    return (
      <Switch
        checked={checked}
        onCheckedChange={setChecked}
      />
    )
  }
}
