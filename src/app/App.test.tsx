/**
 * @vitest-environment jsdom
 */
import { render, act, waitFor } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

import type { PullRequest } from '@/types/pull-request'
import type { ResourceUpdatedEvent } from '@/types/ipc-events'

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
import reviewThreadsReducer from '@/app/store/review-threads-slice'
import tasksReducer from '@/app/store/tasks-slice'

import { App } from './App'

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

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

function createTestStore() {
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
      reviewThreads: reviewThreadsReducer,
      tasks: tasksReducer
    },
    preloadedState: {
      checks: { items: [] },
      comments: { items: [] },
      commits: { items: [] },
      drafts: {},
      mergeOptions: {},
      modifiedFiles: { items: [] },
      pendingReviewComments: {},
      pendingReviews: {},
      pullRequests: {
        initialized: true,
        items: []
      },
      reactions: { items: [] },
      reviews: { items: [] },
      reviewThreads: { items: [] },
      tasks: { items: [] }
    }
  })
}

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 1,
    title: 'Test PR',
    body: null,
    bodyHtml: null,
    headRefName: null,
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/1',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    authorLogin: 'testuser',
    authorAvatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    isDraft: false,
    isAuthor: true,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: '2024-01-01T00:01:00Z',
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

describe('App', () => {
  describe('ResourceUpdated event handling', () => {
    let resourceUpdatedCallback:
      | ((event: ResourceUpdatedEvent) => void)
      | null = null

    beforeEach(() => {
      resourceUpdatedCallback = null

      vi.stubGlobal('electron', {
        getApiPort: vi.fn().mockResolvedValue(3000),
        getBootstrapData: vi.fn().mockResolvedValue(null),
        getTasks: vi.fn().mockResolvedValue([]),
        onNavigateTo: vi.fn().mockReturnValue(() => {
          // Unsubscribe mock
        }),
        onResourceUpdated: vi.fn((callback) => {
          resourceUpdatedCallback = callback

          return () => {
            // Unsubscribe mock
          }
        }),
        onSyncComplete: vi.fn().mockReturnValue(() => {
          // Unsubscribe mock
        }),
        onTaskUpdate: vi.fn().mockReturnValue(() => {
          // Unsubscribe mock
        })
      })

      vi.stubGlobal('auth', {
        getToken: vi.fn().mockResolvedValue('test-token'),
        getUser: vi.fn().mockResolvedValue({
          login: 'testuser',
          avatarUrl: 'https://example.com/avatar.png'
        })
      })
    })

    it('updates Redux store when ResourceUpdated events are received for individual slices', async () => {
      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Verify the callback was registered
      expect(resourceUpdatedCallback).not.toBeNull()

      // Simulate receiving individual resource events
      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'checks',
          pullRequestId: 'pr-123',
          data: [
            {
              id: 'check-1',
              gitHubId: 'check-1',
              pullRequestId: 'pr-123',
              name: 'build',
              state: 'completed',
              conclusion: 'success',
              commitSha: 'abc123',
              suiteName: 'CI',
              durationInSeconds: 60,
              detailsUrl: null,
              message: null,
              url: null,
              gitHubCreatedAt: null,
              gitHubUpdatedAt: null,
              syncedAt: '2024-01-01T00:00:00Z'
            }
          ]
        })

        resourceUpdatedCallback?.({
          type: 'commits',
          pullRequestId: 'pr-123',
          data: [
            {
              id: 'commit-1',
              gitHubId: 'commit-1',
              pullRequestId: 'pr-123',
              hash: 'abc123def456',
              message: 'Test commit',
              url: null,
              authorLogin: 'testuser',
              authorAvatarUrl: null,
              linesAdded: null,
              linesRemoved: null,
              gitHubCreatedAt: '2024-01-01T00:00:00Z',
              syncedAt: '2024-01-01T00:00:00Z'
            }
          ]
        })

        resourceUpdatedCallback?.({
          type: 'modified-files',
          pullRequestId: 'pr-123',
          data: [
            {
              id: 'file-1',
              pullRequestId: 'pr-123',
              filename: 'test.ts',
              filePath: 'src/test.ts',
              status: 'modified',
              additions: 10,
              deletions: 5,
              changes: 15,
              diffHunk: null,
              syncedAt: '2024-01-01T00:00:00Z'
            }
          ]
        })
      })

      // Verify Redux was updated
      await waitFor(() => {
        const state = store.getState()

        expect(
          state.checks.items.filter((c) => c.pullRequestId === 'pr-123')
        ).toHaveLength(1)
        expect(
          state.commits.items.filter((c) => c.pullRequestId === 'pr-123')
        ).toHaveLength(1)
        expect(
          state.modifiedFiles.items.filter((f) => f.pullRequestId === 'pr-123')
        ).toHaveLength(1)
      })
    })

    it('upserts the pull request when a pull-request event is received', async () => {
      const mockPullRequest = createMockPullRequest({
        id: 'pr-123',
        number: 42,
        url: 'https://github.com/owner/repo/pull/42',
        detailsSyncedAt: '2024-01-01T00:02:00Z'
      })

      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'pull-request',
          pullRequestId: 'pr-123',
          data: mockPullRequest
        })
      })

      await waitFor(() => {
        const state = store.getState()
        expect(state.pullRequests.items).toContainEqual(mockPullRequest)
      })
    })

    it('does not upsert the pull request when no pull-request event is sent', async () => {
      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Only send a checks event, not a pull-request event
      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'checks',
          pullRequestId: 'pr-456',
          data: []
        })
      })

      await waitFor(() => {
        const state = store.getState()
        expect(state.pullRequests.items).toHaveLength(0)
      })
    })

    it('keeps slices empty when no events are received', async () => {
      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Wait a bit to ensure any async updates would have happened
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify Redux was not updated
      const state = store.getState()

      expect(state.checks.items).toHaveLength(0)
      expect(state.comments.items).toHaveLength(0)
      expect(state.commits.items).toHaveLength(0)
      expect(state.modifiedFiles.items).toHaveLength(0)
    })

    it('handles events with empty data arrays gracefully', async () => {
      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Simulate receiving events with empty data
      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'checks',
          pullRequestId: 'pr-123',
          data: []
        })
      })

      const state = store.getState()

      expect(state.checks.items).toHaveLength(0)
    })
  })
})
