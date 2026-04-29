import { describe, expect, it } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'
import type {
  Check,
  Comment,
  Review,
  ReviewThread
} from '@/types/pull-request-details'

import { buildTaskGroups, countOpenBlockers } from './use-derived-tasks'

function createCheck(overrides: Partial<Check> = {}): Check {
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

function createComment(overrides: Partial<Comment> = {}): Comment {
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

function createReview(overrides: Partial<Review> = {}): Review {
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

function createThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
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

function createMergeOptions(
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

describe('buildTaskGroups', () => {
  it('returns three groups in order: ci, reviewers, agents', () => {
    const groups = buildTaskGroups({
      checks: [],
      comments: [],
      mergeOptions: null,
      reviewThreads: [],
      reviews: []
    })

    expect(groups.map((group) => group.key)).toEqual([
      'ci',
      'reviewers',
      'agents'
    ])
  })

  it('marks a failed check as a blocker in the CI group', () => {
    const failingCheck = createCheck({
      conclusion: 'failure',
      message: 'Lint errors',
      name: 'lint'
    })

    const groups = buildTaskGroups({
      checks: [failingCheck],
      comments: [],
      mergeOptions: null,
      reviewThreads: [],
      reviews: []
    })

    const ciGroup = groups.find((group) => group.key === 'ci')

    expect(ciGroup?.tasks).toEqual([
      {
        action: {
          label: 'View details',
          url: 'https://example.com/checks/1'
        },
        detailsUrl: 'https://example.com/checks/1',
        id: 'check-check-1',
        kind: 'check',
        message: 'Lint errors',
        meta: 'CI · Failed',
        severity: 'blocker',
        title: 'lint'
      }
    ])
  })

  it('marks a dirty merge state as a blocker', () => {
    const groups = buildTaskGroups({
      checks: [],
      comments: [],
      mergeOptions: createMergeOptions({ mergeableState: 'dirty' }),
      reviewThreads: [],
      reviews: []
    })

    const ciGroup = groups.find((group) => group.key === 'ci')

    expect(ciGroup?.tasks).toEqual([
      {
        description:
          'This branch has conflicts with the base branch that must be resolved before it can be merged.',
        id: 'requirement-merge-conflicts',
        kind: 'requirement',
        meta: 'Branch state',
        severity: 'blocker',
        title: 'Resolve merge conflicts'
      }
    ])
  })

  it('skips resolved review threads', () => {
    const anchor = createComment({
      gitHubReviewThreadId: 'gh-thread-1',
      userLogin: 'alice'
    })

    const thread = createThread({
      gitHubId: 'gh-thread-1',
      isResolved: true
    })

    const groups = buildTaskGroups({
      checks: [],
      comments: [anchor],
      mergeOptions: null,
      reviewThreads: [thread],
      reviews: []
    })

    const reviewersGroup = groups.find((group) => group.key === 'reviewers')
    const agentsGroup = groups.find((group) => group.key === 'agents')

    expect(reviewersGroup?.tasks).toEqual([])
    expect(agentsGroup?.tasks).toEqual([])
  })

  it('routes bot-authored unresolved threads into the agents group', () => {
    const anchor = createComment({
      body: 'Consider extracting this helper.',
      gitHubReviewThreadId: 'gh-thread-1',
      userAvatarUrl: 'https://example.com/coderabbit.png',
      userLogin: 'coderabbitai'
    })

    const thread = createThread({ gitHubId: 'gh-thread-1' })

    const groups = buildTaskGroups({
      checks: [],
      comments: [anchor],
      mergeOptions: null,
      reviewThreads: [thread],
      reviews: []
    })

    const reviewersGroup = groups.find((group) => group.key === 'reviewers')
    const agentsGroup = groups.find((group) => group.key === 'agents')

    expect(reviewersGroup?.tasks).toEqual([])
    expect(agentsGroup?.tasks).toEqual([
      {
        anchorComment: anchor,
        authorAvatarUrl: 'https://example.com/coderabbit.png',
        authorLogin: 'coderabbitai',
        id: 'thread-thread-1',
        kind: 'thread',
        meta: 'src/app.ts:10',
        severity: 'info',
        thread,
        title: 'coderabbitai: Consider extracting this helper.'
      }
    ])
  })

  it('routes human-authored unresolved threads into the reviewers group', () => {
    const anchor = createComment({
      body: 'Rename this please.',
      gitHubReviewThreadId: 'gh-thread-1',
      userLogin: 'bob'
    })

    const thread = createThread({ gitHubId: 'gh-thread-1' })

    const groups = buildTaskGroups({
      checks: [],
      comments: [anchor],
      mergeOptions: null,
      reviewThreads: [thread],
      reviews: []
    })

    const reviewersGroup = groups.find((group) => group.key === 'reviewers')

    expect(reviewersGroup?.tasks).toEqual([
      {
        anchorComment: anchor,
        authorAvatarUrl: anchor.userAvatarUrl,
        authorLogin: 'bob',
        id: 'thread-thread-1',
        kind: 'thread',
        meta: 'src/app.ts:10',
        severity: 'info',
        thread,
        title: 'bob: Rename this please.'
      }
    ])
  })

  it('marks CHANGES_REQUESTED reviews as a blocker and escalates threads', () => {
    const review = createReview({
      authorLogin: 'alice',
      state: 'CHANGES_REQUESTED'
    })

    const anchor = createComment({
      body: 'Please address this.',
      gitHubReviewThreadId: 'gh-thread-1',
      userLogin: 'bob'
    })

    const thread = createThread({ gitHubId: 'gh-thread-1' })

    const groups = buildTaskGroups({
      checks: [],
      comments: [anchor],
      mergeOptions: null,
      reviewThreads: [thread],
      reviews: [review]
    })

    const reviewersGroup = groups.find((group) => group.key === 'reviewers')

    expect(reviewersGroup?.tasks).toEqual([
      {
        authorAvatarUrl: review.authorAvatarUrl,
        authorLogin: 'alice',
        id: `review-state-${review.id}`,
        kind: 'review-state',
        meta: 'Required reviewer · changes requested',
        severity: 'blocker',
        summary:
          'Address the requested changes and re-request review to clear the changes-requested state.',
        title: 'alice requested changes'
      },
      {
        anchorComment: anchor,
        authorAvatarUrl: anchor.userAvatarUrl,
        authorLogin: 'bob',
        id: 'thread-thread-1',
        kind: 'thread',
        meta: 'src/app.ts:10',
        severity: 'blocker',
        thread,
        title: 'bob: Please address this.'
      }
    ])
  })

  it('summarises an all-green PR with a passing-checks task and approved-reviews task', () => {
    const check = createCheck({ conclusion: 'success' })
    const review = createReview({ authorLogin: 'alice', state: 'APPROVED' })

    const groups = buildTaskGroups({
      checks: [check],
      comments: [],
      mergeOptions: createMergeOptions(),
      reviewThreads: [],
      reviews: [review]
    })

    const ciGroup = groups.find((group) => group.key === 'ci')
    const reviewersGroup = groups.find((group) => group.key === 'reviewers')

    expect(ciGroup?.tasks).toEqual([
      {
        id: 'check-summary-passed',
        kind: 'simple',
        meta: '1 of 1 required checks',
        severity: 'done',
        title: 'All checks have passed'
      }
    ])

    expect(reviewersGroup?.tasks).toEqual([
      {
        id: 'review-approved-summary',
        kind: 'simple',
        meta: 'Latest reviews',
        severity: 'done',
        title: '1 reviewer approved'
      }
    ])
  })

  it('treats running checks as warnings without surfacing the all-passed summary', () => {
    const running = createCheck({
      conclusion: null,
      id: 'check-2',
      name: 'tests',
      state: 'in_progress',
      suiteName: 'CI'
    })

    const groups = buildTaskGroups({
      checks: [running],
      comments: [],
      mergeOptions: null,
      reviewThreads: [],
      reviews: []
    })

    const ciGroup = groups.find((group) => group.key === 'ci')

    expect(ciGroup?.tasks).toEqual([
      {
        id: 'check-check-2',
        kind: 'simple',
        meta: 'CI · running',
        severity: 'warning',
        title: 'tests'
      }
    ])
  })

  it('emits unsatisfied merge requirements as blockers', () => {
    const groups = buildTaskGroups({
      checks: [],
      comments: [],
      mergeOptions: createMergeOptions({
        requirements: [
          {
            description: 'The branch must be up to date with the base branch.',
            key: 'up-to-date',
            label: 'Update branch',
            satisfied: false
          }
        ]
      }),
      reviewThreads: [],
      reviews: []
    })

    const ciGroup = groups.find((group) => group.key === 'ci')

    expect(ciGroup?.tasks).toEqual([
      {
        description: 'The branch must be up to date with the base branch.',
        id: 'requirement-up-to-date',
        kind: 'requirement',
        meta: 'Branch protection requirement',
        severity: 'blocker',
        title: 'Update branch'
      }
    ])
  })
})

describe('countOpenBlockers', () => {
  it('counts blocker tasks across all groups', () => {
    const failingCheck = createCheck({ conclusion: 'failure' })

    const anchor = createComment({
      gitHubReviewThreadId: 'gh-thread-1',
      userLogin: 'bob'
    })

    const thread = createThread({ gitHubId: 'gh-thread-1' })

    const groups = buildTaskGroups({
      checks: [failingCheck],
      comments: [anchor],
      mergeOptions: createMergeOptions({ mergeableState: 'dirty' }),
      reviewThreads: [thread],
      reviews: [createReview({ state: 'CHANGES_REQUESTED' })]
    })

    expect(countOpenBlockers(groups)).toEqual(4)
  })

  it('returns zero when no tasks are blockers', () => {
    const groups = buildTaskGroups({
      checks: [createCheck()],
      comments: [],
      mergeOptions: createMergeOptions(),
      reviewThreads: [],
      reviews: [createReview({ state: 'APPROVED' })]
    })

    expect(countOpenBlockers(groups)).toEqual(0)
  })
})
