import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select'

const meta = {
  title: 'shadcn/Select',
  component: Select,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a repository" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pull-panda">artgaard/pull-panda</SelectItem>
        <SelectItem value="core">acme/core</SelectItem>
        <SelectItem value="ui">acme/ui</SelectItem>
        <SelectItem value="docs">acme/docs</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const Small: Story = {
  render: () => (
    <Select>
      <SelectTrigger
        size="sm"
        className="w-48"
      >
        <SelectValue placeholder="Filter" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
        <SelectItem value="merged">Merged</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Disabled" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">A</SelectItem>
      </SelectContent>
    </Select>
  )
}
