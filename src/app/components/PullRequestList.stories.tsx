import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'

import type { PullRequest } from '@/types/pull-request'
import { PullRequestList } from './PullRequestList'

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
  authorAvatarUrl: 'https://github.com/octocat.png',
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
  closedAt: null,
  mergedAt: null,
  isDraft: false,
  isAuthor: true,
  isAssignee: false,
  isReviewer: false,
  labels: [
    { name: 'feature', color: '00aa00' },
    { name: 'design-system', color: '0066cc' }
  ],
  assignees: [],
  syncedAt: new Date().toISOString(),
  detailsSyncedAt: null,
  commentCount: 4,
  approvalCount: 1,
  changesRequestedCount: 0
}

const pullRequests: PullRequest[] = [
  basePullRequest,
  {
    ...basePullRequest,
    id: '2',
    number: 41,
    title: 'Preserve scroll position per PR tab',
    authorLogin: 'octocat',
    labels: [],
    approvalCount: 0,
    changesRequestedCount: 1,
    commentCount: 7
  },
  {
    ...basePullRequest,
    id: '3',
    number: 40,
    title: 'Reduce comment markdown header sizes',
    state: 'MERGED',
    mergedAt: new Date(Date.now() - 86_400_000).toISOString(),
    commentCount: 2,
    approvalCount: 2
  },
  {
    ...basePullRequest,
    id: '4',
    number: 39,
    title: 'Add fallow dev dependency',
    isDraft: true,
    commentCount: 0,
    approvalCount: 0
  }
]

const meta = {
  title: 'Components/PullRequestList',
  component: PullRequestList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="w-[720px]">
          <Story />
        </div>
      </MemoryRouter>
    )
  ]
} satisfies Meta<typeof PullRequestList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { pullRequests }
}

export const Empty: Story = {
  args: { pullRequests: [] }
}
