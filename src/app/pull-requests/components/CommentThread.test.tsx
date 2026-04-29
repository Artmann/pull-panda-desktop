/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

import type { Comment, ReviewThread } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import {
  createComment,
  resolveReviewThread,
  unresolveReviewThread
} from '@/app/lib/api'
import { AuthProvider } from '@/app/lib/store/authContext'
import { ThemeProvider } from '@/app/lib/store/themeContext'
import commentsReducer from '@/app/store/comments-slice'
import draftsReducer, { getDraftKeyForReply } from '@/app/store/drafts-slice'
import reviewThreadsReducer from '@/app/store/review-threads-slice'

import { CommentThreadCard, FileCommentThreadCard } from './CommentThread'

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
  createComment: vi.fn(),
  resolveReviewThread: vi.fn(),
  syncPullRequestDetails: vi.fn(),
  unresolveReviewThread: vi.fn()
}))

vi.mock('@/app/components/MarkdownBlock', () => ({
  MarkdownBlock: ({ children }: { children: string }) => <div>{children}</div>
}))

const mockUser = {
  login: 'currentuser',
  avatar_url: 'https://example.com/currentuser.png',
  id: 12345,
  name: 'Current User'
}

vi.stubGlobal('electron', {
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

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
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

function createTestStore(preloadedState?: {
  drafts?: Record<string, string>
  reviewThreads?: ReviewThread[]
}) {
  return configureStore({
    reducer: {
      comments: commentsReducer,
      drafts: draftsReducer,
      reviewThreads: reviewThreadsReducer
    },
    preloadedState: {
      drafts: preloadedState?.drafts,
      comments: { items: [] },
      reviewThreads: { items: preloadedState?.reviewThreads ?? [] }
    }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ThemeProvider>
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

    const form = screen
      .getByPlaceholderText('Reply to comment...')
      .closest('form') as HTMLFormElement

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

    const form = screen
      .getByPlaceholderText('Reply to comment...')
      .closest('form') as HTMLFormElement

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

    const form = screen
      .getByPlaceholderText('Reply to comment...')
      .closest('form') as HTMLFormElement

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

function createMockThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
  return {
    id: 'thread-1',
    gitHubId: 'PRRT_kwDOExample',
    pullRequestId: 'pr-1',
    isResolved: false,
    resolvedByLogin: null,
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('CopyAsPromptButton', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
  })

  it('renders the AI prompt button when showPromptButton is true', async () => {
    const comment = createMockComment()
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
          showPromptButton
        />
      )
    })

    expect(screen.getByLabelText('Copy as AI prompt')).toBeInTheDocument()
  })

  it('does not render the AI prompt button by default', async () => {
    const comment = createMockComment()
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.queryByLabelText('Copy as AI prompt')).not.toBeInTheDocument()
  })

  it('copies a formatted prompt to the clipboard when clicked', async () => {
    const comment = createMockComment({
      body: 'Please fix this',
      diffHunk: '@@ -1,2 +1,2 @@\n-old\n+new',
      line: 10,
      path: 'src/example.ts',
      userLogin: 'reviewer'
    })
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
          showPromptButton
        />
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy as AI prompt'))
    })

    expect(writeText).toHaveBeenCalledWith(
      [
        'File: src/example.ts:10',
        '```',
        '@@ -1,2 +1,2 @@\n-old\n+new',
        '```',
        '',
        'reviewer said:',
        '"Please fix this"',
        '',
        'Please address this review comment.'
      ].join('\n')
    )
  })
})

describe('Outdated comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an Outdated badge when a review comment has no current line but a preserved originalLine', async () => {
    const comment = createMockComment({ line: null, originalLine: 32 })
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Outdated')).toBeInTheDocument()
  })

  it('shows an Outdated badge when both line and originalLine are null', async () => {
    const comment = createMockComment({ line: null, originalLine: null })
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.getByText('Outdated')).toBeInTheDocument()
  })

  it('does not show an Outdated badge when the comment still has a line', async () => {
    const comment = createMockComment({ line: 32, originalLine: 32 })
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.queryByText('Outdated')).not.toBeInTheDocument()
  })

  it('does not show an Outdated badge for a fresh comment whose originalLine is null', async () => {
    const comment = createMockComment({ line: 56, originalLine: null })
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />
      )
    })

    expect(screen.queryByText('Outdated')).not.toBeInTheDocument()
  })

  it('does not render the empty-range message for outdated comments', async () => {
    const comment = createMockComment({ line: null, originalLine: null })
    const pullRequest = createMockPullRequest()

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />
      )
    })

    expect(
      screen.queryByText('No lines found in the specified range')
    ).not.toBeInTheDocument()
  })
})

describe('ResolveThreadButton (icon)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveReviewThread).mockResolvedValue({
      gitHubId: 'PRRT_kwDOExample',
      isResolved: true,
      resolvedByLogin: 'currentuser'
    })
    vi.mocked(unresolveReviewThread).mockResolvedValue({
      gitHubId: 'PRRT_kwDOExample',
      isResolved: false,
      resolvedByLogin: null
    })
  })

  it('renders the icon Resolve button in FileCommentThreadCard', async () => {
    const comment = createMockComment()
    const pullRequest = createMockPullRequest()
    const store = createTestStore({ reviewThreads: [createMockThread()] })

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    const button = screen.getByRole('button', { name: 'Resolve' })

    expect(button).toBeInTheDocument()
    expect(button.textContent ?? '').toBe('')
  })

  it('renders the icon Resolve button in CommentThreadCard', async () => {
    const comment = createMockComment()
    const pullRequest = createMockPullRequest()
    const store = createTestStore({ reviewThreads: [createMockThread()] })

    await act(async () => {
      renderWithProviders(
        <CommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  })

  it('calls resolveReviewThread when clicked on an unresolved thread', async () => {
    const comment = createMockComment()
    const pullRequest = createMockPullRequest()
    const store = createTestStore({ reviewThreads: [createMockThread()] })

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    })

    await waitFor(() => {
      expect(resolveReviewThread).toHaveBeenCalledWith({
        owner: 'Artmann',
        pullNumber: 7,
        repo: 'teddy',
        threadId: 'PRRT_kwDOExample'
      })
    })

    expect(unresolveReviewThread).not.toHaveBeenCalled()
  })

  it('calls unresolveReviewThread when clicked on a resolved thread', async () => {
    const comment = createMockComment()
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      reviewThreads: [
        createMockThread({ isResolved: true, resolvedByLogin: 'someone' })
      ]
    })

    await act(async () => {
      renderWithProviders(
        <FileCommentThreadCard
          allComments={[comment]}
          comment={comment}
          pullRequest={pullRequest}
        />,
        { store }
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unresolve' }))
    })

    await waitFor(() => {
      expect(unresolveReviewThread).toHaveBeenCalledWith({
        owner: 'Artmann',
        pullNumber: 7,
        repo: 'teddy',
        threadId: 'PRRT_kwDOExample'
      })
    })

    expect(resolveReviewThread).not.toHaveBeenCalled()
  })
})
