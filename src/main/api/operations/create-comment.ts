import { type RestEndpointMethodTypes } from '@octokit/rest'
import { Context, Effect } from 'effect'
import { eq } from 'drizzle-orm'

import {
  comments,
  type Comment,
  type NewComment
} from '../../../database/schema'
import { Database } from '../../../sync/services/database'
import { generateId, normalizeCommentBody } from '../../../sync/shared/utils'
import { GitHubApi } from '../../services/github-api'
import { Repository } from '../../services/repository'

export interface CreateCommentInput {
  readonly body: string
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly reviewCommentId?: number
  readonly token: string
}

type IssueCommentData =
  RestEndpointMethodTypes['issues']['createComment']['response']['data']

type ReviewCommentReplyData =
  RestEndpointMethodTypes['pulls']['createReplyForReviewComment']['response']['data']

const userFields = (
  user: { avatar_url?: string; login?: string } | null | undefined
) => ({
  userAvatarUrl: user?.avatar_url ?? null,
  userLogin: user?.login ?? null
})

const parentLinkFields = (parentComment: Comment | null) => ({
  gitHubReviewThreadId: parentComment?.gitHubReviewThreadId ?? null,
  parentCommentGitHubId: parentComment?.gitHubId ?? null,
  reviewId: parentComment?.reviewId ?? null
})

const toIssueCommentRow = (
  data: IssueCommentData,
  pullRequestId: string
): NewComment => ({
  body: normalizeCommentBody(data.body ?? ''),
  bodyHtml: data.body_html ?? null,
  commitId: null,
  deletedAt: null,
  diffHunk: null,
  gitHubCreatedAt: data.created_at,
  gitHubId: data.node_id,
  gitHubNumericId: data.id,
  gitHubReviewId: null,
  gitHubReviewThreadId: null,
  gitHubUpdatedAt: data.updated_at,
  id: generateId(),
  line: null,
  originalCommitId: null,
  originalLine: null,
  parentCommentGitHubId: null,
  path: null,
  pullRequestId,
  reviewId: null,
  syncedAt: new Date().toISOString(),
  url: data.html_url,
  ...userFields(data.user)
})

const toReplyCommentRow = (
  data: ReviewCommentReplyData,
  parentComment: Comment | null,
  pullRequestId: string
): NewComment => ({
  body: normalizeCommentBody(data.body),
  bodyHtml: data.body_html ?? null,
  commitId: data.commit_id ?? null,
  deletedAt: null,
  diffHunk: data.diff_hunk ?? null,
  gitHubCreatedAt: data.created_at,
  gitHubId: data.node_id,
  gitHubNumericId: data.id,
  gitHubReviewId: data.pull_request_review_id
    ? String(data.pull_request_review_id)
    : null,
  gitHubUpdatedAt: data.updated_at,
  id: generateId(),
  line: data.line ?? null,
  originalCommitId: data.original_commit_id ?? null,
  originalLine: data.original_line ?? null,
  path: data.path,
  pullRequestId,
  syncedAt: new Date().toISOString(),
  url: data.html_url,
  ...parentLinkFields(parentComment),
  ...userFields(data.user)
})

const postIssueComment = (
  gitHub: Context.Tag.Service<GitHubApi>,
  input: CreateCommentInput
) =>
  gitHub.run(
    input.token,
    'issues.createComment',
    async (octokit) => {
      const response = await octokit.rest.issues.createComment({
        body: input.body,
        issue_number: input.pullNumber,
        owner: input.owner,
        repo: input.repo
      })

      return response.data
    },
    { fallbackMessage: 'Failed to create comment' }
  )

const postReviewCommentReply = (
  gitHub: Context.Tag.Service<GitHubApi>,
  input: CreateCommentInput,
  reviewCommentId: number
) =>
  gitHub.run(
    input.token,
    'pulls.createReplyForReviewComment',
    async (octokit) => {
      const response = await octokit.rest.pulls.createReplyForReviewComment({
        body: input.body,
        comment_id: reviewCommentId,
        owner: input.owner,
        pull_number: input.pullNumber,
        repo: input.repo
      })

      return response.data
    },
    { fallbackMessage: 'Failed to create comment' }
  )

const findParentComment = (reviewCommentId: number) =>
  Effect.flatMap(Database, (database) =>
    database.use(
      'createComment.findParent',
      (db) =>
        db
          .select()
          .from(comments)
          .where(eq(comments.gitHubNumericId, reviewCommentId))
          .get() ?? null
    )
  )

const persistComment = (
  newComment: NewComment,
  operations: { readonly insert: string; readonly read: string }
) =>
  Effect.gen(function* () {
    const database = yield* Database

    yield* database.use(operations.insert, (db) => {
      db.insert(comments).values(newComment).run()
    })

    const created = yield* database.use(operations.read, (db) =>
      db.select().from(comments).where(eq(comments.id, newComment.id)).get()
    )

    return created as Comment
  })

const createIssueComment = (
  input: CreateCommentInput,
  gitHub: Context.Tag.Service<GitHubApi>,
  pullRequestId: string
) =>
  Effect.gen(function* () {
    const data = yield* postIssueComment(gitHub, input)
    const newComment = toIssueCommentRow(data, pullRequestId)

    return yield* persistComment(newComment, {
      insert: 'createComment.insertIssueComment',
      read: 'createComment.readIssueComment'
    })
  })

const createReplyComment = (
  input: CreateCommentInput,
  gitHub: Context.Tag.Service<GitHubApi>,
  pullRequestId: string,
  reviewCommentId: number
) =>
  Effect.gen(function* () {
    const data = yield* postReviewCommentReply(gitHub, input, reviewCommentId)
    const parentComment = yield* findParentComment(reviewCommentId)
    const newComment = toReplyCommentRow(data, parentComment, pullRequestId)

    return yield* persistComment(newComment, {
      insert: 'createComment.insertReply',
      read: 'createComment.readReply'
    })
  })

export const createComment = (input: CreateCommentInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const gitHub = yield* GitHubApi

    const pullRequest = yield* repository.requirePullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    if (input.reviewCommentId !== undefined) {
      return yield* createReplyComment(
        input,
        gitHub,
        pullRequest.id,
        input.reviewCommentId
      )
    }

    return yield* createIssueComment(input, gitHub, pullRequest.id)
  })
