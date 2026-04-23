import type { Meta, StoryObj } from '@storybook/react-vite'

import { TimeAgo } from './TimeAgo'

const meta = {
  title: 'Components/TimeAgo',
  component: TimeAgo,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof TimeAgo>

export default meta

type Story = StoryObj<typeof meta>

const minutesAgo = (count: number) =>
  new Date(Date.now() - count * 60_000).toISOString()

const hoursAgo = (count: number) =>
  new Date(Date.now() - count * 3_600_000).toISOString()

const daysAgo = (count: number) =>
  new Date(Date.now() - count * 86_400_000).toISOString()

export const JustNow: Story = {
  args: { dateTime: new Date().toISOString() }
}

export const MinutesAgo: Story = {
  args: { dateTime: minutesAgo(12) }
}

export const HoursAgo: Story = {
  args: { dateTime: hoursAgo(5) }
}

export const DaysAgo: Story = {
  args: { dateTime: daysAgo(3) }
}

export const Scale: Story = {
  args: { dateTime: new Date().toISOString() },
  render: () => (
    <div className="flex flex-col gap-2">
      <TimeAgo dateTime={new Date().toISOString()} />
      <TimeAgo dateTime={minutesAgo(5)} />
      <TimeAgo dateTime={hoursAgo(2)} />
      <TimeAgo dateTime={daysAgo(1)} />
      <TimeAgo dateTime={daysAgo(10)} />
      <TimeAgo dateTime={daysAgo(60)} />
      <TimeAgo dateTime={daysAgo(400)} />
    </div>
  )
}
