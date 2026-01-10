/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

import type { PullRequest } from '@/types/pull-request'
import type { PullRequestDetails } from '@/types/pull-request-details'

import draftsReducer from '@/app/store/drafts-slice'
import navigationReducer from '@/app/store/navigation-slice'
import pullRequestDetailsReducer from '@/app/store/pull-request-details-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import tasksReducer from '@/app/store/tasks-slice'

import { AuthProvider } from '@/app/lib/store/authContext'

import { PullRequestPage } from './PullRequestPage'

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

beforeEach(() => {
  vi.stubGlobal('electron', {
    getPullRequestDetails: vi.fn().mockResolvedValue(null),
    markPullRequestActive: vi.fn(),
    onSyncComplete: vi.fn().mockReturnValue(() => {
      // Unsubscribe mock
    })
  })

  vi.stubGlobal('auth', {
    getUser: vi.fn().mockResolvedValue({
      login: 'testuser',
      avatarUrl: 'https://example.com/avatar.png'
    })
  })
})

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

function createMockDetails(
  overrides: Partial<PullRequestDetails> = {}
): PullRequestDetails {
  return {
    checks: [],
    comments: [],
    commits: [],
    files: [],
    reactions: [],
    reviews: [],
    ...overrides
  }
}

function createTestStore(
  options: {
    pullRequests?: PullRequest[]
    pullRequestDetails?: Record<string, PullRequestDetails>
  } = {}
) {
  return configureStore({
    reducer: {
      drafts: draftsReducer,
      navigation: navigationReducer,
      pullRequestDetails: pullRequestDetailsReducer,
      pullRequests: pullRequestsReducer,
      tasks: tasksReducer
    },
    preloadedState: {
      drafts: {},
      pullRequests: {
        items: options.pullRequests ?? [],
        lastSyncedAt: null,
        loading: false
      },
      pullRequestDetails: options.pullRequestDetails ?? {},
      tasks: { items: [] }
    }
  })
}

function renderWithProviders(
  pullRequestId: string,
  { store = createTestStore() } = {}
) {
  return render(
    <Provider store={store}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/pr/${pullRequestId}`]}>
          <Routes>
            <Route
              element={<PullRequestPage />}
              path="/pr/:id"
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </Provider>
  )
}

describe('PullRequestPage', () => {
  describe('tab item counts', () => {
    it('displays item counts for commits, checks, and files tabs', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1' })
      const details = createMockDetails({
        checks: [
          {
            id: 'c1',
            gitHubId: 'c1',
            pullRequestId: 'pr-1',
            name: 'build',
            state: 'completed',
            conclusion: 'success',
            commitSha: 'abc',
            suiteName: 'CI',
            durationInSeconds: 60,
            detailsUrl: null,
            message: null,
            url: null,
            gitHubCreatedAt: null,
            gitHubUpdatedAt: null,
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'c2',
            gitHubId: 'c2',
            pullRequestId: 'pr-1',
            name: 'test',
            state: 'completed',
            conclusion: 'success',
            commitSha: 'abc',
            suiteName: 'CI',
            durationInSeconds: 120,
            detailsUrl: null,
            message: null,
            url: null,
            gitHubCreatedAt: null,
            gitHubUpdatedAt: null,
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'c3',
            gitHubId: 'c3',
            pullRequestId: 'pr-1',
            name: 'lint',
            state: 'completed',
            conclusion: 'success',
            commitSha: 'abc',
            suiteName: 'CI',
            durationInSeconds: 30,
            detailsUrl: null,
            message: null,
            url: null,
            gitHubCreatedAt: null,
            gitHubUpdatedAt: null,
            syncedAt: '2024-01-01T00:00:00Z'
          }
        ],
        commits: [
          {
            id: 'commit-1',
            gitHubId: 'sha1',
            pullRequestId: 'pr-1',
            hash: 'abc1234567890',
            message: 'First commit',
            url: null,
            authorLogin: 'user',
            authorAvatarUrl: null,
            linesAdded: null,
            linesRemoved: null,
            gitHubCreatedAt: '2024-01-01T00:00:00Z',
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'commit-2',
            gitHubId: 'sha2',
            pullRequestId: 'pr-1',
            hash: 'def4567890123',
            message: 'Second commit',
            url: null,
            authorLogin: 'user',
            authorAvatarUrl: null,
            linesAdded: null,
            linesRemoved: null,
            gitHubCreatedAt: '2024-01-01T00:00:00Z',
            syncedAt: '2024-01-01T00:00:00Z'
          }
        ],
        files: [
          {
            id: 'f1',
            pullRequestId: 'pr-1',
            filename: 'index.ts',
            filePath: 'src/index.ts',
            status: 'modified',
            additions: 10,
            deletions: 5,
            changes: 15,
            diffHunk: null,
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'f2',
            pullRequestId: 'pr-1',
            filename: 'utils.ts',
            filePath: 'src/utils.ts',
            status: 'added',
            additions: 20,
            deletions: 0,
            changes: 20,
            diffHunk: null,
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'f3',
            pullRequestId: 'pr-1',
            filename: 'old.ts',
            filePath: 'src/old.ts',
            status: 'removed',
            additions: 0,
            deletions: 15,
            changes: 15,
            diffHunk: null,
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'f4',
            pullRequestId: 'pr-1',
            filename: 'README.md',
            filePath: 'README.md',
            status: 'modified',
            additions: 5,
            deletions: 2,
            changes: 7,
            diffHunk: null,
            syncedAt: '2024-01-01T00:00:00Z'
          }
        ]
      })

      const store = createTestStore({
        pullRequests: [pullRequest],
        pullRequestDetails: { 'pr-1': details }
      })

      await act(async () => {
        renderWithProviders('pr-1', { store })
      })

      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('displays zero counts when no details are loaded', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1' })

      const store = createTestStore({
        pullRequests: [pullRequest],
        pullRequestDetails: {}
      })

      await act(async () => {
        renderWithProviders('pr-1', { store })
      })

      const zeroCounts = screen.getAllByText('0')

      expect(zeroCounts).toHaveLength(3)
    })

    it('does not display count badge for Overview tab', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1' })

      const store = createTestStore({
        pullRequests: [pullRequest],
        pullRequestDetails: { 'pr-1': createMockDetails() }
      })

      await act(async () => {
        renderWithProviders('pr-1', { store })
      })

      const overviewTab = screen.getByRole('tab', { name: /overview/i })
      const countBadges = overviewTab.querySelectorAll('.bg-muted')

      expect(countBadges).toHaveLength(0)
    })
  })
})
