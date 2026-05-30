import { describe, expect, it } from 'vitest'

import {
  createCheck,
  createCommentFixture,
  createMergeOptions,
  createReviewFixture,
  createThread
} from './__test-helpers__/factories'
import { buildTaskGroups, countOpenBlockers } from './use-derived-tasks'

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

  it('skips review threads whose anchor comment is outdated', () => {
    const anchor = createCommentFixture({
      gitHubReviewThreadId: 'gh-thread-1',
      line: null,
      path: 'src/app.ts',
      userLogin: 'alice'
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
    expect(agentsGroup?.tasks).toEqual([])
  })

  it('skips resolved review threads', () => {
    const anchor = createCommentFixture({
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
    const anchor = createCommentFixture({
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
    const anchor = createCommentFixture({
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
    const review = createReviewFixture({
      authorLogin: 'alice',
      state: 'CHANGES_REQUESTED'
    })

    const anchor = createCommentFixture({
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
    const review = createReviewFixture({
      authorLogin: 'alice',
      state: 'APPROVED'
    })

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

  it('emits running checks as info-severity tasks with a running status', () => {
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
        severity: 'info',
        status: 'running',
        title: 'tests'
      }
    ])
  })

  it('drops the required-checks requirement since the running checks already convey it', () => {
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
      mergeOptions: createMergeOptions({
        requirements: [
          {
            description: 'Required checks must pass before merging.',
            key: 'required-checks',
            label: 'Required checks',
            satisfied: false
          }
        ]
      }),
      reviewThreads: [],
      reviews: []
    })

    const ciGroup = groups.find((group) => group.key === 'ci')

    expect(ciGroup?.tasks.map((task) => task.id)).toEqual(['check-check-2'])
  })

  it('orders other unsatisfied requirements above check tasks in the CI group', () => {
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

    expect(ciGroup?.tasks.map((task) => task.id)).toEqual([
      'requirement-up-to-date',
      'check-check-2'
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

    const anchor = createCommentFixture({
      gitHubReviewThreadId: 'gh-thread-1',
      userLogin: 'bob'
    })

    const thread = createThread({ gitHubId: 'gh-thread-1' })

    const groups = buildTaskGroups({
      checks: [failingCheck],
      comments: [anchor],
      mergeOptions: createMergeOptions({ mergeableState: 'dirty' }),
      reviewThreads: [thread],
      reviews: [createReviewFixture({ state: 'CHANGES_REQUESTED' })]
    })

    expect(countOpenBlockers(groups)).toEqual(4)
  })

  it('returns zero when no tasks are blockers', () => {
    const groups = buildTaskGroups({
      checks: [createCheck()],
      comments: [],
      mergeOptions: createMergeOptions(),
      reviewThreads: [],
      reviews: [createReviewFixture({ state: 'APPROVED' })]
    })

    expect(countOpenBlockers(groups)).toEqual(0)
  })
})
