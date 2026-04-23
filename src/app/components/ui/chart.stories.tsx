import type { Meta, StoryObj } from '@storybook/react-vite'

import { BarChart, MultiLineChart } from './chart'

const meta = {
  title: 'shadcn/Chart',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const barData = [
  { day: 'Mon', prs: 4 },
  { day: 'Tue', prs: 7 },
  { day: 'Wed', prs: 5 },
  { day: 'Thu', prs: 9 },
  { day: 'Fri', prs: 12 },
  { day: 'Sat', prs: 2 },
  { day: 'Sun', prs: 1 }
]

export const Bar: Story = {
  render: () => (
    <div className="w-[600px]">
      <BarChart
        data={barData}
        xKey="day"
        yKey="prs"
        barColor="var(--primary)"
      />
    </div>
  )
}

const lineData = [
  { week: 'W1', merged: 12, open: 8 },
  { week: 'W2', merged: 18, open: 6 },
  { week: 'W3', merged: 14, open: 11 },
  { week: 'W4', merged: 22, open: 7 },
  { week: 'W5', merged: 19, open: 9 },
  { week: 'W6', merged: 25, open: 5 }
]

export const Lines: Story = {
  render: () => (
    <div className="w-[600px]">
      <MultiLineChart
        data={lineData}
        xKey="week"
        lines={[
          { key: 'merged', label: 'Merged', color: 'var(--primary)' },
          { key: 'open', label: 'Open', color: 'var(--destructive)' }
        ]}
      />
    </div>
  )
}
