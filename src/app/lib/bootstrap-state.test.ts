import { describe, expect, it } from 'vitest'

import { createPullRequest } from '@/app/pull-requests/tasks/__test-helpers__/factories'
import type { PreloadedState } from '@/app/store'
import type { BootstrapData, PendingReview } from '@/main/bootstrap'
import type {
  Check,
  Comment,
  CommentReaction,
  Commit,
  ModifiedFile,
  Review,
  ReviewThread
} from '@/types/pull-request-details'

import { buildPreloadedState } from './bootstrap-state'

const check: Check = {
  commitSha: null,
  conclusion: 'SUCCESS',
  detailsUrl: null,
  durationInSeconds: null,
  gitHubCreatedAt: null,
  gitHubId: 'check-github-1',
  gitHubUpdatedAt: null,
  id: 'check-1',
  message: null,
  name: 'build',
  pullRequestId: 'pr-1',
  state: 'COMPLETED',
  suiteName: null,
  syncedAt: '2026-01-01T00:00:00Z',
  url: null
}

const comment: Comment = {
  body: 'Looks good',
  bodyHtml: null,
  commitId: null,
  diffHunk: null,
  gitHubCreatedAt: null,
  gitHubId: 'comment-github-1',
  gitHubNumericId: null,
  gitHubReviewId: null,
  gitHubReviewThreadId: null,
  gitHubUpdatedAt: null,
  id: 'comment-1',
  line: null,
  originalCommitId: null,
  originalLine: null,
  parentCommentGitHubId: null,
  path: null,
  pullRequestId: 'pr-1',
  reviewId: null,
  syncedAt: '2026-01-01T00:00:00Z',
  url: null,
  userAvatarUrl: null,
  userLogin: 'alice'
}

const commit: Commit = {
  authorAvatarUrl: null,
  authorLogin: 'alice',
  gitHubCreatedAt: null,
  gitHubId: 'commit-github-1',
  hash: 'abc123',
  id: 'commit-1',
  linesAdded: null,
  linesRemoved: null,
  message: 'Initial commit',
  pullRequestId: 'pr-1',
  syncedAt: '2026-01-01T00:00:00Z',
  url: null
}

const modifiedFile: ModifiedFile = {
  additions: 1,
  changes: 1,
  deletions: 0,
  diffHunk: null,
  filename: 'index.ts',
  filePath: 'src/index.ts',
  id: 'file-1',
  pullRequestId: 'pr-1',
  status: 'modified',
  syncedAt: '2026-01-01T00:00:00Z'
}

const pendingReview: PendingReview = {
  authorAvatarUrl: null,
  authorLogin: 'alice',
  body: null,
  gitHubId: 'review-github-1',
  gitHubNumericId: null,
  id: 'pending-review-1',
  isCollapsed: false,
  pullRequestId: 'pr-1',
  state: 'PENDING'
}

const reaction: CommentReaction = {
  commentId: 'comment-1',
  content: 'THUMBS_UP',
  gitHubId: 'reaction-github-1',
  id: 'reaction-1',
  pullRequestId: 'pr-1',
  syncedAt: '2026-01-01T00:00:00Z',
  userId: null,
  userLogin: 'alice'
}

const review: Review = {
  authorAvatarUrl: null,
  authorLogin: 'alice',
  body: null,
  bodyHtml: null,
  gitHubCreatedAt: null,
  gitHubId: 'review-github-2',
  gitHubNumericId: null,
  gitHubSubmittedAt: null,
  id: 'review-1',
  pullRequestId: 'pr-1',
  state: 'APPROVED',
  syncedAt: '2026-01-01T00:00:00Z',
  url: null
}

const reviewThread: ReviewThread = {
  gitHubId: 'thread-github-1',
  id: 'thread-1',
  isResolved: false,
  pullRequestId: 'pr-1',
  resolvedByLogin: null,
  syncedAt: '2026-01-01T00:00:00Z'
}

const emptyPreloadedState: PreloadedState = {
  checks: { items: [] },
  comments: { items: [] },
  commits: { items: [] },
  connectedRepos: {
    byFullName: {},
    checkoutsInProgress: {},
    initialized: true
  },
  modifiedFiles: { items: [] },
  pendingReviews: {},
  pullRequests: { initialized: true, items: [] },
  reactions: { items: [] },
  reviews: { items: [] },
  reviewThreads: { items: [] }
}

describe('buildPreloadedState', () => {
  it('returns an empty initialized state when bootstrap data is null', () => {
    expect(buildPreloadedState(null)).toEqual(emptyPreloadedState)
  })

  it('maps bootstrap data into the preloaded state', () => {
    const readyPullRequest = createPullRequest({
      detailsSyncedAt: '2026-01-01T00:00:00Z',
      id: 'pr-ready'
    })
    const notReadyPullRequest = createPullRequest({
      detailsSyncedAt: null,
      id: 'pr-not-ready'
    })

    const bootstrapData: BootstrapData = {
      checks: [check],
      comments: [comment],
      commits: [commit],
      connectedRepos: { 'pull-panda/panda': '/repos/panda' },
      modifiedFiles: [modifiedFile],
      pendingReviews: { 'pr-ready': pendingReview },
      pullRequests: [readyPullRequest, notReadyPullRequest],
      reactions: [reaction],
      reviews: [review],
      reviewThreads: [reviewThread]
    }

    expect(buildPreloadedState(bootstrapData)).toEqual({
      checks: { items: [check] },
      comments: { items: [comment] },
      commits: { items: [commit] },
      connectedRepos: {
        byFullName: { 'pull-panda/panda': '/repos/panda' },
        checkoutsInProgress: {},
        initialized: true
      },
      modifiedFiles: { items: [modifiedFile] },
      pendingReviews: { 'pr-ready': pendingReview },
      pullRequests: { initialized: true, items: [readyPullRequest] },
      reactions: { items: [reaction] },
      reviews: { items: [review] },
      reviewThreads: { items: [reviewThread] }
    })
  })
})
