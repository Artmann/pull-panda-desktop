import type { Meta, StoryObj } from '@storybook/react-vite'

import type { PullRequest } from '@/types/pull-request'
import { PullRequestStatusBadge } from './PullRequestStatusBadge'

const basePullRequest: PullRequest = {
  id: '1',
  number: 42,
  title: 'Add Storybook setup',
  body: null,
  bodyHtml: null,
  headRefName: 'feat/storybook',
  state: 'OPEN',
  url: 'https://github.com/artgaard/pull-panda/pull/42',
  repositoryOwner: 'artgaard',
  repositoryName: 'pull-panda',
  authorLogin: 'artgaard',
  authorAvatarUrl: null,
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-23T09:00:00Z',
  closedAt: null,
  mergedAt: null,
  isDraft: false,
  isAuthor: true,
  isAssignee: false,
  isReviewer: false,
  labels: [],
  assignees: [],
  syncedAt: '2026-04-23T09:00:00Z',
  detailsSyncedAt: null,
  commentCount: 0,
  approvalCount: 0,
  changesRequestedCount: 0
}

const meta = {
  title: 'Components/PullRequestStatusBadge',
  component: PullRequestStatusBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof PullRequestStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Pending: Story = {
  args: { pullRequest: basePullRequest }
}

export const Approved: Story = {
  args: { pullRequest: { ...basePullRequest, approvalCount: 2 } }
}

export const ChangesRequested: Story = {
  args: { pullRequest: { ...basePullRequest, changesRequestedCount: 1 } }
}

export const Draft: Story = {
  args: { pullRequest: { ...basePullRequest, isDraft: true } }
}

export const Merged: Story = {
  args: {
    pullRequest: {
      ...basePullRequest,
      state: 'MERGED',
      mergedAt: '2026-04-22T12:00:00Z'
    }
  }
}

export const Closed: Story = {
  args: {
    pullRequest: {
      ...basePullRequest,
      state: 'CLOSED',
      closedAt: '2026-04-22T12:00:00Z'
    }
  }
}

export const AllStatuses: Story = {
  args: { pullRequest: basePullRequest },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <PullRequestStatusBadge pullRequest={basePullRequest} />
      <PullRequestStatusBadge
        pullRequest={{ ...basePullRequest, approvalCount: 2 }}
      />
      <PullRequestStatusBadge
        pullRequest={{ ...basePullRequest, changesRequestedCount: 1 }}
      />
      <PullRequestStatusBadge
        pullRequest={{ ...basePullRequest, isDraft: true }}
      />
      <PullRequestStatusBadge
        pullRequest={{ ...basePullRequest, state: 'MERGED' }}
      />
      <PullRequestStatusBadge
        pullRequest={{ ...basePullRequest, state: 'CLOSED' }}
      />
    </div>
  )
}
