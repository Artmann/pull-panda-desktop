import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'

import type { PullRequest } from '@/types/pull-request'
import { PullRequestTableRow } from './PullRequestTableRow'
import { Table, TableBody } from './ui/table'

const basePullRequest: PullRequest = {
  id: '1',
  number: 42,
  title: 'Add Storybook setup',
  body: null,
  bodyHtml: null,
  headRefName: 'feat/storybook',
  state: 'OPEN',
  url: '',
  repositoryOwner: 'artgaard',
  repositoryName: 'pull-panda',
  authorLogin: 'artgaard',
  authorAvatarUrl: 'https://github.com/octocat.png',
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
  closedAt: null,
  mergedAt: null,
  isDraft: false,
  isAuthor: true,
  isAssignee: false,
  isReviewer: false,
  labels: [],
  assignees: [],
  syncedAt: new Date().toISOString(),
  detailsSyncedAt: null,
  commentCount: 4,
  approvalCount: 1,
  changesRequestedCount: 0
}

const meta = {
  title: 'Components/PullRequestTableRow',
  component: PullRequestTableRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="w-[900px] rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableBody>
              <Story />
            </TableBody>
          </Table>
        </div>
      </MemoryRouter>
    )
  ]
} satisfies Meta<typeof PullRequestTableRow>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { pullRequest: basePullRequest }
}

export const Approved: Story = {
  args: {
    pullRequest: { ...basePullRequest, approvalCount: 2, commentCount: 8 }
  }
}

export const ChangesRequested: Story = {
  args: {
    pullRequest: {
      ...basePullRequest,
      changesRequestedCount: 1,
      commentCount: 3
    }
  }
}

export const Merged: Story = {
  args: {
    pullRequest: {
      ...basePullRequest,
      state: 'MERGED',
      mergedAt: new Date(Date.now() - 86_400_000).toISOString(),
      approvalCount: 2
    }
  }
}

export const Draft: Story = {
  args: { pullRequest: { ...basePullRequest, isDraft: true } }
}
