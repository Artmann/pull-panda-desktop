import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'

import type { PullRequest } from '@/types/pull-request'
import { PullRequestTable } from './PullRequestTable'

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
  requestedReviewers: [],
  syncedAt: new Date().toISOString(),
  detailsSyncedAt: null,
  commentCount: 4,
  approvalCount: 1,
  changesRequestedCount: 0
}

const storyTitles = [
  'Add Storybook setup',
  'Preserve scroll position per PR tab',
  'Reduce comment markdown header sizes',
  'Add fallow dev dependency',
  'Refactor pull request syncer',
  'Encrypt tokens using safeStorage',
  'Upgrade to React 19',
  'Migrate to Tailwind v4',
  'Add keyboard shortcuts',
  'Fix breadcrumb spacing',
  'Ship dark mode variants',
  'Optimize highlighter bundle',
  'Polish empty states',
  'Cache GraphQL responses'
]

const approvalCountCycle = [2, 0, 0]
const authorLoginCycle = ['artgaard', 'octocat']
const changesRequestedCountCycle = [1, 0, 0, 0]
const stateCycle: PullRequest['state'][] = [
  'MERGED',
  'OPEN',
  'OPEN',
  'OPEN',
  'OPEN'
]

const pullRequests: PullRequest[] = Array.from({ length: 14 }).map(
  (_, index) => ({
    ...basePullRequest,
    id: String(index + 1),
    number: 100 - index,
    title: storyTitles[index],
    authorLogin: authorLoginCycle[index % 2],
    state: stateCycle[index % 5],
    isDraft: index % 7 === 0,
    approvalCount: approvalCountCycle[index % 3],
    changesRequestedCount: changesRequestedCountCycle[index % 4],
    commentCount: index
  })
)

const meta = {
  title: 'Components/PullRequestTable',
  component: PullRequestTable,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="w-[900px]">
          <Story />
        </div>
      </MemoryRouter>
    )
  ]
} satisfies Meta<typeof PullRequestTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { paramPrefix: 'incoming', pullRequests }
}

export const Empty: Story = {
  args: { paramPrefix: 'incoming', pullRequests: [] }
}
