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
  requestedReviewers: [],
  reviewDecision: null,
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
  baseRefName: null,
  id: 'pr-1',
  isAssignee: false,
  isAuthor: true,
  isDraft: false,
  isReviewer: false,
  hiddenAt: null,
  labels: [],
  lastViewedAt: null,
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
      action: {
        label: 'View logs',
        type: 'open-url',
        url: 'https://example.com/checks/1'
      },
      detailsUrl: 'https://example.com/checks/1',
      id: 'check-1',
      kind: 'check',
      message: 'AssertionError: expected 200, got 500',
      meta: 'AssertionError: expected 200, got 500',
      severity: 'blocker',
      title: 'test:e2e is failing'
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
      severity: 'info',
      status: 'running',
      title: 'preview-deploy is still running'
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
      meta: 'Address the feedback, then re-request a review',
      severity: 'blocker',
      summary:
        'Address the requested changes and re-request review to clear the changes-requested state.',
      title: 'Changes requested by alice'
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
      title: 'Approved by alice and bob'
    }
  }
}

export const BehindBaseBranch: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      description:
        'main has moved on since this branch was created. Update the branch to bring in the latest changes.',
      id: 'requirement-behind',
      kind: 'requirement',
      meta: 'Update the branch before merging',
      severity: 'warning',
      title: 'Behind main'
    }
  }
}

export const OpenThread: Story = {
  args: {
    pullRequest: mockPullRequest,
    task: {
      id: 'thread-1',
      kind: 'simple',
      meta: 'src/engine/checkField.ts:142 · mira',
      severity: 'info',
      title: 'maxSize error copy says "total size"'
    }
  }
}
