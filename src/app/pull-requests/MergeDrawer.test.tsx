/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'
import type { PullRequest } from '@/types/pull-request'
import type { Check, Review } from '@/types/pull-request-details'

import checksReducer from '@/app/store/checks-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import reviewsReducer from '@/app/store/reviews-slice'

import { MergeDrawer } from './MergeDrawer'

const mockGetMergeOptions = vi.fn()
const mockMergePullRequest = vi.fn()

vi.mock('@/app/lib/api', () => ({
  getMergeOptions: (...args: unknown[]) => mockGetMergeOptions(...args),
  mergePullRequest: (...args: unknown[]) => mockMergePullRequest(...args)
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

function createMockReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    gitHubId: 'gh-review-1',
    gitHubNumericId: 1,
    pullRequestId: 'pr-1',
    state: 'APPROVED',
    body: null,
    bodyHtml: null,
    url: null,
    authorLogin: 'reviewer1',
    authorAvatarUrl: 'https://example.com/avatar1.png',
    gitHubCreatedAt: '2024-01-01T00:00:00Z',
    gitHubSubmittedAt: '2024-01-01T00:00:00Z',
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

function createMockCheck(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    gitHubId: 'gh-check-1',
    pullRequestId: 'pr-1',
    name: 'CI Build',
    state: 'completed',
    conclusion: 'success',
    commitSha: 'abc123',
    suiteName: null,
    durationInSeconds: 120,
    detailsUrl: null,
    message: null,
    url: null,
    gitHubCreatedAt: '2024-01-01T00:00:00Z',
    gitHubUpdatedAt: '2024-01-01T00:00:00Z',
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

interface TestStoreOptions {
  checks?: Check[]
  reviews?: Review[]
}

function createTestStore({ checks = [], reviews = [] }: TestStoreOptions = {}) {
  return configureStore({
    reducer: {
      checks: checksReducer,
      pullRequests: pullRequestsReducer,
      reviews: reviewsReducer
    },
    preloadedState: {
      checks: { items: checks },
      pullRequests: { items: [], lastSyncedAt: null, loading: false },
      reviews: { items: reviews }
    }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(<Provider store={store}>{ui}</Provider>)
}

const mergeableOptions: MergeOptions = {
  allowMergeCommit: true,
  allowRebaseMerge: true,
  allowSquashMerge: true,
  mergeable: true,
  mergeableState: 'clean'
}

describe('MergeDrawer', () => {
  beforeEach(() => {
    mockGetMergeOptions.mockReset()
    mockMergePullRequest.mockReset()
    mockGetMergeOptions.mockRejectedValue(new Error('not configured'))
  })

  it('renders nothing when closed', async () => {
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={false}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.queryByText('Merge pull request')).not.toBeInTheDocument()
  })

  it('renders header when open', async () => {
    mockGetMergeOptions.mockResolvedValue(mergeableOptions)

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={true}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Merge pull request')).toBeInTheDocument()
  })

  it('shows reviews section when reviews exist', async () => {
    mockGetMergeOptions.mockResolvedValue(mergeableOptions)

    const pullRequest = createMockPullRequest({ approvalCount: 1 })
    const reviews = [createMockReview({ state: 'APPROVED' })]

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={true}
          pullRequest={pullRequest}
        />,
        { store: createTestStore({ reviews }) }
      )
    })

    expect(screen.getByText('Reviews')).toBeInTheDocument()
    expect(screen.getByText('reviewer1')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('1 approval')).toBeInTheDocument()
  })

  it('shows checks summary when checks exist', async () => {
    mockGetMergeOptions.mockResolvedValue(mergeableOptions)

    const pullRequest = createMockPullRequest()
    const checks = [
      createMockCheck({ id: 'c1', name: 'CI Build', conclusion: 'success' }),
      createMockCheck({ id: 'c2', name: 'Lint', conclusion: 'failure' })
    ]

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={true}
          pullRequest={pullRequest}
        />,
        { store: createTestStore({ checks }) }
      )
    })

    expect(screen.getByText('Checks')).toBeInTheDocument()
    expect(screen.getByText('1 passed, 1 failed')).toBeInTheDocument()
    expect(screen.getByText('Lint')).toBeInTheDocument()
  })

  it('shows merge method selection', async () => {
    mockGetMergeOptions.mockResolvedValue(mergeableOptions)

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={true}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Merge method')).toBeInTheDocument()
    expect(screen.getByText('Squash and merge')).toBeInTheDocument()
    expect(screen.getByText('Merge commit')).toBeInTheDocument()
    expect(screen.getByText('Rebase and merge')).toBeInTheDocument()
  })

  it('disables merge button when not mergeable', async () => {
    mockGetMergeOptions.mockResolvedValue({
      ...mergeableOptions,
      mergeable: false,
      mergeableState: 'blocked'
    })

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={true}
          pullRequest={pullRequest}
        />
      )
    })

    const mergeButton = screen.getByRole('button', {
      name: /squash and merge/i
    })

    expect(mergeButton).toBeDisabled()
  })

  it('calls mergePullRequest with selected method on merge', async () => {
    mockGetMergeOptions.mockResolvedValue(mergeableOptions)
    mockMergePullRequest.mockResolvedValue(
      createMockPullRequest({
        state: 'MERGED',
        mergedAt: '2024-01-02T00:00:00Z'
      })
    )

    const onClose = vi.fn()
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={onClose}
          open={true}
          pullRequest={pullRequest}
        />
      )
    })

    // The footer merge button (not the method selector)
    const mergeButtons = screen.getAllByRole('button', {
      name: /squash and merge/i
    })
    const footerMergeButton = mergeButtons[mergeButtons.length - 1]

    await userEvent.click(footerMergeButton)

    expect(mockMergePullRequest).toHaveBeenCalledWith({
      mergeMethod: 'squash',
      owner: 'owner',
      pullNumber: 42,
      pullRequestId: 'pr-1',
      repo: 'repo'
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows loading state when merge options are being fetched', async () => {
    mockGetMergeOptions.mockReturnValue(new Promise(() => {}))

    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <MergeDrawer
          onClose={vi.fn()}
          open={true}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Loading merge options...')).toBeInTheDocument()
  })
})
