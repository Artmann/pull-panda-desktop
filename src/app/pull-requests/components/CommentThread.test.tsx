/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

import type { Comment } from '@/types/pullRequestDetails'
import type { PullRequest } from '@/types/pullRequest'

import { createComment } from '@/app/lib/api'
import { AuthProvider } from '@/app/lib/store/authContext'
import draftsReducer, { getDraftKeyForReply } from '@/app/store/draftsSlice'
import pullRequestDetailsReducer from '@/app/store/pullRequestDetailsSlice'

import { FileCommentThreadCard } from './CommentThread'

// Mock browser APIs not available in jsdom
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

vi.mock('@/app/lib/api', () => ({
  createComment: vi.fn()
}))

vi.mock('@/app/components/MarkdownBlock', () => ({
  MarkdownBlock: ({ children }: { children: string }) => <div>{children}</div>
}))

const mockSyncPullRequestDetails = vi.fn()

const mockUser = {
  login: 'currentuser',
  avatar_url: 'https://example.com/currentuser.png',
  id: 12345,
  name: 'Current User'
}

vi.stubGlobal('electron', {
  syncPullRequestDetails: mockSyncPullRequestDetails,
  getApiPort: vi.fn().mockResolvedValue(3000)
})

vi.stubGlobal('auth', {
  getUser: vi.fn().mockResolvedValue(mockUser),
  clearToken: vi.fn(),
  requestDeviceCode: vi.fn(),
  pollForToken: vi.fn(),
  openUrl: vi.fn()
})

function createMockComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    gitHubId: 'IC_kwDOExample123',
    gitHubNumericId: 123456789,
    pullRequestId: 'pr-1',
    reviewId: 'review-1',
    body: 'Test comment body',
    bodyHtml: null,
    path: 'src/example.ts',
    line: 10,
    originalLine: 10,
    diffHunk: '@@ -1,5 +1,5 @@\n context\n-old line\n+new line',
    commitId: 'abc123',
    originalCommitId: 'abc123',
    gitHubReviewId: 'PRR_kwDOExample',
    gitHubReviewThreadId: 'PRRT_kwDOExample',
    parentCommentGitHubId: null,
    userLogin: 'testuser',
    userAvatarUrl: 'https://example.com/avatar.png',
    url: 'https://github.com/owner/repo/pull/1#discussion_r123',
    gitHubCreatedAt: '2024-01-01T00:00:00Z',
    gitHubUpdatedAt: '2024-01-01T00:00:00Z',
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

function createMockPullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 'pr-1',
    number: 7,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/Artmann/teddy/pull/7',
    repositoryOwner: 'Artmann',
    repositoryName: 'teddy',
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

function createTestStore(preloadedState?: { drafts?: Record<string, string> }) {
  return configureStore({
    reducer: {
      drafts: draftsReducer,
      pullRequestDetails: pullRequestDetailsReducer
    },
    preloadedState
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(
    <Provider store={store}>
      <AuthProvider>{ui}</AuthProvider>
    </Provider>
  )
}

describe('CommentReply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createComment).mockResolvedValue({ id: 999, success: true })
  })

  it('should include reviewCommentId when replying to a review comment', async () => {
    const comment = createMockComment({
      gitHubNumericId: 123456789,
      gitHubReviewThreadId: 'PRRT_kwDOExample'
    })
    const pullRequest = createMockPullRequest()
    const draftKey = getDraftKeyForReply(pullRequest.id, comment.gitHubId)

    // Pre-populate the draft in Redux store
    const store = createTestStore({
      drafts: { [draftKey]: 'Test reply' }
    })

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          comment={comment}
          allComments={[comment]}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    // Wait for auth to be ready (useEffect async)
    await act(async () => {
      await Promise.resolve()
    })

    const form = screen.getByPlaceholderText('Reply to comment...').closest('form') as HTMLFormElement

    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({
        body: 'Test reply',
        owner: 'Artmann',
        pullNumber: 7,
        repo: 'teddy',
        reviewCommentId: 123456789
      })
    })
  })

  it('should NOT include reviewCommentId when gitHubNumericId is null', async () => {
    const comment = createMockComment({
      gitHubNumericId: null,
      gitHubReviewThreadId: 'PRRT_kwDOExample'
    })
    const pullRequest = createMockPullRequest()
    const draftKey = getDraftKeyForReply(pullRequest.id, comment.gitHubId)

    // Pre-populate the draft in Redux store
    const store = createTestStore({
      drafts: { [draftKey]: 'Test reply' }
    })

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          comment={comment}
          allComments={[comment]}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    // Wait for auth to be ready (useEffect async)
    await act(async () => {
      await Promise.resolve()
    })

    const form = screen.getByPlaceholderText('Reply to comment...').closest('form') as HTMLFormElement

    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({
        body: 'Test reply',
        owner: 'Artmann',
        pullNumber: 7,
        repo: 'teddy',
        reviewCommentId: undefined
      })
    })
  })

  it('should NOT include reviewCommentId for non-review comments', async () => {
    const comment = createMockComment({
      gitHubNumericId: 123456789,
      gitHubReviewThreadId: null // Not a review comment
    })
    const pullRequest = createMockPullRequest()
    const draftKey = getDraftKeyForReply(pullRequest.id, comment.gitHubId)

    // Pre-populate the draft in Redux store
    const store = createTestStore({
      drafts: { [draftKey]: 'Test reply' }
    })

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          comment={comment}
          allComments={[comment]}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    // Wait for auth to be ready (useEffect async)
    await act(async () => {
      await Promise.resolve()
    })

    const form = screen.getByPlaceholderText('Reply to comment...').closest('form') as HTMLFormElement

    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({
        body: 'Test reply',
        owner: 'Artmann',
        pullNumber: 7,
        repo: 'teddy',
        reviewCommentId: undefined
      })
    })
  })
})
