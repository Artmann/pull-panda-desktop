import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'

import { AutoMergeStatus, MergeQueueStatus } from './MergeAutomationStatus'

function Frame({ children }: { children: ReactElement }): ReactElement {
  return <div className="w-[400px]">{children}</div>
}

const meta = {
  component: AutoMergeStatus,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  title: 'Components/MergeAutomationStatus'
} satisfies Meta<typeof AutoMergeStatus>

export default meta

type Story = StoryObj<typeof meta>

export const AutoMergeEnabled: Story = {
  args: {
    autoMergeRequest: {
      enabledAt: '2026-10-14T10:00:00Z',
      enabledByLogin: 'octocat',
      mergeMethod: 'squash'
    },
    canDisable: true,
    isMergeQueueEnabled: false,
    onDisable: () => undefined
  },
  render: (args) => (
    <Frame>
      <AutoMergeStatus {...args} />
    </Frame>
  )
}

export const AutoMergeWithoutPermissionToDisable: Story = {
  args: {
    ...AutoMergeEnabled.args,
    canDisable: false
  },
  render: (args) => (
    <Frame>
      <AutoMergeStatus {...args} />
    </Frame>
  )
}

export const MergeWhenReady: Story = {
  args: {
    autoMergeRequest: {
      enabledAt: '2026-10-14T10:00:00Z',
      enabledByLogin: 'octocat',
      mergeMethod: null
    },
    canDisable: true,
    isMergeQueueEnabled: true,
    onDisable: () => undefined
  },
  render: (args) => (
    <Frame>
      <AutoMergeStatus {...args} />
    </Frame>
  )
}

export const InMergeQueue: Story = {
  args: AutoMergeEnabled.args,
  render: () => (
    <Frame>
      <MergeQueueStatus
        entry={{
          enqueuedAt: '2026-10-14T10:00:00Z',
          estimatedTimeToMerge: 720,
          position: 2,
          state: 'AWAITING_CHECKS'
        }}
        onRemove={() => undefined}
      />
    </Frame>
  )
}

export const JustQueued: Story = {
  args: AutoMergeEnabled.args,
  render: () => (
    <Frame>
      <MergeQueueStatus
        entry={{
          enqueuedAt: '2026-10-14T10:00:00Z',
          estimatedTimeToMerge: null,
          position: null,
          state: 'QUEUED'
        }}
        onRemove={() => undefined}
      />
    </Frame>
  )
}

export const Unmergeable: Story = {
  args: AutoMergeEnabled.args,
  render: () => (
    <Frame>
      <MergeQueueStatus
        entry={{
          enqueuedAt: '2026-10-14T10:00:00Z',
          estimatedTimeToMerge: null,
          position: 1,
          state: 'UNMERGEABLE'
        }}
        onRemove={() => undefined}
      />
    </Frame>
  )
}
