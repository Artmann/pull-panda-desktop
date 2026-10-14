import { describe, expect, it } from 'vitest'

import {
  createCheck,
  createCommentFixture,
  createMergeOptions,
  createReviewFixture,
  createThread
} from './__test-helpers__/factories'
import type { TaskGroup, TaskGroupKey } from './task-types'
import { buildTaskGroups } from './use-derived-tasks'

type BuildInput = Parameters<typeof buildTaskGroups>[0]

function build(overrides: Partial<BuildInput> = {}): TaskGroup[] {
  return buildTaskGroups({
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
  })
}

function tasksIn(groups: TaskGroup[], key: TaskGroupKey) {
  return groups.find((group) => group.key === key)?.tasks
}

describe('buildTaskGroups', () => {
  it('returns the four groups in order', () => {
    expect(build().map((group) => [group.key, group.label])).toEqual([
      ['checks', 'Checks'],
      ['reviews', 'Reviews'],
      ['conversations', 'Conversations'],
      ['branch', 'Branch']
    ])
  })

  it('answers every group with a done row when nothing is wrong', () => {
    const groups = build()

    expect(groups.map((group) => group.tasks)).toEqual([
      [
        {
          id: 'check-summary-none',
          kind: 'simple',
          meta: 'Nothing runs on this branch',
          severity: 'done',
          title: 'No checks'
        }
      ],
      [
        {
          action: { type: 'assign-reviewers' },
          id: 'review-none',
          kind: 'simple',
          meta: 'Branch protection on main does not require approvals',
          severity: 'done',
          title: 'No review required'
        }
      ],
      [
        {
          id: 'conversation-summary',
          kind: 'simple',
          meta: 'No comments yet',
          severity: 'done',
          title: 'No unresolved threads'
        }
      ],
      [
        {
          id: 'branch-no-conflicts',
          kind: 'simple',
          meta: 'Up to date · 2 commits',
          severity: 'done',
          title: 'No conflicts with main'
        }
      ]
    ])
  })

  describe('checks', () => {
    it('lists a failing check as a blocker with a link to its logs', () => {
      const failing = createCheck({
        conclusion: 'failure',
        message: '2 failing in engine/file.test.ts\nmore output',
        name: 'Test'
      })
      const passing = createCheck({
        gitHubId: 'gh-check-2',
        id: 'check-2',
        name: 'Build'
      })

      expect(tasksIn(build({ checks: [failing, passing] }), 'checks')).toEqual(
        [
          {
            action: {
              label: 'View logs',
              type: 'open-url',
              url: 'https://example.com/checks/1'
            },
            detailsUrl: 'https://example.com/checks/1',
            id: 'check-check-1',
            kind: 'check',
            message: '2 failing in engine/file.test.ts\nmore output',
            meta: '2 failing in engine/file.test.ts',
            severity: 'blocker',
            title: 'Test is failing'
          },
          {
            id: 'check-summary-passed',
            kind: 'simple',
            meta: 'Build',
            severity: 'done',
            title: '1 other check passed'
          }
        ]
      )
    })

    it('falls back to the suite and conclusion when a failing check says nothing', () => {
      const failing = createCheck({ conclusion: 'timed_out', name: 'e2e' })

      expect(tasksIn(build({ checks: [failing] }), 'checks')?.[0]).toEqual({
        action: {
          label: 'View logs',
          type: 'open-url',
          url: 'https://example.com/checks/1'
        },
        detailsUrl: 'https://example.com/checks/1',
        id: 'check-check-1',
        kind: 'check',
        message: null,
        meta: 'CI · Timed out',
        severity: 'blocker',
        title: 'e2e is failing'
      })
    })

    it('marks a running check as in progress', () => {
      const running = createCheck({
        conclusion: null,
        name: 'e2e',
        state: 'in_progress'
      })

      expect(tasksIn(build({ checks: [running] }), 'checks')).toEqual([
        {
          id: 'check-check-1',
          kind: 'simple',
          meta: 'CI · running',
          severity: 'info',
          status: 'running',
          title: 'e2e is still running'
        }
      ])
    })

    it('rolls every passing check into one done row', () => {
      const checks = [
        createCheck({ id: 'a', name: 'lint' }),
        createCheck({ id: 'b', name: 'build' })
      ]

      expect(tasksIn(build({ checks }), 'checks')).toEqual([
        {
          id: 'check-summary-passed',
          kind: 'simple',
          meta: '2 of 2 successful',
          severity: 'done',
          title: 'All checks passed'
        }
      ])
    })

    it('counts only the latest run of a re-run check', () => {
      const oldRun = createCheck({
        conclusion: 'failure',
        id: 'old',
        syncedAt: '2026-01-01T00:00:00Z'
      })
      const newRun = createCheck({
        id: 'new',
        syncedAt: '2026-01-02T00:00:00Z'
      })

      expect(
        tasksIn(build({ checks: [oldRun, newRun] }), 'checks')?.map(
          (task) => task.title
        )
      ).toEqual(['All checks passed'])
    })
  })

  describe('reviews', () => {
    it('lists changes requested as a blocker that opens the review', () => {
      const review = createReviewFixture({
        authorLogin: 'mira',
        state: 'CHANGES_REQUESTED',
        url: 'https://example.com/review/1'
      })

      expect(tasksIn(build({ reviews: [review] }), 'reviews')).toEqual([
        {
          action: {
            label: 'Open',
            type: 'open-url',
            url: 'https://example.com/review/1'
          },
          authorAvatarUrl: 'https://example.com/avatar.png',
          authorLogin: 'mira',
          id: 'review-state-review-1',
          kind: 'review-state',
          meta: 'Address the feedback, then re-request a review',
          severity: 'blocker',
          summary:
            'Address the requested changes and re-request review to clear the changes-requested state.',
          title: 'Changes requested by mira'
        }
      ])
    })

    it('turns an unmet approval rule into a blocker', () => {
      const mergeOptions = createMergeOptions({
        requirements: [
          {
            description: 'At least 1 approving review is required.',
            key: 'approving-reviews',
            label: '1 approval required',
            satisfied: false
          }
        ]
      })

      expect(tasksIn(build({ mergeOptions }), 'reviews')).toEqual([
        {
          id: 'requirement-approving-reviews',
          kind: 'simple',
          meta: 'At least 1 approving review is required.',
          severity: 'blocker',
          status: 'pending',
          title: '1 approval required'
        }
      ])
    })

    it('waits on requested reviewers who have not reviewed yet', () => {
      const groups = build({
        pullRequest: {
          baseRefName: 'main',
          requestedReviewers: [
            { avatarUrl: 'https://example.com/m.png', login: 'matheus' }
          ],
          reviewDecision: null
        }
      })

      expect(tasksIn(groups, 'reviews')).toEqual([
        {
          authorAvatarUrl: 'https://example.com/m.png',
          authorLogin: 'matheus',
          id: 'review-waiting-matheus',
          kind: 'simple',
          meta: 'Review requested',
          severity: 'info',
          status: 'running',
          title: 'Waiting on matheus'
        }
      ])
    })

    it('names the people who approved', () => {
      const reviews = [
        createReviewFixture({ authorLogin: 'alice', id: 'a', gitHubId: 'a' }),
        createReviewFixture({ authorLogin: 'bob', id: 'b', gitHubId: 'b' })
      ]

      expect(tasksIn(build({ reviews }), 'reviews')).toEqual([
        {
          id: 'review-approved-summary',
          kind: 'simple',
          meta: 'Latest reviews',
          severity: 'done',
          title: 'Approved by alice and bob'
        }
      ])
    })
  })

  describe('conversations', () => {
    it('lists unresolved threads from people and bots with a resolve action', () => {
      const human = createCommentFixture({
        body: 'Rename   this please.',
        gitHubReviewThreadId: 'gh-thread-1',
        userLogin: 'bob'
      })
      const bot = createCommentFixture({
        body: 'Consider extracting this helper.',
        gitHubId: 'gh-comment-2',
        gitHubReviewThreadId: 'gh-thread-2',
        id: 'comment-2',
        line: 4,
        path: 'src/util.ts',
        userLogin: 'coderabbitai'
      })
      const threads = [
        createThread({ gitHubId: 'gh-thread-1' }),
        createThread({ gitHubId: 'gh-thread-2', id: 'thread-2' })
      ]

      const tasks = tasksIn(
        build({ comments: [human, bot], reviewThreads: threads }),
        'conversations'
      )

      expect(
        tasks?.map((task) => ({
          action: task.action,
          meta: task.meta,
          severity: task.severity,
          title: task.title
        }))
      ).toEqual([
        {
          action: { type: 'resolve-thread' },
          meta: 'src/app.ts:10 · bob',
          severity: 'info',
          title: 'Rename this please.'
        },
        {
          action: { type: 'resolve-thread' },
          meta: 'src/util.ts:4 · coderabbitai',
          severity: 'info',
          title: 'Consider extracting this helper.'
        }
      ])
    })

    it('makes human threads blockers once changes are requested', () => {
      const anchor = createCommentFixture({ userLogin: 'bob' })
      const review = createReviewFixture({
        authorLogin: 'bob',
        state: 'CHANGES_REQUESTED'
      })

      const tasks = tasksIn(
        build({
          comments: [anchor],
          reviewThreads: [createThread()],
          reviews: [review]
        }),
        'conversations'
      )

      expect(tasks?.map((task) => task.severity)).toEqual(['blocker'])
    })

    it('skips resolved and outdated threads', () => {
      const outdated = createCommentFixture({ line: null })
      const resolved = createCommentFixture({
        gitHubId: 'gh-comment-2',
        gitHubReviewThreadId: 'gh-thread-2',
        id: 'comment-2'
      })

      const tasks = tasksIn(
        build({
          comments: [outdated, resolved],
          reviewThreads: [
            createThread(),
            createThread({
              gitHubId: 'gh-thread-2',
              id: 'thread-2',
              isResolved: true
            })
          ]
        }),
        'conversations'
      )

      expect(tasks?.map((task) => task.id)).toEqual(['conversation-summary'])
    })

    it('describes the comments when no thread is open', () => {
      const botComment = createCommentFixture({
        gitHubReviewThreadId: null,
        path: null,
        userLogin: 'vercel[bot]'
      })

      expect(
        tasksIn(build({ comments: [botComment] }), 'conversations')?.[0]?.meta
      ).toEqual('1 bot comment')
    })
  })

  describe('branch', () => {
    it('reports conflicts as a blocker without a no-conflicts row', () => {
      const mergeOptions = createMergeOptions({
        mergeable: false,
        mergeableState: 'dirty'
      })

      expect(tasksIn(build({ mergeOptions }), 'branch')).toEqual([
        {
          description:
            'This branch has conflicts with the base branch that must be resolved before it can be merged.',
          id: 'requirement-merge-conflicts',
          kind: 'requirement',
          meta: 'Conflicts with main',
          severity: 'blocker',
          title: 'Resolve merge conflicts'
        }
      ])
    })

    it('warns when the branch is behind', () => {
      const mergeOptions = createMergeOptions({ mergeableState: 'behind' })

      expect(
        tasksIn(build({ mergeOptions }), 'branch')?.map((task) => [
          task.severity,
          task.title,
          task.meta
        ])
      ).toEqual([
        ['warning', 'Behind main', 'Update the branch before merging'],
        ['done', 'No conflicts with main', 'Behind · 2 commits']
      ])
    })

    it('lists other unmet branch rules, such as leaving draft', () => {
      const mergeOptions = createMergeOptions({
        requirements: [
          {
            description: 'Draft pull requests cannot be merged.',
            key: 'not-draft',
            label: 'Not a draft',
            satisfied: false
          }
        ]
      })

      expect(
        tasksIn(build({ mergeOptions }), 'branch')?.map((task) => task.title)
      ).toEqual(['Mark pull request as ready for review', 'No conflicts with main'])
    })

    it('says it is still checking before GitHub reports the merge state', () => {
      expect(tasksIn(build({ mergeOptions: null }), 'branch')).toEqual([
        {
          id: 'branch-unknown',
          kind: 'simple',
          meta: 'Waiting for GitHub to report the merge state',
          severity: 'info',
          title: 'Checking for conflicts'
        }
      ])
    })
  })
})
