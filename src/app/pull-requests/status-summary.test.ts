import { describe, expect, it } from 'vitest'

import { buildStatusSummary } from './status-summary'
import {
  createCheck,
  createCommentFixture,
  createMergeOptions,
  createReviewFixture,
  createThread
} from './tasks/__test-helpers__/factories'
import { buildTaskGroups } from './tasks/use-derived-tasks'

type BuildInput = Parameters<typeof buildTaskGroups>[0]

function summarize(overrides: Partial<BuildInput> = {}) {
  const input: BuildInput = {
    checks: [],
    comments: [],
    commitCount: 2,
    mergeOptions: createMergeOptions(),
    pullRequest: {
      baseRefName: 'main',
      requestedReviewers: [],
      reviewDecision: null
    },
    reviewThreads: [],
    reviews: [],
    ...overrides
  }

  return buildStatusSummary({
    baseName: 'main',
    checks: input.checks,
    taskGroups: buildTaskGroups(input)
  })
}

describe('buildStatusSummary', () => {
  it('reads as all clear for a passing, unreviewed, conflict-free pull request', () => {
    const checks = [
      createCheck({ id: 'a', name: 'lint', suiteName: 'GitHub Actions' }),
      createCheck({ id: 'b', name: 'deploy', suiteName: 'Vercel' })
    ]

    expect(summarize({ checks })).toEqual({
      cells: [
        {
          detail: 'GitHub Actions, Vercel',
          key: 'checks',
          label: 'Checks',
          tab: 'checks',
          tone: 'success',
          value: '2/2 passed'
        },
        {
          detail: 'No reviewers assigned',
          key: 'reviews',
          label: 'Reviews',
          tab: 'tasks',
          tone: 'neutral',
          value: 'Not required'
        },
        {
          detail: 'No comments yet',
          key: 'comments',
          label: 'Comments',
          tab: 'overview',
          tone: 'success',
          value: 'None open'
        },
        {
          detail: 'Up to date with main',
          key: 'branch',
          label: 'Branch',
          tab: 'tasks',
          tone: 'success',
          value: 'No conflicts'
        }
      ],
      tone: 'success'
    })
  })

  it('turns red when a check fails or a reviewer asks for changes', () => {
    const checks = [
      createCheck({ conclusion: 'failure', id: 'a', name: 'test' }),
      createCheck({ id: 'b', name: 'lint' }),
      createCheck({
        conclusion: null,
        id: 'c',
        name: 'e2e',
        state: 'in_progress'
      })
    ]
    const reviews = [
      createReviewFixture({ authorLogin: 'mira', state: 'CHANGES_REQUESTED' })
    ]

    const summary = summarize({ checks, reviews })

    expect({
      checks: summary.cells[0],
      reviews: summary.cells[1],
      tone: summary.tone
    }).toEqual({
      checks: {
        detail: '1 passed · 1 running',
        key: 'checks',
        label: 'Checks',
        tab: 'checks',
        tone: 'danger',
        value: '1 failing'
      },
      reviews: {
        detail: 'mira',
        key: 'reviews',
        label: 'Reviews',
        tab: 'tasks',
        tone: 'danger',
        value: 'Changes requested'
      },
      tone: 'danger'
    })
  })

  it('waits while checks run and a reviewer has not answered', () => {
    const checks = [
      createCheck({ conclusion: null, name: 'e2e', state: 'queued' })
    ]

    const summary = summarize({
      checks,
      pullRequest: {
        baseRefName: 'main',
        requestedReviewers: [{ avatarUrl: '', login: 'matheus' }],
        reviewDecision: 'REVIEW_REQUIRED'
      }
    })

    expect(summary.cells.slice(0, 2).map((cell) => cell.value)).toEqual([
      '1 running',
      'Waiting'
    ])
    expect(summary.cells[1].detail).toEqual('Waiting on matheus')
  })

  it('counts unresolved threads and the files they sit in', () => {
    const comments = [
      createCommentFixture(),
      createCommentFixture({
        gitHubId: 'gh-comment-2',
        gitHubReviewThreadId: 'gh-thread-2',
        id: 'comment-2',
        path: 'src/other.ts'
      })
    ]
    const reviewThreads = [
      createThread(),
      createThread({ gitHubId: 'gh-thread-2', id: 'thread-2' })
    ]

    expect(summarize({ comments, reviewThreads }).cells[2]).toEqual({
      detail: 'Across 2 files',
      key: 'comments',
      label: 'Comments',
      tab: 'tasks',
      tone: 'warning',
      value: '2 unresolved'
    })
  })

  it('reports conflicts on the branch', () => {
    const mergeOptions = createMergeOptions({
      mergeable: false,
      mergeableState: 'dirty'
    })

    expect(summarize({ mergeOptions }).cells[3]).toEqual({
      detail: 'Conflicts with main',
      key: 'branch',
      label: 'Branch',
      tab: 'tasks',
      tone: 'danger',
      value: 'Has conflicts'
    })
  })
})
