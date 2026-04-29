import type { Meta, StoryObj } from '@storybook/react-vite'

import type { PullRequest } from '@/types/pull-request'

import { TaskRow } from './TaskRow'

const meta = {
  title: 'Components/TaskRow',
  component: TaskRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof TaskRow>

export default meta

type Story = StoryObj<typeof meta>

const mockPullRequest: PullRequest = {
  approvalCount: 0,
  assignees: [],
  authorAvatarUrl: null,
  authorLogin: 'octocat',
  body: null,
  bodyHtml: null,
  changesRequestedCount: 0,
  closedAt: null,
  commentCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  detailsSyncedAt: null,
  headRefName: 'feature/branch',
  id: 'pr-1',
  isAssignee: false,
  isAuthor: true,
  isDraft: false,
  isReviewer: false,
  labels: [],
  mergedAt: null,
  number: 1,
  repositoryName: 'demo',
  repositoryOwner: 'octocat',
  state: 'OPEN',
  syncedAt: '2026-01-01T00:00:00Z',
  title: 'Demo PR',
  updatedAt: '2026-01-01T00:00:00Z',
  url: 'https://example.com'
}

export const FailedCheck: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      action: { label: 'View details', url: 'https://example.com/checks/1' },
      detailsUrl: 'https://example.com/checks/1',
      id: 'check-1',
      kind: 'check',
      message: 'AssertionError: expected 200, got 500',
      meta: 'CI · Failed',
      severity: 'blocker',
      title: 'test:e2e failed on commit a91f2c4'
    }
  }
}

export const PendingCheck: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      id: 'check-2',
      kind: 'simple',
      meta: 'CI · running',
      severity: 'warning',
      title: 'preview-deploy still running'
    }
  }
}

export const Requirement: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      description:
        'The branch must be up to date with the base branch before merging.',
      id: 'requirement-1',
      kind: 'requirement',
      meta: 'Branch protection requirement',
      severity: 'blocker',
      title: 'Update branch'
    }
  }
}

export const ChangesRequested: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      authorLogin: 'alice',
      id: 'review-state-1',
      kind: 'review-state',
      meta: 'Required reviewer · changes requested',
      severity: 'blocker',
      summary:
        'Address the requested changes and re-request review to clear the changes-requested state.',
      title: 'alice requested changes'
    }
  }
}

export const ApprovedSummary: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      id: 'review-approved-summary',
      kind: 'simple',
      meta: 'Latest reviews',
      severity: 'done',
      title: '2 reviewers approved'
    }
  }
}
