/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

import type { PullRequest } from '@/types/pull-request'
import type { Check, Commit, ModifiedFile } from '@/types/pull-request-details'

import checksReducer from '@/app/store/checks-slice'
import commentsReducer from '@/app/store/comments-slice'
import commitsReducer from '@/app/store/commits-slice'
import draftsReducer from '@/app/store/drafts-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import modifiedFilesReducer from '@/app/store/modified-files-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import reactionsReducer from '@/app/store/reactions-slice'
import reviewsReducer from '@/app/store/reviews-slice'
import tasksReducer from '@/app/store/tasks-slice'

import { AuthProvider } from '@/app/lib/store/authContext'
import { ThemeProvider } from '@/app/lib/store/themeContext'
import { PullRequestNavigationProvider } from '@/app/pull-requests/PullRequestNavigationProvider'

import { PullRequestPage } from './PullRequestPage'

vi.mock('@/app/lib/api', () => ({
  getMergeOptions: vi.fn().mockRejectedValue(new Error('not configured')),
  markPullRequestActive: vi.fn().mockResolvedValue(undefined)
}))

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
    getApiPort: vi.fn().mockResolvedValue(3000),
    onSyncComplete: vi.fn().mockReturnValue(() => {
      // Unsubscribe mock
    })
  })

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true })
    })
  )

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
    headRefName: null,
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

function createTestStore(
  options: {
    checks?: Check[]
    commits?: Commit[]
    modifiedFiles?: ModifiedFile[]
    pullRequests?: PullRequest[]
  } = {}
) {
  return configureStore({
    reducer: {
      checks: checksReducer,
      comments: commentsReducer,
      commits: commitsReducer,
      drafts: draftsReducer,
      mergeOptions: mergeOptionsReducer,
      modifiedFiles: modifiedFilesReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer,
      reactions: reactionsReducer,
      reviews: reviewsReducer,
      tasks: tasksReducer
    },
    preloadedState: {
      checks: { items: options.checks ?? [] },
      comments: { items: [] },
      commits: { items: options.commits ?? [] },
      drafts: {},
      mergeOptions: {},
      modifiedFiles: { items: options.modifiedFiles ?? [] },
      pendingReviewComments: {},
      pendingReviews: {},
      pullRequests: {
        initialized: true,
        items: options.pullRequests ?? []
      },
      reactions: { items: [] },
      reviews: { items: [] },
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
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/pr/${pullRequestId}`]}>
            <PullRequestNavigationProvider>
              <Routes>
                <Route
                  element={<PullRequestPage />}
                  path="/pr/:id"
                />
              </Routes>
            </PullRequestNavigationProvider>
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  )
}

describe('PullRequestPage', () => {
  describe('tab item counts', () => {
    it('displays item counts for checks and files tabs', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1' })

      const store = createTestStore({
        pullRequests: [pullRequest],
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
        modifiedFiles: [
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
          }
        ]
      })

      await act(async () => {
        renderWithProviders('pr-1', { store })
      })

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('displays zero counts when no details are loaded', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1' })

      const store = createTestStore({
        pullRequests: [pullRequest]
      })

      await act(async () => {
        renderWithProviders('pr-1', { store })
      })

      const zeroCounts = screen.getAllByText('0')

      expect(zeroCounts).toHaveLength(2)
    })

    it('does not display count badge for Overview tab', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1' })

      const store = createTestStore({
        pullRequests: [pullRequest]
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
