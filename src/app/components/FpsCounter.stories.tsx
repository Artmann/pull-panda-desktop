import { useEffect, type ReactElement } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { setFpsCounterVisible } from '@/app/lib/fps-counter-state'

import { FpsCounter } from './FpsCounter'

const meta = {
  title: 'Components/FpsCounter',
  component: FpsCounter,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof FpsCounter>

export default meta

type Story = StoryObj<typeof meta>

function VisibleFpsCounter(): ReactElement {
  useEffect(() => {
    setFpsCounterVisible(true)

    return () => setFpsCounterVisible(false)
  }, [])

  return (
    <div className="min-h-40 bg-background p-6 text-sm text-muted-foreground">
      <FpsCounter />
    </div>
  )
}

export const Visible: Story = {
  render: () => <VisibleFpsCounter />
}
