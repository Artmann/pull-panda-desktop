import { configureStore } from '@reduxjs/toolkit'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'

import type { MergeOptions } from '@/app/lib/api'
import connectedReposReducer from '@/app/store/connected-repos-slice'
import draftsReducer from '@/app/store/drafts-slice'
import mergeDrawerReducer from '@/app/store/merge-drawer-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import pendingReviewCommentsReducer, {
  type PendingReviewComment
} from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer, {
  type PendingReview as PendingReviewState
} from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

import { createMockPullRequest } from './__test-helpers__/pull-request-fixtures'
import { PullRequestFooterActions } from './PullRequestFooterActions'
import { PullRequestNavigationProvider } from './PullRequestNavigationProvider'

const win = window as unknown as {
  electron?: { getApiPort: () => Promise<number | null> }
}

if (!win.electron) {
  win.electron = { getApiPort: () => Promise.resolve(null) }
}

const mockPullRequest = createMockPullRequest({
  headRefName: 'feature/branch',
  baseRefName: 'main',
  repositoryName: 'demo',
  repositoryOwner: 'octocat'
})

const mergeableOptions: MergeOptions = {
  allowMergeCommit: true,
  allowRebaseMerge: true,
  allowSquashMerge: true,
  mergeable: true,
  mergeableState: 'clean',
  requirements: []
}

const pendingReview: PendingReviewState = {
  authorAvatarUrl: null,
  authorLogin: 'octocat',
  body: null,
  gitHubId: 'PRR_kwDOExample',
  gitHubNumericId: 1,
  id: 'review-1',
  isCollapsed: false,
  pullRequestId: 'pr-1',
  state: 'PENDING'
}

const pendingComment: PendingReviewComment = {
  body: 'Should this be nullable?',
  id: 'comment-1',
  line: 12,
  path: 'src/app/index.tsx',
  side: 'RIGHT'
}

interface StoreOptions {
  mergeOptions?: Record<string, MergeOptions | null>
  pendingReviewComments?: Record<string, PendingReviewComment[]>
  pendingReviews?: Record<string, PendingReviewState>
}

function buildStore({
  mergeOptions = {},
  pendingReviewComments = {},
  pendingReviews = {}
}: StoreOptions = {}) {
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false
      }),
    preloadedState: {
      connectedRepos: {
        byFullName: { 'octocat/demo': '/Users/me/code/demo' },
        checkoutsInProgress: {},
        initialized: true
      },
      drafts: {},
      mergeDrawer: { openForPullRequestId: null },
      mergeOptions,
      pendingReviewComments,
      pendingReviews,
      pullRequests: { initialized: true, items: [mockPullRequest] }
    },
    reducer: {
      connectedRepos: connectedReposReducer,
      drafts: draftsReducer,
      mergeDrawer: mergeDrawerReducer,
      mergeOptions: mergeOptionsReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer
    }
  })
}

// The actions sit in the footer bar, so every story frames them the way the bar
// does: right aligned on the titlebar surface.
function renderInFooter(
  options: StoreOptions,
  pullRequest: PullRequest
): ReactElement {
  return (
    <Provider store={buildStore(options)}>
      <MemoryRouter>
        <PullRequestNavigationProvider>
          <div className="bg-titlebar border-border flex h-footer w-full items-center justify-end border-t px-3">
            <PullRequestFooterActions pullRequest={pullRequest} />
          </div>
        </PullRequestNavigationProvider>
      </MemoryRouter>
    </Provider>
  )
}

const meta = {
  title: 'Components/PullRequestFooterActions',
  component: PullRequestFooterActions,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs']
} satisfies Meta<typeof PullRequestFooterActions>

export default meta

type Story = StoryObj<typeof meta>

export const OpenWithoutReview: Story = {
  args: { pullRequest: mockPullRequest },
  render: (args) =>
    renderInFooter(
      { mergeOptions: { 'pr-1': mergeableOptions } },
      args.pullRequest
    )
}

export const MergeBlocked: Story = {
  args: { pullRequest: mockPullRequest },
  render: (args) =>
    renderInFooter(
      {
        mergeOptions: {
          'pr-1': {
            ...mergeableOptions,
            mergeable: false,
            mergeableState: 'blocked'
          }
        }
      },
      args.pullRequest
    )
}

export const PendingReview: Story = {
  args: { pullRequest: mockPullRequest },
  render: (args) =>
    renderInFooter(
      {
        mergeOptions: { 'pr-1': mergeableOptions },
        pendingReviewComments: { 'pr-1': [pendingComment] },
        pendingReviews: { 'pr-1': pendingReview }
      },
      args.pullRequest
    )
}

export const Closed: Story = {
  args: { pullRequest: { ...mockPullRequest, state: 'CLOSED' } },
  render: (args) => renderInFooter({}, args.pullRequest)
}

export const AuthoredByYou: Story = {
  args: { pullRequest: { ...mockPullRequest, isAuthor: true } },
  render: (args) =>
    renderInFooter(
      { mergeOptions: { 'pr-1': mergeableOptions } },
      args.pullRequest
    )
}
