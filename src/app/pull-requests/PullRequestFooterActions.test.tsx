/**
 * @vitest-environment jsdom
 */
import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'
import connectedReposReducer from '@/app/store/connected-repos-slice'
import draftsReducer from '@/app/store/drafts-slice'
import mergeDrawerReducer from '@/app/store/merge-drawer-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer, {
  type PendingReview
} from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'

import { createMockPullRequest } from './__test-helpers__/pull-request-fixtures'
import { PullRequestFooterActions } from './PullRequestFooterActions'
import { PullRequestNavigationProvider } from './PullRequestNavigationProvider'

import { TooltipProvider } from '@/app/components/ui/tooltip'

vi.mock('@/app/lib/api', () => ({
  createReview: vi.fn(),
  deleteReview: vi.fn(),
  getMergeOptions: vi.fn(),
  mergePullRequest: vi.fn(),
  submitReview: vi.fn(),
  updatePullRequest: vi.fn()
}))

function createPendingReview(): PendingReview {
  return {
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
}

interface TestStoreOptions {
  mergeOptions?: Record<string, MergeOptions | null>
  pendingReviews?: Record<string, PendingReview>
}

function createTestStore({
  mergeOptions = {},
  pendingReviews = {}
}: TestStoreOptions = {}) {
  return configureStore({
    reducer: {
      connectedRepos: connectedReposReducer,
      drafts: draftsReducer,
      mergeDrawer: mergeDrawerReducer,
      mergeOptions: mergeOptionsReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer
    },
    preloadedState: {
      connectedRepos: {
        byFullName: {},
        checkoutsInProgress: {},
        initialized: true
      },
      drafts: {},
      mergeDrawer: { openForPullRequestId: null },
      mergeOptions,
      pendingReviewComments: {},
      pendingReviews,
      pullRequests: { initialized: true, items: [] }
    }
  })
}

function renderWithProviders(
  ui: ReactElement,
  { store = createTestStore() } = {}
) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <TooltipProvider>
          <MemoryRouter>
            <PullRequestNavigationProvider>{ui}</PullRequestNavigationProvider>
          </MemoryRouter>
        </TooltipProvider>
      </Provider>
    )
  }
}

describe('PullRequestFooterActions', () => {
  it('shows "Start review" when the user is not the author', async () => {
    const pullRequest = createMockPullRequest({ isAuthor: false })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />
      )
    })

    expect(screen.getByText('Start review')).toBeInTheDocument()
  })

  it('hides "Start review" when the user is the author', async () => {
    const pullRequest = createMockPullRequest({ isAuthor: true })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />
      )
    })

    expect(screen.queryByText('Start review')).not.toBeInTheDocument()
  })

  it('shows a spinner beside the merge label while mergeability is unknown', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      mergeOptions: {
        'pr-1': {
          allowMergeCommit: true,
          allowRebaseMerge: true,
          allowSquashMerge: true,
          mergeable: null,
          mergeableState: 'unknown',
          requirements: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />,
        { store }
      )
    })

    const button = screen.getByText('Checking...').closest('button')

    expect(button?.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('opens the merge drawer when the merge button is clicked', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      mergeOptions: {
        'pr-1': {
          allowMergeCommit: true,
          allowRebaseMerge: true,
          allowSquashMerge: true,
          mergeable: true,
          mergeableState: 'clean',
          requirements: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />,
        { store }
      )
    })

    await userEvent.click(screen.getByText('Ready to merge'))

    expect(store.getState().mergeDrawer).toEqual({
      openForPullRequestId: 'pr-1'
    })
  })

  it('does not show the merge button for a closed pull request', async () => {
    const pullRequest = createMockPullRequest({ state: 'CLOSED' })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />
      )
    })

    expect(screen.queryByText('Merge')).not.toBeInTheDocument()
    expect(screen.queryByText('Ready to merge')).not.toBeInTheDocument()
  })

  it('swaps the merge button for the review submit actions while a review is open', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      pendingReviews: { 'pr-1': createPendingReview() }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />,
        { store }
      )
    })

    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Request changes')).toBeInTheDocument()
    expect(screen.getByText('Comment')).toBeInTheDocument()
    expect(screen.queryByText('Merge')).not.toBeInTheDocument()
    expect(screen.queryByText('Start review')).not.toBeInTheDocument()
  })

  it('disables Comment and Request changes until the review has content', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      pendingReviews: { 'pr-1': createPendingReview() }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestFooterActions pullRequest={pullRequest} />,
        { store }
      )
    })

    expect(screen.getByText('Comment').closest('button')).toBeDisabled()
    expect(screen.getByText('Request changes').closest('button')).toBeDisabled()
    expect(screen.getByText('Approve').closest('button')).not.toBeDisabled()
  })
})
