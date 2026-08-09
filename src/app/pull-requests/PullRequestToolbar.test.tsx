/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'

import { appFooterActionsSlotId } from '@/app/AppFooter'
import type { MergeOptions } from '@/app/lib/api'

import connectedReposReducer from '@/app/store/connected-repos-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'

import { createMockPullRequest } from './__test-helpers__/pull-request-fixtures'
import { PullRequestNavigationProvider } from './PullRequestNavigationProvider'
import { PullRequestToolbar } from './PullRequestToolbar'

vi.mock('@/app/lib/api', () => ({
  createReview: vi.fn(),
  mergePullRequest: vi.fn()
}))

function createTestStore(
  mergeOptions: Record<string, MergeOptions | null> = {}
) {
  return configureStore({
    reducer: {
      connectedRepos: connectedReposReducer,
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
      mergeOptions,
      pendingReviewComments: {},
      pendingReviews: {},
      pullRequests: { initialized: true, items: [] }
    }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  // The toolbar portals its content into the footer's actions slot.
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <PullRequestNavigationProvider>
          {ui}
          <div id={appFooterActionsSlotId} />
        </PullRequestNavigationProvider>
      </MemoryRouter>
    </Provider>
  )
}

const defaultProps = {
  onOpenMergeDrawer: vi.fn()
}

describe('PullRequestToolbar', () => {
  it('shows "Start review" button when user is not the author', async () => {
    const pullRequest = createMockPullRequest({ isAuthor: false })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Start review')).toBeInTheDocument()
  })

  it('hides "Start review" button when user is the author', async () => {
    const pullRequest = createMockPullRequest({ isAuthor: true })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.queryByText('Start review')).not.toBeInTheDocument()
  })

  it('shows "Checking..." with spinner when mergeable is null', async () => {
    const options: MergeOptions = {
      allowMergeCommit: true,
      allowRebaseMerge: true,
      allowSquashMerge: true,
      mergeable: null,
      mergeableState: 'unknown',
      requirements: []
    }

    const pullRequest = createMockPullRequest()
    const store = createTestStore({ 'pr-1': options })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    expect(screen.getByText('Checking...')).toBeInTheDocument()

    const button = screen.getByText('Checking...').closest('button')

    expect(button?.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows "Ready to merge" when PR is mergeable', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      'pr-1': {
        allowMergeCommit: true,
        allowRebaseMerge: true,
        allowSquashMerge: true,
        mergeable: true,
        mergeableState: 'clean',
        requirements: []
      }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    expect(screen.getByText('Ready to merge')).toBeInTheDocument()
  })

  it('shows "Has conflicts" when PR has merge conflicts', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      'pr-1': {
        allowMergeCommit: true,
        allowRebaseMerge: true,
        allowSquashMerge: true,
        mergeable: false,
        mergeableState: 'dirty',
        requirements: []
      }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    expect(screen.getByText('Has conflicts')).toBeInTheDocument()
  })

  it('shows "Merge blocked" when merge is blocked', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      'pr-1': {
        allowMergeCommit: true,
        allowRebaseMerge: true,
        allowSquashMerge: true,
        mergeable: false,
        mergeableState: 'blocked',
        requirements: []
      }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    expect(screen.getByText('Merge blocked')).toBeInTheDocument()
  })

  it('calls onOpenMergeDrawer when merge button is clicked', async () => {
    const onOpenMergeDrawer = vi.fn()
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      'pr-1': {
        allowMergeCommit: true,
        allowRebaseMerge: true,
        allowSquashMerge: true,
        mergeable: true,
        mergeableState: 'clean',
        requirements: []
      }
    })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          onOpenMergeDrawer={onOpenMergeDrawer}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    await userEvent.click(screen.getByText('Ready to merge'))

    expect(onOpenMergeDrawer).toHaveBeenCalledTimes(1)
  })

  it('does not show merge button for closed PRs', async () => {
    const pullRequest = createMockPullRequest({ state: 'CLOSED' })

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.queryByText('Merge')).not.toBeInTheDocument()
    expect(screen.queryByText('Ready to merge')).not.toBeInTheDocument()
  })
})
