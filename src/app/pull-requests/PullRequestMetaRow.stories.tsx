import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import type { MergeOptions } from '@/app/lib/api'
import type { Check, ModifiedFile, Review } from '@/types/pull-request-details'

import {
  buildCheck,
  buildModifiedFile,
  buildReviewerStoryStore,
  reviewerStoryPullRequest
} from './__test-helpers__/reviewer-fixtures'
import { PullRequestMetaRow } from './PullRequestMetaRow'

function passingChecks(count: number): Check[] {
  return Array.from({ length: count }, (_, index) =>
    buildCheck({
      id: `check-${index.toString()}`,
      name: `job ${index.toString()}`
    })
  )
}

function files(count: number): ModifiedFile[] {
  return Array.from({ length: count }, (_, index) =>
    buildModifiedFile({
      additions: 14,
      deletions: 13,
      filePath: `src/file-${index.toString()}.ts`,
      id: `file-${index.toString()}`
    })
  )
}

const reviewers = [
  { login: 'alice', avatarUrl: 'https://github.com/alice.png' },
  { login: 'bob', avatarUrl: 'https://github.com/bob.png' }
]

const approval: Review = {
  authorAvatarUrl: 'https://github.com/alice.png',
  authorLogin: 'alice',
  body: null,
  bodyHtml: null,
  gitHubCreatedAt: '2026-04-20T10:00:00Z',
  gitHubId: 'r-alice',
  gitHubNumericId: 1,
  gitHubSubmittedAt: '2026-04-20T10:05:00Z',
  id: 'r-alice',
  pullRequestId: 'pr-1',
  state: 'APPROVED',
  syncedAt: '2026-04-23T09:00:00Z',
  url: null
}

const conflicting: MergeOptions = {
  allowMergeCommit: true,
  allowRebaseMerge: true,
  allowSquashMerge: true,
  mergeable: false,
  mergeableState: 'dirty',
  requirements: []
}

const meta = {
  title: 'Components/PullRequestMetaRow',
  component: PullRequestMetaRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof PullRequestMetaRow>

export default meta

type Story = StoryObj<typeof meta>

/** The everyday case: green checks, two reviewers, one of them approved. */
export const Passing: Story = {
  args: {
    pullRequest: {
      ...reviewerStoryPullRequest,
      approvalCount: 1,
      requestedReviewers: reviewers
    }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          checks: passingChecks(8),
          modifiedFiles: files(29),
          pullRequest: context.args.pullRequest,
          reviews: [approval]
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

export const Failing: Story = {
  args: {
    pullRequest: { ...reviewerStoryPullRequest, requestedReviewers: reviewers }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          checks: [
            ...passingChecks(7),
            buildCheck({ conclusion: 'failure', id: 'check-bad', name: 'test' })
          ],
          modifiedFiles: files(29),
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

export const Running: Story = {
  args: {
    pullRequest: { ...reviewerStoryPullRequest, requestedReviewers: reviewers }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          checks: [
            ...passingChecks(5),
            buildCheck({
              conclusion: null,
              id: 'check-running',
              name: 'deploy',
              state: 'in_progress'
            })
          ],
          modifiedFiles: files(6),
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

/** No checks configured — the ratio is dropped rather than shown as 0/0. */
export const WithoutChecks: Story = {
  args: {
    pullRequest: { ...reviewerStoryPullRequest, requestedReviewers: reviewers }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          modifiedFiles: files(3),
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

/** Nobody is looking at it yet, so the picker carries the call to action. */
export const WithoutReviewers: Story = {
  args: { pullRequest: reviewerStoryPullRequest },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          checks: passingChecks(8),
          modifiedFiles: files(29),
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

export const Conflicting: Story = {
  args: {
    pullRequest: { ...reviewerStoryPullRequest, requestedReviewers: reviewers }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          checks: passingChecks(8),
          mergeOptions: conflicting,
          modifiedFiles: files(29),
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

/** A draft with a single file, where every number is at its smallest. */
export const DraftAndSmall: Story = {
  args: {
    pullRequest: {
      ...reviewerStoryPullRequest,
      isDraft: true,
      requestedReviewers: []
    }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          checks: passingChecks(1),
          modifiedFiles: [buildModifiedFile({ additions: 1, deletions: 0 })],
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}
