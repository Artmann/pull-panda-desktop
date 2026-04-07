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
      pullRequests: { initialized: true, items: [] },
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
  mergeableState: 'clean',
  requirements: []
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

    expect(screen.getByText('reviewer1')).toBeInTheDocument()
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

    expect(screen.getByText('1 of 2 checks failed')).toBeInTheDocument()
    expect(screen.getByText('Lint')).toBeInTheDocument()
  })

  it('shows merge method tabs', async () => {
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

    expect(screen.getByText('Squash')).toBeInTheDocument()
    expect(screen.getByText('Merge')).toBeInTheDocument()
    expect(screen.getByText('Rebase')).toBeInTheDocument()
  })

  it('shows blocked state when not mergeable', async () => {
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
      name: /merge is blocked/i
    })

    expect(mergeButton).toBeDisabled()
    expect(
      screen.getByText('Blocked by branch protection rules.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Merge without waiting for requirements')
    ).toBeInTheDocument()
  })

  it('shows conflict requirement when merge is blocked by dirty state', async () => {
    mockGetMergeOptions.mockResolvedValue({
      ...mergeableOptions,
      mergeable: false,
      mergeableState: 'dirty',
      requirements: [
        {
          description: 'This branch has conflicts that must be resolved.',
          key: 'no-conflicts',
          label: 'No merge conflicts',
          satisfied: false
        }
      ]
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

    expect(screen.getByText('No merge conflicts')).toBeInTheDocument()

    const conflictTexts = screen.getAllByText(
      'This branch has conflicts that must be resolved.'
    )

    expect(conflictTexts.length).toBeGreaterThan(0)
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

    const mergeButton = screen.getByRole('button', {
      name: /squash and merge/i
    })

    // First click reveals the squash commit fields.
    await userEvent.click(mergeButton)

    expect(mockMergePullRequest).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('Commit title')).toBeInTheDocument()

    // Second click fires the merge.
    await userEvent.click(mergeButton)

    expect(mockMergePullRequest).toHaveBeenCalledWith({
      commitMessage: 'Test PR body',
      commitTitle: 'Test PR (#42)',
      mergeMethod: 'squash',
      owner: 'owner',
      pullNumber: 42,
      pullRequestId: 'pr-1',
      repo: 'repo'
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows requirements checklist with all items satisfied', async () => {
    mockGetMergeOptions.mockResolvedValue({
      ...mergeableOptions,
      requirements: [
        {
          description: 'No merge conflicts.',
          key: 'no-conflicts',
          label: 'No merge conflicts',
          satisfied: true
        },
        {
          description: 'Pull request is ready for review.',
          key: 'not-draft',
          label: 'Not a draft',
          satisfied: true
        }
      ]
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

    expect(screen.getByText('Requirements')).toBeInTheDocument()
    expect(screen.getByText('No merge conflicts')).toBeInTheDocument()
    expect(screen.getByText('Not a draft')).toBeInTheDocument()
  })

  it('shows unsatisfied requirements with descriptions', async () => {
    mockGetMergeOptions.mockResolvedValue({
      ...mergeableOptions,
      mergeable: false,
      mergeableState: 'blocked',
      requirements: [
        {
          description: 'No merge conflicts.',
          key: 'no-conflicts',
          label: 'No merge conflicts',
          satisfied: true
        },
        {
          description: 'Waiting for required approving reviews.',
          key: 'approving-reviews',
          label: '2 approving reviews required',
          satisfied: false
        },
        {
          description: '3 unresolved conversations.',
          key: 'conversations-resolved',
          label: 'Conversations resolved',
          satisfied: false
        }
      ]
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

    expect(screen.getByText('No merge conflicts')).toBeInTheDocument()
    expect(screen.getByText('2 approving reviews required')).toBeInTheDocument()
    expect(
      screen.getByText('Waiting for required approving reviews.')
    ).toBeInTheDocument()
    expect(screen.getByText('Conversations resolved')).toBeInTheDocument()
    expect(
      screen.getByText('3 unresolved conversations.')
    ).toBeInTheDocument()
  })

  it('does not show requirements section when list is empty', async () => {
    mockGetMergeOptions.mockResolvedValue({
      ...mergeableOptions,
      requirements: []
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

    expect(screen.queryByText('Requirements')).not.toBeInTheDocument()
  })

  it('shows blocked summary from failing requirements', async () => {
    mockGetMergeOptions.mockResolvedValue({
      ...mergeableOptions,
      mergeable: false,
      mergeableState: 'blocked',
      requirements: [
        {
          description: 'Waiting for required approving reviews.',
          key: 'approving-reviews',
          label: '2 approving reviews required',
          satisfied: false
        }
      ]
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

    // Description appears in both the checklist item and the blocked footer summary.
    const descriptions = screen.getAllByText(
      'Waiting for required approving reviews.'
    )

    expect(descriptions).toHaveLength(2)
    expect(screen.getByText('2 approving reviews required')).toBeInTheDocument()
  })

  it('shows loading state when merge options are being fetched', async () => {
    mockGetMergeOptions.mockReturnValue(new Promise(() => undefined))

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
