/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'
import type { PullRequest } from '@/types/pull-request'

import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'

import { PullRequestToolbar } from './PullRequestToolbar'

vi.mock('@/app/lib/api', () => ({
  createReview: vi.fn(),
  getMergeOptions: vi.fn().mockRejectedValue(new Error('not configured')),
  mergePullRequest: vi.fn()
}))

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 42,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/42',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    authorLogin: 'testuser',
    authorAvatarUrl: 'https://example.com/avatar.png',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    body: 'Test PR body',
    bodyHtml: null,
    headRefName: null,
    isDraft: false,
    isAuthor: false,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: null,
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

function createTestStore() {
  return configureStore({
    reducer: {
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer
    },
    preloadedState: {
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
  return render(<Provider store={store}>{ui}</Provider>)
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
    const { getMergeOptions } = await import('@/app/lib/api')
    const mockGetMergeOptions = vi.mocked(getMergeOptions)

    const options: MergeOptions = {
      allowMergeCommit: true,
      allowRebaseMerge: true,
      allowSquashMerge: true,
      mergeable: null,
      mergeableState: 'unknown'
    }

    mockGetMergeOptions.mockResolvedValue(options)

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Checking...')).toBeInTheDocument()

    const button = screen.getByText('Checking...').closest('button')

    expect(button?.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows "Ready to merge" when PR is mergeable', async () => {
    const { getMergeOptions } = await import('@/app/lib/api')
    const mockGetMergeOptions = vi.mocked(getMergeOptions)

    mockGetMergeOptions.mockResolvedValue({
      allowMergeCommit: true,
      allowRebaseMerge: true,
      allowSquashMerge: true,
      mergeable: true,
      mergeableState: 'clean'
    })

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Ready to merge')).toBeInTheDocument()
  })

  it('shows "Has conflicts" when PR has merge conflicts', async () => {
    const { getMergeOptions } = await import('@/app/lib/api')
    const mockGetMergeOptions = vi.mocked(getMergeOptions)

    mockGetMergeOptions.mockResolvedValue({
      allowMergeCommit: true,
      allowRebaseMerge: true,
      allowSquashMerge: true,
      mergeable: false,
      mergeableState: 'dirty'
    })

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Has conflicts')).toBeInTheDocument()
  })

  it('shows "Merge blocked" when merge is blocked', async () => {
    const { getMergeOptions } = await import('@/app/lib/api')
    const mockGetMergeOptions = vi.mocked(getMergeOptions)

    mockGetMergeOptions.mockResolvedValue({
      allowMergeCommit: true,
      allowRebaseMerge: true,
      allowSquashMerge: true,
      mergeable: false,
      mergeableState: 'blocked'
    })

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          {...defaultProps}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Merge blocked')).toBeInTheDocument()
  })

  it('calls onOpenMergeDrawer when merge button is clicked', async () => {
    const { getMergeOptions } = await import('@/app/lib/api')
    const mockGetMergeOptions = vi.mocked(getMergeOptions)

    mockGetMergeOptions.mockResolvedValue({
      allowMergeCommit: true,
      allowRebaseMerge: true,
      allowSquashMerge: true,
      mergeable: true,
      mergeableState: 'clean'
    })

    const onOpenMergeDrawer = vi.fn()
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <PullRequestToolbar
          onOpenMergeDrawer={onOpenMergeDrawer}
          pullRequest={pullRequest}
        />
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
