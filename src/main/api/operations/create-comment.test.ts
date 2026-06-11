import { Effect, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Comment,
  NewComment,
  PullRequest
} from '../../../database/schema'
import { NotFoundError } from '../../../sync/errors'
import { Database } from '../../../sync/services/database'
import { Repository } from '../../services/repository'
import { createComment, type CreateCommentInput } from './create-comment'

const octokitMocks = vi.hoisted(() => ({
  createIssueComment: vi.fn(),
  createReplyForReviewComment: vi.fn()
}))

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = {
      issues: { createComment: octokitMocks.createIssueComment },
      pulls: {
        createReplyForReviewComment: octokitMocks.createReplyForReviewComment
      }
    }
  }
}))

interface DatabaseState {
  inserted: NewComment[]
  parentComment: Comment | null
}

// Fake drizzle db: inserts are recorded, the parent-comment lookup returns the
// seeded parent, and every other select returns the most recently inserted
// row (the read-back after insert).
const makeFakeDb = (operation: string, state: DatabaseState) => ({
  insert: () => ({
    values: (values: NewComment) => ({
      run: () => {
        state.inserted.push(values)
      }
    })
  }),
  select: () => ({
    from: () => ({
      where: () => ({
        get: () => {
          if (operation === 'createComment.findParent') {
            return state.parentComment ?? undefined
          }

          return state.inserted[state.inserted.length - 1]
        }
      })
    })
  })
})

const makeDatabaseLayer = (state: DatabaseState) =>
  Layer.succeed(Database, {
    use: <A>(operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(makeFakeDb(operation, state) as never))
  })

const makeRepositoryLayer = (pullRequest: PullRequest | null) => {
  const requirePullRequest = () =>
    pullRequest
      ? Effect.succeed(pullRequest)
      : Effect.fail(
          new NotFoundError({
            resourceId: 'octocat/demo#42',
            route: 'repository.requirePullRequestByCoords'
          })
        )

  return Layer.succeed(Repository, {
    findCommentById: () => Effect.succeed(null),
    findPullRequestByCoords: () => Effect.succeed(pullRequest),
    findPullRequestById: () => Effect.succeed(pullRequest),
    findReviewById: () => Effect.succeed(null),
    findReviewThreadById: () => Effect.succeed(null),
    requirePullRequestByCoords: requirePullRequest,
    requirePullRequestById: requirePullRequest,
    upsertReview: () => Effect.die('upsertReview is not used in these tests')
  })
}

const pullRequestFixture: PullRequest = {
  assignees: null,
  authorAvatarUrl: null,
  authorLogin: 'octocat',
  body: null,
  bodyHtml: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  detailsSyncedAt: null,
  headRefName: 'feature',
  id: 'pr_1',
  isAssignee: false,
  isAuthor: true,
  isDraft: false,
  isReviewer: false,
  labels: null,
  mergedAt: null,
  number: 42,
  repositoryName: 'demo',
  repositoryOwner: 'octocat',
  requestedReviewers: null,
  state: 'open',
  syncedAt: '2026-01-01T00:00:00Z',
  title: 'Demo PR',
  updatedAt: '2026-01-01T00:00:00Z',
  url: 'https://github.com/octocat/demo/pull/42'
}

const parentCommentFixture: Comment = {
  body: 'parent body',
  bodyHtml: null,
  commitId: 'commit_sha',
  deletedAt: null,
  diffHunk: '@@ -1 +1 @@',
  gitHubCreatedAt: '2026-01-01T00:00:00Z',
  gitHubId: 'PRRC_parent',
  gitHubNumericId: 7,
  gitHubReviewId: '555',
  gitHubReviewThreadId: 'PRRT_1',
  gitHubUpdatedAt: '2026-01-01T00:00:00Z',
  id: 'c_parent',
  line: 10,
  originalCommitId: 'orig_sha',
  originalLine: 9,
  parentCommentGitHubId: null,
  path: 'src/index.ts',
  pullRequestId: 'pr_1',
  reviewId: 'rev_1',
  syncedAt: '2026-01-01T00:00:00Z',
  url: 'https://github.com/octocat/demo/pull/42#discussion_r7',
  userAvatarUrl: 'https://example.com/a.png',
  userLogin: 'octocat'
}

