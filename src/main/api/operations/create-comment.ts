import { Octokit } from '@octokit/rest'
import { Effect } from 'effect'
import { eq } from 'drizzle-orm'

import {
  comments,
  type Comment,
  type NewComment
} from '../../../database/schema'
import { Database } from '../../../sync/services/database'
import { generateId, normalizeCommentBody } from '../../../sync/shared/utils'
import { Repository } from '../../services/repository'
import { OctokitError } from '../errors'

export interface CreateCommentInput {
  readonly body: string
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly reviewCommentId?: number
  readonly token: string
}

const octokitErrorOf = (operation: string) => (cause: unknown) => {
  const status =
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    typeof (cause as { status: unknown }).status === 'number'
      ? (cause as { status: number }).status
      : 500
  const message =
    cause instanceof Error ? cause.message : 'Failed to create comment'

  return new OctokitError({ message, operation, status })
}

export const createComment = (input: CreateCommentInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database

    const pullRequest = yield* repository.requirePullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    const octokit = new Octokit({ auth: input.token })

    if (input.reviewCommentId !== undefined) {
      const reviewCommentId = input.reviewCommentId

      const data = yield* Effect.tryPromise({
        try: async () => {
          const response = await octokit.rest.pulls.createReplyForReviewComment(
            {
              body: input.body,
              comment_id: reviewCommentId,
              owner: input.owner,
              pull_number: input.pullNumber,
              repo: input.repo
            }
          )

          return response.data
        },
        catch: octokitErrorOf('pulls.createReplyForReviewComment')
      })

      const parentComment = yield* database.use(
        'createComment.findParent',
        (db) =>
          db
            .select()
            .from(comments)
            .where(eq(comments.gitHubNumericId, reviewCommentId))
            .get() ?? null
      )

      const now = new Date().toISOString()
      const newComment: NewComment = {
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
        gitHubReviewThreadId: parentComment?.gitHubReviewThreadId ?? null,
        gitHubUpdatedAt: data.updated_at,
        id: generateId(),
        line: data.line ?? null,
        originalCommitId: data.original_commit_id ?? null,
        originalLine: data.original_line ?? null,
        parentCommentGitHubId: parentComment?.gitHubId ?? null,
        path: data.path,
        pullRequestId: pullRequest.id,
        reviewId: parentComment?.reviewId ?? null,
        syncedAt: now,
        url: data.html_url,
        userAvatarUrl: data.user?.avatar_url ?? null,
        userLogin: data.user?.login ?? null
      }

      yield* database.use('createComment.insertReply', (db) => {
        db.insert(comments).values(newComment).run()
      })

      const created = yield* database.use('createComment.readReply', (db) =>
        db.select().from(comments).where(eq(comments.id, newComment.id)).get()
      )

      return created as Comment
    }

    const data = yield* Effect.tryPromise({
      try: async () => {
        const response = await octokit.rest.issues.createComment({
          body: input.body,
          issue_number: input.pullNumber,
          owner: input.owner,
          repo: input.repo
        })

        return response.data
      },
      catch: octokitErrorOf('issues.createComment')
    })

    const now = new Date().toISOString()
    const newComment: NewComment = {
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
      pullRequestId: pullRequest.id,
      reviewId: null,
      syncedAt: now,
      url: data.html_url,
      userAvatarUrl: data.user?.avatar_url ?? null,
      userLogin: data.user?.login ?? null
    }

    yield* database.use('createComment.insertIssueComment', (db) => {
      db.insert(comments).values(newComment).run()
    })

    const created = yield* database.use(
      'createComment.readIssueComment',
      (db) =>
        db.select().from(comments).where(eq(comments.id, newComment.id)).get()
    )

    return created as Comment
  })
