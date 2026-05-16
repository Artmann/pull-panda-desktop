import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import type { Review } from '@/types/pull-request-details'

import {
  buildReviewerStoryStore,
  reviewerStoryPullRequest
} from './__test-helpers__/reviewer-fixtures'
import { ReviewerBar } from './ReviewerBar'

function makeReview(
  authorLogin: string,
  state: Review['state'],
  authorAvatarUrl: string | null = `https://github.com/${authorLogin}.png`
): Review {
  return {
    authorAvatarUrl,
    authorLogin,
    body: state === 'COMMENTED' ? 'Nice work!' : null,
    bodyHtml: null,
    gitHubCreatedAt: '2026-04-20T10:00:00Z',
    gitHubId: `r-${authorLogin}`,
    gitHubNumericId: 1,
    gitHubSubmittedAt: '2026-04-20T10:05:00Z',
    id: `r-${authorLogin}`,
    pullRequestId: 'pr-1',
    state,
    syncedAt: '2026-04-23T09:00:00Z',
    url: null
  }
}

const meta = {
  title: 'Components/ReviewerBar',
  component: ReviewerBar,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof ReviewerBar>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { pullRequest: reviewerStoryPullRequest },
  decorators: [
    (Story) => (
      <Provider store={buildReviewerStoryStore()}>
        <Story />
      </Provider>
    )
  ]
}

export const PendingReviewers: Story = {
  args: {
    pullRequest: {
      ...reviewerStoryPullRequest,
      requestedReviewers: [
        { login: 'alice', avatarUrl: 'https://github.com/alice.png' },
        { login: 'bob', avatarUrl: 'https://github.com/bob.png' }
      ]
    }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          pullRequest: context.args.pullRequest
        })}
      >
        <Story />
      </Provider>
    )
  ]
}

export const MixedStatuses: Story = {
  args: {
    pullRequest: {
      ...reviewerStoryPullRequest,
      requestedReviewers: [
        { login: 'alice', avatarUrl: 'https://github.com/alice.png' },
        { login: 'bob', avatarUrl: 'https://github.com/bob.png' },
        { login: 'carol', avatarUrl: 'https://github.com/carol.png' },
        { login: 'dave', avatarUrl: 'https://github.com/dave.png' }
      ]
    }
  },
  decorators: [
    (Story, context) => (
      <Provider
        store={buildReviewerStoryStore({
          pullRequest: context.args.pullRequest,
          reviews: [
            makeReview('alice', 'APPROVED'),
            makeReview('bob', 'CHANGES_REQUESTED'),
            makeReview('carol', 'COMMENTED')
          ]
        })}
      >
        <Story />
      </Provider>
    )
  ]
}
