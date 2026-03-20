/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { PullRequest } from '@/types/pull-request'

import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import reviewsReducer from '@/app/store/reviews-slice'

import { HomePage } from './HomePage'

vi.mock('@/app/lib/store/authContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('@/app/lib/store/tasksContext', () => ({
  useTasks: vi.fn()
}))

import { useAuth } from '@/app/lib/store/authContext'
import { useTasks } from '@/app/lib/store/tasksContext'

const mockUseAuth = vi.mocked(useAuth)
const mockUseTasks = vi.mocked(useTasks)

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 42,
    title: 'Test PR',
    body: 'Test PR body',
    bodyHtml: null,
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

function createTestStore(pullRequests: PullRequest[] = []) {
  return configureStore({
    reducer: {
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer,
      reviews: reviewsReducer
    },
    preloadedState: {
      pendingReviewComments: {},
      pendingReviews: {},
      pullRequests: {
        items: pullRequests,
        listCount: pullRequests.length
      },
      reviews: { items: [] }
    }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    mockUseTasks.mockReturnValue({
      hasSyncInProgress: false,
      tasksInitialized: true,
      runningTasks: [],
      tasks: []
    })

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        name: 'John Doe',
        login: 'johndoe',
        avatar_url: 'https://example.com/avatar.png'
      },
      userCode: null,
      verificationUri: null,
      error: null,
      isNewSignIn: false,
      startLogin: vi.fn(),
      logout: vi.fn(),
      openVerificationUrl: vi.fn(),
      clearNewSignIn: vi.fn()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('greeting display', () => {
    it('renders greeting with user name when available', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      mockUseAuth.mockReturnValue({
        status: 'authenticated',
        user: {
          name: 'John Doe',
          login: 'johndoe',
          avatar_url: 'https://example.com/avatar.png'
        },
        userCode: null,
        verificationUri: null,
        error: null,
        isNewSignIn: false,
        startLogin: vi.fn(),
        logout: vi.fn(),
        openVerificationUrl: vi.fn(),
        clearNewSignIn: vi.fn()
      })

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/John/)).toBeInTheDocument()
    })

    it('falls back to login when name is null', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      mockUseAuth.mockReturnValue({
        status: 'authenticated',
        user: {
          name: null,
          login: 'johndoe',
          avatar_url: 'https://example.com/avatar.png'
        },
        userCode: null,
        verificationUri: null,
        error: null,
        isNewSignIn: false,
        startLogin: vi.fn(),
        logout: vi.fn(),
        openVerificationUrl: vi.fn(),
        clearNewSignIn: vi.fn()
      })

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/johndoe/)).toBeInTheDocument()
    })

    it('falls back to "User" when both name and login are null', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      mockUseAuth.mockReturnValue({
        status: 'authenticated',
        user: null,
        userCode: null,
        verificationUri: null,
        error: null,
        isNewSignIn: false,
        startLogin: vi.fn(),
        logout: vi.fn(),
        openVerificationUrl: vi.fn(),
        clearNewSignIn: vi.fn()
      })

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/User/)).toBeInTheDocument()
    })
  })

  describe('time-based greeting', () => {
    it('shows "Good morning" between 3:00-11:59', () => {
      vi.setSystemTime(new Date('2024-01-15T08:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good morning/)).toBeInTheDocument()
    })

    it('shows "Good afternoon" between 12:00-18:00', () => {
      vi.setSystemTime(new Date('2024-01-15T14:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good afternoon/)).toBeInTheDocument()
    })

    it('shows "Good evening" between 18:01-2:59', () => {
      vi.setSystemTime(new Date('2024-01-15T20:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good evening/)).toBeInTheDocument()
    })

    it('shows "Good evening" at 1:00 AM', () => {
      vi.setSystemTime(new Date('2024-01-15T01:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good evening/)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows "No pull requests found." when no PRs', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      renderWithProviders(<HomePage />)

      expect(
        screen.getByText('No pull requests synced yet.')
      ).toBeInTheDocument()
    })

    it('shows sync message in empty state', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      renderWithProviders(<HomePage />)

      expect(
        screen.getByText("They'll appear here once syncing completes.")
      ).toBeInTheDocument()
    })

    it('shows loading and duration hint while PR sync is in progress', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      mockUseTasks.mockReturnValue({
        hasSyncInProgress: true,
        tasksInitialized: true,
        runningTasks: [],
        tasks: []
      })

      renderWithProviders(<HomePage />)

      expect(screen.getByText('Syncing pull requests…')).toBeInTheDocument()
      expect(
        screen.getByText('This may take a few minutes.')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('No pull requests synced yet.')
      ).not.toBeInTheDocument()
    })

    it('shows loading when the server list has PRs but none are detail-ready yet', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      const store = configureStore({
        reducer: {
          pendingReviewComments: pendingReviewCommentsReducer,
          pendingReviews: pendingReviewsReducer,
          pullRequests: pullRequestsReducer,
          reviews: reviewsReducer
        },
        preloadedState: {
          pendingReviewComments: {},
          pendingReviews: {},
          pullRequests: { items: [], listCount: 2 },
          reviews: { items: [] }
        }
      })

      renderWithProviders(<HomePage />, { store })

      expect(screen.getByText('Syncing pull requests…')).toBeInTheDocument()
      expect(
        screen.queryByText('No pull requests synced yet.')
      ).not.toBeInTheDocument()
    })

    it('shows loading before tasks state is initialized', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      mockUseTasks.mockReturnValue({
        hasSyncInProgress: false,
        tasksInitialized: false,
        runningTasks: [],
        tasks: []
      })

      renderWithProviders(<HomePage />)

      expect(screen.getByText('Syncing pull requests…')).toBeInTheDocument()
    })
  })

  describe('PR sections', () => {
    it('renders "Needs Your Attention" with PRs where isAuthor: false', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      const pullRequests = [
        createMockPullRequest({
          id: 'pr-1',
          isAuthor: false,
          title: 'Review me'
        })
      ]
      const store = createTestStore(pullRequests)

      renderWithProviders(<HomePage />, { store })

      expect(screen.getByText('Needs Your Attention')).toBeInTheDocument()
      expect(screen.getByText('Review me')).toBeInTheDocument()
      expect(
        screen.getAllByRole('columnheader', { name: 'Actions' })
      ).toHaveLength(1)
    })

    it('renders "Your Pull Requests" with PRs where isAuthor: true', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', isAuthor: true, title: 'My PR' })
      ]
      const store = createTestStore(pullRequests)

      renderWithProviders(<HomePage />, { store })

      expect(screen.getByText('Your Pull Requests')).toBeInTheDocument()
      expect(screen.getByText('My PR')).toBeInTheDocument()
    })

    it('displays correct badge counts', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', isAuthor: false }),
        createMockPullRequest({ id: 'pr-2', isAuthor: false }),
        createMockPullRequest({ id: 'pr-3', isAuthor: true })
      ]
      const store = createTestStore(pullRequests)

      renderWithProviders(<HomePage />, { store })

      const badges = screen.getAllByText(/^[0-9]+$/)
      const badgeValues = badges.map((badge) => badge.textContent)

      expect(badgeValues).toContain('2')
      expect(badgeValues).toContain('1')
    })

    it('only shows OPEN PRs (excludes CLOSED/MERGED)', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', state: 'OPEN', title: 'Open PR' }),
        createMockPullRequest({
          id: 'pr-2',
          state: 'CLOSED',
          title: 'Closed PR'
        }),
        createMockPullRequest({
          id: 'pr-3',
          state: 'MERGED',
          title: 'Merged PR'
        })
      ]
      const store = createTestStore(pullRequests)

      renderWithProviders(<HomePage />, { store })

      expect(screen.getByText('Open PR')).toBeInTheDocument()
      expect(screen.queryByText('Closed PR')).not.toBeInTheDocument()
      expect(screen.queryByText('Merged PR')).not.toBeInTheDocument()
    })
  })

  describe('sorting', () => {
    it('sorts PRs by updatedAt descending in both sections', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'))

      const pullRequests = [
        createMockPullRequest({
          id: 'pr-1',
          isAuthor: false,
          title: 'Older PR',
          updatedAt: '2024-01-01T00:00:00Z'
        }),
        createMockPullRequest({
          id: 'pr-2',
          isAuthor: false,
          title: 'Newer PR',
          updatedAt: '2024-01-10T00:00:00Z'
        }),
        createMockPullRequest({
          id: 'pr-3',
          isAuthor: true,
          title: 'Old Author PR',
          updatedAt: '2024-01-05T00:00:00Z'
        }),
        createMockPullRequest({
          id: 'pr-4',
          isAuthor: true,
          title: 'New Author PR',
          updatedAt: '2024-01-12T00:00:00Z'
        })
      ]
      const store = createTestStore(pullRequests)

      renderWithProviders(<HomePage />, { store })

      const rows = screen.getAllByRole('row')
      const titles = rows
        .map((row) => row.textContent)
        .filter((text) => text?.includes('PR'))

      // Newer PR should appear before Older PR in the "Needs Your Attention" section.
      const newerIndex = titles.findIndex((text) => text?.includes('Newer PR'))
      const olderIndex = titles.findIndex((text) => text?.includes('Older PR'))

      expect(newerIndex).toBeLessThan(olderIndex)

      // New Author PR should appear before Old Author PR in the "Your Pull Requests" section.
      const newAuthorIndex = titles.findIndex((text) =>
        text?.includes('New Author PR')
      )
      const oldAuthorIndex = titles.findIndex((text) =>
        text?.includes('Old Author PR')
      )

      expect(newAuthorIndex).toBeLessThan(oldAuthorIndex)
    })
  })
})