const baseInput: CreateCommentInput = {
  body: 'Hello world',
  owner: 'octocat',
  pullNumber: 42,
  repo: 'demo',
  token: 'token_123'
}

const issueCommentResponse = {
  body: 'Hello\r\nworld',
  body_html: '<p>Hello world</p>',
  created_at: '2026-06-01T00:00:00Z',
  html_url: 'https://github.com/octocat/demo/pull/42#issuecomment-100',
  id: 100,
  node_id: 'IC_100',
  updated_at: '2026-06-01T00:00:00Z',
  user: { avatar_url: 'https://example.com/a.png', login: 'octocat' }
}

const replyCommentResponse = {
  body: 'Reply body',
  body_html: '<p>Reply body</p>',
  commit_id: 'commit_sha',
  created_at: '2026-06-01T00:00:00Z',
  diff_hunk: '@@ -1 +1 @@',
  html_url: 'https://github.com/octocat/demo/pull/42#discussion_r200',
  id: 200,
  line: 10,
  node_id: 'PRRC_200',
  original_commit_id: 'orig_sha',
  original_line: 9,
  path: 'src/index.ts',
  pull_request_review_id: 555,
  updated_at: '2026-06-01T00:00:00Z',
  user: { avatar_url: 'https://example.com/b.png', login: 'replier' }
}

const runCreateComment = (
  input: CreateCommentInput,
  state: DatabaseState,
  pullRequest: PullRequest | null = pullRequestFixture
) =>
  Effect.provide(
    createComment(input),
    Layer.mergeAll(makeDatabaseLayer(state), makeRepositoryLayer(pullRequest))
  )

