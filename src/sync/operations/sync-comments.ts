import { Effect, Option } from 'effect'
import { eq, isNull } from 'drizzle-orm'

import { comments, type NewComment } from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import {
  IssueCommentsResponseSchema,
  ReactionsResponseSchema,
  type IssueComment,
  type Reaction
} from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { paginateRest } from '../shared/paginate'
import {
  reconcileBySoftDelete,
  reconcileCommentReactions
} from '../shared/reconcile'
import { generateId, normalizeCommentBody } from '../shared/utils'

export interface SyncCommentsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const buildIssueComment = (
  commentData: IssueComment,
  commentId: string,
  pullRequestId: string,
  now: string
): NewComment => ({
  id: commentId,
  gitHubId: commentData.node_id,
  gitHubNumericId: commentData.id,
  pullRequestId,
  reviewId: null,
  body: normalizeCommentBody(commentData.body),
  bodyHtml: commentData.body_html ?? null,
  path: null,
  line: null,
  originalLine: null,
  diffHunk: null,
  commitId: null,
  originalCommitId: null,
  gitHubReviewId: null,
  gitHubReviewThreadId: null,
  parentCommentGitHubId: null,
  userLogin: commentData.user?.login ?? null,
  userAvatarUrl: commentData.user?.avatar_url ?? null,
  url: commentData.html_url,
  gitHubCreatedAt: commentData.created_at,
  gitHubUpdatedAt: commentData.updated_at,
  syncedAt: now,
  deletedAt: null
})

const fetchReactions = (params: SyncCommentsParams, commentNumericId: number) =>
  paginateRest(
    'GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions',
    {
      owner: params.owner,
      repo: params.repositoryName,
      comment_id: commentNumericId
    },
    ReactionsResponseSchema
  ).pipe(
    Effect.mapError(
      (cause) =>
        new SyncDetailFailedError({
          operation: 'issue_comment_reactions',
          pullRequestId: params.pullRequestId,
          cause
        }) as SyncError
    ),
    Effect.map((result) =>
      Option.isNone(result) ? [] : (result.value as ReadonlyArray<Reaction>)
    )
  )

export const syncComments = (
  params: SyncCommentsParams
): Effect.Effect<void, SyncError, Database | GitHubRest> =>
  Effect.gen(function* () {
    const database = yield* Database

    const result = yield* paginateRest(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: params.owner,
        repo: params.repositoryName,
        issue_number: params.pullNumber
      },
      IssueCommentsResponseSchema,
      {
        etagKey: {
          endpointType: 'issue_comments',
          resourceId: params.pullRequestId
        }
      }
    ).pipe(
      Effect.mapError(
        (cause) =>
          new SyncDetailFailedError({
            operation: 'issue_comments',
            pullRequestId: params.pullRequestId,
            cause
          }) as SyncError
      )
    )

    if (Option.isNone(result)) {
      return
    }

    const commentsData = result.value as ReadonlyArray<IssueComment>
    const now = new Date().toISOString()

    const commentEntries = yield* database.use('syncComments.upsert', (db) =>
      reconcileBySoftDelete(db, comments, {
        // Issue comments only — review comments (path set) are owned by syncReviews.
        scope: [
          eq(comments.pullRequestId, params.pullRequestId),
          isNull(comments.path)
        ],
        items: commentsData,
        keyOfItem: (comment) => comment.node_id,
        keyOfRow: (row) => row.gitHubId,
        build: (comment, existingId) =>
          buildIssueComment(
            comment,
            existingId ?? generateId(),
            params.pullRequestId,
            now
          ),
        now
      })
    )

    for (const entry of commentEntries) {
      // Always reconcile reactions against the server, even when total_count is
      // zero — otherwise removed reactions stay around locally forever.
      const reactionsData =
        entry.item.reactions && entry.item.reactions.total_count > 0
          ? yield* fetchReactions(params, entry.item.id)
          : ([] as ReadonlyArray<Reaction>)

      yield* database.use('syncComments.reactions', (db) => {
        reconcileCommentReactions(db, {
          commentId: entry.id,
          pullRequestId: params.pullRequestId,
          reactions: reactionsData,
          now
        })
      })
    }
  })
