import type { MergeOptions } from '@/app/lib/api'
import type {
  Check,
  Comment,
  Review,
  ReviewThread
} from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import type {
  CheckTask,
  RequirementTask,
  ReviewStateTask,
  SimpleTask,
  ThreadTask
} from '../task-types'

export function createCheck(overrides: Partial<Check> = {}): Check {
  return {
    commitSha: 'abc123',
    conclusion: 'success',
    detailsUrl: 'https://example.com/checks/1',
    durationInSeconds: 12,
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubId: 'gh-check-1',
    gitHubUpdatedAt: '2026-01-01T00:00:00Z',
    id: 'check-1',
    message: null,
    name: 'lint',
    pullRequestId: 'pr-1',
    state: 'completed',
    suiteName: 'CI',
    syncedAt: '2026-01-01T00:00:00Z',
    url: 'https://example.com/checks/1',
    ...overrides
  }
}

export function createComment(overrides: Partial<Comment> = {}): Comment {
  return {
    body: 'Please rename this variable.',
    bodyHtml: null,
    commitId: null,
    diffHunk: '@@ -1 +1 @@',
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubId: 'gh-comment-1',
    gitHubNumericId: 1,
    gitHubReviewId: null,
    gitHubReviewThreadId: 'gh-thread-1',
    gitHubUpdatedAt: '2026-01-01T00:00:00Z',
    id: 'comment-1',
    line: 10,
    originalCommitId: null,
    originalLine: 10,
    parentCommentGitHubId: null,
    path: 'src/app.ts',
    pullRequestId: 'pr-1',
    reviewId: null,
    syncedAt: '2026-01-01T00:00:00Z',
    url: 'https://example.com/comments/1',
    userAvatarUrl: 'https://example.com/avatar.png',
    userLogin: 'alice',
    ...overrides
  }
}

export function createReview(overrides: Partial<Review> = {}): Review {
  return {
    authorAvatarUrl: 'https://example.com/avatar.png',
    authorLogin: 'alice',
    body: '',
    bodyHtml: null,
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubId: 'gh-review-1',
    gitHubNumericId: 1,
    gitHubSubmittedAt: '2026-01-01T00:00:00Z',
    id: 'review-1',
    pullRequestId: 'pr-1',
    state: 'APPROVED',
    syncedAt: '2026-01-01T00:00:00Z',
    url: null,
    ...overrides
  }
}

export function createThread(
  overrides: Partial<ReviewThread> = {}
): ReviewThread {
  return {
    gitHubId: 'gh-thread-1',
    id: 'thread-1',
    isResolved: false,
    pullRequestId: 'pr-1',
    resolvedByLogin: null,
    syncedAt: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

export function createMergeOptions(
  overrides: Partial<MergeOptions> = {}
): MergeOptions {
  return {
    allowMergeCommit: true,
    allowRebaseMerge: true,
    allowSquashMerge: true,
    mergeable: true,
    mergeableState: 'clean',
    requirements: [],
    ...overrides
  }
}

export function createPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    approvalCount: 0,
    assignees: [],
    requestedReviewers: [],
    authorAvatarUrl: 'https://example.com/avatar.png',
    authorLogin: 'alice',
    body: null,
    bodyHtml: null,
    changesRequestedCount: 0,
    closedAt: null,
    commentCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    detailsSyncedAt: null,
    headRefName: 'feature',
    id: 'pr-1',
    isAssignee: false,
    isAuthor: false,
    isDraft: false,
    isReviewer: false,
    labels: [],
    mergedAt: null,
    number: 1,
    repositoryName: 'panda',
    repositoryOwner: 'pull-panda',
    state: 'OPEN',
    syncedAt: '2026-01-01T00:00:00Z',
    title: 'Test PR',
    updatedAt: '2026-01-01T00:00:00Z',
    url: 'https://example.com/pr/1',
    ...overrides
  }
}

export function createSimpleTask(
  overrides: Partial<SimpleTask> = {}
): SimpleTask {
  return {
    id: 'task-simple-1',
    kind: 'simple',
    severity: 'done',
    title: 'All checks have passed',
    ...overrides
  }
}

export function createCheckTask(overrides: Partial<CheckTask> = {}): CheckTask {
  return {
    detailsUrl: 'https://example.com/checks/1',
    id: 'task-check-1',
    kind: 'check',
    message: 'Build failed at step 3',
    meta: 'CI · Failed',
    severity: 'blocker',
    title: 'lint',
    ...overrides
  }
}

export function createRequirementTask(
  overrides: Partial<RequirementTask> = {}
): RequirementTask {
  return {
    description: 'Two approving reviews are required.',
    id: 'task-requirement-1',
    kind: 'requirement',
    meta: 'Branch protection requirement',
    severity: 'blocker',
    title: 'Get required approvals',
    ...overrides
  }
}

export function createReviewStateTask(
  overrides: Partial<ReviewStateTask> = {}
): ReviewStateTask {
  return {
    authorAvatarUrl: 'https://example.com/avatar.png',
    authorLogin: 'alice',
    id: 'task-review-state-1',
    kind: 'review-state',
    meta: 'Required reviewer · changes requested',
    severity: 'blocker',
    summary: 'Address the requested changes.',
    title: 'alice requested changes',
    ...overrides
  }
}

export function createThreadTask(
  overrides: Partial<ThreadTask> = {}
): ThreadTask {
  return {
    anchorComment: createComment(),
    authorAvatarUrl: 'https://example.com/avatar.png',
    authorLogin: 'alice',
    id: 'task-thread-1',
    kind: 'thread',
    meta: 'src/app.ts:10',
    severity: 'blocker',
    thread: createThread(),
    title: 'alice: Please rename this variable.',
    ...overrides
  }
}
