import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import type { Commit, ModifiedFile } from '@/types/pull-request-details'

import {
  buildModifiedFile,
  buildReviewerStoryStore,
  reviewerStoryPullRequest
} from './__test-helpers__/reviewer-fixtures'
import { PullRequestMetaRow } from './PullRequestMetaRow'

function files(count: number): ModifiedFile[] {
  return Array.from({ length: count }, (_, index) =>
    buildModifiedFile({
      additions: 140,
      deletions: 13,
      filePath: `src/file-${index.toString()}.ts`,
      id: `file-${index.toString()}`
    })
  )
}

function commits(count: number): Commit[] {
  return Array.from({ length: count }, (_, index): Commit => ({
    authorAvatarUrl: null,
    authorLogin: 'octocat',
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubId: `commit-${index.toString()}`,
    hash: `abc${index.toString()}`,
    id: `commit-${index.toString()}`,
    linesAdded: null,
    linesRemoved: null,
    message: 'Commit',
    pullRequestId: 'pr-1',
    syncedAt: '2026-01-01T00:00:00Z',
    url: null
  }))
}

const openPullRequest = {
  ...reviewerStoryPullRequest,
  baseRefName: 'main',
  headRefName: 'feature/qr-codes-and-tables'
}

const meta = {
  title: 'Components/PullRequestMetaRow',
  component: PullRequestMetaRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { pullRequest: openPullRequest },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          commits: commits(2),
          modifiedFiles: files(29),
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
} satisfies Meta<typeof PullRequestMetaRow>

export default meta

type Story = StoryObj<typeof meta>

/** The everyday case: an open pull request carries no state marker. */
export const Open: Story = {}

export const Draft: Story = {
  args: { pullRequest: { ...openPullRequest, isDraft: true } }
}

export const Merged: Story = {
  args: { pullRequest: { ...openPullRequest, state: 'MERGED' } }
}

export const Closed: Story = {
  args: { pullRequest: { ...openPullRequest, state: 'CLOSED' } }
}

/** Long branch names truncate rather than push the size off the row. */
export const LongBranchName: Story = {
  args: {
    pullRequest: {
      ...openPullRequest,
      headRefName: 'prd-269-engine-file-answers-as-file-id-arrays-with-upload'
    }
  }
}
