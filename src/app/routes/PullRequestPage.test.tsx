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

import chatReducer from '@/app/store/chat-slice'
import checksReducer from '@/app/store/checks-slice'
import commentsReducer from '@/app/store/comments-slice'
import commitsReducer from '@/app/store/commits-slice'
import connectedReposReducer from '@/app/store/connected-repos-slice'
import draftsReducer from '@/app/store/drafts-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import modifiedFilesReducer from '@/app/store/modified-files-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import reactionsReducer from '@/app/store/reactions-slice'
import recentReviewersReducer from '@/app/store/recent-reviewers-slice'
import reviewerSuggestionsReducer from '@/app/store/reviewer-suggestions-slice'
import reviewThreadsReducer from '@/app/store/review-threads-slice'
import reviewsReducer from '@/app/store/reviews-slice'
import tasksReducer from '@/app/store/tasks-slice'

import { AuthProvider } from '@/app/lib/store/authContext'
import { ThemeProvider } from '@/app/lib/store/themeContext'
import { createMockPullRequest } from '@/app/pull-requests/__test-helpers__/pull-request-fixtures'
import { installObserverStubs } from '@/app/pull-requests/__test-helpers__/test-utils'
import { PullRequestNavigationProvider } from '@/app/pull-requests/PullRequestNavigationProvider'

import { PullRequestPage } from './PullRequestPage'

vi.mock('@/app/lib/api', () => ({
  clearFocusedPullRequest: vi.fn().mockResolvedValue(undefined),
  fetchCodeowners: vi.fn().mockResolvedValue([]),
  fetchCollaborators: vi.fn().mockResolvedValue([]),
  getMergeOptions: vi.fn().mockRejectedValue(new Error('not configured')),
  getPendingReview: vi.fn().mockResolvedValue(null),
  markPullRequestActive: vi.fn().mockResolvedValue(undefined),
  setFocusedPullRequest: vi.fn().mockResolvedValue(undefined)
}))

beforeAll(() => {
  installObserverStubs()
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

  vi.stubGlobal('agents', {
    detect: vi.fn().mockResolvedValue([])
  })

  vi.stubGlobal('chat', {
    getMessages: vi.fn().mockResolvedValue([]),
    getSessions: vi.fn().mockResolvedValue([]),
    onChatEvent: vi.fn().mockReturnValue(() => {
      // Unsubscribe mock
    }),
    send: vi.fn().mockResolvedValue(null),
    stop: vi.fn().mockResolvedValue(undefined)
  })
})

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
      chat: chatReducer,
      checks: checksReducer,
      comments: commentsReducer,
      commits: commitsReducer,
      connectedRepos: connectedReposReducer,
      drafts: draftsReducer,
      mergeOptions: mergeOptionsReducer,
      modifiedFiles: modifiedFilesReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer,
      reactions: reactionsReducer,
      recentReviewers: recentReviewersReducer,
      reviewerSuggestions: reviewerSuggestionsReducer,
      reviewThreads: reviewThreadsReducer,
      reviews: reviewsReducer,
      tasks: tasksReducer
    },
    preloadedState: {
      chat: {
        activeSessionIdByPullRequest: {},
        messagesBySession: {},
        sessionsByPullRequest: {},
        streamingBySession: {}
      },
      checks: { items: options.checks ?? [] },
      comments: { items: [] },
      commits: { items: options.commits ?? [] },
      connectedRepos: {
        byFullName: {},
        checkoutsInProgress: {},
        initialized: true
      },
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
      recentReviewers: { byRepo: {} },
      reviewerSuggestions: {
        collaboratorsByRepo: {},
        codeownersByPullRequest: {}
      },
      reviewThreads: { items: [] },
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
      const pullRequest = createMockPullRequest({ id: 'pr-1', isAuthor: true })

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
            previousFilename: null,
            status: 'modified',
            additions: 10,
            deletions: 5,
            changes: 15,
            diffHunk: null,
            blobSha: null,
            syncedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'f2',
            pullRequestId: 'pr-1',
            filename: 'utils.ts',
            filePath: 'src/utils.ts',
            previousFilename: null,
            status: 'added',
            additions: 20,
            deletions: 0,
            changes: 20,
            diffHunk: null,
            blobSha: null,
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
      const pullRequest = createMockPullRequest({ id: 'pr-1', isAuthor: true })

      const store = createTestStore({
        pullRequests: [pullRequest]
      })

      await act(async () => {
        renderWithProviders('pr-1', { store })
      })

      const checksTab = screen.getByRole('tab', { name: /checks/i })
      const filesTab = screen.getByRole('tab', { name: /files/i })

      expect(checksTab.querySelector('.bg-muted')?.textContent).toEqual('0')
      expect(filesTab.querySelector('.bg-muted')?.textContent).toEqual('0')
    })

    it('does not display count badge for Overview tab', async () => {
      const pullRequest = createMockPullRequest({ id: 'pr-1', isAuthor: true })

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
