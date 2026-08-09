import type { Meta, StoryObj } from '@storybook/react-vite'
import { WrenchIcon } from 'lucide-react'

import { Marker, MarkerContent, MarkerIcon } from './marker'

const meta = {
  title: 'shadcn/Marker',
  component: Marker,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Marker>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <Marker>
        <MarkerIcon>
          <WrenchIcon />
        </MarkerIcon>
        <MarkerContent>Reading the pull request diff</MarkerContent>
      </Marker>
    </div>
  )
}

export const Separator: Story = {
  render: () => (
    <div className="w-96">
      <Marker variant="separator">
        <MarkerContent>Yesterday</MarkerContent>
      </Marker>
    </div>
  )
}

export const Border: Story = {
  render: () => (
    <div className="w-96">
      <Marker variant="border">
        <MarkerContent>Session started</MarkerContent>
      </Marker>
    </div>
  )
}
