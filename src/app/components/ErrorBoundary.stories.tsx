import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'

import { ErrorBoundary } from './ErrorBoundary'

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs']
} satisfies Meta<typeof ErrorBoundary>

export default meta

type Story = StoryObj<typeof meta>

function Thrower(): ReactElement {
  throw new Error('GitHub token expired. Please sign in again.')
}

export const HealthyChild: Story = {
  args: {
    children: (
      <div className="p-8">
        <p className="text-sm">Everything is fine inside the boundary.</p>
      </div>
    )
  }
}

export const CaughtError: Story = {
  args: { children: <Thrower /> },
  render: (args) => (
    <div className="h-96">
      <ErrorBoundary {...args} />
    </div>
  )
}
