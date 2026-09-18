import type { Meta, StoryObj } from '@storybook/react-vite'

import { createMockPullRequest } from '../__test-helpers__/pull-request-fixtures'
import { PullRequestSidebarRow } from './PullRequestSidebarRow'
import type { SidebarRow } from './sidebar-data'

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString()

function buildRow(overrides: Partial<SidebarRow> = {}): SidebarRow {
  return {
    checkRollup: 'passing',
    needsAttention: false,
    pullRequest: createMockPullRequest({
      number: 47,
      repositoryName: 'pull-panda-desktop',
      title: 'Right-align Copy resolution prompt button',
      updatedAt: hoursAgo(12)
    }),
    mergeReadiness: 'needs-review',
    unread: false,
    ...overrides
  }
}

const meta = {
  title: 'Components/PullRequestSidebarRow',
  component: PullRequestSidebarRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    isSelected: false,
    onSelect: () => undefined,
    row: buildRow()
  },
  decorators: [
    (Story) => (
      <div className="bg-sidebar border-sidebar-border w-[306px] rounded-lg border p-1.5">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof PullRequestSidebarRow>

export default meta

type Story = StoryObj<typeof meta>

export const Read: Story = {}

export const Unread: Story = {
  args: { row: buildRow({ unread: true }) }
}

export const NeedsAttention: Story = {
  args: {
    row: buildRow({
      checkRollup: 'failing',
      needsAttention: true,
      pullRequest: createMockPullRequest({
        changesRequestedCount: 1,
        isReviewer: true,
        number: 290,
        repositoryName: 'vscode-deepnote',
        title: 'feat: add integration tests to CI workflow',
        updatedAt: hoursAgo(72)
      }),
      unread: true
    })
  }
}

export const Selected: Story = {
  args: { isSelected: true, row: buildRow({ unread: true }) }
}

export const ReadyToMerge: Story = {
  args: {
    row: buildRow({
      pullRequest: createMockPullRequest({
        approvalCount: 2,
        number: 41,
        repositoryName: 'pull-panda-desktop',
        title: 'Add a tab with review tasks',
        updatedAt: hoursAgo(14)
      }),
      mergeReadiness: 'ready'
    })
  }
}

export const ChecksRunning: Story = {
  args: { row: buildRow({ checkRollup: 'running' }) }
}

export const NoChecks: Story = {
  args: { row: buildRow({ checkRollup: 'none' }) }
}

export const Approved: Story = {
  args: {
    row: buildRow({
      pullRequest: createMockPullRequest({
        approvalCount: 2,
        number: 41,
        repositoryName: 'pull-panda-desktop',
        title: 'Add a tab with review tasks',
        updatedAt: hoursAgo(14)
      })
    })
  }
}

export const Draft: Story = {
  args: {
    row: buildRow({
      pullRequest: createMockPullRequest({
        isDraft: true,
        number: 110,
        repositoryName: 'pmkin-app-remix',
        title: 'Update README.md',
        updatedAt: hoursAgo(24 * 90)
      })
    })
  }
}

export const LongTitle: Story = {
  args: {
    row: buildRow({
      pullRequest: createMockPullRequest({
        number: 12,
        repositoryName: 'a-repository-with-a-very-long-name',
        title:
          'Refactor the background syncer so that every endpoint shares one etag store',
        updatedAt: hoursAgo(120)
      })
    })
  }
}
