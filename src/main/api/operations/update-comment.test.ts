import { Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Comment, PullRequest } from '../../../database/schema'
import { Database } from '../../../sync/services/database'
import { GitHubApi } from '../../services/github-api'
import { Repository } from '../../services/repository'
import { octokitErrorOf } from '../octokit-error'
import {
  createPullRequestFixture,
  createRepositoryStub
} from './__test-helpers__/fixtures'
import { updateComment } from './update-comment'

const octokitMocks = vi.hoisted(() => ({
  updateIssueComment: vi.fn(),
  updateReviewComment: vi.fn()
}))

const fakeOctokit = {
  rest: {
    issues: { updateComment: octokitMocks.updateIssueComment },
    pulls: { updateReviewComment: octokitMocks.updateReviewComment }
  }
}

const makeGitHubApiLayer = () =>
  Layer.succeed(GitHubApi, {
    run: (_token, operation, call, options) =>
      Effect.tryPromise({
        try: () => call(fakeOctokit as never),
        catch: octokitErrorOf(operation, options)
      })
  })

interface DatabaseState {
  stored: Comment | null
  updates: Partial<Comment>[]
}

const makeFakeDb = (state: DatabaseState) => ({
  select: () => ({
    from: () => ({
      where: () => ({
        get: () => state.stored ?? undefined
      })
    })
  }),
  update: () => ({
    set: (values: Partial<Comment>) => ({
      where: () => ({
        run: () => {
          state.updates.push(values)
        }
      })
    })
  })
})

const makeDatabaseLayer = (state: DatabaseState) =>
  Layer.succeed(Database, {
    use: <A>(_operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(makeFakeDb(state) as never))
  })

const issueCommentFixture: Comment = {
  body: '- [ ] Ship it',
  bodyHtml: null,
  commitId: null,
  deletedAt: null,
  diffHunk: null,
  gitHubCreatedAt: '2026-01-01T00:00:00Z',
  gitHubId: 'IC_100',
  gitHubNumericId: 100,
  gitHubReviewId: null,
  gitHubReviewThreadId: null,
  gitHubUpdatedAt: '2026-01-01T00:00:00Z',
  id: 'c_100',
  line: null,
  originalCommitId: null,
  originalLine: null,
  parentCommentGitHubId: null,
  path: null,
  pullRequestId: 'pr_1',
  reviewId: null,
  syncedAt: '2026-01-01T00:00:00Z',
  url: 'https://github.com/octocat/demo/pull/42#issuecomment-100',
  userAvatarUrl: null,
  userLogin: 'octocat'
}

const reviewCommentFixture: Comment = {
  ...issueCommentFixture,
  gitHubId: 'PRRC_200',
  gitHubNumericId: 200,
  gitHubReviewId: '555',
  gitHubReviewThreadId: 'PRRT_1',
  id: 'c_200',
  path: 'src/index.ts'
}

const updatedResponse = {
  body: '- [x] Ship it',
  body_html: '<ul><li>Ship it</li></ul>',
  updated_at: '2026-06-01T00:00:00Z'
}

const runUpdateComment = (
  commentId: string,
  state: DatabaseState,
  pullRequest: PullRequest | null = createPullRequestFixture()
) =>
  Effect.provide(
    updateComment({ body: '- [x] Ship it', commentId, token: 'token_123' }),
    Layer.mergeAll(
      makeDatabaseLayer(state),
      Layer.succeed(Repository, createRepositoryStub(pullRequest)),
      makeGitHubApiLayer()
    )
  )

describe('updateComment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('updates an issue comment and stores the new body', async () => {
    const state: DatabaseState = { stored: issueCommentFixture, updates: [] }

    octokitMocks.updateIssueComment.mockResolvedValue({ data: updatedResponse })

    const updated = await Effect.runPromise(runUpdateComment('c_100', state))

    expect(octokitMocks.updateIssueComment).toHaveBeenCalledWith({
      body: '- [x] Ship it',
      comment_id: 100,
      owner: 'octocat',
      repo: 'demo'
    })
    expect(octokitMocks.updateReviewComment).not.toHaveBeenCalled()
    expect(updated).toEqual({
      ...issueCommentFixture,
      body: '- [x] Ship it',
      bodyHtml: '<ul><li>Ship it</li></ul>',
      gitHubUpdatedAt: '2026-06-01T00:00:00Z',
      syncedAt: expect.any(String)
    })
    expect(state.updates).toEqual([
      {
        body: '- [x] Ship it',
        bodyHtml: '<ul><li>Ship it</li></ul>',
        gitHubUpdatedAt: '2026-06-01T00:00:00Z',
        syncedAt: expect.any(String)
      }
    ])
  })

  it('updates a review comment through the pulls API', async () => {
    const state: DatabaseState = { stored: reviewCommentFixture, updates: [] }

    octokitMocks.updateReviewComment.mockResolvedValue({
      data: updatedResponse
    })

    await Effect.runPromise(runUpdateComment('c_200', state))

    expect(octokitMocks.updateReviewComment).toHaveBeenCalledWith({
      body: '- [x] Ship it',
      comment_id: 200,
      owner: 'octocat',
      repo: 'demo'
    })
    expect(octokitMocks.updateIssueComment).not.toHaveBeenCalled()
  })

  it('fails without calling GitHub when the comment is unknown', async () => {
    const state: DatabaseState = { stored: null, updates: [] }

    const exit = await Effect.runPromiseExit(runUpdateComment('missing', state))

    expect(Exit.isFailure(exit)).toEqual(true)
    expect(octokitMocks.updateIssueComment).not.toHaveBeenCalled()
    expect(state.updates).toEqual([])
  })
})
