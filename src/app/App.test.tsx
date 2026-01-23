/**
 * @vitest-environment jsdom
 */
import { render, act, waitFor } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

import type { PullRequestDetails } from '@/types/pull-request-details'

import draftsReducer from '@/app/store/drafts-slice'
import navigationReducer from '@/app/store/navigation-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestDetailsReducer from '@/app/store/pull-request-details-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
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
      drafts: draftsReducer,
      navigation: navigationReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequestDetails: pullRequestDetailsReducer,
      pullRequests: pullRequestsReducer,
      tasks: tasksReducer
    },
    preloadedState: {
      drafts: {},
      navigation: { activeTab: {} },
      pendingReviewComments: {},
      pendingReviews: {},
      pullRequestDetails: {},
      pullRequests: {
        items: [],
        lastSyncedAt: null,
        loading: false
      },
      tasks: { items: [] }
    }
  })
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

describe('App', () => {
  describe('ResourceUpdated event handling', () => {
    let resourceUpdatedCallback:
      | ((event: { type: string; pullRequestId: string }) => void)
      | null = null

    beforeEach(() => {
      resourceUpdatedCallback = null

      vi.stubGlobal('electron', {
        getApiPort: vi.fn().mockResolvedValue(3000),
        getBootstrapData: vi.fn().mockResolvedValue(null),
        getPullRequestDetails: vi.fn().mockResolvedValue(null),
        getTasks: vi.fn().mockResolvedValue([]),
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

    it('updates Redux store when ResourceUpdated event is received for pull-request-details', async () => {
      const mockDetails = createMockDetails({
        checks: [
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
        ],
        commits: [
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
        ],
        files: [
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

      vi.mocked(window.electron.getPullRequestDetails).mockResolvedValue(
        mockDetails
      )

      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Verify the callback was registered
      expect(resourceUpdatedCallback).not.toBeNull()

      // Simulate receiving ResourceUpdated event
      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'pull-request-details',
          pullRequestId: 'pr-123'
        })
      })

      // Verify Redux was updated
      await waitFor(() => {
        const state = store.getState()

        expect(state.pullRequestDetails['pr-123']).toBeDefined()
        expect(state.pullRequestDetails['pr-123'].checks).toHaveLength(1)
        expect(state.pullRequestDetails['pr-123'].commits).toHaveLength(1)
        expect(state.pullRequestDetails['pr-123'].files).toHaveLength(1)
      })

      // Verify getPullRequestDetails was called with correct ID
      expect(window.electron.getPullRequestDetails).toHaveBeenCalledWith(
        'pr-123'
      )
    })

    it('does not update Redux when getPullRequestDetails returns null', async () => {
      vi.mocked(window.electron.getPullRequestDetails).mockResolvedValue(null)

      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Simulate receiving ResourceUpdated event
      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'pull-request-details',
          pullRequestId: 'pr-456'
        })
      })

      // Wait a bit to ensure any async updates would have happened
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify Redux was not updated
      const state = store.getState()

      expect(state.pullRequestDetails['pr-456']).toBeUndefined()
    })

    it('ignores events without pullRequestId', async () => {
      const mockDetails = createMockDetails()

      vi.mocked(window.electron.getPullRequestDetails).mockResolvedValue(
        mockDetails
      )

      const store = createTestStore()

      await act(async () => {
        render(<App store={store} />)
      })

      // Simulate receiving event without pullRequestId
      await act(async () => {
        resourceUpdatedCallback?.({
          type: 'pull-request-details',
          pullRequestId: ''
        })
      })

      // Verify getPullRequestDetails was not called
      expect(window.electron.getPullRequestDetails).not.toHaveBeenCalled()
    })
  })
})
