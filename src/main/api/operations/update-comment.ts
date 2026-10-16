import { Context, Effect } from 'effect'
import { eq } from 'drizzle-orm'

import { comments, type Comment } from '../../../database/schema'
import { NotFoundError } from '../../../sync/errors'
import { Database } from '../../../sync/services/database'
import {
  localWriteKeys,
  trackLocalWrite
} from '../../../sync/shared/local-writes'
import { normalizeCommentBody } from '../../../sync/shared/utils'
import { GitHubApi } from '../../services/github-api'
import { Repository } from '../../services/repository'

export interface UpdateCommentInput {
  readonly body: string
  readonly commentId: string
  readonly token: string
}

interface UpdatedCommentData {
  readonly body?: string
  readonly body_html?: string
  readonly updated_at: string
}

interface GitHubCommentTarget {
  readonly commentNumericId: number
  readonly owner: string
  readonly repo: string
}

// Issue comments live in the pull request's conversation; everything else in
// the comments table belongs to a review and goes through the pulls API.
const isReviewComment = (comment: Comment): boolean =>
  comment.path !== null ||
  comment.gitHubReviewId !== null ||
  comment.gitHubReviewThreadId !== null

const patchIssueComment = (
  gitHub: Context.Tag.Service<GitHubApi>,
  token: string,
  target: GitHubCommentTarget,
  body: string
) =>
  gitHub.run(
    token,
    'issues.updateComment',
    async (octokit): Promise<UpdatedCommentData> => {
      const response = await octokit.rest.issues.updateComment({
        body,
        comment_id: target.commentNumericId,
        owner: target.owner,
        repo: target.repo
      })

      return response.data
    },
    { fallbackMessage: 'Failed to update comment' }
  )

const patchReviewComment = (
  gitHub: Context.Tag.Service<GitHubApi>,
  token: string,
  target: GitHubCommentTarget,
  body: string
) =>
  gitHub.run(
    token,
    'pulls.updateReviewComment',
    async (octokit): Promise<UpdatedCommentData> => {
      const response = await octokit.rest.pulls.updateReviewComment({
        body,
        comment_id: target.commentNumericId,
        owner: target.owner,
        repo: target.repo
      })

      return response.data
    },
    { fallbackMessage: 'Failed to update comment' }
  )

const findComment = (commentId: string) =>
  Effect.gen(function* () {
    const database = yield* Database

    const comment = yield* database.use(
      'updateComment.find',
      (db) =>
        db.select().from(comments).where(eq(comments.id, commentId)).get() ??
        null
    )

    if (!comment || comment.gitHubNumericId === null) {
      return yield* Effect.fail(
        new NotFoundError({ resourceId: commentId, route: 'updateComment' })
      )
    }

    return { comment, commentNumericId: comment.gitHubNumericId }
  })

export const updateComment = (input: UpdateCommentInput) =>
  Effect.gen(function* () {
    const { comment, commentNumericId } = yield* findComment(input.commentId)

    // Tracked so a sync that fetched the comment before this lands does not
    // write the old body back over it.
    return yield* trackLocalWrite(
      localWriteKeys.comment(comment.gitHubId),
      sendAndStore(input, comment, commentNumericId)
    )
  })

const sendAndStore = (
  input: UpdateCommentInput,
  comment: Comment,
  commentNumericId: number
) =>
  Effect.gen(function* () {
    const database = yield* Database
    const gitHub = yield* GitHubApi
    const repository = yield* Repository

    const pullRequest = yield* repository.requirePullRequestById(
      comment.pullRequestId
    )

    const target: GitHubCommentTarget = {
      commentNumericId,
      owner: pullRequest.repositoryOwner,
      repo: pullRequest.repositoryName
    }

    const data = isReviewComment(comment)
      ? yield* patchReviewComment(gitHub, input.token, target, input.body)
      : yield* patchIssueComment(gitHub, input.token, target, input.body)

    const updated: Comment = {
      ...comment,
      body: normalizeCommentBody(data.body ?? input.body),
      bodyHtml: data.body_html ?? null,
      gitHubUpdatedAt: data.updated_at,
      syncedAt: new Date().toISOString()
    }

    yield* database.use('updateComment.update', (db) => {
      db.update(comments)
        .set({
          body: updated.body,
          bodyHtml: updated.bodyHtml,
          gitHubUpdatedAt: updated.gitHubUpdatedAt,
          syncedAt: updated.syncedAt
        })
        .where(eq(comments.id, comment.id))
        .run()
    })

    return updated
  })