describe('createComment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates an issue comment, normalizes the body, and persists the row', async () => {
    const state: DatabaseState = { inserted: [], parentComment: null }

    octokitMocks.createIssueComment.mockResolvedValue({
      data: issueCommentResponse
    })

    const created = await Effect.runPromise(runCreateComment(baseInput, state))

    expect(octokitMocks.createIssueComment).toHaveBeenCalledWith({
      body: 'Hello world',
      issue_number: 42,
      owner: 'octocat',
      repo: 'demo'
    })

    expect(state.inserted).toEqual([
      {
        body: 'Hello\nworld',
        bodyHtml: '<p>Hello world</p>',
        commitId: null,
        deletedAt: null,
        diffHunk: null,
        gitHubCreatedAt: '2026-06-01T00:00:00Z',
        gitHubId: 'IC_100',
        gitHubNumericId: 100,
        gitHubReviewId: null,
        gitHubReviewThreadId: null,
        gitHubUpdatedAt: '2026-06-01T00:00:00Z',
        id: expect.any(String),
        line: null,
        originalCommitId: null,
        originalLine: null,
        parentCommentGitHubId: null,
        path: null,
        pullRequestId: 'pr_1',
        reviewId: null,
        syncedAt: expect.any(String),
        url: 'https://github.com/octocat/demo/pull/42#issuecomment-100',
        userAvatarUrl: 'https://example.com/a.png',
        userLogin: 'octocat'
      }
    ])

    expect(created).toEqual(state.inserted[0])
  })

  it('creates a reply comment linked to its locally stored parent', async () => {
    const state: DatabaseState = {
      inserted: [],
      parentComment: parentCommentFixture
    }

    octokitMocks.createReplyForReviewComment.mockResolvedValue({
      data: replyCommentResponse
    })

    const created = await Effect.runPromise(
      runCreateComment({ ...baseInput, reviewCommentId: 7 }, state)
    )

    expect(octokitMocks.createReplyForReviewComment).toHaveBeenCalledWith({
      body: 'Hello world',
      comment_id: 7,
      owner: 'octocat',
      pull_number: 42,
      repo: 'demo'
    })

    expect(state.inserted).toEqual([
      {
        body: 'Reply body',
        bodyHtml: '<p>Reply body</p>',
        commitId: 'commit_sha',
        deletedAt: null,
        diffHunk: '@@ -1 +1 @@',
        gitHubCreatedAt: '2026-06-01T00:00:00Z',
        gitHubId: 'PRRC_200',
        gitHubNumericId: 200,
        gitHubReviewId: '555',
        gitHubReviewThreadId: 'PRRT_1',
        gitHubUpdatedAt: '2026-06-01T00:00:00Z',
        id: expect.any(String),
        line: 10,
        originalCommitId: 'orig_sha',
        originalLine: 9,
        parentCommentGitHubId: 'PRRC_parent',
        path: 'src/index.ts',
        pullRequestId: 'pr_1',
        reviewId: 'rev_1',
        syncedAt: expect.any(String),
        url: 'https://github.com/octocat/demo/pull/42#discussion_r200',
        userAvatarUrl: 'https://example.com/b.png',
        userLogin: 'replier'
      }
    ])

    expect(created).toEqual(state.inserted[0])
  })

  it('creates a reply comment with null parent links when the parent is not stored locally', async () => {
    const state: DatabaseState = { inserted: [], parentComment: null }

    octokitMocks.createReplyForReviewComment.mockResolvedValue({
      data: { ...replyCommentResponse, pull_request_review_id: null }
    })

    await Effect.runPromise(
      runCreateComment({ ...baseInput, reviewCommentId: 7 }, state)
    )

    expect(state.inserted).toEqual([
      expect.objectContaining({
        gitHubReviewId: null,
        gitHubReviewThreadId: null,
        parentCommentGitHubId: null,
        reviewId: null
      })
    ])
  })

  it('fails with NotFoundError before calling GitHub when the pull request is unknown', async () => {
    const state: DatabaseState = { inserted: [], parentComment: null }

    const error = await Effect.runPromise(
      Effect.flip(runCreateComment(baseInput, state, null))
    )

    expect(error).toEqual(
      new NotFoundError({
        resourceId: 'octocat/demo#42',
        route: 'repository.requirePullRequestByCoords'
      })
    )
    expect(octokitMocks.createIssueComment).not.toHaveBeenCalled()
    expect(state.inserted).toEqual([])
  })

  it('classifies octokit failures that carry a status as an OctokitError with that status', async () => {
    const state: DatabaseState = { inserted: [], parentComment: null }

    octokitMocks.createIssueComment.mockRejectedValue(
      Object.assign(new Error('Validation Failed'), { status: 422 })
    )

    const error = await Effect.runPromise(
      Effect.flip(runCreateComment(baseInput, state))
    )

    if (error._tag !== 'OctokitError') {
      throw new Error(`Expected OctokitError, got ${error._tag}`)
    }

    expect({
      message: error.message,
      operation: error.operation,
      status: error.status
    }).toEqual({
      message: 'Validation Failed',
      operation: 'issues.createComment',
      status: 422
    })
    expect(state.inserted).toEqual([])
  })

  it('falls back to status 500 and a generic message for non-Error failures', async () => {
    const state: DatabaseState = {
      inserted: [],
      parentComment: parentCommentFixture
    }

    octokitMocks.createReplyForReviewComment.mockRejectedValue('boom')

    const error = await Effect.runPromise(
      Effect.flip(runCreateComment({ ...baseInput, reviewCommentId: 7 }, state))
    )

    if (error._tag !== 'OctokitError') {
      throw new Error(`Expected OctokitError, got ${error._tag}`)
    }

    expect({
      message: error.message,
      operation: error.operation,
      status: error.status
    }).toEqual({
      message: 'Failed to create comment',
      operation: 'pulls.createReplyForReviewComment',
      status: 500
    })
    expect(state.inserted).toEqual([])
  })
})
