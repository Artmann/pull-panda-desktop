/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'

import type { Check } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { CodeThemeProvider } from '@/app/lib/store/codeThemeContext'
import {
  createTestQueryClient,
  QueryWrapper
} from '@/app/lib/test-query-wrapper'

import { ChecksView } from './ChecksView'

beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {
      // Mock
    }
    disconnect() {
      // Mock
    }
    observe() {
      // Mock
    }
    unobserve() {
      // Mock
    }
  } as unknown as typeof IntersectionObserver

  global.ResizeObserver = class ResizeObserver {
    constructor() {
      // Mock
    }
    disconnect() {
      // Mock
    }
    observe() {
      // Mock
    }
    unobserve() {
      // Mock
    }
  } as unknown as typeof ResizeObserver
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

function renderWithProviders(
  ui: React.ReactElement,
  { checks = [] as Check[] } = {}
) {
  const queryClient = createTestQueryClient({ checks })

  return render(
    <QueryWrapper client={queryClient}>
      <CodeThemeProvider>{ui}</CodeThemeProvider>
    </QueryWrapper>
  )
}

describe('ChecksView', () => {
  it('renders empty state when no checks', async () => {
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />)
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

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check1, check2, check3]
      })
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

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check]
      })
    })

    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('shows Failed badge for failed suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      conclusion: 'failure'
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check]
      })
    })

    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows Running badge for in-progress suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      state: 'in_progress',
      conclusion: null
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check]
      })
    })

    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('shows Cancelled badge for cancelled suite', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      conclusion: 'cancelled'
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check]
      })
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

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [oldCheck, newCheck]
      })
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

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check]
      })
    })

    const button = screen.getByTitle('Open on GitHub')

    expect(button).toBeInTheDocument()
  })

  it('handles checks with null suiteName', async () => {
    const pullRequest = createMockPullRequest()
    const check = createMockCheck({
      suiteName: null
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, {
        checks: [check]
      })
    })

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
