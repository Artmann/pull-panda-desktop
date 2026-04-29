import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { PullRequestFilter } from './PullRequestFilter'

function noop(): void {
  return undefined
}

const meta = {
  title: 'Components/PullRequestFilter',
  component: PullRequestFilter,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof PullRequestFilter>

export default meta

type Story = StoryObj<typeof meta>

function Interactive({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)

  return (
    <div className="w-96">
      <PullRequestFilter
        value={value}
        onChange={setValue}
      />
    </div>
  )
}

export const Empty: Story = {
  args: { value: '', onChange: noop },
  render: () => <Interactive />
}

export const WithValue: Story = {
  args: { value: '', onChange: noop },
  render: () => <Interactive initial="storybook" />
}
