/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeAll } from 'vitest'

import type { Check, PullRequestDetails } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import pullRequestDetailsReducer from '@/app/store/pull-request-details-slice'

import { ChecksView } from './ChecksView'

beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
})

function createMockCheck(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    gitHubId: 'CR_kwDOExample123',
    pullRequestId: 'pr-1',
    name: 'build',
    state: 'completed',
    conclusion: 'success',
    commitSha: 'abc1234567890',
    suiteName: 'GitHub Actions',
    durationInSeconds: 120,
    detailsUrl: 'https://github.com/owner/repo/actions/runs/123',
    message: 'Build completed successfully',
    url: 'https://github.com/owner/repo/actions/runs/123',
    gitHubCreatedAt: '2024-01-01T00:00:00Z',
    gitHubUpdatedAt: '2024-01-01T00:02:00Z',
    syncedAt: '2024-01-01T00:02:00Z',
    ...overrides
  }
}

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 7,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/7',
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
    isAuthor: true,
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

function createTestStore(preloadedState?: {
  pullRequestDetails?: { [key: string]: PullRequestDetails }
}) {
  return configureStore({
    reducer: {
      pullRequestDetails: pullRequestDetailsReducer
    },
    preloadedState
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('ChecksView', () => {
  it('renders empty state when no checks', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('No checks found.')).toBeInTheDocument()
  })

  it('renders checks grouped by suite name', async () => {
    const pullRequest = createMockPullRequest()
    const check1 = createMockCheck({
      id: 'check-1',
      name: 'build',
      suiteName: 'GitHub Actions'
    })
    const check2 = createMockCheck({
      id: 'check-2',
      name: 'test',
      suiteName: 'GitHub Actions'
    })
    const check3 = createMockCheck({
      id: 'check-3',
      name: 'deploy',
      suiteName: 'Vercel'
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check1, check2, check3],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('GitHub Actions')).toBeInTheDocument()
    expect(screen.getByText('Vercel')).toBeInTheDocument()
    expect(screen.getByText('build')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('deploy')).toBeInTheDocument()
  })

  it('shows Success badge for successful suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      conclusion: 'success'
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('shows Failed badge for failed suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      conclusion: 'failure'
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows Running badge for in-progress suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      state: 'in_progress',
      conclusion: null
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('shows Cancelled badge for cancelled suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      conclusion: 'cancelled'
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('deduplicates checks by name, keeping most recent', async () => {
    const pullRequest = createMockPullRequest()
    const oldCheck = createMockCheck({
      id: 'check-old',
      name: 'build',
      message: 'Old build',
      syncedAt: '2024-01-01T00:00:00Z'
    })
    const newCheck = createMockCheck({
      id: 'check-new',
      name: 'build',
      message: 'New build',
      syncedAt: '2024-01-02T00:00:00Z'
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [oldCheck, newCheck],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    // Should only show the newer check's message
    expect(screen.getByText('New build')).toBeInTheDocument()
    expect(screen.queryByText('Old build')).not.toBeInTheDocument()
  })

  it('renders external link for check with detailsUrl', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      detailsUrl: 'https://github.com/owner/repo/actions/runs/123'
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    const link = screen.getByRole('link')

    expect(link).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/actions/runs/123'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('handles checks with null suiteName', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      suiteName: null
    })
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: {
          checks: [check],
          commits: [],
          comments: [],
          files: [],
          reactions: [],
          reviews: []
        }
      }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
